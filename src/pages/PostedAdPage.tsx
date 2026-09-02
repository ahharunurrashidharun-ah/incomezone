import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getLocalAds, isTableMissingError } from '../lib/localFallbackStore';
import { Trash2, RefreshCw, ExternalLink, Megaphone, CheckCircle2, XCircle, CreditCard, Clock } from 'lucide-react';

interface Ad {
  adId: string;
  title: string;
  imageUrl: string;
  targetUrl: string;
  planDays: number;
  paidAmount: number;
  createdAt: any;
  expiresAt: any;
  status?: string;
}

const PLANS = [
  { id: '1-day', days: 1, price: 1, label: '1 Day' },
  { id: '3-days', days: 3, price: 2, label: '3 Days' },
  { id: '5-days', days: 5, price: 3, label: '5 Days' },
  { id: '7-days', days: 7, price: 4, label: '7 Days' },
  { id: '10-days', days: 10, price: 5, label: '10 Days' },
  { id: '20-days', days: 20, price: 8, label: '20 Days' },
  { id: '30-days', days: 30, price: 10, label: '30 Days' },
  { id: '365-days', days: 365, price: 100, label: '1 Year' },
];

export default function PostedAdPage() {
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Renew Modal State
  const [renewAd, setRenewAd] = useState<Ad | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('1-day');
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewError, setRenewError] = useState('');

  const fetchAds = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .eq('owner_id', user.uid)
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          const local = getLocalAds().filter((a: any) => a.owner_id === user.uid || (a as any).ownerId === user.uid);
          setAds(local.map((d: any) => ({
            adId: d.id || (d as any).adId,
            title: d.title || 'Sponsored Ad',
            imageUrl: d.image_url || (d as any).imageUrl || '',
            targetUrl: d.target_url || (d as any).targetUrl || '#',
            planDays: Number((d as any).plan_days || (d as any).planDays || (d as any).duration_days || 0),
            paidAmount: Number((d as any).paid_amount || (d as any).paidAmount || (d as any).price_paid || 0),
            createdAt: d.created_at || (d as any).createdAt,
            expiresAt: d.expires_at || (d as any).expiresAt,
            status: d.status,
          })));
          return;
        }
        throw error;
      }

      const fetchedAds: Ad[] = (data || []).map((d: any) => ({
        adId: d.id || d.adId,
        title: d.title || 'Sponsored Ad',
        imageUrl: d.image_url || d.imageUrl || '',
        targetUrl: d.target_url || d.targetUrl || '#',
        planDays: Number(d.plan_days || d.planDays || 0),
        paidAmount: Number(d.paid_amount || d.paidAmount || 0),
        createdAt: d.created_at || d.createdAt,
        expiresAt: d.expires_at || d.expiresAt,
        status: d.status,
      }));

      setAds(fetchedAds);
    } catch (err) {
      console.warn('Network issue fetching ads, using local cache:', err);
      const local = getLocalAds().filter((a: any) => a.owner_id === user.uid || (a as any).ownerId === user.uid);
      setAds(local.map((d: any) => ({
        adId: d.id || (d as any).adId,
        title: d.title || 'Sponsored Ad',
        imageUrl: d.image_url || (d as any).imageUrl || '',
        targetUrl: d.target_url || (d as any).targetUrl || '#',
        planDays: Number((d as any).plan_days || (d as any).planDays || (d as any).duration_days || 0),
        paidAmount: Number((d as any).paid_amount || (d as any).paidAmount || (d as any).price_paid || 0),
        createdAt: d.created_at || (d as any).createdAt,
        expiresAt: d.expires_at || (d as any).expiresAt,
        status: d.status,
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [user]);

  const handleDelete = async (ad: Ad) => {
    if (!window.confirm('Are you sure you want to delete this ad permanently?')) return;
    
    try {
      const { error } = await supabase
        .from('ads')
        .delete()
        .eq('id', ad.adId);

      if (error) throw error;
      
      // Remove from state
      setAds(ads.filter(a => a.adId !== ad.adId));
    } catch (err) {
      console.error('Error deleting ad:', err);
      alert('Failed to delete the ad.');
    }
  };

  const handleRenew = async () => {
    if (!renewAd || !user) return;
    setRenewError('');
    setRenewLoading(true);

    const plan = PLANS.find(p => p.id === selectedPlanId)!;

    try {
      // 1. Check user deposit balance
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('deposit_balance')
        .eq('id', user.uid)
        .maybeSingle();

      if (userError || !userData) {
        throw new Error('User account not found.');
      }

      const balance = Number(userData.deposit_balance ?? 0);
      if (balance < plan.price) {
        throw new Error('Insufficient deposit balance. Please deposit funds first.');
      }

      // 2. Deduct user deposit balance
      const newDepositBalance = balance - plan.price;
      const { error: deductError } = await supabase
        .from('users')
        .update({
          deposit_balance: newDepositBalance,
        })
        .eq('id', user.uid);

      if (deductError) throw deductError;

      // 3. Calculate new expiry
      const currentExpires = renewAd.expiresAt ? new Date(renewAd.expiresAt) : new Date();
      const now = new Date();
      let newExpiresAt: Date;
      if (currentExpires < now) {
        newExpiresAt = new Date(now.getTime() + plan.days * 24 * 60 * 60 * 1000);
      } else {
        newExpiresAt = new Date(currentExpires.getTime() + plan.days * 24 * 60 * 60 * 1000);
      }

      // 4. Update ad
      const { error: adUpdateError } = await supabase
        .from('ads')
        .update({
          expires_at: newExpiresAt.toISOString(),
          status: 'active'
        })
        .eq('id', renewAd.adId);

      if (adUpdateError) throw adUpdateError;

      // Refresh list
      await fetchAds();
      setRenewAd(null); // Close modal

    } catch (err: any) {
      console.error('Error renewing ad:', err);
      setRenewError(err.message || 'Failed to renew ad.');
    } finally {
      setRenewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Posted Ads</h1>
        <p className="text-slate-500 dark:text-purple-300/60 text-sm mt-1 font-bold">Manage your active and expired advertisement campaigns.</p>
      </div>

      {ads.length === 0 ? (
        <div className="bg-white dark:bg-[#130b2c]/60 dark:backdrop-blur-md rounded-[2rem] border border-slate-200 dark:border-purple-500/20 shadow-sm dark:shadow-lg dark:shadow-purple-900/20 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-6 border border-purple-200 dark:border-purple-500/20">
            <Megaphone className="w-10 h-10 text-purple-600 dark:text-purple-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Ads Posted Yet</h3>
          <p className="text-slate-500 dark:text-purple-300/60 max-w-sm mb-8 font-bold">
            You don't have any active campaigns. Create one now to drive traffic to your link!
          </p>
          <a
            href="/post-ad"
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-bold rounded-full shadow-md shadow-purple-600/20 dark:shadow-lg dark:shadow-amber-500/30 text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-500 dark:to-yellow-600 dark:hover:from-amber-600 dark:hover:to-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-amber-400 transition-all hover:scale-[1.02] active:scale-95"
          >
            Post an Ad
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ads.map((ad) => {
            const isExpired = ad.expiresAt ? new Date(ad.expiresAt) < new Date() : false;
            
            return (
              <div key={ad.adId} className="bg-white dark:bg-[#130b2c]/60 dark:backdrop-blur-md rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 border border-slate-200 dark:border-purple-500/20 overflow-hidden flex flex-col transition-all hover:shadow-md hover:border-purple-300 dark:hover:shadow-lg dark:hover:shadow-purple-900/5 hover:-translate-y-0.5">
                <div className="h-40 w-full relative bg-slate-100 dark:bg-purple-900/20">
                  <img src={ad.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60'} alt={ad.title || 'Ad Image'} className="w-full h-full object-cover" />
                  <div className="absolute top-3 right-3">
                    {ad.status === 'pending' ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 shadow-sm dark:shadow-lg border border-amber-200 dark:border-amber-500/30">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        Pending
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 shadow-sm dark:shadow-lg border border-red-200 dark:border-red-500/30">
                        <XCircle className="w-3.5 h-3.5 mr-1.5" />
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm dark:shadow-lg border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Active
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-5 flex-grow flex flex-col">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 truncate">{ad.title || 'Untitled Ad'}</h3>
                  <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-purple-600 hover:text-purple-700 dark:text-amber-400 dark:hover:text-amber-300 flex items-center mb-4 truncate">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    {ad.targetUrl}
                  </a>
                  
                  <div className="mt-auto pt-4 border-t border-slate-200 dark:border-purple-500/20 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-500 dark:text-purple-300/60">
                      Expires: <span className="font-black text-slate-900 dark:text-white">{ad.expiresAt ? new Date(ad.expiresAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleDelete(ad)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:text-purple-300/40 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30"
                        title="Delete Ad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setRenewAd(ad)}
                        className="p-2 text-purple-600 hover:bg-purple-50 dark:text-amber-400 dark:hover:bg-purple-900/20 rounded-xl transition-colors flex items-center text-sm font-bold border border-transparent hover:border-purple-200 dark:hover:border-purple-500/30"
                      >
                        <RefreshCw className="w-4 h-4 mr-1.5" />
                        Renew
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Renew Modal */}
      {renewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-[#080412]/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#130b2c]/90 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/30 rounded-[2rem] shadow-2xl max-w-md w-full p-6 sm:p-8 overflow-hidden relative">
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Renew Advertisement</h3>
            <p className="text-slate-500 dark:text-purple-300/60 text-sm font-bold mb-6">Select a plan to extend the duration of your ad campaign.</p>
            
            {renewError && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-bold border border-red-200 dark:border-red-500/30">
                {renewError}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6 max-h-60 overflow-y-auto pr-1 hardware-accelerate">
              {PLANS.map((plan) => (
                <div 
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative cursor-pointer rounded-xl border p-3 flex flex-col justify-between transition-all ${
                    selectedPlanId === plan.id 
                      ? 'border-purple-600 bg-purple-50 shadow-sm ring-1 ring-purple-600/50 dark:border-amber-400 dark:bg-[#1e1242] dark:shadow-md dark:shadow-amber-500/20 dark:ring-amber-400/50' 
                      : 'border-slate-200 bg-slate-50 hover:border-purple-300 dark:border-purple-500/20 dark:bg-[#0a0718] dark:hover:border-purple-400/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{plan.label || `${plan.days} Days`}</span>
                    {selectedPlanId === plan.id ? (
                      <span className="h-3 w-3 bg-purple-600 dark:bg-amber-400 rounded-full"></span>
                    ) : (
                      <span className="h-3 w-3 border border-slate-300 dark:border-purple-500/40 rounded-full"></span>
                    )}
                  </div>
                  <span className="text-base font-black text-purple-600 dark:text-amber-400 mt-2">${plan.price}</span>
                </div>
              ))}
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setRenewAd(null)}
                disabled={renewLoading}
                className="flex-1 py-3.5 px-4 rounded-xl border border-slate-200 dark:border-purple-500/30 text-slate-600 dark:text-purple-200 font-bold hover:bg-slate-50 dark:hover:bg-transparent hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenew}
                disabled={renewLoading}
                className="flex-1 py-3.5 px-4 rounded-xl bg-purple-600 text-white hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-500 dark:to-yellow-600 dark:text-slate-950 font-bold dark:hover:from-amber-600 dark:hover:to-yellow-700 transition-all shadow-md shadow-purple-600/20 dark:shadow-lg dark:shadow-amber-500/30 disabled:opacity-50 flex items-center justify-center hover:scale-[1.02] active:scale-95 disabled:hover:scale-100"
              >
                {renewLoading ? 'Processing...' : 'Pay & Renew'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
