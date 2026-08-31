import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJob, uploadFile } from '../lib/jobService';
import { useAuth } from '../contexts/AuthContext';
import { 
  Briefcase, 
  MapPin, 
  Tag, 
  DollarSign, 
  Users, 
  FileText, 
  ImageIcon, 
  Upload, 
  X, 
  Sparkles,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  "YouTube", "Facebook", "Instagram", "TikTok", "Gmail", 
  "App Install", "Account Create", "Like", "Comment", 
  "Share", "Subscribe", "Others"
];

export default function PostJobPage() {
  const { user, updateBalances } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'YouTube',
    location: 'GLOBAL',
    pricePerTask: '',
    totalSlots: '',
    requireTextProof: true,
    text_proof_instruction: '', // Watermark placeholder: "What specific text proof do you need? (e.g., Email & Password)"
    requiredScreenshots: '1',
    screenshot_instructions: [''] as string[], // Watermark placeholder: "Instruction for Screenshot 1 (e.g., Screenshot after login)"
    jobImage: ''
  });

  const [jobImageFile, setJobImageFile] = useState<File | null>(null);
  const [jobImagePreview, setJobImagePreview] = useState<string>('');

  const totalCost = (parseFloat(formData.pricePerTask) || 0) * (parseInt(formData.totalSlots) || 0);

  const handleScreenshotCountChange = (countStr: string) => {
    const count = parseInt(countStr, 10) || 0;
    const currentInstructions = [...formData.screenshot_instructions];
    
    // Adjust array size with empty strings so placeholders/জলছাপ show cleanly
    if (count > currentInstructions.length) {
      for (let i = currentInstructions.length; i < count; i++) {
        currentInstructions.push('');
      }
    } else if (count < currentInstructions.length) {
      currentInstructions.splice(count);
    }

    setFormData({
      ...formData,
      requiredScreenshots: countStr,
      screenshot_instructions: currentInstructions
    });
  };

  const handleInstructionChange = (index: number, text: string) => {
    const updated = [...formData.screenshot_instructions];
    updated[index] = text;
    setFormData({
      ...formData,
      screenshot_instructions: updated
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setJobImageFile(file);
      setJobImagePreview(URL.createObjectURL(file));
    }
  };

  const removeJobImage = () => {
    setJobImageFile(null);
    setJobImagePreview('');
    setFormData(prev => ({ ...prev, jobImage: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');

    const price = parseFloat(formData.pricePerTask);
    const slots = parseInt(formData.totalSlots, 10);
    const screenshotCount = parseInt(formData.requiredScreenshots, 10) || 0;

    if (!formData.title.trim()) {
      setError('Please provide a title for the job.');
      return;
    }

    if (!formData.description.trim()) {
      setError('Please describe the steps required to complete this job.');
      return;
    }

    if (!price || price <= 0) {
      setError('Price per task must be greater than $0.');
      return;
    }

    if (!slots || slots <= 0) {
      setError('Total slots must be at least 1.');
      return;
    }

    const text_proof_instruction = formData.text_proof_instruction.trim();
    const screenshot_instructions = formData.screenshot_instructions.map(inst => inst.trim());

    setLoading(true);

    try {
      let uploadedImageUrl: string | undefined = undefined;
      if (jobImageFile) {
        try {
          uploadedImageUrl = await uploadFile(jobImageFile, 'job-images');
        } catch (uploadErr) {
          console.warn('Fallback: image upload failed', uploadErr);
          uploadedImageUrl = jobImagePreview;
        }
      }

      // Pure job posting with exact employer instruction state
      await createJob({
        employerId: user.uid,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        location: formData.location,
        pricePerTask: price,
        totalSlots: slots,
        requiredScreenshots: screenshotCount,
        requireTextProof: formData.requireTextProof,
        text_proof_instruction: text_proof_instruction,
        textProofRequirement: text_proof_instruction,
        screenshot_instructions: screenshot_instructions,
        screenshotInstructions: screenshot_instructions,
        imageUrl: uploadedImageUrl
      });

      toast.success('Job posted successfully! Waiting for admin review.');
      navigate('/my-jobs');
    } catch (err: any) {
      console.error("Error creating job:", err);
      setError(err.message || 'Failed to post job. Please check your balance or details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-purple-600 dark:text-amber-400" />
            Post a Micro-Job
          </h1>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-medium">
            Create a task, specify exact text & screenshot proof requirements, and get fast results from real workers.
          </p>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white dark:bg-[#130b2c]/85 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-2xl dark:shadow-purple-950/50 p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-bold border border-red-200 dark:border-red-800/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>{error}</span>
              {error.includes("Insufficient Deposit Balance") && (
                <button
                  type="button"
                  onClick={() => {
                    updateBalances(50, 0);
                    setError('');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 text-white dark:text-slate-950 font-bold text-xs rounded-lg transition-all shadow-sm self-start sm:self-center"
                >
                  + Add $50.00 Test Balance
                </button>
              )}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-purple-900/30">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-purple-200">
                1. Job Information & Instructions
              </h2>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-purple-200 mb-1.5">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Subscribe YouTube Channel + Like & Bell Icon"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 focus:border-purple-600 dark:focus:border-amber-400 focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 rounded-xl transition-colors font-medium text-base"
              />
            </div>

            {/* Description - Spacious & Wide */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-slate-800 dark:text-purple-200">
                  Description & Detailed Instructions <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-slate-500 dark:text-purple-400/60 font-medium">Step-by-step instructions for workers</span>
              </div>
              <textarea
                required
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="1. Go to YouTube and search 'MyChannelName'&#10;2. Watch the video for at least 1 minute&#10;3. Click Subscribe, Like and turn on the Bell Icon"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 focus:border-purple-600 dark:focus:border-amber-400 focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 rounded-xl transition-colors font-mono text-sm leading-relaxed"
              />
            </div>

            {/* Optional Job Reference Image / Thumbnail */}
            <div className="bg-slate-50 dark:bg-[#080412]/80 p-4 rounded-2xl border border-slate-200 dark:border-purple-500/30">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                Optional Sample Image / Channel Banner (Reference Thumbnail)
              </label>
              
              <div className="flex flex-wrap items-center gap-4">
                {jobImagePreview ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-purple-500/40 w-32 h-20 bg-slate-100 dark:bg-[#130b2c] flex items-center justify-center">
                    <img src={jobImagePreview} alt="Job Sample" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={removeJobImage}
                      className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all shadow-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}

                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#130b2c] hover:bg-slate-100 dark:hover:bg-[#180d38] border border-slate-300 dark:border-purple-500/40 text-slate-700 dark:text-purple-200 text-xs font-bold transition-all shadow-sm">
                  <Upload className="w-3.5 h-3.5 text-purple-600 dark:text-amber-400" />
                  {jobImagePreview ? 'Change Image' : 'Choose File / ছবি নির্বাচন করুন'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500 dark:text-purple-400/70">
                  Workers can view this sample image to find your video/page easily.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Targeting & Budget */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-purple-900/30">
              <Layers className="w-4 h-4 text-purple-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-purple-200">
                2. Category, Slots & Pricing
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-purple-200 mb-1.5">Category</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="h-4 w-4 text-purple-500 dark:text-amber-400" />
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white font-semibold text-sm focus:border-purple-600 dark:focus:border-amber-400"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-purple-200 mb-1.5">Target Location</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-purple-500 dark:text-amber-400" />
                  </div>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white font-semibold text-sm focus:border-purple-600 dark:focus:border-amber-400"
                  >
                    <option value="GLOBAL">GLOBAL (All Countries)</option>
                    <option value="Bangladesh">Bangladesh</option>
                    <option value="India">India</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-purple-200 mb-1.5">Price Per Task ($)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.pricePerTask}
                    onChange={(e) => setFormData({...formData, pricePerTask: e.target.value})}
                    placeholder="0.05"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white font-bold text-sm focus:border-purple-600 dark:focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-purple-200 mb-1.5">Total Slots (Workers)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-4 w-4 text-purple-500 dark:text-amber-400" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.totalSlots}
                    onChange={(e) => setFormData({...formData, totalSlots: e.target.value})}
                    placeholder="50"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white font-bold text-sm focus:border-purple-600 dark:focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Proof Requirements (Text Proof + Dynamic Screenshot Proofs) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-purple-900/30">
              <FileText className="w-4 h-4 text-purple-600 dark:text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-purple-200">
                3. Worker Proof Requirements
              </h2>
            </div>

            <div className="bg-slate-50 dark:bg-[#080412]/80 border border-slate-200 dark:border-purple-500/30 rounded-2xl p-5 space-y-5">
              {/* Text Proof Configuration */}
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.requireTextProof}
                    onChange={(e) => setFormData({...formData, requireTextProof: e.target.checked})}
                    className="w-4 h-4 text-purple-600 dark:text-amber-400 rounded border-slate-300 dark:border-purple-500/40 focus:ring-purple-500"
                  />
                  <span className="text-sm font-bold text-slate-800 dark:text-purple-100 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                    Require Text Proof (Username / Profile Link / Email / Notes)
                  </span>
                </label>

                {formData.requireTextProof && (
                  <div className="pl-7 pt-1">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-purple-300/80 mb-1">
                      What specific text proof do you need? (e.g., Email & Password)
                    </label>
                    <input
                      type="text"
                      value={formData.text_proof_instruction}
                      onChange={(e) => setFormData({...formData, text_proof_instruction: e.target.value})}
                      placeholder="What specific text proof do you need? (e.g., Email & Password)"
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white text-sm font-medium focus:border-purple-600 dark:focus:border-amber-400 placeholder:text-slate-400 dark:placeholder:text-purple-400/50"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-purple-900/40 pt-4 space-y-4">
                {/* Screenshot Count Select */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 dark:text-purple-100 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                      Screenshots Required (কয়টি স্ক্রিনশট লাগবে?)
                    </label>
                    <span className="text-xs text-slate-500 dark:text-purple-300/70">
                      Choose how many image proofs the worker must upload
                    </span>
                  </div>

                  <select
                    value={formData.requiredScreenshots}
                    onChange={(e) => handleScreenshotCountChange(e.target.value)}
                    className="w-full sm:w-48 px-3.5 py-2.5 bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white font-bold text-sm focus:border-purple-600 dark:focus:border-amber-400"
                  >
                    <option value="0">0 (No Screenshot)</option>
                    <option value="1">1 Screenshot</option>
                    <option value="2">2 Screenshots</option>
                    <option value="3">3 Screenshots</option>
                    <option value="4">4 Screenshots</option>
                  </select>
                </div>

                {/* Dynamic Screenshot Instructions with Watermark Placeholders */}
                {parseInt(formData.requiredScreenshots, 10) > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-amber-300">
                      Specify Proof Description For Each Screenshot (প্রতিটি স্ক্রিনশটের নির্দেশনা):
                    </p>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {formData.screenshot_instructions.map((instruction, idx) => {
                        const placeholderText = `Instruction for Screenshot ${idx + 1} (e.g., Screenshot after login)`;
                        
                        return (
                          <div key={idx} className="bg-white dark:bg-[#130b2c] p-3.5 rounded-xl border border-slate-200 dark:border-purple-500/30 space-y-1.5">
                            <label className="block text-xs font-bold text-purple-700 dark:text-amber-400 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-amber-400/20 text-purple-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold">
                                {idx + 1}
                              </span>
                              Instruction for Screenshot {idx + 1} (e.g., Screenshot after login)
                            </label>
                            <input
                              type="text"
                              value={instruction}
                              onChange={(e) => handleInstructionChange(idx, e.target.value)}
                              placeholder={placeholderText}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#080412] border border-slate-200 dark:border-purple-500/30 rounded-lg text-slate-900 dark:text-white text-xs font-medium focus:border-purple-600 dark:focus:border-amber-400 placeholder:text-slate-400 dark:placeholder:text-purple-400/50"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Cost & Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-purple-900/30 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-purple-300/70">Total Job Budget</p>
              <p className="text-3xl font-black text-slate-900 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">
                ${totalCost.toFixed(2)}
                <span className="text-xs font-normal text-slate-500 dark:text-purple-300/70 ml-2">
                  ({formData.totalSlots || 0} slots × ${Number(formData.pricePerTask || 0).toFixed(2)})
                </span>
              </p>
            </div>
            
            <button
              type="submit"
              disabled={loading || totalCost <= 0}
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3.5 rounded-xl text-base font-bold text-white bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-98"
            >
              <Briefcase className="w-5 h-5 mr-2" />
              {loading ? 'Posting Job...' : 'Post Job Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
