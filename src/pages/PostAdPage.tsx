import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, toValidUUID } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';
import { compressImage } from '../lib/imageCompression';
import { 
  ImagePlus, 
  Link as LinkIcon, 
  Type, 
  CreditCard, 
  ArrowRight, 
  AlertCircle,
  Megaphone
} from 'lucide-react';

interface AdPlan {
  id: string;
  days: number;
  price: number;
  label?: string;
}

const AD_PLANS: AdPlan[] = [
  { id: '1-day', days: 1, price: 1, label: '1 Day' },
  { id: '3-days', days: 3, price: 2, label: '3 Days' },
  { id: '5-days', days: 5, price: 3, label: '5 Days' },
  { id: '7-days', days: 7, price: 4, label: '7 Days' },
  { id: '10-days', days: 10, price: 5, label: '10 Days' },
  { id: '20-days', days: 20, price: 8, label: '20 Days' },
  { id: '30-days', days: 30, price: 10, label: '30 Days' },
  { id: '365-days', days: 365, price: 100, label: '1 Year' },
];

export default function PostAdPage() {
  const { user, refreshProfile, updateBalances } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('3-days');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedPlan = AD_PLANS.find(p => p.id === selectedPlanId) || AD_PLANS[0];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      const msg = 'You must be logged in to post an ad.';
      setError(msg);
      alert(msg);
      return;
    }

    if (!targetUrl.trim()) {
      const msg = 'Target destination URL is required.';
      setError(msg);
      alert(msg);
      return;
    }

    setLoading(true);

    try {
      // 1. Verify user's deposit balance from Supabase with fallback to auth context & local store
      const userUuid = toValidUUID(user.uid);
      let currentBalance = Number(user.depositBalance ?? 0);
      
      const { data: userData } = await supabase
        .from('users')
        .select('deposit_balance')
        .eq('id', userUuid)
        .maybeSingle();

      if (userData) {
        currentBalance = Number(userData.deposit_balance ?? currentBalance);
      } else {
        // Self-healing: create profile in Supabase if missing
        const isAdmin = checkIsAdmin(user);
        currentBalance = currentBalance || (isAdmin ? 1000 : 50);
        try {
          await supabase.from('users').upsert({
            id: userUuid,
            email: user.email || '',
            name: user.name || '',
            username: user.username || '',
            deposit_balance: currentBalance,
            earning_balance: user.earningBalance || (isAdmin ? 500 : 25),
            role: user.role || (isAdmin ? 'admin' : 'user'),
            is_locked: false
          });
        } catch {}
      }

      if (currentBalance < selectedPlan.price) {
        const msg = `Insufficient Deposit Balance. Your balance is $${currentBalance.toFixed(2)}, but this plan requires $${selectedPlan.price.toFixed(2)}.`;
        setError(msg);
        alert(msg);
        return;
      }

      // 2. Upload image to Supabase Storage 'uploads' bucket with preview fallback
      let imageUrl = '';
      if (image) {
        try {
          const compressedFile = await compressImage(image, 1080, 0.6);
          const fileExt = compressedFile.name.split('.').pop() || 'jpg';
          const fileName = `${user.uid}/ads/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const { error: uploadError, data } = await supabase.storage
            .from('uploads')
            .upload(fileName, compressedFile);

          if (!uploadError && data) {
            const { data: publicUrlData } = supabase.storage
              .from('uploads')
              .getPublicUrl(data.path);
            imageUrl = publicUrlData.publicUrl;
          } else {
            if (imagePreview) imageUrl = imagePreview;
          }
        } catch {
          if (imagePreview) imageUrl = imagePreview;
        }
      } else if (imagePreview) {
        imageUrl = imagePreview;
      }

      // 3. Decrement user deposit_balance
      const newDepositBalance = Math.max(0, currentBalance - selectedPlan.price);
      
      // Update in Supabase
      const { error: updateError } = await supabase
        .from('users')
        .update({ deposit_balance: newDepositBalance })
        .eq('id', userUuid);
        
      if (updateError) {
        throw updateError;
      }

      // Update in Auth Context
      if (updateBalances) {
        updateBalances(-selectedPlan.price, 0);
      }

      // 4. Create Ad in 'ads' table strictly with snake_case columns
      const now = new Date();
      const expiresAt = new Date(now.getTime() + selectedPlan.days * 24 * 60 * 60 * 1000);
      const targetFormatted = targetUrl.trim().startsWith('http') 
        ? targetUrl.trim() 
        : `https://${targetUrl.trim()}`;

      const adPayload = {
        title: title.trim() || 'Sponsored Ad',
        target_url: targetFormatted,
        image_url: imageUrl || '',
        owner_id: userUuid,
        expires_at: expiresAt.toISOString(),
        status: 'pending'
      };

      const { error: adError } = await supabase
        .from('ads')
        .insert(adPayload);

      if (adError) {
        throw adError;
      }

      if (refreshProfile) await refreshProfile();

      // 5. Success alert & redirection
      alert('Ad submitted successfully! It will go live after Admin approval.');
      navigate('/posted-ads');

    } catch (err: any) {
      console.error('Error publishing ad:', err);
      setError(err.message || 'Failed to submit ad. Please try again.');
    } finally {
      // Guarantee loading state is always reset to prevent stuck button
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 sm:pb-28 hardware-accelerate">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <Megaphone className="w-7 h-7 text-purple-600 dark:text-amber-400" />
          Post Advertisement
        </h1>
        <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">
          Promote your links, websites, and offers directly on the Available Missions page.
        </p>
      </div>

      <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/25 rounded-2xl shadow-sm dark:shadow-xl dark:shadow-black/50 p-6 sm:p-8">
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300 p-4 rounded-xl text-sm font-bold border border-red-200 dark:border-red-500/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p>{error}</p>
            </div>
            {error.includes("Insufficient") && (
              <button
                type="button"
                onClick={() => {
                  updateBalances(50, 0);
                  setError('');
                }}
                className="px-4 py-2 bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 hover:bg-purple-700 dark:hover:from-amber-300 dark:hover:to-yellow-400 text-white dark:text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md flex-shrink-0"
              >
                + Add $50.00 Test Balance
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Ad Image Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-2">
              Ad Banner / Thumbnail Image
            </label>
            <div className="border-2 border-slate-300 dark:border-purple-500/30 border-dashed rounded-xl p-6 hover:border-purple-500 dark:hover:border-amber-400/50 transition-colors bg-slate-50 dark:bg-[#0a0718]/60 relative group">
              <div className="space-y-2 text-center">
                {imagePreview ? (
                  <div className="mb-3">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="mx-auto h-40 max-w-full object-cover rounded-xl border border-slate-200 dark:border-purple-500/40 shadow-sm dark:shadow-lg" 
                    />
                  </div>
                ) : (
                  <ImagePlus className="mx-auto h-10 w-10 text-slate-400 dark:text-purple-400/50 group-hover:text-purple-500 dark:group-hover:text-amber-400 transition-colors" />
                )}
                
                <div className="flex text-sm text-slate-600 dark:text-purple-200 justify-center">
                  <label 
                    htmlFor="ad-file-upload" 
                    className="relative cursor-pointer bg-white dark:bg-[#180d38] hover:bg-slate-100 dark:hover:bg-[#231350] border border-slate-300 dark:border-amber-400/40 rounded-xl font-bold text-purple-600 dark:text-amber-400 px-4 py-2 text-xs shadow-sm dark:shadow-md transition-all cursor-pointer"
                  >
                    <span>{imagePreview ? 'Change Banner Image' : 'Choose Banner Image'}</span>
                    <input 
                      id="ad-file-upload" 
                      name="ad-file-upload" 
                      type="file" 
                      className="sr-only" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                    />
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-purple-300/60 font-medium">PNG, JPG, WEBP, GIF up to 5MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Target URL */}
            <div>
              <label htmlFor="targetUrl" className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-2">
                Target URL <span className="text-purple-600 dark:text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <LinkIcon className="h-4 w-4 text-slate-400 dark:text-purple-400" />
                </div>
                <input
                  type="url"
                  id="targetUrl"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://yourwebsite.com/offer"
                  className="pl-10 appearance-none block w-full px-4 py-3 bg-white dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-amber-400 transition-all"
                />
              </div>
            </div>

            {/* Ad Title */}
            <div>
              <label htmlFor="title" className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-2">
                Ad Headline / Title <span className="text-slate-400 dark:text-purple-400/60 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Type className="h-4 w-4 text-slate-400 dark:text-purple-400" />
                </div>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Join the Telegram Community & Earn"
                  className="pl-10 appearance-none block w-full px-4 py-3 bg-white dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-amber-400 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Pricing Plans Grid (Including 1 Year Plan) */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider">
                Select Pricing Plan
              </label>
              <span className="text-xs text-purple-600 dark:text-amber-400/90 font-medium">Auto-activated on payment</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {AD_PLANS.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <div 
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative cursor-pointer rounded-xl p-4 transition-all duration-200 flex flex-col justify-between gap-2 border ${
                      isSelected 
                        ? 'border-purple-600 bg-purple-50 shadow-md ring-1 ring-purple-600/50 scale-[1.02] dark:border-amber-400 dark:bg-[#1e1242] dark:shadow-lg dark:shadow-amber-500/20 dark:ring-amber-400/50' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-purple-500/25 dark:bg-[#0a0718]/80 dark:hover:border-purple-400/50 dark:hover:bg-[#180d38]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold tracking-wide ${isSelected ? 'text-purple-700 dark:text-white' : 'text-slate-700 dark:text-white'}`}>
                        {plan.label || `${plan.days} Days`}
                      </span>
                      {isSelected ? (
                        <span className="h-4 w-4 bg-purple-600 dark:bg-amber-400 rounded-full flex items-center justify-center">
                          <span className="h-1.5 w-1.5 bg-white dark:bg-slate-950 rounded-full"></span>
                        </span>
                      ) : (
                        <span className="h-4 w-4 border border-slate-300 dark:border-purple-500/40 rounded-full"></span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`text-xl font-black ${isSelected ? 'text-purple-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
                        ${plan.price}
                      </span>
                      <span className={`text-[10px] font-medium ${isSelected ? 'text-purple-600/80 dark:text-purple-400/80' : 'text-slate-500 dark:text-purple-400/80'}`}>
                        ${(plan.price / plan.days).toFixed(2)}/day
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Checkout & Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-purple-900/50">
            <div className="flex items-center justify-between mb-5 bg-slate-50 dark:bg-[#0a0718] p-4 rounded-xl border border-slate-200 dark:border-purple-500/20">
              <div>
                <span className="text-xs text-slate-500 dark:text-purple-300/80 font-bold block uppercase tracking-wider">Total Deduction</span>
                <span className="text-xs text-slate-600 dark:text-purple-400 font-medium">Deducted from Deposit Balance</span>
              </div>
              <span className="text-2xl font-black text-purple-600 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">
                ${selectedPlan.price.toFixed(2)}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-4 px-6 rounded-xl font-bold text-sm text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:via-yellow-400 dark:to-amber-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 shadow-md shadow-purple-600/20 dark:shadow-xl dark:shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-95 gap-2"
            >
              <CreditCard className="w-5 h-5" />
              {loading ? 'Processing & Publishing...' : `Pay $${selectedPlan.price.toFixed(2)} & Publish Ad`}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
