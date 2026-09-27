import React, { useEffect, useState } from 'react';
import { supabase, formatJobDisplayId } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, Inbox, Search } from 'lucide-react';
import {
  getLocalSubmissions,
  getLocalJobs,
} from '../lib/localFallbackStore';

interface Submission {
  id: string;
  jobId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: any;
  jobTitle: string;
  jobPrice: number;
  job?: any;
}

export default function SubmittedJobPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // 1. Gather submissions from Supabase
        let remoteSubs: any[] = [];
        try {
          const { data, error } = await supabase
            .from('submissions')
            .select('*')
            .eq('worker_id', user.uid)
            .order('created_at', { ascending: false });

          if (!error && data) {
            remoteSubs = data;
          }
        } catch {}

        // 2. Gather submissions from local storage
        const localSubs = getLocalSubmissions().filter(
          (s: any) => s.worker_id === user.uid || s.workerId === user.uid
        );

        // Deduplicate submissions by ID
        const subMap = new Map<string, any>();
        localSubs.forEach((s) => {
          if (s.id) subMap.set(s.id, s);
        });
        remoteSubs.forEach((s) => {
          if (s.id) subMap.set(s.id, s);
        });

        const allRawSubs = Array.from(subMap.values()).sort((a, b) => {
          const tA = new Date(a.created_at || a.createdAt || Date.now()).getTime();
          const tB = new Date(b.created_at || b.createdAt || Date.now()).getTime();
          return tB - tA;
        });

        // 3. Extract unique job IDs
        const jobIds = Array.from(
          new Set(allRawSubs.map((s) => s.job_id || s.jobId).filter(Boolean))
        );

        // 4. Gather jobs from Local Storage first
        const jobsMap: Record<string, any> = {};
        const localJobs = getLocalJobs();
        localJobs.forEach((j) => {
          if (j.id) jobsMap[j.id] = j;
        });

        // 5. Gather jobs from Supabase and merge
        if (jobIds.length > 0) {
          try {
            const { data: remoteJobs } = await supabase
              .from('jobs')
              .select('*')
              .in('id', jobIds);

            if (remoteJobs) {
              remoteJobs.forEach((j) => {
                if (j.id) {
                  jobsMap[j.id] = { ...jobsMap[j.id], ...j };
                }
              });
            }
          } catch {}
        }

        // 6. Build finalized submission list with guaranteed titles & prices
        const finalizedList: Submission[] = allRawSubs.map((sub) => {
          const jobId = sub.job_id || sub.jobId;
          const matchedJob = jobsMap[jobId] || {};

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
            submittedAt: sub.created_at || sub.createdAt || Date.now(),
            jobTitle: title,
            jobPrice: price,
            job: matchedJob,
          };
        });

        setSubmissions(finalizedList);
      } catch (err) {
        console.error('Error loading submissions:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial load
    loadData();

    // Set up Real-time subscription for Supabase
    const channel = supabase
      .channel('submissions_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions' },
        () => {
          loadData();
        }
      )
      .subscribe();

    // Listen to local events
    const handleLocalUpdate = () => loadData();
    window.addEventListener('storage', handleLocalUpdate);
    window.addEventListener('submission_updated', handleLocalUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', handleLocalUpdate);
      window.removeEventListener('submission_updated', handleLocalUpdate);
    };
  }, [user]);

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
    <div className="max-w-5xl mx-auto space-y-6 pb-24 sm:pb-28">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Submitted Jobs</h1>
        <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">Track the real-time status of all your completed tasks.</p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-purple-500/20 shadow-sm dark:shadow-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-[#080412] rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-purple-500/30">
            <Inbox className="w-8 h-8 text-slate-400 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No tasks submitted yet</h3>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm max-w-sm mb-6 font-medium">
            You haven't submitted any tasks yet. Browse available opportunities and start earning today!
          </p>
          <Link
            to="/jobs"
            className="inline-flex items-center px-6 py-2.5 text-xs font-bold rounded-xl text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 transition-all shadow-md shadow-purple-600/20 dark:shadow-amber-500/20"
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
              {submissions.map((sub) => {
                const displayIdVal = formatJobDisplayId(sub.job?.display_id || sub.job?.displayId || (sub as any).display_id, sub.jobId || sub.id);
                return (
                  <div key={sub.id} className="p-5 hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                          Job ID: #{displayIdVal}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{sub.jobTitle}</h3>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      {renderStatusBadge(sub.status)}
                      <div className="text-right">
                        {renderReward(sub.jobPrice, sub.status)}
                      </div>
                    </div>
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
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider w-36">Task ID</th>
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider">Job Title</th>
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider">Status</th>
                  <th className="py-3.5 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 uppercase tracking-wider text-right">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                {submissions.map((sub) => {
                  const displayIdVal = formatJobDisplayId(sub.job?.display_id || sub.job?.displayId || (sub as any).display_id, sub.jobId || sub.id);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-colors">
                      <td className="py-4 px-6 text-xs font-bold text-purple-600 dark:text-amber-400 font-mono whitespace-nowrap">
                        Job ID: #{displayIdVal}
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white max-w-xs truncate">
                        {sub.jobTitle}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {renderStatusBadge(sub.status)}
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
