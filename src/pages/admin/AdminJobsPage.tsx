import React, { useEffect, useState } from 'react';
import { supabase, formatJobDisplayId, formatDateTime } from '../../lib/supabaseClient';
import { adminApproveJob, adminRejectJob, deleteJob } from '../../lib/jobService';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  DollarSign, 
  Briefcase, 
  AlertCircle, 
  Search,
  Check,
  X,
  FileText,
  Tag,
  MapPin,
  RefreshCw,
  Trash2,
  ImageIcon,
  Eye
} from 'lucide-react';
import { getLocalJobs, isTableMissingError } from '../../lib/localFallbackStore';
import { extractJobImageUrl, cleanJobDescription } from '../../lib/jobImages';
import toast from 'react-hot-toast';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedRejectJob, setSelectedRejectJob] = useState<any | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not comply with community guidelines');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && isTableMissingError(error)) {
        const local = getLocalJobs().map((j: any) => ({
          id: j.id,
          title: j.title,
          description: j.description || j.instructions,
          category: j.category || 'General',
          location: j.location || 'GLOBAL',
          pricePerTask: Number(j.price_per_task || j.pricePerTask || j.price || 0),
          totalSlots: Number(j.total_slots || j.totalSlots || j.spots || 0),
          occupiedSlots: Number(j.occupied_slots || j.occupiedSlots || 0),
          ownerId: j.owner_id || j.ownerId || j.employer_id || j.employerId,
          status: j.status || 'pending',
          requiredScreenshots: Number(j.required_screenshots || j.requiredScreenshots || 0),
          requireTextProof: j.require_text_proof ?? j.requireTextProof ?? true,
          imageUrl: extractJobImageUrl(j) || '',
          rejectionReason: j.rejection_reason || j.rejectionReason,
          createdAt: j.created_at || j.createdAt
        }));
        setJobs(local);
        setLoading(false);
        return;
      }

      if (error) {
        console.error('Fetch jobs error:', error);
        setStatusMessage({ type: 'error', text: `জব লোড করতে সমস্যা হয়েছে: ${error.message}` });
        setLoading(false);
        return;
      }

      const jobList: any[] = (data || []).map((j: any) => ({
        id: j.id,
        display_id: j.display_id ?? j.displayId,
        displayId: j.display_id ?? j.displayId,
        title: j.title,
        description: j.description || j.instructions,
        category: j.category || 'General',
        location: j.location || 'GLOBAL',
        pricePerTask: Number(j.price_per_task || j.pricePerTask || j.price || 0),
        totalSlots: Number(j.total_slots || j.totalSlots || j.spots || 0),
        occupiedSlots: Number(j.occupied_slots || j.occupiedSlots || 0),
        ownerId: j.owner_id || j.ownerId || j.employer_id || j.employerId,
        status: j.status || 'pending',
        requiredScreenshots: Number(j.required_screenshots || j.requiredScreenshots || 0),
        requireTextProof: j.require_text_proof ?? j.requireTextProof ?? true,
        imageUrl: extractJobImageUrl(j) || '',
        rejectionReason: j.rejection_reason || j.rejectionReason,
        createdAt: j.created_at || j.createdAt
      }));

      setJobs(jobList);
      // Synchronize browser local storage with raw DB records so old ghost jobs don't linger
      try {
        localStorage.setItem('iz_fallback_jobs', JSON.stringify(data || []));
      } catch {}
      setLoading(false);

      // Fetch employer emails
      const ownerIds = Array.from(new Set(jobList.map(j => j.ownerId).filter(Boolean)));
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
    } catch {
      const local = getLocalJobs().map((j: any) => ({
        id: j.id,
        title: j.title,
        description: j.description || j.instructions,
        category: j.category || 'General',
        location: j.location || 'GLOBAL',
        pricePerTask: Number(j.price_per_task || j.pricePerTask || j.price || 0),
        totalSlots: Number(j.total_slots || j.totalSlots || j.spots || 0),
        occupiedSlots: Number(j.occupied_slots || j.occupiedSlots || 0),
        ownerId: j.owner_id || j.ownerId || j.employer_id || j.employerId,
        status: j.status || 'pending',
        requiredScreenshots: Number(j.required_screenshots || j.requiredScreenshots || 0),
        requireTextProof: j.require_text_proof ?? j.requireTextProof ?? true,
        imageUrl: extractJobImageUrl(j) || '',
        rejectionReason: j.rejection_reason || j.rejectionReason,
        createdAt: j.created_at || j.createdAt
      }));
      setJobs(local);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Subscribe to realtime changes in jobs table
    const channel = supabase
      .channel('admin-jobs-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (jobId: string, title: string) => {
    try {
      setActionLoading(jobId);
      setStatusMessage(null);
      await adminApproveJob(jobId);
      await fetchJobs();
      toast.success(`Job "${title}" অ্যাপ্রুভ করা হয়েছে!`);
      setStatusMessage({
        type: 'success',
        text: `Job "${title}" has been approved and is now live in Find Jobs!`
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Approve job error:', err);
      const msg = err?.message || 'Failed to approve job. Please try again.';
      toast.error(msg);
      setStatusMessage({
        type: 'error',
        text: msg
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedRejectJob) return;
    const jobId = selectedRejectJob.id;
    const totalRefund = (Number(selectedRejectJob.pricePerTask) || 0) * (Number(selectedRejectJob.totalSlots) || 0);

    try {
      setActionLoading(jobId);
      setStatusMessage(null);
      await adminRejectJob(jobId, rejectReason);
      await fetchJobs();
      setSelectedRejectJob(null);
      setRejectReason('Does not comply with community guidelines');
      toast.success('জবটি রিজেক্ট ও ব্যালেন্স রিফান্ড করা হয়েছে!');
      setStatusMessage({
        type: 'success',
        text: `Job rejected. $${totalRefund.toFixed(2)} was refunded to the employer's deposit balance.`
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Reject job error:', err);
      const msg = err?.message || 'Failed to reject and refund job.';
      toast.error(msg);
      setStatusMessage({
        type: 'error',
        text: msg
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = async (jobId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete job "${title}"?`)) return;
    try {
      setActionLoading(jobId);
      setStatusMessage(null);
      await deleteJob(jobId);
      await fetchJobs();
      toast.success(`Job "${title}" স্থায়ীভাবে ডিলিট করা হয়েছে।`);
      setStatusMessage({
        type: 'success',
        text: `Job "${title}" deleted permanently.`
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Delete job error:', err);
      const msg = err?.message || 'Failed to delete job.';
      toast.error(msg);
      setStatusMessage({
        type: 'error',
        text: msg
      });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const activeJobs = jobs.filter(j => j.status === 'active');

  const filteredJobs = jobs.filter(job => {
    const matchesTab = activeTab === 'all' ? true : job.status === activeTab;
    const matchesSearch = searchQuery === '' || 
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userEmails[job.ownerId]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.id?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 hardware-accelerate">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-purple-600 dark:text-amber-400" />
            Job Management & Approvals
          </h1>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">
            Review submitted micro-jobs, approve active listings, or reject and refund employer deposit balances.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-purple-200">Pending:</span>
            <span className="text-base font-black text-amber-600 dark:text-amber-400">{pendingJobs.length}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-purple-200">Active:</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{activeJobs.length}</span>
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
            Pending Approvals
            {pendingJobs.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'pending' ? 'bg-white text-purple-600 dark:bg-slate-950 dark:text-amber-400' : 'bg-purple-100 text-purple-700 dark:bg-amber-400 dark:text-slate-950'
              }`}>
                {pendingJobs.length}
              </span>
            )}
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
            Active ({activeJobs.length})
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-purple-500/20'
            }`}
          >
            All ({jobs.length})
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 dark:text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search jobs, category, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Jobs Table / List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-purple-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">No Jobs in this View</h3>
          <p className="text-slate-500 dark:text-purple-300/60 text-xs max-w-sm">
            {activeTab === 'pending' ? 'All submitted jobs have been reviewed!' : 'No jobs matching the criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => {
            const price = Number(job.pricePerTask) || 0;
            const slots = Number(job.totalSlots) || 0;
            const occupied = Number(job.occupiedSlots) || 0;
            const totalBudget = price * slots;
            const employerEmail = userEmails[job.ownerId] || job.ownerId || 'Unknown';
            const isPending = job.status === 'pending';
            const isProcessing = actionLoading === job.id;

            return (
              <div 
                key={job.id} 
                className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/25 hover:border-purple-300 dark:hover:border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-xl flex flex-col gap-4"
              >
                {/* Top Row: Meta Tags, Status & Employer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-purple-900/50 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide border ${
                      job.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' :
                      job.status === 'rejected' ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30' :
                      'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
                    }`}>
                      {job.status?.toUpperCase()}
                    </span>

                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-500/20">
                      <Tag className="w-3 h-3 mr-1 text-purple-500 dark:text-amber-400" />
                      {job.category || 'General'}
                    </span>

                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 text-xs font-medium border border-slate-200 dark:border-purple-500/20">
                      <MapPin className="w-3 h-3 mr-1 text-slate-500 dark:text-amber-400" />
                      {job.location || 'GLOBAL'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-purple-300/80 font-medium">
                    Employer: <span className="font-bold text-slate-900 dark:text-white ml-1">{employerEmail}</span>
                  </div>
                </div>

                {/* Middle: Thumbnail, Title & Description */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-2">
                    <div className="flex items-start gap-3">
                      {job.imageUrl && (
                        <div 
                          onClick={() => setPreviewModalImg(job.imageUrl)}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-purple-200 dark:border-purple-500/30 bg-slate-100 dark:bg-[#080412] flex-shrink-0 cursor-pointer group relative shadow-xs"
                          title="Click to view full image"
                        >
                          <img 
                            src={job.imageUrl} 
                            alt={job.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4 text-amber-300" />
                          </div>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{job.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-purple-300/70 mt-0.5 line-clamp-1">
                          Category: <span className="font-semibold text-purple-600 dark:text-amber-400">{job.category}</span>
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-[#0a0718] rounded-xl border border-slate-200 dark:border-purple-900/40 text-xs text-slate-600 dark:text-purple-200/90 leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap">
                      {cleanJobDescription(job.description)}
                    </div>
                  </div>

                  {/* Pricing & Slot Box */}
                  <div className="bg-slate-50 dark:bg-[#180d38] border border-slate-200 dark:border-purple-500/20 rounded-xl p-4 flex flex-col justify-between gap-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-purple-400 font-bold block">Reward / Task</span>
                        <span className="text-base font-black text-amber-600 dark:text-amber-400">${price.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-purple-400 font-bold block">Total Slots</span>
                        <span className="text-base font-black text-slate-900 dark:text-white">{occupied} / {slots}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-purple-400 font-bold block">Total Budget</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${totalBudget.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-purple-400 font-bold block">Screenshots</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{job.requiredScreenshots || 0} Req</span>
                      </div>
                    </div>

                    {job.rejectionReason && (
                      <div className="text-[11px] p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded text-red-700 dark:text-red-300">
                        Reason: {job.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-purple-900/50">
                  <span className="text-xs text-slate-400 dark:text-purple-400/60 font-mono">
                    Job ID: #{formatJobDisplayId(job.display_id || job.displayId, job.id)} • Posted: {formatDateTime(job.createdAt)}
                  </span>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => setSelectedRejectJob(job)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-500/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          Reject & Refund (${totalBudget.toFixed(2)})
                        </button>

                        <button
                          onClick={() => handleApprove(job.id, job.title)}
                          disabled={isProcessing}
                          className="flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black text-white dark:text-slate-950 bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-400 hover:bg-purple-700 dark:hover:from-amber-300 dark:hover:to-yellow-300 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
                        >
                          {isProcessing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Approve Job
                        </button>
                      </>
                    ) : job.status === 'active' ? (
                      <button
                        onClick={() => setSelectedRejectJob(job)}
                        disabled={isProcessing}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-500/25 transition-all flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Revoke & Refund
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-purple-400 font-bold">Processed</span>
                    )}

                    <button
                      onClick={() => handleDeleteJob(job.id, job.title)}
                      disabled={isProcessing}
                      title="Delete Job Permanently"
                      className="p-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white dark:hover:bg-red-500 dark:hover:text-white border border-red-200 dark:border-red-500/25 transition-all flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {selectedRejectJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/40 rounded-2xl p-6 max-w-md w-full shadow-xl dark:shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-purple-900/50 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                Reject & Refund Job
              </h3>
              <button 
                onClick={() => setSelectedRejectJob(null)}
                className="text-slate-500 hover:text-slate-700 dark:text-purple-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-purple-200/80 leading-relaxed">
              Rejecting <strong className="text-slate-900 dark:text-white">"{selectedRejectJob.title}"</strong> will immediately refund <strong className="text-emerald-600 dark:text-emerald-400">${((Number(selectedRejectJob.pricePerTask) || 0) * (Number(selectedRejectJob.totalSlots) || 0)).toFixed(2)}</strong> back to the employer's Deposit Balance.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1.5">
                Rejection Reason
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedRejectJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-purple-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-[#180d38]"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={actionLoading === selectedRejectJob.id}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center gap-1.5"
              >
                Confirm Rejection & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Image Preview Modal */}
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
            <img src={previewModalImg} alt="Enlarged Job Thumbnail" className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
