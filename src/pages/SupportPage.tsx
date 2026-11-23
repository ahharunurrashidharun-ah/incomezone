import React from 'react';
import { Headphones, Mail, ShieldCheck, Wallet, Briefcase, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatUserDisplayId } from '../lib/supabaseClient';
import SupportChatPanel from '../components/SupportChatPanel';

export default function SupportPage() {
  const { user, profile } = useAuth();
  const displayId = user ? formatUserDisplayId(profile?.display_id || (user as any)?.display_id, user.uid) : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 flex items-center justify-center shrink-0">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              লাইভ সাপোর্ট সেন্টার
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/70 mt-0.5">
              {displayId ? `অ্যাকাউন্ট #${displayId}-এর জন্য আলাদা লাইভ সাপোর্ট · ` : ''}
              কমন প্রশ্ন সিলেক্ট করুন অথবা লিখে পাঠান—সাথে সাথেই উত্তর পাবেন
            </p>
          </div>
        </div>

        <a
          href="mailto:incomezone2729@gmail.com"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1b103a] dark:hover:bg-purple-900/50 text-slate-800 dark:text-purple-100 border border-slate-200 dark:border-purple-500/25 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Mail className="w-4 h-4 text-purple-600 dark:text-amber-400" />
          <span>অ্যাডমিন ইমেইল সাপোর্ট</span>
        </a>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Chat Interface */}
        <div className="lg:col-span-8 bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 rounded-2xl overflow-hidden flex flex-col h-[580px]">
          <SupportChatPanel variant="page" />
        </div>

        {/* Helpful Quick Links & Guidelines */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              দ্রুত প্রয়োজনীয় পেজসমূহ
            </h2>
            <div className="space-y-2.5">
              <Link
                to="/deposit"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-purple-500/20 hover:bg-slate-50 dark:hover:bg-[#1a1038] transition-colors"
              >
                <Wallet className="w-4 h-4 text-purple-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">ডিপোজিট ওয়ালেট</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-300/70 truncate">bKash, Nagad বা Rocket দিয়ে ব্যালেন্স যোগ করুন</p>
                </div>
              </Link>

              <Link
                to="/withdraw"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-purple-500/20 hover:bg-slate-50 dark:hover:bg-[#1a1038] transition-colors"
              >
                <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">টাকা উত্তোলন (Withdraw)</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-300/70 truncate">আর্নিং ব্যালেন্স থেকে পেমেন্ট নিন</p>
                </div>
              </Link>

              <Link
                to="/notifications"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-purple-500/20 hover:bg-slate-50 dark:hover:bg-[#1a1038] transition-colors"
              >
                <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">নোটিফিকেশন সেটিংস</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-300/70 truncate">ফোনে পুশ নোটিফিকেশন চালু ও টেস্ট করুন</p>
                </div>
              </Link>

              <Link
                to="/rules"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-purple-500/20 hover:bg-slate-50 dark:hover:bg-[#1a1038] transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">কাজের নিয়মাবলি</p>
                  <p className="text-[11px] text-slate-500 dark:text-purple-300/70 truncate">প্রুফ সাবমিশন ও একাউন্ট সুরক্ষা নীতি</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 rounded-2xl p-5 space-y-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              ম্যানুয়াল ভেরিফিকেশন প্রয়োজন হলে
            </h3>
            <p className="text-xs text-slate-600 dark:text-purple-200/80 leading-relaxed">
              নির্দিষ্ট কোনো TrxID, পেন্ডিং পেমেন্ট বা একাউন্ট আনব্লক করার জন্য আপনার Account ID ও ইমেইল সহ{' '}
              <a
                href="mailto:incomezone2729@gmail.com"
                className="font-semibold text-purple-700 dark:text-amber-400 underline"
              >
                incomezone2729@gmail.com
              </a>
              -এ যোগাযোগ করুন।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
