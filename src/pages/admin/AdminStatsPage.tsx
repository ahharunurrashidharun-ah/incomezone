import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { 
  Users, 
  Briefcase, 
  FileText, 
  Megaphone, 
  Wallet, 
  Banknote, 
  Clock, 
  ShieldAlert, 
  ArrowRight,
  CheckCircle2,
  XCircle,
  PiggyBank,
  Coins,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  saveLocalUser,
  deleteLocalUser,
} from '../../lib/localFallbackStore';
import { fetchLiveAdminStats, AdminPlatformStats } from '../../lib/adminStats';
import toast from 'react-hot-toast';

export default function AdminStatsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminPlatformStats>({
    // Total Metrics
    totalUsers: 0,
    totalTasks: 0,
    totalSubmissions: 0,
    totalAds: 0,
    totalDepositUSD: 0,
    totalWithdrawalUSD: 0,
    totalUserDepositBalanceUSD: 0,
    totalUserEarningBalanceUSD: 0,

    // Pending Metrics
    pendingUsersCount: 0,
    pendingSubmissionsCount: 0,
    pendingJobsCount: 0,
    pendingAdsCount: 0,
    pendingDepositsCount: 0,
    pendingDepositsUSD: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsUSD: 0,

    pendingUsersList: [],
  });

  const [pendingUsersList, setPendingUsersList] = useState<any[]>([]);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const fetchStats = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    try {
      const liveStats = await fetchLiveAdminStats();
      setStats(liveStats);
      setPendingUsersList(liveStats.pendingUsersList);
      if (isManual) {
        toast.success('ড্যাশবোর্ডের সকল তথ্য ও হিসাব নির্ভুলভাবে রিফ্রেশ করা হয়েছে!');
      }
    } catch (err) {
      console.error('Failed to load live admin stats', err);
      toast.error('হিসাব লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Set up Realtime subscriptions to update immediately on any data change
    const channel = supabase
      .channel('admin-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchStats(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchStats(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => fetchStats(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, () => fetchStats(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests' }, () => fetchStats(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdraw_requests' }, () => fetchStats(false))
      .subscribe();

    const handleDataUpdate = () => {
      fetchStats(false);
    };

    window.addEventListener('iz_users_updated', handleDataUpdate);
    window.addEventListener('iz_balance_updated', handleDataUpdate);
    window.addEventListener('iz_platform_controls_updated', handleDataUpdate);
    window.addEventListener('iz_email_notification_queued', handleDataUpdate);
    window.addEventListener('iz_jobs_updated', handleDataUpdate);
    window.addEventListener('submission_updated', handleDataUpdate);
    window.addEventListener('iz_ads_updated', handleDataUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('iz_users_updated', handleDataUpdate);
      window.removeEventListener('iz_balance_updated', handleDataUpdate);
      window.removeEventListener('iz_platform_controls_updated', handleDataUpdate);
      window.removeEventListener('iz_email_notification_queued', handleDataUpdate);
      window.removeEventListener('iz_jobs_updated', handleDataUpdate);
      window.removeEventListener('submission_updated', handleDataUpdate);
      window.removeEventListener('iz_ads_updated', handleDataUpdate);
    };
  }, [fetchStats]);

  const handleApprovePendingUser = async (userObj: any) => {
    const userId = userObj.id;
    try {
      setActionUserId(userId);
      // 1. Update Supabase
      const { error: approveErr } = await supabase
        .from('users')
        .update({ 
          status: 'active', 
          is_pending: false, 
          is_locked: false, 
          role: 'user', 
          pending_reason: null 
        })
        .eq('id', userId);

      if (approveErr) {
        throw new Error(approveErr.message);
      }

      // 2. Update local fallback store
      saveLocalUser(userId, { 
        status: 'active', 
        is_pending: false, 
        is_locked: false, 
        role: 'user', 
        pending_reason: undefined 
      });

      // 3. Dispatch user update event for app-wide reactive state sync
      window.dispatchEvent(new CustomEvent('iz_users_updated', { 
        detail: { userId, status: 'active' } 
      }));

      toast.success('পেন্ডিং সিকিউরিটি ইউজার সফলভাবে অ্যাপ্রুভ ও সক্রিয় করা হয়েছে!');
      await fetchStats();
    } catch (err: any) {
      console.error(err);
      toast.error('অ্যাপ্রুভ করতে ব্যর্থ হয়েছে: ' + (err?.message || ''));
    } finally {
      setActionUserId(null);
    }
  };

  const handleRejectPendingUser = async (userObj: any) => {
    const displayName = userObj.name || userObj.email || 'ইউজার';
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${displayName}" ইউজারের অ্যাকাউন্ট রেজিস্ট্রেশন বাতিল ও স্থায়ীভাবে মুছে ফেলতে চান?`)) return;
    const userId = userObj.id;
    try {
      setActionUserId(userId);
      // 1. Mark and delete in Supabase
      const { error: updateErr } = await supabase
        .from('users')
        .update({ status: 'deleted', role: 'deleted', is_locked: true })
        .eq('id', userId);

      if (updateErr) {
        throw new Error(updateErr.message);
      }

      const { error: deleteErr } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteErr) {
        throw new Error(deleteErr.message);
      }

      // 2. Archive & thoroughly delete from local fallback store
      deleteLocalUser(userId, 'Rejected by Admin', userObj);

      // 3. Dispatch user update event
      window.dispatchEvent(new CustomEvent('iz_users_updated', { 
        detail: { userId, status: 'deleted' } 
      }));

      toast.success('পেন্ডিং ইউজার অ্যাকাউন্ট রিজেক্ট ও স্থায়ীভাবে ডিলিট করা হয়েছে!');
      await fetchStats();
    } catch (err: any) {
      console.error(err);
      toast.error('রিজেক্ট করতে ব্যর্থ হয়েছে: ' + (err?.message || ''));
    } finally {
      setActionUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
      </div>
    );
  }

  // TOTAL METRICS CARDS (Side-by-Side: 2 Per Row in Grid)
  const totalCards = [
    {
      title: 'Total Users (টোটাল ইউজার)',
      value: stats.totalUsers.toLocaleString(),
      subtext: 'মোট নিবন্ধিত অ্যাকাউন্ট',
      icon: Users,
      badge: 'Users',
      color: 'from-purple-600 to-indigo-600 text-white',
      border: 'border-purple-200 dark:border-purple-500/30'
    },
    {
      title: 'Total Tasks (টোটাল জব/মিশন)',
      value: stats.totalTasks.toLocaleString(),
      subtext: 'প্ল্যাটফর্মে পোস্টকৃত সকল মাইক্রো-জব',
      icon: Briefcase,
      badge: 'Jobs',
      color: 'from-blue-600 to-cyan-600 text-white',
      border: 'border-blue-200 dark:border-blue-500/30'
    },
    {
      title: 'Total Submissions (টোটাল সাবমিশন)',
      value: stats.totalSubmissions.toLocaleString(),
      subtext: 'ওয়ার্কারদের জমাকৃত কাজের প্রমাণপত্র',
      icon: FileText,
      badge: 'Submitted',
      color: 'from-violet-600 to-purple-600 text-white',
      border: 'border-violet-200 dark:border-violet-500/30'
    },
    {
      title: 'Total Ads (টোটাল ক্যাস্পেইন/অ্যাড)',
      value: stats.totalAds.toLocaleString(),
      subtext: 'চলতি ও সম্পন্ন ব্যানার বিজ্ঞাপন',
      icon: Megaphone,
      badge: 'Ads',
      color: 'from-pink-600 to-rose-600 text-white',
      border: 'border-pink-200 dark:border-pink-500/30'
    },
    {
      title: 'Total Deposits (টোটাল ডিপোজিট)',
      value: `$${stats.totalDepositUSD.toFixed(2)}`,
      subtext: `≈ ৳${Math.round(stats.totalDepositUSD * 100).toLocaleString()} BDT (অনুমোদিত)`,
      icon: Wallet,
      badge: 'Deposits',
      color: 'from-emerald-600 to-teal-600 text-white',
      border: 'border-emerald-200 dark:border-emerald-500/30'
    },
    {
      title: 'Total Withdrawals (টোটাল উত্তোলন)',
      value: `$${stats.totalWithdrawalUSD.toFixed(2)}`,
      subtext: `≈ ৳${Math.round(stats.totalWithdrawalUSD * 100).toLocaleString()} BDT (ক্যাশআউট সম্পন্ন)`,
      icon: Banknote,
      badge: 'Withdrawals',
      color: 'from-amber-500 to-orange-600 text-white',
      border: 'border-amber-200 dark:border-amber-500/30'
    },
    {
      title: 'Deposit Balances (ডিপোজিট ব্যালেন্স)',
      value: `$${stats.totalUserDepositBalanceUSD.toFixed(2)}`,
      subtext: `≈ ৳${Math.round(stats.totalUserDepositBalanceUSD * 100).toLocaleString()} BDT (সকল ইউজারের)`,
      icon: PiggyBank,
      badge: 'Deposit Wallet',
      color: 'from-indigo-600 to-blue-600 text-white',
      border: 'border-indigo-200 dark:border-indigo-500/30'
    },
    {
      title: 'Withdraw Balances (আর্নিং ব্যালেন্স)',
      value: `$${stats.totalUserEarningBalanceUSD.toFixed(2)}`,
      subtext: `≈ ৳${Math.round(stats.totalUserEarningBalanceUSD * 100).toLocaleString()} BDT (উত্তোলনযোগ্য)`,
      icon: Coins,
      badge: 'Earning Wallet',
      color: 'from-emerald-600 to-green-600 text-white',
      border: 'border-emerald-200 dark:border-emerald-500/30'
    },
  ];

  // PENDING METRICS CARDS (Side-by-Side: 2 Per Row in Grid)
  const pendingCards = [
    {
      title: 'Pending Users (পেন্ডিং সিকিউরিটি ইউজার)',
      value: `${stats.pendingUsersCount} User${stats.pendingUsersCount !== 1 ? 's' : ''}`,
      subtext: 'একই আইপি বা ভিপিএন ফ্ল্যাগযুক্ত স্থগিত ইউজার',
      icon: ShieldAlert,
      badge: 'Security Review',
      color: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
      link: '/admin/users?filter=pending',
      actionText: 'ইউজার রিভিউ করুন'
    },
    {
      title: 'Pending Submissions (পেন্ডিং কাজ)',
      value: `${stats.pendingSubmissionsCount} Task${stats.pendingSubmissionsCount !== 1 ? 's' : ''}`,
      subtext: 'অপেক্ষমাণ টাস্ক প্রুফ অনুমোদন',
      icon: Clock,
      badge: 'Submissions',
      color: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      link: '/admin/submissions',
      actionText: 'সাবমিশন রিভিউ করুন'
    },
    {
      title: 'Pending Jobs (পেন্ডিং মাইক্রো-জব)',
      value: `${stats.pendingJobsCount} Job${stats.pendingJobsCount !== 1 ? 's' : ''}`,
      subtext: 'অপেক্ষমাণ নতুন মিশন অনুমোদন',
      icon: Briefcase,
      badge: 'Jobs Review',
      color: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      link: '/admin/jobs',
      actionText: 'জব অনুমোদন করুন'
    },
    {
      title: 'Pending Ads (পেন্ডিং ব্যানার অ্যাড)',
      value: `${stats.pendingAdsCount} Ad${stats.pendingAdsCount !== 1 ? 's' : ''}`,
      subtext: 'অপেক্ষমাণ বিজ্ঞাপন ক্যাম্পেইন',
      icon: Megaphone,
      badge: 'Ads Review',
      color: 'text-purple-600 dark:text-purple-400',
      badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      link: '/admin/ads',
      actionText: 'অ্যাড রিভিউ করুন'
    },
    {
      title: 'Pending Deposits (পেন্ডিং ডিপোজিট)',
      value: `${stats.pendingDepositsCount} Req ($${stats.pendingDepositsUSD.toFixed(2)})`,
      subtext: `≈ ৳${Math.round(stats.pendingDepositsUSD * 100).toLocaleString()} BDT অপেক্ষমাণ`,
      icon: Wallet,
      badge: 'Deposit Review',
      color: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      link: '/admin/deposits',
      actionText: 'ডিপোজিট রিভিউ করুন'
    },
    {
      title: 'Pending Withdrawals (পেন্ডিং ক্যাশআউট)',
      value: `${stats.pendingWithdrawalsCount} Req ($${stats.pendingWithdrawalsUSD.toFixed(2)})`,
      subtext: `≈ ৳${Math.round(stats.pendingWithdrawalsUSD * 100).toLocaleString()} BDT ক্যাশআউট`,
      icon: Banknote,
      badge: 'Withdraw Review',
      color: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      link: '/admin/withdrawals',
      actionText: 'উইথড্র রিভিউ করুন'
    },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-10 hardware-accelerate">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 dark:bg-gradient-to-tr dark:from-amber-400 dark:to-yellow-500 text-white dark:text-slate-950 flex items-center justify-center font-black text-base shadow-md">
              IZ
            </div>
            Admin Master Dashboard
          </h1>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-semibold">
            প্ল্যাটফর্মের সকল হিসাব ও পেন্ডিং কার্যক্রমের রিয়েল-টাইম তথ্য (পাশাপাশি ২ টি করে সাজানো)।
          </p>
        </div>

        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="self-start sm:self-auto px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'হিসাব রিফ্রেশ হচ্ছে...' : 'হিসাব রিফ্রেশ করুন'}</span>
        </button>
      </div>

      {/* SECTION 1: TOTAL STATS (টোটাল হিসাবসমূহ - 2 Box Side-by-Side per row) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-purple-900/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-600 dark:bg-amber-400"></span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide">
              ১. টোটাল হিসাবসমূহ (Total Metrics Summary)
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-400 dark:text-purple-400 font-mono">
            8 Cards (2 Side-by-Side)
          </span>
        </div>

        {/* 2 Cards Side-by-Side Grid (Strictly 2 per row) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {totalCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx}
                className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/25 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl hover:border-purple-400 dark:hover:border-amber-400/50 transition-all flex flex-col justify-between gap-4 group relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-purple-900/40 text-slate-600 dark:text-purple-300 border border-slate-200 dark:border-purple-500/30">
                      {card.badge}
                    </span>
                    <h3 className="text-xs font-black text-slate-500 dark:text-purple-300/70 uppercase tracking-wide truncate">
                      {card.title}
                    </h3>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
                      {card.value}
                    </p>
                  </div>

                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${card.color} flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-purple-900/40 text-xs font-semibold text-slate-500 dark:text-purple-300/60">
                  {card.subtext}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: PENDING STATS & SECURITY REVIEW (পেন্ডিং হিসাবসমূহ - 2 Box Side-by-Side per row) */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-purple-900/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wide">
              ২. পেন্ডিং হিসাবসমূহ (Pending Actions & Security)
            </h2>
          </div>
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
            Requires Admin Review
          </span>
        </div>

        {/* 2 Cards Side-by-Side Grid (Strictly 2 per row) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {pendingCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx}
                className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/25 rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-xl hover:border-amber-400/60 transition-all flex flex-col justify-between gap-4 relative overflow-hidden group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${card.badgeBg}`}>
                      {card.badge}
                    </span>
                    <h3 className="text-xs font-black text-slate-500 dark:text-purple-300/70 uppercase tracking-wide truncate">
                      {card.title}
                    </h3>
                    <p className={`text-2xl sm:text-3xl font-black tracking-tight font-mono ${card.color}`}>
                      {card.value}
                    </p>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-purple-900/40">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-purple-300/60">
                    {card.subtext}
                  </span>

                  <Link
                    to={card.link}
                    className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-amber-400/10 dark:hover:bg-amber-400/20 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-amber-400/30 text-xs font-black transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <span>{card.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PENDING SECURITY USERS EXPANDED REVIEW BOX */}
      {pendingUsersList.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-3xl p-5 sm:p-6 text-slate-900 dark:text-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 animate-bounce" />
              <div>
                <h3 className="text-sm sm:text-base font-black text-rose-700 dark:text-rose-300">
                  পেন্ডিং সিকিউরিটি ইউজার রিভিউ (VPN / Multi-IP Flagged)
                </h3>
                <p className="text-xs font-semibold text-slate-600 dark:text-purple-200/80">
                  নিচের ইউজারগুলো একই আইপি বা ভিপিএন সিকিউরিটি ফ্ল্যাগের কারণে স্থগিত রয়েছে। ম্যানুয়ালি এপ্রুভ বা রিজেক্ট করুন।
                </p>
              </div>
            </div>
            <Link
              to="/admin/users?filter=pending"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 transition-all shrink-0"
            >
              সকল পেন্ডিং ইউজার দেখুন
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingUsersList.slice(0, 6).map((u) => (
              <div key={u.id} className="p-3.5 rounded-2xl bg-white dark:bg-[#130b2c] border border-rose-500/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white truncate">{u.name || u.email}</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    {u.ip_address ? `IP: ${u.ip_address}` : 'Pending IP'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-purple-300/70">
                  <span className="truncate">{u.email}</span>
                  <span className="text-[10px] text-amber-500 font-bold shrink-0">একই আইপি</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleApprovePendingUser(u)}
                    disabled={actionUserId === u.id}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>এপ্রুভ</span>
                  </button>
                  <button
                    onClick={() => handleRejectPendingUser(u)}
                    disabled={actionUserId === u.id}
                    className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>রিজেক্ট</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
