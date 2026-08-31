import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Megaphone, 
  AlertCircle, 
  Search,
  Check,
  X,
  ExternalLink,
  Calendar,
  DollarSign,
  Trash2
} from 'lucide-react';
import { getLocalAds, isTableMissingError, saveLocalAd } from '../../lib/localFallbackStore';

export default function AdminAdsPage() {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAds = async () => {
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && isTableMissingError(error)) {
        const local = getLocalAds().map((a: any) => ({
          id: a.id,
          ownerId: a.owner_id || a.ownerId || '',
          title: a.title || 'Sponsored Ad',
          targetUrl: a.target_url || a.targetUrl || '',
          imageUrl: a.image_url || a.imageUrl || '',
          status: a.status || 'pending',
          planDays: a.plan_days || a.duration_days || a.planDays || 3,
          paidAmount: Number(a.paid_amount || a.price_paid || a.paidAmount || 0),
          createdAt: a.created_at || a.createdAt,
          expiresAt: a.expires_at || a.expiresAt
        }));
        setAds(local);
        setLoading(false);
        return;
      }

      const adList: any[] = (data || []).map((a: any) => ({
        id: a.id,
        ownerId: a.owner_id || a.ownerId || '',
        title: a.title || 'Sponsored Ad',
        targetUrl: a.target_url || a.targetUrl || '',
        imageUrl: a.image_url || a.imageUrl || '',
        status: a.status || 'pending',
        planDays: a.plan_days || a.duration_days || a.planDays || 3,
        paidAmount: Number(a.paid_amount || a.price_paid || a.paidAmount || 0),
        createdAt: a.created_at || a.createdAt,
        expiresAt: a.expires_at || a.expiresAt
      }));

      setAds(adList);
      setLoading(false);

      // Fetch advertiser emails
      try {
        const ownerIds = Array.from(new Set(adList.map(a => a.ownerId).filter(Boolean)));
        if (ownerIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, email')
            .in('id', ownerIds);

          if (usersData) {
            const emailMap: Record<string, string> = {};
            usersData.forEach((u: any) => {
              emailMap[u.id] = u.email;
            });
            setUserEmails(prev => ({ ...prev, ...emailMap }));
          }
        }
      } catch (emailErr) {
        console.warn('Silent note: advertiser email lookup deferred', emailErr);
      }
    } catch (err: any) {
      console.warn('Error fetching ads, falling back:', err);
      const local = getLocalAds().map((a: any) => ({
        id: a.id,
        ownerId: a.owner_id || a.ownerId || '',
        title: a.title || 'Sponsored Ad',
        targetUrl: a.target_url || a.targetUrl || '',
        imageUrl: a.image_url || a.imageUrl || '',
        status: a.status || 'pending',
        planDays: a.plan_days || a.duration_days || a.planDays || 3,
        paidAmount: Number(a.paid_amount || a.price_paid || a.paidAmount || 0),
        createdAt: a.created_at || a.createdAt,
        expiresAt: a.expires_at || a.expiresAt
      }));
      setAds(local);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const handleApproveAd = async (adId: string) => {
    try {
      setActionLoading(adId);
      setStatusMessage(null);

      const { error } = await supabase
        .from('ads')
        .update({ status: 'active' })
        .eq('id', adId);

      if (error && isTableMissingError(error)) {
        // Fallback local update
        const localAds = getLocalAds();
        const updated = localAds.map((a: any) => {
          if (a.id === adId) {
            return { ...a, status: 'active' };
          }
          return a;
        });
        localStorage.setItem('iz_fallback_ads', JSON.stringify(updated));
        setStatusMessage({ type: 'success', text: 'Advertisement approved successfully (Offline Mode).' });
        fetchAds();
        return;
      }

      if (error) throw error;

      setStatusMessage({ type: 'success', text: 'Advertisement approved and is now Live!' });
      fetchAds();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to approve advertisement.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectAd = async (ad: any) => {
    try {
      setActionLoading(ad.id);
      setStatusMessage(null);

      // Refund the user's deposit balance
      const { data: userData, error: userFetchErr } = await supabase
        .from('users')
        .select('deposit_balance')
        .eq('id', ad.ownerId)
        .single();

      if (!userFetchErr && userData) {
        const currentBalance = Number(userData.deposit_balance || 0);
        await supabase
          .from('users')
          .update({ deposit_balance: currentBalance + Number(ad.paidAmount) })
          .eq('id', ad.ownerId);
      }

      const { error } = await supabase
        .from('ads')
        .update({ status: 'expired' }) // mark as expired / rejected
        .eq('id', ad.id);

      if (error && isTableMissingError(error)) {
        // Local refund fallback
        const cachedUsers = localStorage.getItem('iz_fallback_users');
        if (cachedUsers) {
          const list = JSON.parse(cachedUsers);
          const updated = list.map((u: any) => {
            if (u.id === ad.ownerId) {
              return { ...u, deposit_balance: Number(u.deposit_balance || 0) + Number(ad.paidAmount) };
            }
            return u;
          });
          localStorage.setItem('iz_fallback_users', JSON.stringify(updated));
        }

        const localAds = getLocalAds();
        const updatedAds = localAds.map((a: any) => {
          if (a.id === ad.id) {
            return { ...a, status: 'expired' };
          }
          return a;
        });
        localStorage.setItem('iz_fallback_ads', JSON.stringify(updatedAds));

        setStatusMessage({ type: 'success', text: 'Advertisement rejected and funds refunded (Offline Mode).' });
        fetchAds();
        return;
      }

      if (error) throw error;

      setStatusMessage({ type: 'success', text: `Advertisement rejected and $${Number(ad.paidAmount).toFixed(2)} refunded successfully!` });
      fetchAds();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reject advertisement.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAd = async (adId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete ad campaign "${title}"?`)) return;
    try {
      setActionLoading(adId);
      const { error } = await supabase.from('ads').delete().eq('id', adId);
      
      if (error && isTableMissingError(error)) {
        const local = getLocalAds().filter((a: any) => a.id !== adId);
        localStorage.setItem('iz_fallback_ads', JSON.stringify(local));
      } else {
        const local = getLocalAds().filter((a: any) => a.id !== adId);
        localStorage.setItem('iz_fallback_ads', JSON.stringify(local));
      }

      setStatusMessage({ type: 'success', text: `Ad "${title}" deleted permanently.` });
      fetchAds();
    } catch (err: any) {
      console.error('Delete ad error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to delete advertisement.' });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAds = ads.filter(a => {
    const matchesSearch = 
      (a.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.targetUrl || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (userEmails[a.ownerId] || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'pending') return a.status === 'pending';
    if (activeTab === 'active') return a.status === 'active';
    return true; // 'all'
  });

  const pendingAds = ads.filter(a => a.status === 'pending');
  const activeAds = ads.filter(a => a.status === 'active');

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-[#0a0718] min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-purple-600 dark:text-amber-400" />
            Ad Campaign Approvals
          </h1>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">
            Review user-submitted banner ad campaigns, verify targeted links, and manage active slots.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-purple-200">Pending:</span>
            <span className="text-base font-black text-amber-600 dark:text-amber-400">{pendingAds.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-purple-200">Active Ads:</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{activeAds.length}</span>
          </div>
        </div>
      </div>

      {/* Notification Toast Banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200' 
            : 'bg-red-50 dark:bg-red-950/70 border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-200'
        }`}>
          {statusMessage.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          <p className="text-sm font-bold">{statusMessage.text}</p>
        </div>
      )}

      {/* Controls Bar: Tabs & Search */}
      <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-lg">
        {/* Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-purple-500/20'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending ({pendingAds.length})
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'active'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-purple-500/20'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Live Ads ({activeAds.length})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-purple-500/20'
            }`}
          >
            All Campaigns ({ads.length})
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search campaigns, link, user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Campaigns Listing */}
      {filteredAds.length === 0 ? (
        <div className="bg-white dark:bg-[#130b2c]/40 border border-slate-200 dark:border-purple-500/10 rounded-2xl p-12 text-center">
          <Megaphone className="w-10 h-10 text-slate-300 dark:text-purple-400/30 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-purple-300/50">No campaigns found matching selection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAds.map((ad) => (
            <div 
              key={ad.id} 
              className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl flex flex-col hover:border-purple-300 dark:hover:border-amber-400/40 transition-all duration-300"
            >
              {/* Ad Image / Preview */}
              {ad.imageUrl ? (
                <div className="h-44 w-full relative overflow-hidden bg-slate-50 dark:bg-purple-950/20 border-b border-slate-100 dark:border-purple-500/10">
                  <img 
                    src={ad.imageUrl} 
                    alt={ad.title} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <span className={`absolute top-3 right-3 text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                    ad.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-400 dark:text-slate-950' :
                    ad.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500 dark:text-slate-950' : 'bg-red-100 text-red-800 dark:bg-red-500 dark:text-white'
                  }`}>
                    {ad.status}
                  </span>
                </div>
              ) : (
                <div className="h-44 w-full bg-slate-50 dark:bg-[#180d38] border-b border-slate-100 dark:border-purple-500/10 flex flex-col items-center justify-center p-6 relative">
                  <Megaphone className="w-10 h-10 text-slate-300 dark:text-purple-500/30 mb-2" />
                  <span className="text-slate-500 dark:text-purple-400/50 text-xs font-bold text-center">No image provided</span>
                  <span className={`absolute top-3 right-3 text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                    ad.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-400 dark:text-slate-950' :
                    ad.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500 dark:text-slate-950' : 'bg-red-100 text-red-800 dark:bg-red-500 dark:text-white'
                  }`}>
                    {ad.status}
                  </span>
                </div>
              )}

              {/* Content info */}
              <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug line-clamp-2">{ad.title}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-purple-300">
                    <span className="font-bold text-slate-500 dark:text-purple-300/60">Advertiser:</span>
                    <span className="font-semibold text-purple-700 dark:text-amber-300 truncate max-w-[200px]" title={userEmails[ad.ownerId] || ad.ownerId}>
                      {userEmails[ad.ownerId] || ad.ownerId || 'Anonymous'}
                    </span>
                  </div>
                  
                  {/* Target URL */}
                  <a 
                    href={ad.targetUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-amber-400 hover:underline font-bold"
                  >
                    Target Link
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Campaign specifics */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-purple-500/10 text-xs font-bold">
                  <div className="space-y-1">
                    <span className="text-slate-500 dark:text-purple-300/50 block">Tier / Days:</span>
                    <span className="text-slate-700 dark:text-purple-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                      {ad.planDays} Days
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500 dark:text-purple-300/50 block">Amount Paid:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      ${Number(ad.paidAmount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Approvals Action Buttons */}
                {ad.status === 'pending' && (
                  <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-purple-500/10">
                    <button
                      onClick={() => handleRejectAd(ad)}
                      disabled={actionLoading === ad.id}
                      className="flex-1 px-4 py-2.5 bg-red-50 hover:bg-red-600 dark:bg-red-500/10 dark:hover:bg-red-500 text-red-700 hover:text-white dark:text-red-400 dark:hover:text-white border border-red-200 dark:border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject & Refund
                    </button>
                    <button
                      onClick={() => handleApproveAd(ad.id)}
                      disabled={actionLoading === ad.id}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 hover:bg-emerald-700 dark:hover:bg-emerald-400 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Approve & Go Live
                    </button>
                  </div>
                )}

                {ad.status === 'active' && (
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => handleRejectAd(ad)}
                      disabled={actionLoading === ad.id}
                      className="flex-1 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Terminate & Refund
                    </button>
                    <button
                      onClick={() => handleDeleteAd(ad.id, ad.title)}
                      disabled={actionLoading === ad.id}
                      title="Delete Ad"
                      className="px-3 py-2.5 bg-red-50 hover:bg-red-600 dark:bg-red-500/10 dark:hover:bg-red-500 text-red-700 hover:text-white dark:text-red-400 dark:hover:text-white border border-red-200 dark:border-red-500/30 rounded-xl text-xs font-bold transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {ad.status !== 'pending' && ad.status !== 'active' && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleDeleteAd(ad.id, ad.title)}
                      disabled={actionLoading === ad.id}
                      title="Delete Ad"
                      className="px-3 py-2 bg-red-50 hover:bg-red-600 dark:bg-red-500/10 dark:hover:bg-red-500 text-red-700 hover:text-white dark:text-red-400 dark:hover:text-white border border-red-200 dark:border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Ad
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
