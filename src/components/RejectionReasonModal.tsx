import React, { useState } from 'react';
import { X, AlertTriangle, Check, Send } from 'lucide-react';

interface RejectionReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  isProcessing?: boolean;
  jobTitle?: string;
}

const PRESET_REASONS = [
  'কাজের সঠিক স্ক্রিনশট বা প্রুফ দেওয়া হয়নি (Invalid or Missing Screenshot/Proof)',
  'জবের নির্দেশনা অনুযায়ী কাজ সম্পন্ন করা হয়নি (Job Instructions Not Followed)',
  'ভুয়া অথবা ডুপ্লিকেট সাবমিশন (Duplicate or Fake Submission)',
  'অন্যান্য / কাস্টম কারণ (Custom Reason)',
];

export default function RejectionReasonModal({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
  jobTitle,
}: RejectionReasonModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>(PRESET_REASONS[0]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: string) => {
    setSelectedPreset(preset);
    if (preset === 'অন্যান্য / কাস্টম কারণ (Custom Reason)') {
      setCustomReason('');
    } else {
      setCustomReason(preset);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = customReason.trim();
    if (!finalReason) return;
    await onConfirm(finalReason);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-purple-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                রিজেক্টের কারণ উল্লেখ করুন (Rejection Reason)
              </h3>
              {jobTitle && (
                <p className="text-xs text-slate-500 dark:text-purple-300/70 font-medium truncate max-w-[260px] sm:max-w-[320px]">
                  জব: <span className="font-bold text-slate-700 dark:text-purple-200">{jobTitle}</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-purple-900/40 hover:bg-slate-200 dark:hover:bg-purple-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Reasons */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider block">
              কারণ সিলেক্ট করুন (SELECT REASON): <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {PRESET_REASONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all text-xs font-bold flex items-center justify-between cursor-pointer ${
                    selectedPreset === preset
                      ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 shadow-sm'
                      : 'bg-slate-50 dark:bg-[#0a0718] border-slate-200 dark:border-purple-500/20 text-slate-700 dark:text-purple-200 hover:border-slate-300 dark:hover:border-purple-500/40'
                  }`}
                >
                  <span className="leading-snug">{preset}</span>
                  {selectedPreset === preset && (
                    <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 ml-2">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Reason Text Area */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider block mb-1.5">
              বিস্তারিত বিবরণ (DETAILED REASON): <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="কাজের প্রমাণপত্র কেন গ্রহণযোগ্য নয় তার বিবরণ লিখুন..."
              className="w-full p-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-2xl text-slate-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all placeholder-slate-400 dark:placeholder-purple-400/40 resize-none shadow-inner leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-slate-700 dark:text-purple-200 text-xs font-black transition-all cursor-pointer"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="submit"
              disabled={isProcessing || !customReason.trim()}
              className="flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>প্রসেসিং...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>রিজেক্ট সম্পন্ন করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
