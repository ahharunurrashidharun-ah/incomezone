import React, { useState, useEffect } from 'react';
import {
  Clock,
  Lock,
  Trash2,
  Mail,
  ArrowLeft,
  RefreshCw,
  UserPlus,
  Wifi,
  ShieldAlert,
  X,
  Headphones,
} from 'lucide-react';
import SupportChatPanel from './SupportChatPanel';

export type AccountStatusType = 'pending' | 'blocked' | 'deleted';

interface AccountStatusModalProps {
  status: AccountStatusType;
  email?: string;
  ip?: string;
  onClose: () => void;
  onCreateNewAccount?: () => void;
  onCheckStatus?: () => void | Promise<void>;
  checkingStatus?: boolean;
  /** When true, renders as a centered card on a page rather than a fixed modal overlay */
  embedded?: boolean;
}

export default function AccountStatusModal({
  status,
  email,
  ip,
  onClose,
  onCreateNewAccount,
  onCheckStatus,
  checkingStatus = false,
  embedded = false,
}: AccountStatusModalProps) {
  const [showLiveSupport, setShowLiveSupport] = useState(false);

  useEffect(() => {
    setShowLiveSupport(false);
  }, [status, email]);

  const statusTitle =
    status === 'pending'
      ? 'পেন্ডিং অ্যাকাউন্ট সাপোর্ট'
      : status === 'blocked'
      ? 'ব্লক অ্যাকাউন্ট সাপোর্ট'
      : 'ডিলিট অ্যাকাউন্ট সাপোর্ট';

  const liveSupportModal = showLiveSupport ? (
    <div
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={() => setShowLiveSupport(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] h-[560px] max-h-[88dvh] bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 dark:border-purple-500/20 bg-slate-50 dark:bg-[#0e0822] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {statusTitle}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-purple-300/70 truncate">
                তাৎক্ষণিক কমন প্রশ্ন ও উত্তর
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowLiveSupport(false)}
            aria-label="বন্ধ করুন"
            className="w-9 h-9 rounded-xl text-slate-500 dark:text-purple-300 hover:bg-slate-200/70 dark:hover:bg-purple-900/40 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <SupportChatPanel
            variant="widget"
            accountOverride={{
              accountStatus: status,
              email,
              ip,
            }}
          />
        </div>
      </div>
    </div>
  ) : null;

  const cardContent = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 shadow-2xl shadow-slate-900/30 dark:shadow-purple-950/90 rounded-3xl p-6 sm:p-8 max-w-[520px] w-full relative animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Manual Close (X) Button - Only manual exit allowed */}
      <button
        type="button"
        onClick={onClose}
        aria-label="বন্ধ করুন"
        className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-purple-300/70 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 1. PENDING POPUP (IP PENDING) */}
      {status === 'pending' && (
        <div className="space-y-5 text-center pt-1">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border-2 border-amber-200 dark:border-amber-500/40 shadow-lg shadow-amber-500/10">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 uppercase tracking-wider">
              <Wifi className="w-3.5 h-3.5" />
              ACCOUNT IP PENDING / অ্যাকাউন্ট আইপি পেন্ডিং
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              অ্যাকাউন্ট আইপি পেন্ডিংয়ে রয়েছে
            </h2>
          </div>

          <div className="p-4 sm:p-5 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-500/30 text-left space-y-3">
            <p className="text-sm sm:text-[15px] text-slate-800 dark:text-amber-100 leading-relaxed font-bold">
              আপনার এই একই আইপি দিয়ে একাধিক একাউন্ট খোলার চেষ্টা করা হয়েছে তাই একাউন্টটি আইপি পেন্ডিং এ আছে বিস্তারিত জানতে
            </p>

            <div className="pt-2 border-t border-amber-200/80 dark:border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-amber-200">
                <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Email:</span>
                <a
                  href="mailto:incomezone2729@gmail.com"
                  className="font-mono font-black text-purple-700 dark:text-amber-300 underline select-all"
                >
                  incomezone2729@gmail.com
                </a>
              </div>
              {ip && (
                <span className="font-mono text-[11px] text-slate-600 dark:text-purple-300">
                  IP: <strong>{ip}</strong>
                </span>
              )}
            </div>

            {email && (
              <div className="text-[11px] font-mono text-slate-600 dark:text-purple-300/90">
                অ্যাকাউন্ট ইমেইল: <strong>{email}</strong>
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-1">
            {onCheckStatus && (
              <button
                type="button"
                onClick={onCheckStatus}
                disabled={checkingStatus}
                className="w-full py-3 px-5 rounded-xl font-black text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                <span>
                  {checkingStatus
                    ? 'স্ট্যাটাস যাচাই করা হচ্ছে...'
                    : 'অ্যাপ্রুভ হয়েছে কিনা যাচাই করুন (Check Status)'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowLiveSupport(true)}
              className="w-full py-3 px-5 rounded-xl font-black text-xs sm:text-sm text-purple-700 dark:text-amber-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-500/35 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span>লাইভ সাপোর্ট (Live Support)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-5 rounded-xl font-black text-sm text-white bg-slate-900 hover:bg-black dark:bg-purple-600 dark:hover:bg-purple-700 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>লগইন পেজে ফিরে যান</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. BLOCKED POPUP */}
      {status === 'blocked' && (
        <div className="space-y-5 text-center pt-1">
          <div className="w-20 h-20 rounded-3xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border-2 border-red-200 dark:border-red-500/40 shadow-lg shadow-red-500/10">
            <Lock className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/40 uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5" />
              ACCOUNT BLOCKED / অ্যাকাউন্ট ব্লকড
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              অ্যাকাউন্ট ব্লক করা হয়েছে
            </h2>
          </div>

          <div className="p-4 sm:p-5 bg-red-50/80 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-500/30 text-left space-y-3">
            <div className="text-sm sm:text-[15px] text-slate-800 dark:text-red-100 leading-relaxed font-bold space-y-1">
              <p>আপনার একাউন্ট এডমিন কর্তৃক ব্লক করা হয়েছে........</p>
              <p>বিস্তারিত জানতে</p>
            </div>

            <div className="pt-2 border-t border-red-200/80 dark:border-red-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-red-200">
                <Mail className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <span>Email:</span>
                <a
                  href="mailto:incomezone2729@gmail.com"
                  className="font-mono font-black text-purple-700 dark:text-amber-300 underline select-all"
                >
                  incomezone2729@gmail.com
                </a>
              </div>
              {ip && (
                <span className="font-mono text-[11px] text-slate-600 dark:text-purple-300">
                  IP: <strong>{ip}</strong>
                </span>
              )}
            </div>

            {email && (
              <div className="text-[11px] font-mono text-slate-600 dark:text-purple-300/90">
                অ্যাকাউন্ট ইমেইল: <strong>{email}</strong>
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => setShowLiveSupport(true)}
              className="w-full py-3 px-5 rounded-xl font-black text-xs sm:text-sm text-purple-700 dark:text-amber-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-500/35 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span>লাইভ সাপোর্ট (Live Support)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 px-5 rounded-xl font-black text-sm text-white bg-red-600 hover:bg-red-700 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>লগইন পেজে ফিরে যান</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. DELETED POPUP */}
      {status === 'deleted' && (
        <div className="space-y-5 text-center pt-1">
          <div className="w-20 h-20 rounded-3xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border-2 border-rose-200 dark:border-rose-500/40 shadow-lg shadow-rose-500/10">
            <Trash2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40 uppercase tracking-wider">
              ACCOUNT DELETED / অ্যাকাউন্ট ডিলিট
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              অ্যাকাউন্ট ডিলিট করা হয়েছে
            </h2>
          </div>

          <div className="p-4 sm:p-5 bg-rose-50/80 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-500/30 text-left space-y-3">
            <p className="text-sm sm:text-[15px] text-slate-800 dark:text-rose-100 leading-relaxed font-bold">
              আপনার একাউন্ট এডমিন কর্তৃক ডিলিট করা হয়েছে আপনি চাইলে এখন এই ইমেইল দিয়ে নতুন একাউন্ট খুলতে পারবেন
            </p>

            {email && (
              <div className="pt-2 border-t border-rose-200/80 dark:border-rose-500/20 text-xs font-mono text-slate-600 dark:text-purple-300">
                ইমেইল: <strong>{email}</strong>
              </div>
            )}
          </div>

          <div className="space-y-2.5 pt-1">
            {onCreateNewAccount && (
              <button
                type="button"
                onClick={onCreateNewAccount}
                className="w-full py-3.5 px-5 rounded-xl font-black text-sm text-white bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 dark:text-slate-950 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>নতুন একাউন্ট খুলুন (Create Account)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowLiveSupport(true)}
              className="w-full py-3 px-5 rounded-xl font-black text-xs sm:text-sm text-purple-700 dark:text-amber-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-500/35 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span>লাইভ সাপোর্ট (Live Support)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 px-5 rounded-xl font-bold text-xs sm:text-sm text-slate-700 dark:text-purple-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>লগইন পেজে ফিরে যান</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <>
        {cardContent}
        {liveSupportModal}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        {cardContent}
      </div>
      {liveSupportModal}
    </>
  );
}
