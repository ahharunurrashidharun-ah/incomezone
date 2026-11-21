import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { 
  Wallet, 
  CreditCard, 
  History, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Info, 
  Copy, 
  Check, 
  Zap, 
  AlertTriangle, 
  Smartphone, 
  Hash,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Plus
} from 'lucide-react';
import {
  getLocalDeposits,
  addLocalDeposit,
  getLocalUser,
  isTableMissingError,
  saveLocalNotification,
} from '../lib/localFallbackStore';
import { queueEmailNotification } from '../lib/notificationSender';
import { sendDepositAlert } from '../utils/telegramNotifier';
import toast from 'react-hot-toast';

interface DepositRequest {
  id: string;
  method?: string;
  senderNumber: string;
  transactionId: string;
  amount: number;
  amountBDT?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

// Exchange rate: 1 USD = 100 BDT (Standard platform rate: 1$ = 100৳)
const BDT_PER_USD = 100;

// Authentic brand logos for mobile banking
const BkashLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`rounded-xl bg-[#E2136E] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#E2136E]/20 ${className}`}>
    <svg viewBox="0 0 40 40" fill="currentColor" className="w-3/4 h-3/4">
      <path d="M21.5 5L9 22.8h11.2l-3.8 12.2L31 16.5H18.8L21.5 5z" />
    </svg>
  </div>
);

const NagadLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`rounded-xl bg-[#F7931E] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#F7931E]/20 ${className}`}>
    <svg viewBox="0 0 40 40" fill="currentColor" className="w-3/4 h-3/4">
      <circle cx="20" cy="20" r="16" fill="#F7931E" />
      <path d="M18 10c0 4-5 6-5 12a7 7 0 0 0 14 0c0-6-6-8-6-12z" fill="#FFFFFF" />
    </svg>
  </div>
);

const RocketLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`rounded-xl bg-[#8C3494] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#8C3494]/20 ${className}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-3/5 h-3/5">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  </div>
);

export default function DepositPage() {
  const { user, profile, setDirectBalances } = useAuth();
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'bKash' | 'Nagad' | 'Rocket'>('bKash');
  const [isProcessing, setIsProcessing] = useState(false);
  const submitLockRef = React.useRef(false);
  const [currentBalance, setCurrentBalance] = useState(profile?.depositBalance ?? 0);
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Synchronize deposit balance with live wallet profile state
  useEffect(() => {
    if (profile?.depositBalance !== undefined) {
      setCurrentBalance(profile.depositBalance);
    }
  }, [profile?.depositBalance]);

  const [depositBonusPercent, setDepositBonusPercent] = useState<number>(0);
  const [methods, setMethods] = useState<any>({
    bkash_enabled: true,
    bkash_number: '01870866189',
    nagad_enabled: true,
    nagad_number: '01870866189',
    rocket_enabled: true,
    rocket_number: '01870866189',
  });

  const fetchPlatformControls = async () => {
    try {
      let localCtrls = null;
      try {
        const str = localStorage.getItem('iz_platform_controls');
        if (str) localCtrls = JSON.parse(str);
      } catch {}

      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'platform_controls')
        .maybeSingle();

      let val = data?.value;
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch {}
      }

      const merged = val || localCtrls || {};
      setDepositBonusPercent(Number(merged.deposit_bonus_percent || 0));
    } catch {}
  };

  const fetchSettings = async () => {
    fetchPlatformControls();
    try {
      let localSS = null;
      try {
        const str = localStorage.getItem('iz_payment_methods');
        if (str) localSS = JSON.parse(str);
      } catch (e) {}

      let { data } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'deposit_methods')
        .maybeSingle();

      if (data && data.value) {
        data = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        if (data.bkash && typeof data.bkash === 'object') {
          data = {
            bkash_enabled: data.bkash.enabled ?? true,
            bkash_number: data.bkash.number || '01870866189',
            nagad_enabled: data.nagad.enabled ?? true,
            nagad_number: data.nagad.number || '01870866189',
            rocket_enabled: data.rocket.enabled ?? true,
            rocket_number: data.rocket.number || '01870866189',
          };
        }
      } else {
        data = null;
      }

      if (data) {
        setMethods({
          bkash_enabled: data.bkash_enabled ?? true,
          bkash_number: data.bkash_number || '01870866189',
          nagad_enabled: data.nagad_enabled ?? true,
          nagad_number: data.nagad_number || '01870866189',
          rocket_enabled: data.rocket_enabled ?? true,
          rocket_number: data.rocket_number || '01870866189',
        });
      } else if (localSS) {
        setMethods({
          bkash_enabled: localSS.bkash_enabled ?? true,
          bkash_number: localSS.bkash_number || '01870866189',
          nagad_enabled: localSS.nagad_enabled ?? true,
          nagad_number: localSS.nagad_number || '01870866189',
          rocket_enabled: localSS.rocket_enabled ?? true,
          rocket_number: localSS.rocket_number || '01870866189',
        });
      }
    } catch {
      // Keep sensible default numbers
    }
  };

  const fetchRequests = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false });

      let raw: any[] = [];
      if (!error && Array.isArray(data)) {
        raw = [...data];
      } else {
        raw = getLocalDeposits().filter((d) => d.user_id === user.uid);
      }

      // Deduplicate to avoid multiple visual rows
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const d of raw) {
        const trxKey = String(d.transaction_id || d.transactionId || d.id || '').trim().toUpperCase();
        if (!seen.has(trxKey)) {
          seen.add(trxKey);
          deduped.push(d);
        }
      }

      setRequests(deduped.map((d: any) => ({
        id: d.id,
        method: d.method,
        senderNumber: d.sender_number || d.senderNumber || '',
        transactionId: d.transaction_id || d.transactionId || '',
        amount: Number(d.amount || 0),
        amountBDT: Number(d.amount_bdt || d.amountBDT || Math.round(Number(d.amount || 0) * BDT_PER_USD)),
        status: d.status || 'pending',
        createdAt: d.created_at || d.createdAt,
      })));
    } catch {
      const local = getLocalDeposits()
        .filter((d) => d.user_id === user.uid)
        .map((d: any) => ({
          id: d.id,
          method: d.method,
          senderNumber: d.sender_number || d.senderNumber || '',
          transactionId: d.transaction_id || d.transactionId || '',
          amount: Number(d.amount || 0),
          amountBDT: Number(d.amount_bdt || d.amountBDT || Math.round(Number(d.amount || 0) * BDT_PER_USD)),
          status: d.status || 'pending',
          createdAt: d.created_at || d.createdAt,
        }));
      setRequests(local);
    }
  };

  const fetchUserBalance = async () => {
    if (!user) return;
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase
        .from('users')
        .select('deposit_balance')
        .eq('id', user.uid)
        .maybeSingle();

      if (!error && data) {
        const bal = Number(data.deposit_balance ?? 0);
        setCurrentBalance(bal);
        if (profile && profile.depositBalance !== bal) {
          setDirectBalances({ depositBalance: bal });
        }
      } else {
        const localUser = getLocalUser(user.uid);
        if (localUser) {
          const bal = Number(localUser.deposit_balance || 0);
          setCurrentBalance(bal);
          if (profile && profile.depositBalance !== bal) {
            setDirectBalances({ depositBalance: bal });
          }
        } else if (profile) {
          setCurrentBalance(Number(profile.depositBalance || 0));
        }
      }
    } catch {
      const localUser = getLocalUser(user.uid);
      if (localUser) {
        setCurrentBalance(Number(localUser.deposit_balance || 0));
      } else if (profile) {
        setCurrentBalance(Number(profile.depositBalance || 0));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchUserBalance();
    fetchRequests();
    fetchSettings();

    const handleControlsUpdated = (e: any) => {
      if (e.detail) {
        setDepositBonusPercent(Number(e.detail.deposit_bonus_percent || 0));
      }
    };
    window.addEventListener('iz_platform_controls_updated', handleControlsUpdated);

    try {
      const channel = supabase
        .channel(`deposit-page-updates-${user.uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests' }, () => {
          fetchRequests();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` }, () => {
          fetchUserBalance();
        })
        .subscribe();

      return () => {
        window.removeEventListener('iz_platform_controls_updated', handleControlsUpdated);
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {
        window.removeEventListener('iz_platform_controls_updated', handleControlsUpdated);
      };
    }
  }, [user?.uid]);

  // Active number based on selected method
  const getSelectedNumber = () => {
    if (selectedMethod === 'bKash') return methods?.bkash_number || '01870866189';
    if (selectedMethod === 'Nagad') return methods?.nagad_number || '01870866189';
    if (selectedMethod === 'Rocket') return methods?.rocket_number || '01870866189';
    return '01870866189';
  };

  const handleCopyNumber = () => {
    const num = getSelectedNumber();
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopied(true);
    toast.success(`নম্বর কপি করা হয়েছে: ${num}`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Live conversion calculations
  const parsedUSD = parseFloat(amountUSD) || 0;
  const calculatedBDT = Math.round(parsedUSD * BDT_PER_USD);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (submitLockRef.current || isProcessing) return;
    submitLockRef.current = true;

    if (!amountUSD || !senderNumber.trim() || !transactionId.trim()) {
      toast.error("অনুগ্রহ করে সব তথ্য সঠিকভাবে পূরণ করুন।");
      submitLockRef.current = false;
      return;
    }

    if (parsedUSD < 1) {
      toast.error("সর্বনিম্ন ডিপোজিট পরিমাণ ১ ডলার ($1.00) বা ৳১০০ টাকা (1$ = 100৳)।");
      submitLockRef.current = false;
      return;
    }

    const depositAmountUSD = parsedUSD;

    try {
      setIsProcessing(true);
      setSuccess('');

      const cleanMethodName = `${selectedMethod}`;
      const cleanTrxID = transactionId.trim().toUpperCase();
      const cleanSender = senderNumber.trim();

      let insertedIntoSupabase = false;
      const { data: insertedData, error: insertError } = await supabase
        .from('deposit_requests')
        .insert({
          user_id: user.uid,
          method: cleanMethodName,
          sender_number: cleanSender,
          transaction_id: cleanTrxID,
          amount: depositAmountUSD,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle();

      if (insertError && !isTableMissingError(insertError)) {
        throw new Error(`ডিপোজিট রিকোয়েস্ট সাবমিট হয়নি: ${insertError.message}`);
      }

      if (!insertError && insertedData?.id) {
        insertedIntoSupabase = true;
        addLocalDeposit({
          id: insertedData.id,
          user_id: user.uid,
          method: cleanMethodName,
          sender_number: cleanSender,
          transaction_id: cleanTrxID,
          amount: depositAmountUSD,
          amount_bdt: calculatedBDT,
          status: 'pending',
        });
      }

      if (!insertedIntoSupabase) {
        addLocalDeposit({
          user_id: user.uid,
          method: cleanMethodName,
          sender_number: cleanSender,
          transaction_id: cleanTrxID,
          amount: depositAmountUSD,
          amount_bdt: calculatedBDT,
          status: 'pending',
        });
      }

      saveLocalNotification(user.uid, {
        title: 'ডিপোজিট রিকোয়েস্ট জমা হয়েছে! 💰',
        message: `আপনার $${depositAmountUSD.toFixed(2)} (৳${calculatedBDT}) ডিপোজিট রিকোয়েস্ট (${cleanMethodName}) পর্যালোচনার জন্য জমা হয়েছে।`,
        type: 'deposit',
      });

      queueEmailNotification({
        subject: `[IncomeZone] New Deposit Request: $${depositAmountUSD.toFixed(2)} via ${cleanMethodName}`,
        message: `User ID: ${user.uid}\nMethod: ${cleanMethodName}\nSender: ${cleanSender}\nTrxID: ${cleanTrxID}\nAmount: $${depositAmountUSD.toFixed(2)} (৳${calculatedBDT} BDT)\n\nPlease verify in Admin Panel.`,
        type: 'deposit',
      });

      // Direct Telegram Alert to Admin
      sendDepositAlert({
        amount: depositAmountUSD,
        method: cleanMethodName,
        transactionId: cleanTrxID,
        senderNumber: cleanSender,
        userEmail: user.email,
        userId: user.uid,
      });

      setAmountUSD('');
      setSenderNumber('');
      setTransactionId('');
      setSuccess('ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে! অ্যাডমিন অ্যাপ্রুভ করার পর ব্যালেন্স যুক্ত হবে।');
      toast.success('ডিপোজিট রিকোয়েস্ট সফল হয়েছে! অ্যাডমিন অ্যাপ্রুভ করলে ব্যালেন্স যোগ হবে।');
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || 'ডিপোজিট রিকোয়েস্ট জমা দিতে সমস্যা হয়েছে।');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        submitLockRef.current = false;
      }, 1500);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
            <Clock className="w-3 h-3 mr-1 shrink-0 animate-pulse" /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/30">
            <XCircle className="w-3 h-3 mr-1 shrink-0" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getMethodIcon = (methodName?: string) => {
    const m = (methodName || '').toLowerCase();
    if (m.includes('bkash') || m.includes('বিকাশ')) return <BkashLogo className="w-9 h-9" />;
    if (m.includes('nagad') || m.includes('নগদ')) return <NagadLogo className="w-9 h-9" />;
    if (m.includes('rocket') || m.includes('রকেট')) return <RocketLogo className="w-9 h-9" />;
    return (
      <div className="w-9 h-9 rounded-xl bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 flex items-center justify-center font-black">
        <CreditCard className="w-5 h-5" />
      </div>
    );
  };

  const activeNumber = getSelectedNumber();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 sm:pb-28">
      {/* 1. Header with Liquidity Title & Live Balance */}
      <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-xl dark:shadow-purple-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 dark:bg-gradient-to-tr dark:from-amber-400 dark:to-yellow-500 flex items-center justify-center text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20 font-black shrink-0">
              <Plus className="w-7 h-7 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Add Liquidity
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Active Gateway
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-widest mt-0.5">
                Secure Deposit Gateway
              </p>
            </div>
          </div>

          {/* Current Balance & Live Wallet Connection */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 self-start sm:self-auto">
            {/* Deposit Wallet Card */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-2xl px-4 py-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-amber-400 shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-black text-slate-500 dark:text-purple-300/80 uppercase tracking-wider">
                    ডিপোজিট ব্যালেন্স (WALLET DEPOSIT)
                  </p>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-500/30 font-mono">
                    1$ = 100৳
                  </span>
                </div>
                <p className="text-base sm:text-lg font-black text-slate-900 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">
                  ${currentBalance.toFixed(2)}
                  <span className="text-xs text-slate-500 dark:text-purple-300/70 font-bold ml-1.5 font-sans">
                    (≈ ৳{Math.round(currentBalance * BDT_PER_USD)})
                  </span>
                </p>
              </div>
              <button
                onClick={fetchUserBalance}
                disabled={isRefreshing}
                title="Refresh Balance"
                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-purple-900/40 transition-colors ml-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick jump to Withdraw Wallet */}
            <Link
              to="/withdraw"
              className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 hover:border-purple-300 dark:hover:border-amber-400/40 text-xs transition-all shadow-sm group"
              title="উইথড্র / আর্নিং ওয়ালেটে যান"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-purple-300/60 uppercase">আর্নিং ওয়ালেট</p>
                <p className="text-xs font-black text-slate-700 dark:text-purple-200 font-mono">
                  ${(profile?.earningBalance || 0).toFixed(2)}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Official Instruction & Warning Notice Banner */}
      <div className="bg-amber-50/80 dark:bg-[#1a1205]/60 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 text-amber-900 dark:text-amber-200 flex items-start gap-3.5 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm font-semibold leading-relaxed">
          <p className="font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide text-[11px] sm:text-xs mb-1">
            জরুরি নিয়মাবলী ও নোটিশ (রেট: 1$ = 100৳):
          </p>
          <p>
            প্ল্যাটফর্ম এক্সচেঞ্জ রেট ১ ডলার সমান ১০০ টাকা (1$ = 100৳)। অফিশিয়াল নাম্বারে টাকা পাঠিয়ে সেন্ডার নাম্বার, টাকার পরিমাণ ও ট্রানজেকশন আইডি (TrxID) দিন। ভুয়া রিকোয়েস্ট দিলে একাউন্ট ব্লক করা হবে। রিভিউ শেষে ব্যালেন্স যোগ হতে ১–৬ ঘণ্টা লাগতে পারে।
          </p>
        </div>
      </div>

      {/* Special Active Deposit Bonus Banner */}
      {depositBonusPercent > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 dark:from-[#0d3326] dark:via-[#09291e] dark:to-[#041a13] border border-emerald-400 dark:border-emerald-500/40 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-emerald-900/20 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 dark:bg-emerald-500/20 flex items-center justify-center shrink-0 text-amber-300">
            <Sparkles className="w-7 h-7 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                SPECIAL OFFER
              </span>
              <h3 className="text-sm sm:text-base font-black">
                {depositBonusPercent}% ইনস্ট্যান্ট ডিপোজিট বোনাস অফার চলছে! 🎉
              </h3>
            </div>
            <p className="text-xs text-emerald-100 dark:text-emerald-200/80 mt-1 font-medium">
              যেকোনো মেথডে ডিপোজিট করলে অ্যাডমিন অ্যাপ্রুভালের সাথে সাথে আপনার অ্যাকাউন্টে মূল ডিপোজিটের পাশাপাশি অতিরিক্ত <strong className="text-amber-300">{depositBonusPercent}% বোনাস ব্যালেন্স</strong> যোগ হয়ে যাবে!
            </p>
          </div>
        </div>
      )}

      {/* 3. Official Number Box with Quick Copy & Method Switcher */}
      <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl dark:shadow-purple-950/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-purple-300/70">
                {selectedMethod.toUpperCase()} (PERSONAL) NUMBER
              </span>
            </div>

            {/* Big Phone Number with One-Click Copy */}
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white tracking-wider">
                {activeNumber}
              </span>
              <button
                onClick={handleCopyNumber}
                type="button"
                className={`p-2 sm:p-2.5 rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-xs font-bold ${
                  copied
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 dark:bg-purple-900/40 dark:text-amber-300 dark:hover:bg-purple-900/60 dark:border-purple-500/40'
                }`}
                title="নম্বরটি কপি করুন"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="hidden xs:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Quick Gateway Switcher Pills */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {methods?.bkash_enabled !== false && (
                <button
                  type="button"
                  onClick={() => setSelectedMethod('bKash')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border ${
                    selectedMethod === 'bKash'
                      ? 'bg-[#E2136E] text-white border-[#E2136E] shadow-sm'
                      : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
                  }`}
                >
                  <BkashLogo className="w-4 h-4 rounded-md" />
                  bKash (বিকাশ)
                </button>
              )}

              {methods?.nagad_enabled !== false && (
                <button
                  type="button"
                  onClick={() => setSelectedMethod('Nagad')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border ${
                    selectedMethod === 'Nagad'
                      ? 'bg-[#F7931E] text-white border-[#F7931E] shadow-sm'
                      : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
                  }`}
                >
                  <NagadLogo className="w-4 h-4 rounded-md" />
                  Nagad (নগদ)
                </button>
              )}

              {methods?.rocket_enabled !== false && (
                <button
                  type="button"
                  onClick={() => setSelectedMethod('Rocket')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border ${
                    selectedMethod === 'Rocket'
                      ? 'bg-[#8C3494] text-white border-[#8C3494] shadow-sm'
                      : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
                  }`}
                >
                  <RocketLogo className="w-4 h-4 rounded-md" />
                  Rocket (রকেট)
                </button>
              )}
            </div>
          </div>

          {/* Right Logo Avatar */}
          <div className="hidden sm:flex items-center justify-center shrink-0">
            {selectedMethod === 'bKash' && <BkashLogo className="w-16 h-16 rounded-2xl shadow-xl shadow-[#E2136E]/20" />}
            {selectedMethod === 'Nagad' && <NagadLogo className="w-16 h-16 rounded-2xl shadow-xl shadow-[#F7931E]/20" />}
            {selectedMethod === 'Rocket' && <RocketLogo className="w-16 h-16 rounded-2xl shadow-xl shadow-[#8C3494]/20" />}
          </div>
        </div>
      </div>

      {/* 4. Select Method Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-purple-200">
            ডিপোজিট মেথড সিলেক্ট করুন (SELECT METHOD)
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            ACTIVE GATEWAYS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {methods?.bkash_enabled !== false && (
            <button
              type="button"
              onClick={() => setSelectedMethod('bKash')}
              className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 cursor-pointer ${
                selectedMethod === 'bKash'
                  ? 'bg-purple-50/80 dark:bg-[#1f1035] border-[#E2136E] ring-2 ring-[#E2136E]/40 shadow-md'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 hover:border-slate-300 dark:hover:border-purple-500/40 shadow-sm'
              }`}
            >
              <BkashLogo className="w-12 h-12 rounded-xl" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  bKash (বিকাশ)
                </h4>
                <p className="text-[11px] font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-wider">
                  Personal Account
                </p>
              </div>
              {selectedMethod === 'bKash' && (
                <div className="w-5 h-5 rounded-full bg-[#E2136E] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          )}

          {methods?.nagad_enabled !== false && (
            <button
              type="button"
              onClick={() => setSelectedMethod('Nagad')}
              className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 cursor-pointer ${
                selectedMethod === 'Nagad'
                  ? 'bg-amber-50/80 dark:bg-[#251307] border-[#F7931E] ring-2 ring-[#F7931E]/40 shadow-md'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 hover:border-slate-300 dark:hover:border-purple-500/40 shadow-sm'
              }`}
            >
              <NagadLogo className="w-12 h-12 rounded-xl" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Nagad (নগদ)
                </h4>
                <p className="text-[11px] font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-wider">
                  Personal Account
                </p>
              </div>
              {selectedMethod === 'Nagad' && (
                <div className="w-5 h-5 rounded-full bg-[#F7931E] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          )}

          {methods?.rocket_enabled !== false && (
            <button
              type="button"
              onClick={() => setSelectedMethod('Rocket')}
              className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 cursor-pointer ${
                selectedMethod === 'Rocket'
                  ? 'bg-purple-50/80 dark:bg-[#260f2a] border-[#8C3494] ring-2 ring-[#8C3494]/40 shadow-md'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 hover:border-slate-300 dark:hover:border-purple-500/40 shadow-sm'
              }`}
            >
              <RocketLogo className="w-12 h-12 rounded-xl" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Rocket (রকেট)
                </h4>
                <p className="text-[11px] font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-wider">
                  Personal Account
                </p>
              </div>
              {selectedMethod === 'Rocket' && (
                <div className="w-5 h-5 rounded-full bg-[#8C3494] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 5. Deposit Input Form */}
      <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl dark:shadow-purple-950/40">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-purple-900/30">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600 dark:text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              ডিপোজিট ফর্ম (Submit Payment Info)
            </h2>
          </div>
          <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-500/30 font-mono">
            1$ = 100৳
          </span>
        </div>

        {success && (
          <div className="mb-6 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-4 rounded-2xl text-xs sm:text-sm font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleDeposit} className="space-y-5">
          {/* Amount Field in USD $ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                ডিপোজিট এমাউন্ট ডলারে (AMOUNT IN USD $) <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono">
                1$ = 100৳
              </span>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-purple-600 dark:text-amber-400 font-black text-lg">
                $
              </div>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amountUSD}
                onChange={(e) => setAmountUSD(e.target.value)}
                placeholder="1.00"
                className="w-full pl-9 pr-36 py-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-2xl text-slate-900 dark:text-white text-base sm:text-lg font-black font-mono focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all placeholder-slate-400 dark:placeholder-purple-400/30 shadow-inner"
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {parsedUSD > 0 ? `≈ ৳${calculatedBDT} BDT` : '1$ = 100৳'}
              </div>
            </div>

            {/* Quick Dollar Preset Buttons */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {[1, 2, 5, 10, 20, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountUSD(preset.toString())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1 cursor-pointer ${
                    parsedUSD === preset
                      ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 shadow-sm'
                      : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/30 hover:border-slate-300'
                  }`}
                >
                  <span>${preset}</span>
                  <span className="opacity-75 text-[10px]">(৳{preset * BDT_PER_USD})</span>
                  {parsedUSD === preset && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-purple-300/60 mt-1.5 ml-1">
              * ডলারে পরিমাণ লিখুন (যেমন $1, $2, $5)। ১$ এর জন্য বিকাশ/নগদ/রকেটে ১০০৳ পাঠাতে হবে।
            </p>
          </div>

          {/* Sender Mobile Number */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider mb-2">
              যে নম্বর থেকে টাকা পাঠিয়েছেন (SENDER MOBILE NUMBER) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-2xl text-slate-900 dark:text-white text-sm sm:text-base font-bold font-mono focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all placeholder-slate-400 dark:placeholder-purple-400/30 shadow-inner"
              />
            </div>
          </div>

          {/* Transaction ID */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider mb-2">
              ট্রানজেকশন আইডি (TRANSACTION ID / TRXID) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400">
                <Hash className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                placeholder="E.G. 8NX7A23B"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-2xl text-slate-900 dark:text-white text-sm sm:text-base font-black font-mono focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all placeholder-slate-400 dark:placeholder-purple-400/30 shadow-inner tracking-wider"
              />
            </div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-purple-300/60 mt-1.5 ml-1">
              * আপনার পেমেন্ট অ্যাপের কনফার্মেশন মেসেজ বা SMS থেকে TrxID কপি করে দিন।
            </p>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isProcessing || submitLockRef.current}
            className="w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 shadow-xl shadow-purple-600/25 dark:shadow-amber-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none mt-4 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>যাচাই করা হচ্ছে...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>DEPOSIT NOW (ডিপোজিট সাবমিট করুন)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 6. Deposit History Section (Cards view matching reference screenshot) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600 dark:text-amber-400" />
            DEPOSIT HISTORY (পূর্ববর্তী ডিপোজিট)
          </h3>
          <span className="text-xs font-bold text-slate-500 dark:text-purple-300/70">
            মোট রেকর্ড: {requests.length}
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white dark:bg-[#130b2c]/80 border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 text-center shadow-sm">
            <Wallet className="w-10 h-10 text-slate-300 dark:text-purple-500/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600 dark:text-purple-200">
              এখনো কোনো ডিপোজিট রেকর্ড নেই।
            </p>
            <p className="text-xs font-medium text-slate-400 dark:text-purple-300/50 mt-1">
              টাকা পাঠানোর পর ফরমটি পূরণ করলে এখানে হিস্টোরি দেখতে পারবেন।
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const bdtVal = req.amountBDT || Math.round(req.amount * BDT_PER_USD);
              const dateStr = req.createdAt
                ? new Date(req.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'N/A';

              return (
                <div
                  key={req.id}
                  className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 hover:border-slate-300 dark:hover:border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-lg dark:shadow-purple-950/40 flex items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {getMethodIcon(req.method)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">
                          {req.method || 'Manual'} DEPOSIT
                        </h4>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 dark:text-purple-300/50 uppercase mt-0.5">
                        {dateStr}
                      </p>
                      <p className="text-[11px] font-mono font-bold text-purple-600 dark:text-amber-300/80 truncate mt-0.5">
                        Trx: {req.transactionId} {req.senderNumber ? `· From: ${req.senderNumber}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <div>
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                        BDT {bdtVal}
                      </span>
                      <span className="text-xs font-bold text-slate-400 dark:text-purple-300/60 ml-1">
                        (${req.amount.toFixed(2)})
                      </span>
                    </div>
                    {renderStatus(req.status)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

