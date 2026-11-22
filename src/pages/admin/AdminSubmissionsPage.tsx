import React, { useEffect, useState } from 'react';
import { supabase, formatJobDisplayId, formatUserDisplayId, formatDateTime } from '../../lib/supabaseClient';
import { approveSubmission, rejectSubmission } from '../../lib/jobService';
import { CheckCircle, XCircle, AlertCircle, ExternalLink, ImageIcon, X, ImageOff, Clock, Check, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import RejectionReasonModal from '../../components/RejectionReasonModal';
import {
  getLocalSubmissions,
  getLocalJobs,
  isTableMissingError,
} from '../../lib/localFallbackStore';
import { parseProofScreenshots } from '../../lib/jobImages';

const FallbackImage = ({ src, alt, className }: { src: string, alt: string, className: string }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-800/80 rounded-lg text-slate-400 ${className} min-h-[200px]`}>
        <ImageOff className="w-10 h-10 mb-3 opacity-50" />
        <span className="text-xs font-bold uppercase tracking-wider">Screenshot Deleted / Unavailable</span>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className}
      onError={() => setHasError(true)}
    />
  );
};

export default function AdminSubmissionsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [rejectingSub, setRejectingSub] = useState<any | null>(null);
  const actionLockRef = React.useRef<Set<string>>(new Set());

  // Modal State for Interactive Screenshot Previews
  const [selectedScreenshots, setSelectedScreenshots] = useState<string[]>([]);
  const [selectedSubmissionModal, setSelectedSubmissionModal] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openScreenshotModal = (urls: string[] | string, sub: any) => {
    let urlList: string[] = [];
    if (Array.isArray(urls)) {
      urlList = urls.filter(Boolean);
    } else if (typeof urls === 'string' && urls.trim()) {
      urlList = [urls.trim()];
    }
    if (urlList.length === 0) return;
    setSelectedScreenshots(urlList);
    setSelectedSubmissionModal(sub);
    setIsModalOpen(true);
  };

  const closeScreenshotModal = () => {
    setIsModalOpen(false);
    setSelectedScreenshots([]);
    setSelectedSubmissionModal(null);
  };

  useEffect(() => {
    fetchSubmissions();

    const channel = supabase
      .channel('admin-submissions-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchSubmissions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      // Step 1: Fetch the submissions from Supabase
      const { data: subsData, error: subsErr } = await supabase
        .from('submissions')
        .select('*')
        .order('created_at', { ascending: false });

      let rawSubs: any[] = [];
      if (!subsErr && Array.isArray(subsData)) {
        rawSubs = [...subsData];
        try {
          localStorage.setItem('iz_fallback_submissions', JSON.stringify(rawSubs));
        } catch {}
      } else if (subsErr && isTableMissingError(subsErr)) {
        rawSubs = getLocalSubmissions();
      } else if (subsErr) {
        setError(`সাবমিশন লোড করতে সমস্যা হয়েছে: ${subsErr.message}`);
        rawSubs = [];
      }

      // Step 2: Extract unique Job IDs and Worker IDs
      const jobIds = Array.from(new Set(rawSubs.map((s: any) => s.job_id || s.jobId).filter(Boolean)));
      const workerIds = Array.from(new Set(rawSubs.map((s: any) => s.worker_id || s.workerId || s.user_id || s.userId).filter(Boolean)));

      // Step 3: Fetch the related details from 'jobs' and 'users' tables
      let jobs: any[] = [];
      if (jobIds.length > 0) {
        const { data: jobsData, error: jobsErr } = await supabase
          .from('jobs')
          .select('*')
          .in('id', jobIds);
        if (!jobsErr && jobsData) {
          jobs = jobsData;
        } else {
          jobs = getLocalJobs();
        }
      }

      let workers: any[] = [];
      if (workerIds.length > 0) {
        const { data: workersData, error: workerError } = await supabase
          .from('users')
          .select('id, display_id')
          .in('id', workerIds);
        if (workerError) {
          console.error("Error fetching workers:", workerError);
        }
        workers = workersData || [];
      }

      // Step 4: Merge the data into React state
      const merged = rawSubs.map((sub: any) => {
        const jobId = sub.job_id || sub.jobId;
        const workerId = sub.worker_id || sub.workerId || sub.user_id || sub.userId;

        const matchedJob = jobs.find((j) => j.id === jobId);
        const matchedWorker = workers.find((w) => w.id === workerId);

        const rawPrice =
          matchedJob?.price_per_task ??
          matchedJob?.pricePerTask ??
          matchedJob?.worker_earn ??
          sub.pricePerTask;

        const jobObj = matchedJob
          ? {
              id: matchedJob.id,
              title: matchedJob.title || 'Micro Task Assignment',
              price_per_task: Number(rawPrice) > 0 ? Number(rawPrice) : 0.25,
              display_id: formatJobDisplayId(matchedJob.display_id ?? matchedJob.displayId, jobId),
            }
          : {
              id: jobId,
              title: sub.jobTitle || 'Micro Task Assignment',
              price_per_task: Number(sub.pricePerTask) > 0 ? Number(sub.pricePerTask) : 0.25,
              display_id: formatJobDisplayId(null, jobId),
            };

        const workerObj = matchedWorker
          ? {
              id: matchedWorker.id,
              display_id: matchedWorker.display_id ?? matchedWorker.displayId ?? sub.worker_display_id ?? null,
            }
          : {
              id: workerId,
              display_id: sub.worker_display_id ?? null,
            };

        const screenshotUrls = parseProofScreenshots(sub);
        const singleUrl = screenshotUrls[0] || '';

        return {
          ...sub,
          id: sub.id,
          jobId: jobId,
          workerId: workerId,
          proof: sub.proof_text || sub.proofText || sub.proof || '',
          screenshotUrl: singleUrl,
          screenshotUrls: screenshotUrls,
          status: sub.status || 'pending',
          createdAt: sub.created_at || sub.submittedAt || sub.createdAt,
          job: jobObj,
          worker: workerObj,
        };
      });

      setSubmissions(merged);
    } catch {
      const localSubs = getLocalSubmissions();
      const localJobs = getLocalJobs();
      const formatted = localSubs.map((s: any) => {
        const job = localJobs.find((j) => j.id === s.job_id) as any || {};
        const screenshotUrls = parseProofScreenshots(s);
        const singleUrl = screenshotUrls[0] || '';

        return {
          ...s,
          id: s.id,
          jobId: s.job_id,
          workerId: s.worker_id || s.user_id,
          proof: s.proof_text || s.proof || '',
          screenshotUrl: singleUrl,
          screenshotUrls: screenshotUrls,
          status: s.status || 'pending',
          createdAt: s.created_at,
          job: {
            id: s.job_id,
            title: job.title || 'Micro Task Assignment',
            price_per_task: Number(job.price_per_task || 0.25),
            display_id: formatJobDisplayId(job.display_id || job.displayId, s.job_id),
          },
          worker: {
            id: s.worker_id || s.user_id,
            display_id: null,
          },
        };
      });
      setSubmissions(formatted);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (submission: any) => {
    // ১. ডাবল পেমেন্ট ও ডাবল ক্লিক বন্ধ করার সিকিউরিটি চেক
    if (actionLockRef.current.has(submission.id) || submission.status !== 'pending') {
      return;
    }
    actionLockRef.current.add(submission.id);
    setActionLoading(submission.id);
    try {
      await approveSubmission(submission.id, submission.jobId || submission.job_id, submission.workerId || submission.worker_id);
      setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, status: 'approved', reviewed_at: new Date().toISOString(), proof_screenshot_url: null, proof_file_url: null, screenshotUrl: '', screenshotUrls: [] } : s));
      toast.success("কাজটি অ্যাপ্রুভ করা হয়েছে!");
      await fetchSubmissions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'অ্যাপ্রুভ করতে সমস্যা হয়েছে।');
      actionLockRef.current.delete(submission.id);
      await fetchSubmissions();
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmReject = async (reason: string) => {
    if (!rejectingSub) return;
    const submission = rejectingSub;
    if (actionLockRef.current.has(submission.id)) return;
    actionLockRef.current.add(submission.id);
    setActionLoading(submission.id);
    try {
      await rejectSubmission(submission.id, submission.jobId || submission.job_id, reason);
      setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString(), proof_screenshot_url: null, proof_file_url: null, screenshotUrl: '', screenshotUrls: [] } : s));
      setRejectingSub(null);
      toast.success("কাজটি রিজেক্ট করা হয়েছে!");
      await fetchSubmissions();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'রিজেক্ট করতে সমস্যা হয়েছে।');
      actionLockRef.current.delete(submission.id);
      await fetchSubmissions();
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = submissions.filter(s => s.status === 'pending').length;
  const approvedCount = submissions.filter(s => s.status === 'approved').length;
  const rejectedCount = submissions.filter(s => s.status === 'rejected').length;

  const displayedSubmissions = activeTab === 'all' 
    ? submissions 
    : submissions.filter(s => s.status === activeTab);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Mission Submissions</h1>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">
            Review worker proofs, approve payouts, and manage verification tasks.
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-bold border border-purple-200 dark:border-purple-500/30 shadow-sm dark:shadow-lg dark:shadow-black/40">
          Total Submissions: {submissions.length}
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/25 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending ({pendingCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'approved'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Approved ({approvedCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'rejected'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected ({rejectedCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>All ({submissions.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-500/30">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-md rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 border border-slate-200 dark:border-purple-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-purple-950/40 border-b border-slate-200 dark:border-purple-500/20">
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Mission / Job</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Worker</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Date & Time (তারিখ ও সময়)</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Reward</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Proof</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
              {displayedSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-purple-300/60 font-bold">
                    No submissions found for this status.
                  </td>
                </tr>
              ) : (
                displayedSubmissions.map(submission => (
                  <tr key={submission.id} className="hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                        {submission.job?.title || 'Unknown Job'}
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-purple-400/60 mt-0.5">
                        (ID: #{submission.job?.display_id})
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-mono text-purple-700 dark:text-amber-300 font-bold">
                        User #{formatUserDisplayId(submission.worker?.display_id, submission.workerId)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-bold text-slate-700 dark:text-purple-200 font-mono">
                        {formatDateTime(submission.createdAt)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-black text-emerald-600 dark:text-amber-400 font-mono">
                        +${submission.job?.price_per_task ? Number(submission.job.price_per_task).toFixed(2) : '0.25'}
                      </span>
                    </td>
                    <td className="py-4 px-6 max-w-xs">
                      <p className="text-sm text-slate-700 dark:text-purple-200/90 font-medium line-clamp-2" title={submission.proof}>
                        {submission.proof || 'No written text provided'}
                      </p>
                      {((submission.screenshotUrls && submission.screenshotUrls.length > 0) || submission.screenshotUrl) && (
                        <button 
                          type="button"
                          onClick={() => openScreenshotModal(submission.screenshotUrls && submission.screenshotUrls.length > 0 ? submission.screenshotUrls : [submission.screenshotUrl], submission)} 
                          className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-amber-400 hover:text-purple-800 dark:hover:text-amber-300 font-bold mt-1.5 px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/40 transition-all hover:border-purple-300 dark:hover:border-amber-400/50 shadow-sm"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-purple-600 dark:text-amber-400" />
                          View Screenshot{submission.screenshotUrls && submission.screenshotUrls.length > 1 ? `s (${submission.screenshotUrls.length})` : ''}
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide border uppercase ${
                        submission.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30' :
                        submission.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                      }`}>
                        {submission.status}
                      </span>
                      {(submission.rejection_reason || submission.rejectionReason) && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-1 line-clamp-1">
                          কারণ: {submission.rejection_reason || submission.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {submission.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={actionLoading === submission.id || actionLockRef.current.has(submission.id)}
                            onClick={() => handleApprove(submission)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            disabled={actionLoading === submission.id || actionLockRef.current.has(submission.id)}
                            onClick={() => setRejectingSub(submission)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            submission.status === 'approved' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {submission.status === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Rejection Reason Modal */}
      <RejectionReasonModal
        isOpen={Boolean(rejectingSub)}
        onClose={() => setRejectingSub(null)}
        onConfirm={handleConfirmReject}
        isProcessing={actionLoading === rejectingSub?.id}
        jobTitle={rejectingSub?.job?.title}
      />

      {/* Interactive Screenshot Preview Modal */}
      {isModalOpen && selectedScreenshots.length > 0 && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
          onClick={closeScreenshotModal}
        >
          <div 
            className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-purple-900/40 bg-slate-50/50 dark:bg-purple-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-amber-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Submitted Proof Screenshot{selectedScreenshots.length > 1 ? 's' : ''}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-purple-300/70 font-medium">
                    {selectedScreenshots.length} image{selectedScreenshots.length > 1 ? 's' : ''} uploaded for verification
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeScreenshotModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-purple-900/40 hover:bg-slate-200 dark:hover:bg-purple-800/60 transition-colors"
                title="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)] space-y-6">
              {selectedSubmissionModal?.status !== 'pending' ? (
                <div className="flex flex-col items-center justify-center p-6 bg-slate-100 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                  <ImageOff className="w-10 h-10 text-slate-400 mb-2"/>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Screenshot deleted after review</span>
                </div>
              ) : selectedScreenshots.length === 1 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full flex justify-center bg-slate-900/80 dark:bg-[#080412] p-3 rounded-2xl border border-slate-200 dark:border-purple-900/50">
                    <FallbackImage
                      src={selectedScreenshots[0]}
                      alt="Proof Screenshot"
                      className="max-h-[65vh] w-auto object-contain rounded-xl shadow-md"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedScreenshots.map((url, idx) => (
                    <div 
                      key={idx} 
                      className="bg-slate-50 dark:bg-[#080412]/90 border border-slate-200 dark:border-purple-900/40 rounded-2xl p-4 flex flex-col items-center gap-3"
                    >
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-700 dark:text-amber-300 uppercase tracking-wider">
                          Screenshot #{idx + 1}
                        </span>
                      </div>
                      <div className="w-full flex justify-center bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                        <FallbackImage
                          src={url}
                          alt={`Screenshot ${idx + 1}`}
                          className="max-h-[300px] w-auto object-contain rounded-lg"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-purple-900/40 bg-slate-50/50 dark:bg-purple-950/40 flex justify-end">
              <button
                type="button"
                onClick={closeScreenshotModal}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-purple-900/50 hover:bg-slate-300 dark:hover:bg-purple-800/60 text-slate-800 dark:text-purple-200 text-xs font-bold transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
