import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, toValidUUID, formatJobDisplayId, formatUserDisplayId } from '../lib/supabaseClient';
import { approveSubmission, rejectSubmission, deleteJob } from '../lib/jobService';
import { Briefcase, Users, FileCheck, X, CheckCircle, XCircle, Trash2, ImageIcon, Eye, ImageOff } from 'lucide-react';
import {
  getLocalJobs,
  getLocalSubmissions,
  isTableMissingError,
} from '../lib/localFallbackStore';
import toast from 'react-hot-toast';

const FallbackImage = ({ src, alt, className }: { src: string, alt: string, className: string }) => {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-800/80 rounded-lg text-slate-400 ${className} min-h-[100px]`}>
        <ImageOff className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-center px-2">Deleted / Unavailable</span>
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

export default function MyJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal State
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  const fetchMyJobs = async () => {
    if (!user) return;
    const userUuid = toValidUUID(user.uid);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('owner_id', user.uid)
        .order('created_at', { ascending: false });

      if (error && isTableMissingError(error)) {
        const local = getLocalJobs()
          .filter((j) => j.owner_id === user.uid || j.employer_id === user.uid || j.owner_id === userUuid)
          .map((j: any) => ({
            id: j.id,
            title: j.title || 'Untitled Mission',
            category: j.category || 'General',
            location: j.location || 'GLOBAL',
            totalSlots: Number(j.total_slots ?? j.totalSlots ?? 0),
            occupiedSlots: Number(j.occupied_slots ?? j.occupiedSlots ?? 0),
            pricePerTask: Number(j.price_per_task ?? j.pricePerTask ?? 0),
            status: j.status || 'pending',
            rejectionReason: j.rejection_reason || j.rejectionReason,
            createdAt: j.created_at || j.createdAt,
          }));
        setJobs(local);
        return;
      }

      if (data) {
        const formatted = (data || []).map((j: any) => {
          let scInst = j.screenshot_instructions ?? j.screenshotInstructions ?? [];
          if (typeof scInst === 'string') {
            try { scInst = JSON.parse(scInst); } catch { scInst = []; }
          }
          return {
            id: j.id,
            display_id: j.display_id ?? j.displayId,
            displayId: j.display_id ?? j.displayId,
            title: j.title || 'Untitled Mission',
            category: j.category || 'General',
            location: j.location || 'GLOBAL',
            totalSlots: Number(j.total_slots ?? j.totalSlots ?? 0),
            occupiedSlots: Number(j.occupied_slots ?? j.occupiedSlots ?? 0),
            pricePerTask: Number(j.price_per_task ?? j.pricePerTask ?? 0),
            status: j.status || 'pending',
            rejectionReason: j.rejection_reason || j.rejectionReason,
            text_proof_instruction: j.text_proof_instruction || j.text_proof_requirement || j.textProofRequirement || '',
            screenshot_instructions: scInst,
            createdAt: j.created_at || j.createdAt,
          };
        });

        setJobs(formatted);
      } else {
        const local = getLocalJobs()
          .filter((j) => j.owner_id === user.uid || j.employer_id === user.uid)
          .map((j: any) => {
            let scInst = j.screenshot_instructions ?? j.screenshotInstructions ?? [];
            if (typeof scInst === 'string') {
              try { scInst = JSON.parse(scInst); } catch { scInst = []; }
            }
            return {
              id: j.id,
              title: j.title || 'Untitled Mission',
              category: j.category || 'General',
              location: j.location || 'GLOBAL',
              totalSlots: Number(j.total_slots ?? j.totalSlots ?? 0),
              occupiedSlots: Number(j.occupied_slots ?? j.occupiedSlots ?? 0),
              pricePerTask: Number(j.price_per_task ?? j.pricePerTask ?? 0),
              status: j.status || 'pending',
              rejectionReason: j.rejection_reason || j.rejectionReason,
              text_proof_instruction: j.text_proof_instruction || j.text_proof_requirement || j.textProofRequirement || '',
              screenshot_instructions: scInst,
              createdAt: j.created_at || j.createdAt,
            };
          });
        setJobs(local);
      }
    } catch {
      const local = getLocalJobs()
        .filter((j) => j.owner_id === user.uid || j.employer_id === user.uid)
        .map((j: any) => ({
          id: j.id,
          title: j.title || 'Untitled Mission',
          category: j.category || 'General',
          location: j.location || 'GLOBAL',
          totalSlots: Number(j.total_slots ?? j.totalSlots ?? 0),
          occupiedSlots: Number(j.occupied_slots ?? j.occupiedSlots ?? 0),
          pricePerTask: Number(j.price_per_task ?? j.pricePerTask ?? 0),
          status: j.status || 'pending',
          rejectionReason: j.rejection_reason || j.rejectionReason,
          createdAt: j.created_at || j.createdAt,
        }));
      setJobs(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyJobs();

    if (!user) return;
    try {
      const channel = supabase
        .channel('my-jobs-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
          fetchMyJobs();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Channel fallback
    }
  }, [user]);

  // Load Submissions when a job is selected
  const fetchSubmissionsForJob = async (jobId: string) => {
    setLoadingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error && isTableMissingError(error)) {
        const local = getLocalSubmissions()
          .filter((s) => s.job_id === jobId)
          .map((s: any) => ({
            id: s.id,
            jobId: s.job_id,
            workerId: s.worker_id,
            proofText: s.proof_text || s.proof || '',
            proofScreenshotUrl: s.proof_screenshot_url || '',
            proofScreenshotUrls: s.proof_screenshot_urls || (s.proof_screenshot_url ? [s.proof_screenshot_url] : []),
            status: s.status || 'pending',
            createdAt: s.created_at,
          }));
        setSubmissions(local);
        return;
      }

      if (data && data.length > 0) {
        const workerIds = Array.from(new Set(data.map((s: any) => s.worker_id || s.workerId).filter(Boolean)));
        let workersMap: Record<string, any> = {};

        if (workerIds.length > 0) {
          try {
            const { data: workersData } = await supabase
              .from('users')
              .select('id, display_id, displayId')
              .in('id', workerIds);

            (workersData || []).forEach((w: any) => {
              workersMap[w.id] = w;
            });
          } catch {}
        }

        const formattedSubs = data.map((s: any) => {
          const urls = s.proof_screenshot_urls ?? s.proofScreenshotUrls ?? (s.proof_screenshot_url ? [s.proof_screenshot_url] : []);
          const wId = s.worker_id || s.workerId;
          const matchedWorker = workersMap[wId];
          const workerDisplay = matchedWorker?.display_id ?? matchedWorker?.displayId ?? wId?.substring(0, 8);

          return {
            id: s.id,
            jobId: s.job_id || s.jobId,
            workerId: wId,
            workerDisplayId: workerDisplay,
            proofText: s.proof_text || s.proofText || s.proof || '',
            proofScreenshotUrl: s.proof_screenshot_url || s.proofScreenshotUrl || (urls[0] || ''),
            proofScreenshotUrls: Array.isArray(urls) ? urls : (urls ? [urls] : []),
            status: s.status || 'pending',
            createdAt: s.created_at || s.submittedAt || s.createdAt,
          };
        });
        setSubmissions(formattedSubs);
      } else {
        const local = getLocalSubmissions()
          .filter((s) => s.job_id === jobId && s.status === 'pending')
          .map((s: any) => ({
            id: s.id,
            jobId: s.job_id,
            workerId: s.worker_id,
            proofText: s.proof_text || s.proof || '',
            proofScreenshotUrl: s.proof_screenshot_url || '',
            proofScreenshotUrls: s.proof_screenshot_urls || (s.proof_screenshot_url ? [s.proof_screenshot_url] : []),
            status: s.status || 'pending',
            createdAt: s.created_at,
          }));
        setSubmissions(local);
      }
    } catch {
      const local = getLocalSubmissions()
        .filter((s) => s.job_id === jobId && s.status === 'pending')
        .map((s: any) => ({
          id: s.id,
          jobId: s.job_id,
          workerId: s.worker_id,
          proofText: s.proof_text || s.proof || '',
          proofScreenshotUrl: s.proof_screenshot_url || '',
          proofScreenshotUrls: s.proof_screenshot_urls || (s.proof_screenshot_url ? [s.proof_screenshot_url] : []),
          status: s.status || 'pending',
          createdAt: s.created_at,
        }));
      setSubmissions(local);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (!selectedJob) {
      setSubmissions([]);
      return;
    }

    fetchSubmissionsForJob(selectedJob.id);

    const subChannel = supabase
      .channel(`subs-channel-${selectedJob.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchSubmissionsForJob(selectedJob.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subChannel);
    };
  }, [selectedJob]);

  const handleApprove = async (subId: string, workerId: string) => {
    if (!selectedJob) return;
    const sub = submissions.find(s => s.id === subId);
    if (sub && sub.status !== 'pending') {
      toast.error("This submission has already been reviewed!");
      return;
    }
    setActionLoading(subId);
    try {
      await approveSubmission(subId, selectedJob.id, workerId);
      toast.success('Submission approved and worker paid!');
      fetchSubmissionsForJob(selectedJob.id);
      fetchMyJobs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve submission');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (subId: string) => {
    if (!selectedJob) return;
    const sub = submissions.find(s => s.id === subId);
    if (sub && sub.status !== 'pending') {
      toast.error("This submission has already been reviewed!");
      return;
    }
    const reason = window.prompt('Please provide a brief reason for rejection:');
    if (reason === null) return; // cancelled
    
    setActionLoading(subId);
    try {
      await rejectSubmission(subId, selectedJob.id, reason);
      toast.success('Submission rejected and slot reopened');
      fetchSubmissionsForJob(selectedJob.id);
      fetchMyJobs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject submission');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = async (jobId: string, jobTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${jobTitle}"? Any unspent budget will be refunded to your balance.`)) {
      return;
    }

    try {
      await deleteJob(jobId, user?.uid || '');
      toast.success('Job deleted and unused budget refunded');
      fetchMyJobs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete job');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          My Posted Jobs
        </h1>
        <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">
          Manage your active campaigns, verify submitted proofs, and approve completed tasks.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-2xl p-12 text-center flex flex-col items-center">
          <Briefcase className="w-12 h-12 text-slate-400 dark:text-purple-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Jobs Posted</h3>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm font-medium">You haven't posted any jobs yet. Head over to the Post Job page to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white dark:bg-[#130b2c]/85 dark:backdrop-blur-md rounded-2xl shadow-sm dark:shadow-lg dark:shadow-purple-950/40 border border-slate-200 dark:border-purple-500/20 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-purple-300 dark:hover:border-amber-400/40">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-800/50 text-xs font-mono font-bold">
                    Job ID: #{formatJobDisplayId(job.display_id || job.displayId, job.id)}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{job.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-purple-200/80 font-medium">
                  <span className="inline-flex items-center">
                    <Users className="w-4 h-4 mr-1 text-purple-600 dark:text-amber-400" />
                    {job.occupiedSlots}/{job.totalSlots} Slots
                  </span>
                  <span className="hidden sm:inline text-slate-300 dark:text-purple-400/50">•</span>
                  <span className="font-black text-slate-900 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">${job.pricePerTask.toFixed(2)}/task</span>
                  <span className="hidden sm:inline text-slate-300 dark:text-purple-400/50">•</span>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wide border uppercase ${
                    job.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60' :
                    job.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60' :
                    job.status === 'completed' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60' :
                    'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60'
                  }`}>
                    {job.status}
                  </span>
                </div>
                {job.status === 'rejected' && job.rejectionReason && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                    Reason for rejection: {job.rejectionReason} (Budget refunded)
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setSelectedJob(job)}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-2 bg-purple-50 dark:bg-[#080412] text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-amber-400/30 rounded-xl text-sm font-bold hover:bg-purple-600 hover:text-white dark:hover:bg-gradient-to-r dark:hover:from-amber-400 dark:hover:to-yellow-500 dark:hover:text-slate-950 transition-colors shadow-sm"
                >
                  <FileCheck className="w-4 h-4 mr-2" />
                  Review Submissions
                </button>
                <button
                  onClick={() => handleDeleteJob(job.id, job.title)}
                  title="Delete Job"
                  className="p-2 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 dark:hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white border border-red-200 dark:border-red-800/60 rounded-xl text-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-purple-900/40 bg-slate-50 dark:bg-[#080412]/80">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Review: {selectedJob.title}</h2>
                <p className="text-xs text-slate-500 dark:text-purple-300/70 mt-1 font-medium">Showing pending worker submissions for verification</p>
              </div>
              <button 
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {loadingSubmissions ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 dark:border-amber-400"></div>
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 mb-4">
                    <CheckCircle className="w-6 h-6 text-purple-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">All caught up!</h3>
                  <p className="text-xs text-slate-500 dark:text-purple-300/70 mt-1 font-medium">No pending submissions to review right now.</p>
                </div>
              ) : (
                submissions.map((sub) => (
                  <div key={sub.id} className="bg-slate-50 dark:bg-[#080412]/90 border border-slate-200 dark:border-purple-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="text-xs font-bold text-slate-700 dark:text-purple-200">
                        Worker: <span className="font-mono text-purple-600 dark:text-amber-400 ml-1 bg-white dark:bg-[#130b2c] px-2 py-0.5 rounded border border-slate-200 dark:border-purple-500/30">Worker #{formatUserDisplayId(sub.workerDisplayId, sub.workerId)}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-purple-400/60 font-medium">
                        {sub.createdAt ? new Date(sub.createdAt).toLocaleString() : 'Just now'}
                      </div>
                    </div>
                    
                    {/* Text Proof Box */}
                    <div className="bg-white dark:bg-[#130b2c] rounded-xl p-4 border border-slate-200 dark:border-purple-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-purple-700 dark:text-amber-300 uppercase tracking-wider">Submitted Text Proof:</h4>
                        {selectedJob?.text_proof_instruction && (
                          <span className="text-[11px] text-slate-500 dark:text-purple-300/70 font-semibold italic">
                            Requirement: "{selectedJob.text_proof_instruction}"
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 dark:text-purple-100 whitespace-pre-wrap font-mono">{sub.proofText || 'No text proof provided'}</p>
                    </div>
                    {/* Screenshot Proofs */}
                    {sub.proofScreenshotUrls && sub.proofScreenshotUrls.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-600 dark:text-amber-400" />
                          Submitted Screenshots ({sub.proofScreenshotUrls.length}):
                        </h4>
                        
                        {sub.reviewed_at && (new Date().getTime() - new Date(sub.reviewed_at).getTime() > 3600000) ? (
                          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-[#130b2c]/80 rounded-xl border border-slate-200 dark:border-purple-500/30 text-center">
                            <ImageOff className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-3 opacity-50" />
                            <h5 className="text-sm font-bold text-slate-800 dark:text-purple-200 mb-1">Screenshots Expired</h5>
                            <p className="text-xs text-slate-500 dark:text-purple-300/70 max-w-sm">
                              Screenshots have expired and been removed for security/storage reasons. They are only visible for 1 hour after review.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {sub.proofScreenshotUrls.map((imgUrl: string, imgIdx: number) => {
                              const inst = selectedJob?.screenshot_instructions?.[imgIdx];
                              return (
                                <div 
                                  key={imgIdx}
                                  onClick={() => setPreviewModalImg(imgUrl)}
                                  className="relative group h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-purple-500/30 bg-white dark:bg-[#130b2c] cursor-pointer flex flex-col justify-end"
                                >
                                  <FallbackImage src={imgUrl} alt={`Proof ${imgIdx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                                  {inst && (
                                    <div className="relative z-10 bg-black/75 px-2 py-1 text-[10px] text-amber-300 font-bold truncate">
                                      #{imgIdx + 1}: {inst}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 z-20">
                                    <Eye className="w-4 h-4" /> View #{imgIdx + 1}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                       
                    {sub.status === 'pending' ? (
                      <div className="flex gap-3 justify-end pt-2">
                        <button
                          disabled={actionLoading === sub.id}
                          onClick={() => handleReject(sub.id)}
                          className="inline-flex items-center px-4 py-2 border border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50 bg-white dark:bg-transparent"
                        >
                          <XCircle className="w-4 h-4 mr-1.5" />
                          Reject & Reopen Slot
                        </button>
                        <button
                          disabled={actionLoading === sub.id}
                          onClick={() => handleApprove(sub.id, sub.workerId)}
                          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 text-white dark:text-slate-950 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20"
                        >
                          <CheckCircle className="w-4 h-4 mr-1.5" />
                          Approve & Pay Worker
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end pt-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border uppercase ${
                          sub.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30' :
                          'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30'
                        }`}>
                          {sub.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewModalImg && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewModalImg(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-[#130b2c] rounded-2xl overflow-hidden border border-purple-500/30 p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewModalImg(null)}
              className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-black text-white rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <FallbackImage src={previewModalImg} alt="Enlarged Proof" className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
