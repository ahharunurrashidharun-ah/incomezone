import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Users, 
  Globe, 
  SearchX, 
  Tag, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Send,
  Sparkles,
  ExternalLink,
  Megaphone,
  ImageIcon,
  Upload,
  X,
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, toValidUUID, formatJobDisplayId, formatUserDisplayId } from '../lib/supabaseClient';
import { submitJobProof, uploadFile } from '../lib/jobService';
import { compressImage } from '../lib/imageCompression';
import { getLocalJobs, getLocalAds, getLocalSubmissions, isTableMissingError } from '../lib/localFallbackStore';
import toast from 'react-hot-toast';

export default function FindJobPage() {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [submittedJobIds, setSubmittedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Full-Screen Job Details State
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [proofText, setProofText] = useState('');
  const [screenshotFiles, setScreenshotFiles] = useState<(File | null)[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  const fetchSubmittedIds = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('job_id')
        .eq('worker_id', user.uid);

      if (error && isTableMissingError(error)) {
        const localSubs = getLocalSubmissions().filter((s) => s.worker_id === user.uid);
        setSubmittedJobIds(new Set(localSubs.map((d) => d.job_id)));
        return;
      }

      if (data) {
        setSubmittedJobIds(new Set(data.map((d: any) => d.job_id)));
      }
    } catch {
      const localSubs = getLocalSubmissions().filter((s) => s.worker_id === user.uid);
      setSubmittedJobIds(new Set(localSubs.map((d) => d.job_id)));
    }
  };

  const cleanJobDescription = (desc: string) => {
    if (!desc) return '';
    return desc
      .replace(/\[Text Proof Required:[^\]]*\]/gi, '')
      .replace(/\[Screenshots Required:[^\]]*\]/gi, '')
      .trim();
  };

  const mapJobItem = (d: any) => {
    let scInst = d.screenshot_instructions ?? d.screenshotInstructions ?? [];
    if (typeof scInst === 'string') {
      try {
        scInst = JSON.parse(scInst);
      } catch {
        scInst = [];
      }
    }
    const textProofInst = d.text_proof_instruction ?? d.text_proof_requirement ?? d.textProofRequirement ?? d.textProofInstruction ?? '';

    return {
      id: d.id,
      display_id: d.display_id ?? d.displayId,
      displayId: d.display_id ?? d.displayId,
      title: d.title,
      category: d.category,
      location: d.location,
      totalSlots: d.total_slots ?? d.totalSlots,
      occupiedSlots: d.occupied_slots ?? d.occupiedSlots,
      pricePerTask: d.price_per_task ?? d.pricePerTask,
      requiredScreenshots: d.required_screenshots ?? d.requiredScreenshots ?? 0,
      requireTextProof: d.require_text_proof ?? d.requireTextProof ?? true,
      text_proof_instruction: textProofInst,
      textProofRequirement: textProofInst,
      screenshot_instructions: scInst,
      screenshotInstructions: scInst,
      imageUrl: d.image_url ?? d.imageUrl,
      description: d.description,
      ownerId: d.owner_id ?? d.employer_id ?? d.ownerId,
      createdAt: d.created_at,
    };
  };

  const fetchActiveJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error && isTableMissingError(error)) {
        const local = getLocalJobs()
          .filter((j) => j.status === 'active')
          .map(mapJobItem)
          .filter((j: any) => {
            const occupied = Number(j.occupiedSlots) || 0;
            const total = Number(j.totalSlots) || 0;
            return occupied < total;
          });
        setJobs(local);
        return;
      }

      if (data && data.length > 0) {
        const mappedJobs = data.map(mapJobItem).filter((j: any) => {
          const occupied = Number(j.occupiedSlots) || 0;
          const total = Number(j.totalSlots) || 0;
          return occupied < total;
        });
        setJobs(mappedJobs);
      } else {
        const local = getLocalJobs()
          .filter((j) => j.status === 'active')
          .map(mapJobItem)
          .filter((j: any) => {
            const occupied = Number(j.occupiedSlots) || 0;
            const total = Number(j.totalSlots) || 0;
            return occupied < total;
          });
        setJobs(local);
      }
    } catch {
      const local = getLocalJobs()
        .filter((j) => j.status === 'active')
        .map(mapJobItem)
        .filter((j: any) => {
          const occupied = Number(j.occupiedSlots) || 0;
          const total = Number(j.totalSlots) || 0;
          return occupied < total;
        });
      setJobs(local);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveAds = async () => {
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false });

      if (error && isTableMissingError(error)) {
        const localAds = getLocalAds();
        setAds(localAds.map((a: any) => ({
          id: a.id,
          title: a.title,
          imageUrl: a.image_url ?? a.imageUrl,
          targetUrl: a.target_url ?? a.targetUrl,
          expiresAt: a.expires_at ?? a.expiresAt,
        })));
        return;
      }

      if (data && data.length > 0) {
        setAds(data.map((a: any) => ({
          id: a.id,
          title: a.title,
          imageUrl: a.image_url ?? a.imageUrl,
          targetUrl: a.target_url ?? a.targetUrl,
          expiresAt: a.expires_at ?? a.expiresAt,
        })));
      } else {
        const localAds = getLocalAds();
        setAds(localAds.map((a: any) => ({
          id: a.id,
          title: a.title,
          imageUrl: a.image_url ?? a.imageUrl,
          targetUrl: a.target_url ?? a.targetUrl,
          expiresAt: a.expires_at ?? a.expiresAt,
        })));
      }
    } catch {
      const localAds = getLocalAds();
      setAds(localAds.map((a: any) => ({
        id: a.id,
        title: a.title,
        imageUrl: a.image_url ?? a.imageUrl,
        targetUrl: a.target_url ?? a.targetUrl,
        expiresAt: a.expires_at ?? a.expiresAt,
      })));
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchSubmittedIds();
    fetchActiveJobs();
    fetchActiveAds();

    const channel = supabase
      .channel('find-jobs-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchActiveJobs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, () => {
        fetchActiveAds();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchSubmittedIds();
        fetchActiveJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSelectJob = (job: any) => {
    setSelectedJob(job);
    setProofText('');
    setSubmitError('');
    setSubmitSuccess(false);

    const screenshotCount = Number(job.requiredScreenshots) || 0;
    setScreenshotFiles(new Array(screenshotCount).fill(null));
    setScreenshotPreviews(new Array(screenshotCount).fill(''));
  };

  const handleScreenshotFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newFiles = [...screenshotFiles];
      newFiles[index] = file;
      setScreenshotFiles(newFiles);

      const newPreviews = [...screenshotPreviews];
      newPreviews[index] = URL.createObjectURL(file);
      setScreenshotPreviews(newPreviews);
    }
  };

  const removeScreenshot = (index: number) => {
    const newFiles = [...screenshotFiles];
    newFiles[index] = null;
    setScreenshotFiles(newFiles);

    const newPreviews = [...screenshotPreviews];
    newPreviews[index] = '';
    setScreenshotPreviews(newPreviews);
  };

  const handleApply = async () => {
    if (!user || !selectedJob) return;

    if (selectedJob.requireTextProof && !proofText.trim()) {
      setSubmitError('Please provide the required text proof.');
      return;
    }

    const reqCount = Number(selectedJob.requiredScreenshots) || 0;
    for (let i = 0; i < reqCount; i++) {
      if (!screenshotFiles[i]) {
        setSubmitError(`Please upload Screenshot ${i + 1} before submitting.`);
        return;
      }
    }
    
    try {
      setIsSubmitting(true);
      setSubmitError('');

      // Upload screenshots
      const uploadedUrls: string[] = [];
      for (let i = 0; i < reqCount; i++) {
        const file = screenshotFiles[i];
        if (file) {
          try {
            const compressedFile = await compressImage(file, 1080, 0.6);
            const url = await uploadFile(compressedFile, 'proofs');
            uploadedUrls.push(url);
          } catch (uploadErr: any) {
            console.error("Upload error:", uploadErr);
            setSubmitError("Failed to upload image. Please try again or contact admin.");
            setIsSubmitting(false);
            return; // Halt the entire submission process
          }
        }
      }

      const workerDisplayId = formatUserDisplayId(
        user?.display_id || (user as any)?.displayId || profile?.display_id || (profile as any)?.displayId,
        user?.uid
      );

      await submitJobProof(
        selectedJob.id, 
        user.uid, 
        proofText.trim() || 'Completed as instructed',
        uploadedUrls[0] || undefined,
        uploadedUrls,
        workerDisplayId
      );
      
      setSubmitSuccess(true);
      toast.success('Proof submitted successfully!');

      setTimeout(() => {
        setSubmitSuccess(false);
        setProofText('');
        setScreenshotFiles([]);
        setScreenshotPreviews([]);
        setSelectedJob(null);
        fetchSubmittedIds();
        fetchActiveJobs();
      }, 1500);
    } catch (error: any) {
      console.error("Error submitting proof:", error);
      setSubmitError(error.message || 'Failed to submit proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDomain = (urlStr: string) => {
    try {
      const formatted = urlStr.startsWith('http') ? urlStr : `https://${urlStr}`;
      return new URL(formatted).hostname.replace(/^www\./, '');
    } catch {
      return 'Visit Offer';
    }
  };

  // Filter out jobs already submitted and apply category filter
  const availableJobs = jobs.filter(job => !submittedJobIds.has(job.id));
  const displayedJobs = selectedCategory === 'ALL' 
    ? availableJobs 
    : availableJobs.filter(job => job.category?.toLowerCase() === selectedCategory.toLowerCase());

  const categories = ['ALL', ...Array.from(new Set(availableJobs.map(j => j.category).filter(Boolean)))];

  // -------------------------------------------------------------
  // FULL-SCREEN / EXPANDED JOB DETAILS & PROOF SUBMISSION VIEW
  // -------------------------------------------------------------
  if (selectedJob) {
    const completionPercentage = Math.min(
      100, 
      Math.round(((Number(selectedJob.occupiedSlots) || 0) / (Number(selectedJob.totalSlots) || 1)) * 100)
    );
    const priceFormatted = (Number(selectedJob.pricePerTask) || 0).toFixed(2);

    const userUuid = user ? toValidUUID(user.uid) : '';
    const jobOwnerUuid = toValidUUID(selectedJob.ownerId || selectedJob.owner_id || '');
    const isOwnJob = Boolean(
      user && (
        selectedJob.ownerId === user.uid ||
        selectedJob.owner_id === user.uid ||
        (jobOwnerUuid && jobOwnerUuid === userUuid)
      )
    );

    const requiredScreenshotsCount = Number(selectedJob.requiredScreenshots) || 0;
    const job = selectedJob;

    return (
      <div className="w-full space-y-6 pb-12">
        {/* Navigation Bar */}
        <div className="max-w-4xl lg:max-w-5xl mx-auto w-full flex items-center justify-between">
          <button
            onClick={() => {
              setSelectedJob(null);
              setProofText('');
              setSubmitError('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#130b2c]/90 text-slate-700 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-[#180d38] border border-slate-200 dark:border-purple-500/30 transition-all font-bold text-sm shadow-sm dark:shadow-lg dark:shadow-purple-950/40 hover:-translate-x-0.5 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-purple-600 dark:text-amber-400" />
            Back to Available Missions
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Verified Micro-Job
          </div>
        </div>

        {/* Expanded Job Detail Container (Width increased to max-w-4xl / max-w-5xl) */}
        <div className="max-w-4xl lg:max-w-5xl mx-auto w-full space-y-6">
          {/* Main Card: Title & Reward Header */}
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-2xl dark:shadow-purple-950/50">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-mono font-bold tracking-wider">
                    Job ID: #{formatJobDisplayId(selectedJob.display_id || selectedJob.displayId, selectedJob.id)}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-800/60 text-xs font-bold uppercase tracking-wider">
                    <Tag className="w-3 h-3 mr-1 text-purple-600 dark:text-amber-400" />
                    {selectedJob.category || 'General'}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#080412] text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-900/40 text-xs font-bold">
                    {selectedJob.location?.toUpperCase() === 'GLOBAL' ? (
                      <Globe className="w-3 h-3 mr-1 text-purple-600 dark:text-amber-400" />
                    ) : (
                      <MapPin className="w-3 h-3 mr-1 text-purple-600 dark:text-amber-400" />
                    )}
                    {selectedJob.location || 'GLOBAL'}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  {selectedJob.title}
                </h1>
              </div>

              {/* Price Callout */}
              <div className="bg-purple-50 dark:bg-[#080412] p-4 sm:p-5 rounded-2xl border border-purple-100 dark:border-amber-400/30 flex sm:flex-col justify-between items-center sm:items-end flex-shrink-0 shadow-sm dark:shadow-lg dark:shadow-amber-500/10">
                <span className="text-xs text-purple-700 dark:text-amber-300 font-bold uppercase tracking-wider">You will Earn</span>
                <span className="text-3xl sm:text-4xl font-black text-purple-700 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">
                  ${priceFormatted}
                </span>
                <span className="text-xs text-slate-500 dark:text-purple-300/70 font-medium">per completed task</span>
              </div>
            </div>

            {/* Slots Progress Bar */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-purple-900/30">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-600 dark:text-purple-300/80 flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-amber-400" />
                  Remaining Slots: {Number(selectedJob.totalSlots) - Number(selectedJob.occupiedSlots)} spots left
                </span>
                <span className="text-purple-600 dark:text-amber-400 font-bold">{selectedJob.occupiedSlots} / {selectedJob.totalSlots} ({completionPercentage}%)</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#080412] rounded-full h-2.5 overflow-hidden border border-slate-200 dark:border-purple-900/40">
                <div 
                  className="bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Description & Instructions Card (Expanded, wide, comfortable reading) */}
          <div className="bg-white dark:bg-[#130b2c]/85 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-2xl dark:shadow-purple-950/50 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600 dark:text-amber-400" />
              Job Instructions & Rules
            </h2>

            {/* Job Sample Image / Banner if uploaded by employer */}
            {selectedJob.imageUrl && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#080412]/80 border border-slate-200 dark:border-purple-500/30 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-amber-400 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                  Employer Reference Image / Sample:
                </p>
                <div className="relative inline-block group cursor-pointer" onClick={() => setPreviewModalImg(selectedJob.imageUrl)}>
                  <img 
                    src={selectedJob.imageUrl} 
                    alt="Job Reference" 
                    className="max-h-60 max-w-full rounded-xl border border-slate-200 dark:border-purple-500/30 object-contain shadow-sm" 
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white text-xs font-bold gap-1">
                    <Eye className="w-4 h-4" /> Click to view full image
                  </div>
                </div>
              </div>
            )}

            {/* Description Text Box - Wide & Spacious (Clean of any injected proof requirements) */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-[#080412]/90 border border-slate-200 dark:border-purple-500/30 text-slate-800 dark:text-purple-100 text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {cleanJobDescription(selectedJob.description)}
            </div>

            {/* Proof Requirements Summary Badges */}
            <div className="pt-2">
              <h3 className="text-xs font-bold text-slate-500 dark:text-purple-400/70 uppercase tracking-wider mb-2">Required Proof Overview</h3>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                {selectedJob.requireTextProof && (
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> 
                    Text Proof Required
                  </span>
                )}
                {requiredScreenshotsCount > 0 && (
                  <span className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400" /> 
                    {requiredScreenshotsCount} Screenshot{requiredScreenshotsCount > 1 ? 's' : ''} Required
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Proof Submission Form Card or Own Job Notice */}
          {isOwnJob ? (
            <div className="bg-white dark:bg-[#130b2c]/85 dark:backdrop-blur-xl border border-amber-200 dark:border-amber-400/30 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-2xl text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-amber-700 dark:text-amber-400">This is your own job</h3>
              <p className="text-sm text-slate-600 dark:text-purple-200/80 font-semibold max-w-md mx-auto">
                You created this micro-job. You cannot submit proof or complete tasks on your own job.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#130b2c]/85 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-2xl dark:shadow-purple-950/50 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-purple-900/40">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Send className="w-5 h-5 text-purple-600 dark:text-amber-400" />
                    Submit Your Proof of Work
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-purple-300/70 font-medium mt-1">
                    Follow the exact proof instructions requested by the employer below to receive your payment.
                  </p>
                </div>
                {user && (
                  <div className="flex items-center gap-2 bg-purple-50 dark:bg-[#080412] px-3.5 py-1.5 rounded-xl border border-purple-200 dark:border-amber-400/30 self-start sm:self-auto shadow-xs">
                    <span className="text-xs font-bold text-slate-600 dark:text-purple-300">Your Worker ID:</span>
                    <span className="font-mono font-black text-sm text-purple-700 dark:text-amber-300">
                      #{formatUserDisplayId(user?.display_id || (user as any)?.displayId || profile?.display_id, user?.uid)}
                    </span>
                  </div>
                )}
              </div>

              {submitSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Proof submitted successfully!</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">The employer will review your submission and release the reward.</p>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm font-bold">{submitError}</p>
                </div>
              )}

              {/* 1. REQUIRED TEXT PROOF BOX */}
              {job.requireTextProof && (
                <div className="space-y-3 p-4 sm:p-5 bg-slate-50 dark:bg-[#080412]/80 rounded-2xl border border-slate-200 dark:border-purple-500/30">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-amber-300">
                      Required Text Proof (টেক্সট প্রুফ হিসেবে যা চেয়েছে):
                    </span>
                  </div>

                  <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl">
                    <p className="text-sm font-bold text-slate-900 dark:text-amber-200">
                      {job.text_proof_instruction || "Please provide the required text details."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-purple-200/90 mb-1.5">
                      Your Text Proof / আপনার তথ্য লিখুন <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                      placeholder="Type your proof details here..."
                      disabled={isSubmitting || submitSuccess}
                      className="w-full px-4 py-3 bg-white dark:bg-[#080412] border border-slate-200 dark:border-purple-500/40 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-transparent transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              {/* 2. DYNAMIC SCREENSHOT PROOF BOXES (Compact file choices based on count) */}
              {requiredScreenshotsCount > 0 && (
                <div className="space-y-4 p-4 sm:p-5 bg-slate-50 dark:bg-[#080412]/80 rounded-2xl border border-slate-200 dark:border-purple-500/30">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                      Required Screenshot Proofs ({requiredScreenshotsCount} Image{requiredScreenshotsCount > 1 ? 's' : ''})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-purple-300/70">
                      প্রতিটি স্ক্রিনশটের জন্য মালিকের চাওয়া প্রুফ নির্দেশনা দেখে সঠিক ছবি আপলোড করুন:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: requiredScreenshotsCount }).map((_, index) => {
                      const preview = screenshotPreviews[index];

                      return (
                        <div 
                          key={index} 
                          className="bg-white dark:bg-[#130b2c] p-4 rounded-xl border border-slate-200 dark:border-purple-500/30 flex flex-col justify-between space-y-3 shadow-sm"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-amber-400/20 text-purple-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold">
                                {index + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-purple-100">
                                Screenshot {index + 1}
                              </span>
                            </div>
                            
                            <div className="p-2.5 bg-purple-50/60 dark:bg-[#080412] border border-purple-200 dark:border-purple-500/30 rounded-lg">
                              <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-amber-400 block mb-0.5">
                                প্রুফ হিসেবে যা চেয়েছে:
                              </span>
                              <p className="text-xs text-slate-900 dark:text-amber-200 font-bold">
                                {job.screenshot_instructions?.[index] || `Upload required screenshot ${index + 1}`}
                              </p>
                            </div>
                          </div>

                          {/* Upload / Preview Area */}
                          <div>
                            {preview ? (
                              <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-purple-500/40 w-full h-28 bg-slate-100 dark:bg-[#080412] flex items-center justify-center">
                                <img src={preview} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModalImg(preview)}
                                    className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
                                    title="View"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeScreenshot(index)}
                                    className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    title="Remove"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#080412] hover:bg-slate-100 dark:hover:bg-[#180d38] border border-slate-300 dark:border-purple-500/30 text-slate-700 dark:text-purple-200 text-xs font-bold transition-all shadow-sm w-full justify-center">
                                <Upload className="w-3.5 h-3.5 text-purple-600 dark:text-amber-400" />
                                Choose Screenshot {index + 1}
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleScreenshotFileChange(index, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submit Button & Worker Identity */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-xs text-slate-500 dark:text-purple-300/70 font-medium">
                    * Providing fake proof or incorrect details will lead to submission rejection.
                  </p>
                  {user && (
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-600 dark:text-purple-300">
                      <span>Submitting as:</span>
                      <span className="font-mono font-bold text-purple-700 dark:text-amber-300 bg-purple-50 dark:bg-[#080412] px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/40">
                        User ID #{formatUserDisplayId(user?.display_id || (user as any)?.displayId || profile?.display_id, user?.uid)}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleApply}
                  disabled={isSubmitting || submitSuccess}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin" />
                      Submitting Proof...
                    </>
                  ) : submitSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Submitted!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Proof & Earn Reward
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

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
              <img src={previewModalImg} alt="Enlarged Preview" className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEFAULT JOBS LIST VIEW (Royal Midnight Theme)
  // -------------------------------------------------------------
  return (
    <div className="w-full space-y-6">
      {/* Centered Header */}
      <div className="max-w-4xl lg:max-w-5xl mx-auto w-full space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Available Micro-Jobs
          </h1>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">
            Select a task, complete the simple steps, submit your proof, and earn instant rewards.
          </p>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SPONSORED ADVERTISEMENTS SECTION                             */}
        {/* ------------------------------------------------------------- */}
        {ads.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Sponsored Advertisements
              </span>
              <Link 
                to="/post-ad" 
                className="text-[11px] font-bold text-purple-600 dark:text-amber-400 hover:underline transition-colors flex items-center gap-1"
              >
                Promote Here &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {ads.map((ad) => {
                const targetHref = ad.targetUrl?.startsWith('http') ? ad.targetUrl : `https://${ad.targetUrl || ''}`;
                const domainLabel = getDomain(ad.targetUrl || '');

                return (
                  <a
                    key={ad.id}
                    href={targetHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group bg-white dark:bg-[#130b2c] hover:bg-slate-50 dark:hover:bg-[#180d38] border border-amber-200 dark:border-amber-400/30 hover:border-amber-400 rounded-2xl p-3.5 shadow-sm dark:shadow-lg dark:shadow-purple-950/40 transition-all duration-200 flex items-center gap-3.5 cursor-pointer overflow-hidden"
                  >
                    {/* Ad Image / Thumbnail */}
                    {ad.imageUrl ? (
                      <img 
                        src={ad.imageUrl} 
                        alt={ad.title || 'Sponsored Ad'} 
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 dark:border-purple-500/30 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-purple-50 dark:bg-[#080412] border border-purple-200 dark:border-purple-500/30 flex items-center justify-center flex-shrink-0">
                        <Megaphone className="w-6 h-6 text-purple-600 dark:text-amber-400" />
                      </div>
                    )}

                    {/* Ad Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 uppercase tracking-wider">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          Sponsored
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 dark:text-purple-400 group-hover:text-purple-600 dark:group-hover:text-amber-300 transition-colors flex-shrink-0" />
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-amber-300 transition-colors line-clamp-1">
                        {ad.title || 'Featured Partner Offer'}
                      </h4>

                      <p className="text-xs text-slate-500 dark:text-purple-300/70 truncate font-medium mt-0.5">
                        {domainLabel}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Categories Filter Bar */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  selectedCategory === cat
                    ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 shadow-sm dark:shadow-md'
                    : 'bg-white dark:bg-[#130b2c] text-slate-700 dark:text-purple-200 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-purple-500/20 hover:bg-slate-50 dark:hover:bg-[#180d38]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-purple-600 dark:border-amber-400"></div>
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="max-w-4xl lg:max-w-5xl mx-auto w-full bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-12 text-center flex flex-col items-center shadow-sm dark:shadow-2xl">
          <div className="w-14 h-14 bg-slate-50 dark:bg-[#080412] rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-purple-500/30">
            <SearchX className="w-7 h-7 text-slate-400 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Active Missions</h3>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm max-w-sm font-medium">
            There are no active jobs available matching your criteria at the moment. Please check back shortly!
          </p>
        </div>
      ) : (
        <div className="max-w-4xl lg:max-w-5xl mx-auto w-full flex flex-col gap-4">
          {displayedJobs.map((job) => {
            const completionPercentage = Math.min(
              100, 
              Math.round(((Number(job.occupiedSlots) || 0) / (Number(job.totalSlots) || 1)) * 100)
            );
            const price = (Number(job.pricePerTask) || 0).toFixed(2);

            const isOwnJobCard = Boolean(
              user && (
                job.ownerId === user.uid ||
                job.owner_id === user.uid ||
                (toValidUUID(job.ownerId || job.owner_id || '') === toValidUUID(user.uid))
              )
            );

            return (
              <div 
                key={job.id} 
                onClick={() => handleSelectJob(job)}
                className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 hover:border-purple-400 dark:hover:border-amber-400/40 rounded-2xl p-5 shadow-sm dark:shadow-lg dark:shadow-purple-950/40 hover:shadow-md transition-all duration-150 cursor-pointer group flex flex-col justify-between gap-3"
              >
                {/* Card Top Row: Meta Tags & Reward */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-800/50 text-xs font-mono font-bold">
                      Job ID: #{formatJobDisplayId(job.display_id || job.displayId, job.id)}
                    </span>
                    {isOwnJobCard && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold">
                        Your Job
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-800/50 text-xs font-bold">
                      <Tag className="w-3 h-3 mr-1 text-purple-600 dark:text-amber-400" />
                      {job.category || 'Job'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#080412] text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-900/30 text-xs font-medium">
                      {job.location?.toUpperCase() === 'GLOBAL' ? (
                        <Globe className="w-3 h-3 mr-1 text-purple-600 dark:text-amber-400" />
                      ) : (
                        <MapPin className="w-3 h-3 mr-1 text-purple-600 dark:text-amber-400" />
                      )}
                      {job.location || 'GLOBAL'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-black text-slate-900 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">
                      ${price}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-purple-300/70 font-medium ml-1">/task</span>
                  </div>
                </div>

                {/* Card Middle: Title & Description */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-amber-300 transition-colors line-clamp-1">
                    {job.title}
                  </h3>
                  {job.description && (
                    <p className="text-slate-500 dark:text-purple-300/70 text-xs mt-1 line-clamp-2 font-medium">
                      {job.description}
                    </p>
                  )}
                </div>

                {/* Card Bottom Row: Slots & Action */}
                <div className="pt-3 border-t border-slate-100 dark:border-purple-900/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-purple-300/70">
                    <span className="flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1.5 text-purple-600 dark:text-amber-400" />
                      {job.occupiedSlots || 0} / {job.totalSlots || 0} spots
                    </span>
                    <div className="w-20 sm:w-28 bg-slate-100 dark:bg-[#080412] rounded-full h-1.5 overflow-hidden border border-slate-200 dark:border-purple-900/30 hidden xs:block">
                      <div 
                        className="bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 h-full rounded-full" 
                        style={{ width: `${completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-amber-400 group-hover:text-purple-700 dark:group-hover:text-amber-300 transition-colors">
                    View Details & Complete
                    <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
