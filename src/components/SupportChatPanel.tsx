import React, { useState, useEffect, useRef } from 'react';
import { Send, RotateCcw, Headphones, User as UserIcon, ArrowUpRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatUserDisplayId } from '../lib/supabaseClient';
import {
  AccountSupportScope,
  getQuickFaqsForScope,
  matchReadymadeSupportReply,
} from '../lib/supportFaq';

export interface SupportMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
}

export interface SupportAccountOverride {
  accountStatus: 'pending' | 'blocked' | 'deleted';
  email?: string;
  ip?: string;
  name?: string;
}

function getWelcomeMessage(override?: SupportAccountOverride): SupportMessage {
  if (override?.accountStatus === 'pending') {
    return {
      id: 'welcome_msg',
      role: 'model',
      text: 'আসসালামু আলাইকুম! আপনার অ্যাকাউন্টটি বর্তমানে **IP পেন্ডিং** অবস্থায় রয়েছে। নিচের কমন প্রশ্নগুলো থেকে ট্যাপ করুন অথবা আপনার প্রশ্ন লিখুন—সাথে সাথেই উত্তর পাবেন।',
      createdAt: new Date().toISOString(),
    };
  }
  if (override?.accountStatus === 'blocked') {
    return {
      id: 'welcome_msg',
      role: 'model',
      text: 'আসসালামু আলাইকুম! আপনার অ্যাকাউন্টটি **ব্লক** অবস্থায় রয়েছে। কারণ ও সমাধান জানতে নিচের কমন প্রশ্নে ট্যাপ করুন অথবা প্রশ্ন লিখে পাঠান।',
      createdAt: new Date().toISOString(),
    };
  }
  if (override?.accountStatus === 'deleted') {
    return {
      id: 'welcome_msg',
      role: 'model',
      text: 'আসসালামু আলাইকুম! আপনার পূর্বের অ্যাকাউন্টটি **ডিলিট** করা হয়েছে। নতুন অ্যাকাউন্ট খোলা ও বিস্তারিত জানতে নিচের প্রশ্ন সিলেক্ট করুন বা লিখে পাঠান।',
      createdAt: new Date().toISOString(),
    };
  }
  return {
    id: 'welcome_msg',
    role: 'model',
    text: 'আসসালামু আলাইকুম! IncomeZone লাইভ সাপোর্টে স্বাগতম। ডিপোজিট, উইথড্র, জব সাবমিশন, অ্যাড বা নোটিফিকেশন সংক্রান্ত নিচের যেকোনো কমন প্রশ্নে ট্যাপ করুন অথবা আপনার প্রশ্ন লিখে পাঠান—সাথে সাথেই উত্তর পেয়ে যাবেন।',
    createdAt: new Date().toISOString(),
  };
}

function renderFormattedLine(line: string, lineKey: number, onNavigate?: () => void, allowInternalLinks = true) {
  const tokenRegex = /(\*\*[^*]+\*\*|\/(?:jobs|post-job|my-jobs|submitted-jobs|post-ad|posted-ads|deposit|withdraw|notifications|profile|support|rules|terms)|incomezone2729@gmail\.com)/g;
  const parts = line.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${lineKey}-${idx}`} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('/')) {
      if (!allowInternalLinks) {
        return (
          <span key={`${lineKey}-${idx}`} className="font-mono font-semibold text-purple-700 dark:text-amber-300">
            {part}
          </span>
        );
      }
      return (
        <Link
          key={`${lineKey}-${idx}`}
          to={part}
          onClick={onNavigate}
          className="inline-flex items-center gap-0.5 font-semibold text-purple-700 dark:text-amber-400 underline underline-offset-2 hover:opacity-80"
        >
          <span>{part}</span>
          <ArrowUpRight className="w-3 h-3 inline" />
        </Link>
      );
    }
    if (part === 'incomezone2729@gmail.com') {
      return (
        <a
          key={`${lineKey}-${idx}`}
          href="mailto:incomezone2729@gmail.com"
          className="font-semibold text-purple-700 dark:text-amber-400 underline underline-offset-2 hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={`${lineKey}-${idx}`}>{part}</React.Fragment>;
  });
}

function SafeMessageBody({
  text,
  onNavigate,
  allowInternalLinks = true,
}: {
  text: string;
  onNavigate?: () => void;
  allowInternalLinks?: boolean;
}) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed break-words">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        const bulletMatch = trimmed.match(/^([-*•])\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-purple-600 dark:text-amber-400 font-bold mt-0.5 select-none">•</span>
              <span className="flex-1">{renderFormattedLine(bulletMatch[2], i, onNavigate, allowInternalLinks)}</span>
            </div>
          );
        }
        return (
          <p key={i}>
            {renderFormattedLine(line, i, onNavigate, allowInternalLinks)}
          </p>
        );
      })}
    </div>
  );
}

interface SupportChatPanelProps {
  variant?: 'widget' | 'page';
  onNavigate?: () => void;
  accountOverride?: SupportAccountOverride;
}

export default function SupportChatPanel({
  variant = 'page',
  onNavigate,
  accountOverride,
}: SupportChatPanelProps) {
  const { user, profile } = useAuth();

  const normalizedOverrideEmail = (accountOverride?.email || '').trim().toLowerCase();
  const storageKey = accountOverride
    ? `iz_support_chat_v3_status_${accountOverride.accountStatus}_${normalizedOverrideEmail || 'anon'}`
    : user?.uid
    ? `iz_support_chat_v3_user_${user.uid}`
    : `iz_support_chat_v3_guest`;

  const scope: AccountSupportScope = accountOverride?.accountStatus || 'active';

  const [messages, setMessages] = useState<SupportMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [getWelcomeMessage(accountOverride)];
  });

  const [input, setInput] = useState('');
  const [showCommonList, setShowCommonList] = useState(true);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Switch strictly per-account when storageKey changes
  useEffect(() => {
    setInput('');
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}
    setMessages([getWelcomeMessage(accountOverride)]);
  }, [storageKey, accountOverride?.accountStatus]);

  useEffect(() => {
    try {
      const cleanToSave = messages.filter((m) => m.text.trim().length > 0).slice(-40);
      if (cleanToSave.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(cleanToSave));
      }
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleResetChat = () => {
    setInput('');
    const fresh = [getWelcomeMessage(accountOverride)];
    setMessages(fresh);
    setShowCommonList(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(fresh));
    } catch {}
    inputRef.current?.focus();
  };

  const sendMessage = (rawText?: string) => {
    const trimmed = (rawText ?? input).trim();
    if (!trimmed) return;

    if (!rawText) setInput('');

    const now = Date.now();
    const userMsg: SupportMessage = {
      id: `u_${now}`,
      role: 'user',
      text: trimmed,
      createdAt: new Date(now).toISOString(),
    };

    const { reply } = matchReadymadeSupportReply(trimmed, scope);

    const replyMsg: SupportMessage = {
      id: `m_${now + 1}`,
      role: 'model',
      text: reply,
      createdAt: new Date(now + 1).toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, replyMsg]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const quickFaqs = getQuickFaqsForScope(scope);
  const allowInternalLinks = !accountOverride;

  const accountLabel = accountOverride
    ? `${
        accountOverride.accountStatus === 'pending'
          ? 'পেন্ডিং একাউন্ট'
          : accountOverride.accountStatus === 'blocked'
          ? 'ব্লক একাউন্ট'
          : 'ডিলিট একাউন্ট'
      }${accountOverride.email ? ` · ${accountOverride.email}` : ''}`
    : user
    ? `#${formatUserDisplayId(profile?.display_id || (user as any)?.display_id, user.uid)} · ${
        profile?.email || user.email || profile?.name || user.name
      }`
    : null;

  return (
    <div className={`flex flex-col ${variant === 'page' ? 'h-full min-h-[540px]' : 'h-full'}`}>
      {/* Per-account session bar */}
      {accountLabel && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-purple-500/20 bg-slate-50/80 dark:bg-[#0c061f] flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-purple-200/80 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-amber-400 shrink-0" />
            <span className="truncate font-mono">{accountLabel}</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-purple-300/60 whitespace-nowrap shrink-0">
            তাৎক্ষণিক উত্তর
          </span>
        </div>
      )}

      {/* Messages Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 smooth-scroll">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  isUser
                    ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-700 dark:border-amber-300'
                    : 'bg-slate-100 dark:bg-[#1a1038] text-purple-700 dark:text-amber-300 border-slate-200 dark:border-purple-500/30'
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
              </div>

              <div className={`max-w-[82%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 border ${
                    isUser
                      ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 rounded-tr-sm'
                      : 'bg-slate-50 dark:bg-[#0e0822] text-slate-800 dark:text-slate-100 border-slate-200 dark:border-purple-500/20 rounded-tl-sm'
                  }`}
                >
                  {isUser ? (
                    <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words font-medium">
                      {msg.text}
                    </p>
                  ) : (
                    <SafeMessageBody
                      text={msg.text}
                      onNavigate={onNavigate}
                      allowInternalLinks={allowInternalLinks}
                    />
                  )}
                </div>

                <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-purple-300/50 px-1">
                  {isUser ? 'আপনি' : 'Live Support'} · {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Always-accessible Common Questions section */}
        {showCommonList && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-purple-300/70 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-purple-600 dark:text-amber-400" />
                <span>কমন প্রশ্ন (সিলেক্ট করলেই তাৎক্ষণিক উত্তর পাবেন):</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickFaqs.map((faq) => (
                <button
                  key={faq.id}
                  type="button"
                  onClick={() => sendMessage(faq.question)}
                  className="text-left text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-[#180e36] text-slate-700 dark:text-purple-100 border border-slate-200 dark:border-purple-500/25 hover:border-purple-400 dark:hover:border-amber-400/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
                >
                  {faq.question}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-purple-500/20 bg-white dark:bg-[#110a26]">
        <div className="flex items-end gap-2">
          {variant === 'widget' && (
            <button
              type="button"
              onClick={handleResetChat}
              title="নতুন চ্যাট শুরু করুন"
              className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 dark:border-purple-500/25 text-slate-500 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/40 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="আপনার প্রশ্ন এখানে লিখুন..."
            className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-[#090517] text-slate-900 dark:text-white border border-slate-200 dark:border-purple-500/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 max-h-28"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-purple-600 hover:bg-purple-700 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline whitespace-nowrap">পাঠান</span>
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-purple-300/60">
          <button
            type="button"
            onClick={() => setShowCommonList((v) => !v)}
            className="font-semibold text-purple-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            {showCommonList ? 'কমন প্রশ্ন লুকান' : 'কমন প্রশ্ন দেখুন'}
          </button>
          {variant === 'page' && (
            <button
              type="button"
              onClick={handleResetChat}
              className="font-semibold text-purple-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>নতুন চ্যাট</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
