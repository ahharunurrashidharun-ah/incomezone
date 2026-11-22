import React, { useEffect, useState } from 'react';
import { supabase, toValidUUID, formatJobDisplayId } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Inbox, 
  Search, 
  Wallet, 
  Calendar,
  Hourglass
} from 'lucide-react';
import {
  getLocalSubmissions,
  getLocalJobs,
} from '../lib/localFallbackStore';
import { approveSubmission } from '../lib/jobService';

interface Submission {
  id: string;
  jobId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
  jobTitle: string;
  jobPrice: number;
  rejectionReason?: string;
  job?: any;
}

const BDT_PER_USD = 100;
const AUTO_APPROVE_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export default function SubmittedJobPage() {
  const { user, profile } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected'>('ALL');
  const [now, setNow] = useState(Date.now());

  const isLoadingDataRef = React.useRef(false);
  const autoApprovedIdsRef = React.useRef<Set<string>>(new Set());

  // Live ticking clock for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      if (isLoadingDataRef.current) return;
      isLoadingDataRef.current = true;
      try {
        // 1. Gather submissions from Supabase across all known worker identifiers
        const idsToQuery = Array.from(
          new Set([user.uid, user.id, profile?.id, toValidUUID(user.uid)].filter(Boolean))
        );
        let remoteSubs: any[] = [];
        let isSubsConnected = false;
        try {
          if (idsToQuery.length > 0) {
            const { data, error } = await supabase
              .from('submissions')
              .select('*')
              .in('worker_id', idsToQuery)
              .order('created_at', { ascending: false });

            if (!error && Array.isArray(data)) {
              remoteSubs = data;
              isSubsConnected = true;
              setLoadError('');
            } else if (error && error.message && !error.message.toLowerCase().includes('schema cache') && error.code !== 'PGRST205') {
              setLoadError(`সাবমিশন লোড করতে সমস্যা হয়েছে: ${error.message}`);
            }
          }
        } catch {}

        // 2. Fallback to local storage ONLY if remote DB is unreachable
        const idSet = new Set(idsToQuery.map((id) => String(id).trim().toLowerCase()));
        const allRawSubs = (
          isSubsConnected
            ? remoteSubs
            : getLocalSubmissions().filter(
                (s: any) =>
                  idSet.has(String(s.worker_id || '').trim().toLowerCase()) ||
                  idSet.has(String(s.workerId || '').trim().toLowerCase())
              )
        ).sort((a, b) => {
          const tA = new Date(a.created_at || a.createdAt || Date.now()).getTime();
          const tB = new Date(b.created_at || b.createdAt || Date.now()).getTime();
          return tB - tA;
        });

        // 3. Extract unique job IDs
        const jobIds = Array.from(
          new Set(allRawSubs.map((s) => s.job_id || s.jobId).filter(Boolean))
        );

        // 4. Gather jobs from Supabase when available, falling back to local cache only on failure
        const jobsMap: Record<string, any> = {};
        let isJobsConnected = false;
        if (jobIds.length > 0) {
          try {
            const { data: remoteJobs, error: jobsErr } = await supabase
              .from('jobs')
              .select('*')
              .in('id', jobIds);

            if (!jobsErr && Array.isArray(remoteJobs)) {
              isJobsConnected = true;
              remoteJobs.forEach((j) => {
                if (j.id) {
                  jobsMap[j.id] = j;
                  jobsMap[String(j.id).trim().toLowerCase()] = j;
                }
              });
            }
          } catch {}
        }

        if (!isJobsConnected) {
          const localJobs = getLocalJobs();
          localJobs.forEach((j) => {
            if (j.id) {
              jobsMap[j.id] = j;
              jobsMap[String(j.id).trim().toLowerCase()] = j;
            }
          });
        }

        // 6. Build finalized submission list with guaranteed titles, prices & proof details
        const finalizedList: Submission[] = allRawSubs.map((sub) => {
          const jobId = sub.job_id || sub.jobId;
          const matchedJob =
            jobsMap[jobId] || jobsMap[String(jobId || '').trim().toLowerCase()] || {};

          // Extract title with graceful fallback
          const title =
            matchedJob.title ||
            matchedJob.jobTitle ||
            sub.jobTitle ||
            sub.title ||
            'Micro Task Assignment';

          // Extract reward price with graceful fallback
          const rawPrice =
            matchedJob.price_per_task ??
            matchedJob.pricePerTask ??
            matchedJob.worker_earn ??
            matchedJob.reward ??
            sub.jobPrice ??
            0.25;

          const price = Number(rawPrice) > 0 ? Number(rawPrice) : 0.25;

          return {
            id: sub.id,
            jobId: jobId,
            status: (sub.status as any) || 'pending',
            submittedAt: sub.created_at || sub.createdAt || sub.submittedAt || Date.now(),
            jobTitle: title,
            jobPrice: price,
            rejectionReason: sub.rejection_reason || sub.rejectionReason || '',
            job: matchedJob,
          };
        });

        // 7. Check and execute 7-day Auto Approval for any pending submissions >= 7 days old (once per sub ID)
        let autoApprovedAny = false;
        for (const sub of finalizedList) {
          if (sub.status === 'pending' && !autoApprovedIdsRef.current.has(sub.id)) {
            const subTime = new Date(sub.submittedAt).getTime();
            if (!isNaN(subTime) && Date.now() - subTime >= AUTO_APPROVE_DAYS_MS) {
              autoApprovedIdsRef.current.add(sub.id);
              try {
                await approveSubmission(sub.id, sub.jobId, user.uid);
                sub.status = 'approved';
                autoApprovedAny = true;
              } catch (autoErr) {
                console.warn('Auto approval notice:', autoErr);
              }
            }
          }
        }

        setSubmissions(finalizedList);

        if (autoApprovedAny) {
          window.dispatchEvent(new CustomEvent('iz_balance_updated', { detail: { userId: user.uid } }));
        }
      } catch (err) {
        console.error('Error loading submissions:', err);
      } finally {
        isLoadingDataRef.current = false;
        setLoading(false);
      }
    };

    // Initial load
    loadData();

    // Set up Real-time subscription for Supabase
    const channel = supabase
      .channel(`submissions_realtime_${user.uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          loadData();
        }
      )
      .subscribe();

    // Listen to local events & window focus
    const handleLocalUpdate = () => loadData();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    window.addEventListener('storage', handleLocalUpdate);
    window.addEventListener('submission_updated', handleLocalUpdate);
    window.addEventListener('focus', handleLocalUpdate);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleLocalUpdate);
      window.removeEventListener('submission_updated', handleLocalUpdate);
      window.removeEventListener('focus', handleLocalUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.uid]);

  // Calculations for summary stats
  const pendingSubs = submissions.filter((s) => s.status === 'pending');
  const approvedSubs = submissions.filter((s) => s.status === 'approved');
  const rejectedSubs = submissions.filter((s) => s.status === 'rejected');

  const pendingAmountUSD = pendingSubs.reduce((acc, s) => acc + s.jobPrice, 0);
  const approvedAmountUSD = approvedSubs.reduce((acc, s) => acc + s.jobPrice, 0);
  const rejectedAmountUSD = rejectedSubs.reduce((acc, s) => acc + s.jobPrice, 0);

  const pendingAmountBDT = Math.round(pendingAmountUSD * BDT_PER_USD);
  const approvedAmountBDT = Math.round(approvedAmountUSD * BDT_PER_USD);
  const rejectedAmountBDT = Math.round(rejectedAmountUSD * BDT_PER_USD);

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter === 'ALL') return true;
    return s.status === statusFilter;
  });

  const getCountdownText = (submittedAt: any) => {
    const subTime = new Date(submittedAt).getTime();
    if (isNaN(subTime)) return '7d 00h 00m';

    const autoApproveTime = subTime + AUTO_APPROVE_DAYS_MS;
    const diff = autoApproveTime - now;

    if (diff <= 0) {
      return 'Auto-Approving...';
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    if (d > 0) {
      return `${d}d ${h}h ${m}m ${s}s`;
    }
    return `${h}h ${m}m ${s}s`;
  };

  const formatSubmissionDate = (submittedAt: any) => {
    const d = new Date(submittedAt);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            Approved & Paid
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60">
            <XCircle className="w-3.5 h-3.5 mr-1 text-red-600 dark:text-red-400" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const renderReward = (price: number, status: string) => {
    const formattedPrice = `$${price.toFixed(2)}`;
    
    switch (status) {
      case 'pending':
        return <span className="font-bold text-slate-700 dark:text-purple-200">{formattedPrice}</span>;
      case 'approved':
        return <span className="font-black text-emerald-600 dark:text-emerald-400">+{formattedPrice}</span>;
      case 'rejected':
        return (
          <div className="flex flex-col items-end">
            <span className="font-semibold text-slate-400 dark:text-purple-300/40 line-through text-xs">{formattedPrice}</span>
            <span className="font-bold text-red-600 dark:text-red-400 text-xs">$0.00</span>
          </div>
        );
      default:
        return <span className="font-bold text-slate-800 dark:text-white">{formattedPrice}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-24 sm:pb-28">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Submitted Jobs Summary
        </h1>
        <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-0.5 font-medium">
          জব সাবমিশনের ৭ দিন পর স্বয়ংক্রিয়ভাবে অটো-অ্যাপ্রুভড হয়ে আর্নিং ব্যালেন্স যোগ হবে।
        </p>
      </div>

      {loadError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs sm:text-sm font-bold">
          {loadError}
        </div>
      )}

      {/* 2x2 Grid Compact Box Cards (এক লাইনে দুইটা করে মোট দুই লাইনে) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Box 1: Pending Job */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'ALL' : 'pending')}
          className={`cursor-pointer bg-white dark:bg-[#130b2c]/90 rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'pending'
              ? 'border-amber-500 ring-2 ring-amber-500/30'
              : 'border-slate-200 dark:border-purple-500/20 hover:border-amber-400/50'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-purple-300/70 truncate">
              Pending Job
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 shrink-0">
              <Clock className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {pendingSubs.length}
            </h3>
            <span className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
              ${pendingAmountUSD.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-purple-300/50 mt-1 truncate">
            ৳{pendingAmountBDT} BDT (৭ দিনে অটো-অ্যাপ্রুভ)
          </p>
        </div>

        {/* Box 2: Approved Job */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'approved' ? 'ALL' : 'approved')}
          className={`cursor-pointer bg-white dark:bg-[#130b2c]/90 rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'approved'
              ? 'border-emerald-500 ring-2 ring-emerald-500/30'
              : 'border-slate-200 dark:border-purple-500/20 hover:border-emerald-400/50'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-purple-300/70 truncate">
              Approved Job
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {approvedSubs.length}
            </h3>
            <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
              +${approvedAmountUSD.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-purple-300/50 mt-1 truncate">
            ৳{approvedAmountBDT} BDT অর্জিত
          </p>
        </div>

        {/* Box 3: Rejected Job */}
        <div
          onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'ALL' : 'rejected')}
          className={`cursor-pointer bg-white dark:bg-[#130b2c]/90 rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'rejected'
              ? 'border-red-500 ring-2 ring-red-500/30'
              : 'border-slate-200 dark:border-purple-500/20 hover:border-red-400/50'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-500 dark:text-purple-300/70 truncate">
              Rejected Job
            </span>
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
              {rejectedSubs.length}
            </h3>
            <span className="text-xs sm:text-sm font-black text-red-600 dark:text-red-400 font-mono">
              ${rejectedAmountUSD.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-purple-300/50 mt-1 truncate">
            ৳{rejectedAmountBDT} BDT বাতিল
          </p>
        </div>

        {/* Box 4: Pending Balance */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 dark:from-purple-900/90 dark:to-[#1a0f3d] text-white rounded-2xl p-3.5 sm:p-4 border border-purple-500/30 shadow-xs">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-purple-200 truncate">
              Pending Balance
            </span>
            <div className="p-1.5 rounded-lg bg-white/10 text-amber-300 backdrop-blur-sm border border-white/10 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xl sm:text-2xl font-black font-mono text-amber-300">
              ${pendingAmountUSD.toFixed(2)}
            </h3>
            <span className="text-xs sm:text-sm font-black font-mono text-purple-100">
              ৳{pendingAmountBDT} BDT
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-medium text-purple-200/80 mt-1 truncate">
            অ্যাপ্রুভ হলে ওয়ালেটে যুক্ত হবে
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-purple-600 text-white dark:bg-amber-400 dark:text-slate-950 shadow-xs'
                : 'bg-white dark:bg-[#130b2c] text-slate-600 dark:text-purple-200 border border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
            }`}
          >
            ALL JOBS ({submissions.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                : 'bg-white dark:bg-[#130b2c] text-slate-600 dark:text-purple-200 border border-slate-200 dark:border-purple-500/20 hover:border-amber-400/50'
            }`}
          >
            PENDING ({pendingSubs.length})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                : 'bg-white dark:bg-[#130b2c] text-slate-600 dark:text-purple-200 border border-slate-200 dark:border-purple-500/20 hover:border-emerald-400/50'
            }`}
          >
            APPROVED ({approvedSubs.length})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              statusFilter === 'rejected'
                ? 'bg-red-600 text-white dark:bg-red-500 dark:text-slate-950 shadow-xs'
                : 'bg-white dark:bg-[#130b2c] text-slate-600 dark:text-purple-200 border border-slate-200 dark:border-purple-500/20 hover:border-red-400/50'
            }`}
          >
            REJECTED ({rejectedSubs.length})
          </button>
        </div>
      </div>

      {/* Submission List Table / Cards */}
      {filteredSubmissions.length === 0 ? (
        <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-purple-500/20 shadow-sm dark:shadow-2xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 bg-slate-50 dark:bg-[#080412] rounded-full flex items-center justify-center mb-3 border border-slate-200 dark:border-purple-500/30">
            <Inbox className="w-7 h-7 text-slate-400 dark:text-purple-400" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {statusFilter === 'ALL' ? 'এখনো কোনো জব সাবমিট করেননি' : `${statusFilter} ফিল্টারে কোনো রেকর্ড নেই`}
          </h3>
          <p className="text-slate-500 dark:text-purple-300/70 text-xs max-w-xs mb-5 font-medium">
            {statusFilter === 'ALL'
              ? 'মাইক্রো-জব সম্পন্ন করে আপনার আর্নিং বৃদ্ধি করুন।'
              : `'${statusFilter}' স্ট্যাটাসের কোনো জব রেকর্ড পাওয়া যায়নি।`}
          </p>
          <Link
            to="/jobs"
            className="inline-flex items-center px-5 py-2.5 text-xs font-bold rounded-xl text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 transition-all shadow-md"
          >
            <Search className="w-4 h-4 mr-2" />
            Find Jobs
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#130b2c]/85 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-2xl overflow-hidden">
          {/* Mobile View: Stack of Cards */}
          <div className="block md:hidden">
            <div className="divide-y divide-slate-100 dark:divide-purple-900/30">
              {filteredSubmissions.map((sub) => {
                const displayIdVal = formatJobDisplayId(sub.job?.display_id || sub.job?.displayId || (sub as any).display_id, sub.jobId || sub.id);
                return (
                  <div key={sub.id} className="p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-colors space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
                          Job ID: #{displayIdVal}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{sub.jobTitle}</h3>
                      </div>
                      <div className="text-right shrink-0">
                        {renderReward(sub.jobPrice, sub.status)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1.5 border-t border-slate-100 dark:border-purple-900/30">
                      <div className="flex items-center gap-1 text-slate-500 dark:text-purple-300/70 font-medium text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span>সাবমিট সময়: {formatSubmissionDate(sub.submittedAt)}</span>
                      </div>
                      {renderStatusBadge(sub.status)}
                    </div>

                    {sub.status === 'pending' && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <Hourglass className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                          অটো-অ্যাপ্রুভ বাকি:
                        </span>
                        <span className="font-mono text-amber-600 dark:text-amber-300 text-xs">
                          {getCountdownText(sub.submittedAt)}
                        </span>
                      </div>
                    )}

                    {sub.status === 'rejected' && sub.rejectionReason && (
                      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl px-3 py-2 text-xs text-red-700 dark:text-red-300 font-semibold">
                        রিজেক্টের কারণ: {sub.rejectionReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop View: Data Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#080412]/80 border-b border-slate-200 dark:border-purple-900/40">
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider w-36">Job ID</th>
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider">Job Name & Submit Time</th>
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider">Status & Countdown</th>
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider text-right">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                {filteredSubmissions.map((sub) => {
                  const displayIdVal = formatJobDisplayId(sub.job?.display_id || sub.job?.displayId || (sub as any).display_id, sub.jobId || sub.id);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-colors">
                      <td className="py-4 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 font-mono whitespace-nowrap">
                        Job ID: #{displayIdVal}
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white max-w-xs">
                        <div className="truncate">{sub.jobTitle}</div>
                        <div className="text-xs font-medium text-slate-400 dark:text-purple-300/60 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-purple-400 shrink-0" />
                          <span>{formatSubmissionDate(sub.submittedAt)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {renderStatusBadge(sub.status)}
                          {sub.status === 'pending' && (
                            <div className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1.5">
                              <Hourglass className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
                              <span>Auto Approve: {getCountdownText(sub.submittedAt)}</span>
                            </div>
                          )}
                          {sub.status === 'rejected' && sub.rejectionReason && (
                            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 max-w-xs">
                              কারণ: {sub.rejectionReason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap text-right">
                        {renderReward(sub.jobPrice, sub.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
