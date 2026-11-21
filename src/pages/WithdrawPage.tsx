import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  CreditCard,
  History,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpRight,
  Zap,
  AlertTriangle,
  Smartphone,
  RefreshCw,
  Check,
  ShieldCheck,
  Radio,
  Wallet,
} from 'lucide-react';
import {
  getLocalWithdrawals,
  addLocalWithdrawal,
  getLocalUser,
  saveLocalUser,
  isTableMissingError,
  saveLocalNotification,
} from '../lib/localFallbackStore';
import { queueEmailNotification } from '../lib/notificationSender';
import { sendWithdrawalAlert } from '../utils/telegramNotifier';
import toast from 'react-hot-toast';

interface WithdrawRequest {
  id: string;
  method: string;
  accountNumber: string;
  amount: number;
  amountBDT?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

// Platform Standard Exchange Rate: 1 USD = 100 BDT (1$ = 100৳)
const BDT_PER_USD = 100;

// Authentic brand logos for mobile banking and recharge
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

const RechargeLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <div className={`rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20 ${className}`}>
    <Smartphone className="w-3/5 h-3/5 stroke-[2.5]" />
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

export default function WithdrawPage() {
  const { user, profile, updateBalances, setDirectBalances } = useAuth();
  const [method, setMethod] = useState<'bKash' | 'Nagad' | 'Recharge' | 'Rocket'>('bKash');
  const [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState('1'); // Default to $1 (1$ = 100৳)
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [earningBalance, setEarningBalance] = useState(profile?.earningBalance ?? 0);
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const submitLockRef = useRef(false);

  // Keep earning balance in live sync with wallet state
  useEffect(() => {
    if (profile?.earningBalance !== undefined) {
      setEarningBalance(profile.earningBalance);
    }
  }, [profile?.earningBalance]);
  const [controls, setControls] = useState<{ withdraw_fee_percent: number; withdraw_bonus_percent: number }>({
    withdraw_fee_percent: 0,
    withdraw_bonus_percent: 0,
  });
  const [methods, setMethods] = useState<any>({
    bkash_enabled: true,
    nagad_enabled: true,
    recharge_enabled: true,
    rocket_enabled: true,
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
      setControls({
        withdraw_fee_percent: Number(merged.withdraw_fee_percent || 0),
        withdraw_bonus_percent: Number(merged.withdraw_bonus_percent || 0),
      });
    } catch {}
  };

  const fetchSettings = async () => {
    fetchPlatformControls();
    try {
      let localSS = null;
      try {
        const str = localStorage.getItem('iz_payment_methods');
        if (str) localSS = JSON.parse(str);
      } catch {}

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
            nagad_enabled: data.nagad.enabled ?? true,
            recharge_enabled: true,
            rocket_enabled: data.rocket?.enabled ?? true,
          };
        }
      } else {
        data = null;
      }

      if (data) {
        setMethods({
          bkash_enabled: data.bkash_enabled ?? true,
          nagad_enabled: data.nagad_enabled ?? true,
          recharge_enabled: data.recharge_enabled ?? true,
          rocket_enabled: data.rocket_enabled ?? true,
        });
      } else if (localSS) {
        setMethods({
          bkash_enabled: localSS.bkash_enabled ?? true,
          nagad_enabled: localSS.nagad_enabled ?? true,
          recharge_enabled: true,
          rocket_enabled: localSS.rocket_enabled ?? true,
        });
      }
    } catch {
      // Default enabled
    }
  };

  const fetchRequests = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('withdraw_requests')
        .select('*')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false });

      let raw: any[] = [];
      if (!error && Array.isArray(data)) {
        raw = [...data];
      } else {
        raw = getLocalWithdrawals().filter((d) => d.user_id === user.uid);
      }

      // Deduplicate to avoid multiple visual rows
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const d of raw) {
        const key = d.id || `${d.amount}_${d.account_number || d.accountNumber}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(d);
        }
      }

      setRequests(deduped.map((d: any) => ({
        id: d.id,
        method: d.method || 'bKash',
        accountNumber: d.account_number || d.accountNumber || '',
        amount: Number(d.amount || 0),
        amountBDT: Number(d.amount_bdt || d.amountBDT || Math.round(Number(d.amount || 0) * BDT_PER_USD)),
        status: d.status || 'pending',
        createdAt: d.created_at || d.createdAt,
      })));
    } catch {
      const local = getLocalWithdrawals()
        .filter((d) => d.user_id === user.uid)
        .map((d: any) => ({
          id: d.id,
          method: d.method || 'bKash',
          accountNumber: d.account_number || d.accountNumber || '',
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
        .select('earning_balance')
        .eq('id', user.uid)
        .maybeSingle();

      if (!error && data) {
        const bal = Number(data.earning_balance ?? 0);
        setEarningBalance(bal);
        if (profile && profile.earningBalance !== bal) {
          setDirectBalances({ earningBalance: bal });
        }
      } else {
        const localUser = getLocalUser(user.uid);
        if (localUser) {
          const bal = Number(localUser.earning_balance || 0);
          setEarningBalance(bal);
          if (profile && profile.earningBalance !== bal) {
            setDirectBalances({ earningBalance: bal });
          }
        } else if (profile) {
          setEarningBalance(Number(profile.earningBalance || 0));
        }
      }
    } catch {
      const localUser = getLocalUser(user.uid);
      if (localUser) {
        setEarningBalance(Number(localUser.earning_balance || 0));
      } else if (profile) {
        setEarningBalance(Number(profile.earningBalance || 0));
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
        setControls({
          withdraw_fee_percent: Number(e.detail.withdraw_fee_percent || 0),
          withdraw_bonus_percent: Number(e.detail.withdraw_bonus_percent || 0),
        });
      }
    };
    window.addEventListener('iz_platform_controls_updated', handleControlsUpdated);

    try {
      const channel = supabase
        .channel(`withdraw-page-${user.uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'withdraw_requests' }, () => {
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

  const parsedAmountUSD = parseFloat(amount) || 0;
  const baseCalculatedBDT = Math.round(parsedAmountUSD * BDT_PER_USD);
  const feeUSD = Number(((parsedAmountUSD * controls.withdraw_fee_percent) / 100).toFixed(2));
  const bonusUSD = Number(((parsedAmountUSD * controls.withdraw_bonus_percent) / 100).toFixed(2));
  const netAmountUSD = Number(Math.max(0, parsedAmountUSD - feeUSD + bonusUSD).toFixed(2));
  const calculatedBDT = Math.round(netAmountUSD * BDT_PER_USD);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Instant synchronous lockout: rapid multiple clicks are blocked on the spot
    if (submitLockRef.current || isProcessing) return;
    submitLockRef.current = true;

    setError('');
    setSuccess('');

    if (isNaN(parsedAmountUSD) || parsedAmountUSD <= 0) {
      const err = "অনুগ্রহ করে সঠিক পরিমাণ (ডলারে) লিখুন।";
      setError(err);
      toast.error(err);
      submitLockRef.current = false;
      return;
    }

    try {
      setIsProcessing(true);

      // 0. Always verify live earning_balance from Supabase first
      let currentEarning = Number(profile?.earningBalance ?? earningBalance ?? 0);
      let hasRemoteUser = false;
      const { data: userDoc, error: balFetchErr } = await supabase
        .from('users')
        .select('id, earning_balance')
        .eq('id', user.uid)
        .maybeSingle();

      if (balFetchErr && !isTableMissingError(balFetchErr)) {
        throw new Error(`ব্যালেন্স যাচাই করতে সমস্যা হয়েছে: ${balFetchErr.message}`);
      }

      if (userDoc) {
        hasRemoteUser = true;
        currentEarning = Number(userDoc.earning_balance ?? 0);
      } else {
        const localUser = getLocalUser(user.uid);
        if (localUser) {
          currentEarning = Number(localUser.earning_balance || 0);
        }
      }

      setEarningBalance(currentEarning);

      // Strict balance sufficiency check: display clear Insufficient Balance / পর্যাপ্ত ব্যালেন্স নেই notice
      if (parsedAmountUSD > currentEarning || currentEarning <= 0) {
        const err = `Insufficient Balance! আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই। বর্তমান উত্তোলনযোগ্য ব্যালেন্স: $${currentEarning.toFixed(2)} (৳${Math.round(currentEarning * BDT_PER_USD)})।`;
        setError(err);
        toast.error(err);
        return;
      }

      if (parsedAmountUSD < 1) {
        const err = "সর্বনিম্ন উইথড্র লিমিট ১ ডলার বা ১০০ টাকা (1$ = 100৳)।";
        setError(err);
        toast.error(err);
        return;
      }

      if (!accountNumber.trim()) {
        const err = "অনুগ্রহ করে আপনার একাউন্ট নম্বরটি প্রদান করুন।";
        setError(err);
        toast.error(err);
        return;
      }

      // Bangladeshi phone number validation (11 digits e.g. 017...)
      const cleanNumber = accountNumber.trim().replace(/[^0-9]/g, '');
      if (cleanNumber.length < 11) {
        const err = "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01700000000)।";
        setError(err);
        toast.error(err);
        return;
      }

      const newBalance = Math.max(0, Number((currentEarning - parsedAmountUSD).toFixed(2)));

      // 1. Deduct Supabase users balance FIRST and verify persistence
      if (hasRemoteUser) {
        const { data: updatedUser, error: deductErr } = await supabase
          .from('users')
          .update({ earning_balance: newBalance })
          .eq('id', user.uid)
          .select('id, earning_balance')
          .maybeSingle();

        if (deductErr && !isTableMissingError(deductErr)) {
          throw new Error(`ব্যালেন্স কাটতে সমস্যা হয়েছে: ${deductErr.message}`);
        }
        if (!deductErr && !updatedUser) {
          throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে ব্যালেন্স আপডেট হয়নি।');
        }
      }

      // 2. Insert into Supabase withdraw_requests (roll back balance if DB insert fails)
      let insertedIntoSupabase = false;
      const { data: insertedData, error: insertError } = await supabase
        .from('withdraw_requests')
        .insert({
          user_id: user.uid,
          method,
          account_number: cleanNumber,
          amount: parsedAmountUSD,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();

      if (insertError && !isTableMissingError(insertError)) {
        if (hasRemoteUser) {
          await supabase
            .from('users')
            .update({ earning_balance: currentEarning })
            .eq('id', user.uid);
        }
        throw new Error(`উইথড্র রিকোয়েস্ট সাবমিট হয়নি: ${insertError.message}`);
      }

      saveLocalUser(user.uid, { earning_balance: newBalance });
      setEarningBalance(newBalance);
      updateBalances(0, -parsedAmountUSD);

      if (!insertError && insertedData?.id) {
        insertedIntoSupabase = true;
        addLocalWithdrawal({
          id: insertedData.id,
          user_id: user.uid,
          method,
          account_number: cleanNumber,
          amount: parsedAmountUSD,
          amount_bdt: calculatedBDT,
          status: 'pending',
        });
      }

      // Fallback only if Supabase table is missing (offline mode)
      if (!insertedIntoSupabase) {
        addLocalWithdrawal({
          user_id: user.uid,
          method,
          account_number: cleanNumber,
          amount: parsedAmountUSD,
          amount_bdt: calculatedBDT,
          status: 'pending',
        });
      }

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('iz_balance_updated', {
          detail: { userId: user.uid, earningBalance: newBalance }
        }));
      }, 0);

      saveLocalNotification(user.uid, {
        title: 'উত্তোলন রিকোয়েস্ট জমা হয়েছে! 💸',
        message: `আপনার $${parsedAmountUSD.toFixed(2)} (৳${calculatedBDT}) উত্তোলন রিকোয়েস্ট (${method}) পর্যালোচনার জন্য জমা হয়েছে।`,
        type: 'withdrawal',
      });

      queueEmailNotification({
        subject: `[IncomeZone] New Withdrawal Request: $${parsedAmountUSD.toFixed(2)} via ${method}`,
        message: `User ID: ${user.uid}\nMethod: ${method}\nAccount Number: ${cleanNumber}\nAmount: $${parsedAmountUSD.toFixed(2)} (৳${calculatedBDT} BDT)\n\nPlease process payout in Admin Panel.`,
        type: 'withdrawal',
      });

      // Direct Telegram Alert to Admin
      sendWithdrawalAlert({
        amount: parsedAmountUSD,
        method,
        accountNumber: cleanNumber,
        userEmail: user.email,
        userId: user.uid,
      });

      setAmount('1');
      setAccountNumber('');
      const successMsg = 'উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে! অ্যাডমিন অ্যাপ্রুভ করলে পেমেন্ট পাঠানো হবে, অথবা রিজেক্ট করলে ব্যালেন্স ফিরে পাবেন।';
      setSuccess(successMsg);
      toast.success(successMsg);
      fetchRequests();
    } catch (err: any) {
      const msg = err.message || 'উইথড্র রিকোয়েস্ট জমা দিতে ব্যর্থ হয়েছে।';
      setError(msg);
      toast.error(msg);
    } finally {
      setTimeout(() => {
        submitLockRef.current = false;
        setIsProcessing(false);
      }, 1500);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
            <Clock className="w-3 h-3 mr-1 shrink-0 animate-pulse" /> PENDING
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> COMPLETED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/30">
            <XCircle className="w-3 h-3 mr-1 shrink-0" /> REJECTED
          </span>
        );
      default:
        return null;
    }
  };

  const getMethodIcon = (methodName?: string) => {
    const m = (methodName || '').toLowerCase();
    if (m.includes('bkash') || m.includes('বিকাশ')) return <BkashLogo className="w-10 h-10" />;
    if (m.includes('nagad') || m.includes('নগদ')) return <NagadLogo className="w-10 h-10" />;
    if (m.includes('recharge') || m.includes('রিচার্জ')) return <RechargeLogo className="w-10 h-10" />;
    if (m.includes('rocket') || m.includes('রকেট')) return <RocketLogo className="w-10 h-10" />;
    return (
      <div className="w-10 h-10 rounded-xl bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 flex items-center justify-center font-black">
        <CreditCard className="w-5 h-5" />
      </div>
    );
  };

  const getDynamicAccountLabel = () => {
    switch (method) {
      case 'bKash':
        return 'বিকাশ পার্সোনাল মোবাইল নম্বর (BKASH PERSONAL NUMBER)';
      case 'Nagad':
        return 'নগদ পার্সোনাল মোবাইল নম্বর (NAGAD PERSONAL NUMBER)';
      case 'Recharge':
        return 'মোবাইল রিচার্জ নম্বর (ALL SIM OPERATOR - GP, BL, ROBI, AIRTEL, TELETALK)';
      case 'Rocket':
        return 'রকেট পার্সোনাল নম্বর (ROCKET PERSONAL NUMBER)';
      default:
        return 'একাউন্ট নম্বর (ACCOUNT NUMBER)';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 sm:pb-28">
      {/* 1. Header with Exit Capital / Verified Payout Gateway */}
      <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-xl dark:shadow-purple-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 dark:bg-gradient-to-tr dark:from-amber-400 dark:to-yellow-500 flex items-center justify-center text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20 font-black shrink-0">
              <ArrowUpRight className="w-7 h-7 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Exit Capital
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Verified Payout Gateway
                </span>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-widest mt-0.5">
                উত্তোলন ও উইথড্রয়াল গেটওয়ে
              </p>
            </div>
          </div>

          {/* Platform Exchange Rate & Live Deposit Wallet Connection */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 self-start sm:self-auto">
            {/* Quick jump to Deposit Wallet */}
            <Link
              to="/deposit"
              className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 hover:border-purple-300 dark:hover:border-amber-400/40 text-xs transition-all shadow-sm group"
              title="ডিপোজিট ওয়ালেটে যান"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <p className="text-[9px] font-black text-slate-400 dark:text-purple-300/60 uppercase">ডিপোজিট ওয়ালেট</p>
                <p className="text-xs font-black text-slate-700 dark:text-purple-200 font-mono">
                  ${(profile?.depositBalance || 0).toFixed(2)}
                </p>
              </div>
            </Link>

            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-purple-300/70">
                ফিক্সড রেট:
              </span>
              <span className="text-xs font-black font-mono px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-500/30">
                1$ = 100৳
              </span>
            </div>

            <button
              onClick={fetchUserBalance}
              disabled={isRefreshing}
              title="Refresh Balance"
              className="p-2.5 rounded-2xl bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 text-slate-500 dark:text-purple-300 hover:text-purple-600 dark:hover:text-amber-400 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Official Instruction & Warning Notice Banner */}
      <div className="bg-amber-50/90 dark:bg-[#1a1205]/70 border border-amber-300 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 text-amber-900 dark:text-amber-200 flex items-start gap-3.5 shadow-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm leading-relaxed">
          <p className="font-black text-amber-800 dark:text-amber-300 uppercase tracking-wide text-[11px] sm:text-xs mb-1">
            জরুরি উইথড্রয়াল নোটিশ ও সতর্কতা (1$ = 100৳):
          </p>
          <p>
            নাম্বারটি ভালোভাবে চেক করে সাবমিট করুন। ভুল নম্বরে টাকা গেলে কর্তৃপক্ষ কোনোভাবেই দায়ী নয়। রিচার্জ অথবা বিকাশ ও নগদে টাকা পেতে সাধারণত ১-২৪ ঘণ্টা সময় লাগতে পারে। সর্বনিম্ন উইথড্র ১ ডলার বা ১০০ টাকা (1$ = 100৳)।
          </p>
        </div>
      </div>

      {/* 3. Withdrawable Balance Card (Inspired by reference screenshot) */}
      <div className="bg-gradient-to-br from-purple-700 via-indigo-800 to-purple-900 dark:from-[#1b0d3a] dark:via-[#160a30] dark:to-[#0f0722] border border-purple-500/30 dark:border-purple-500/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-purple-900/20 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-purple-200 dark:text-purple-300/80">
                WITHDRAWABLE BALANCE (উত্তোলনযোগ্য ব্যালেন্স)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 font-mono">
                1$ = 100৳
              </span>
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight text-white dark:bg-gradient-to-r dark:from-amber-200 dark:via-yellow-300 dark:to-amber-400 dark:bg-clip-text dark:text-transparent">
                BDT {Math.round(earningBalance * BDT_PER_USD)}
              </span>
              <span className="text-lg sm:text-2xl font-black text-purple-200 dark:text-purple-200/90 font-mono">
                / ${earningBalance.toFixed(2)} USD
              </span>
            </div>

            <p className="text-xs font-semibold text-purple-200/80 flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              টাস্ক কমপ্লিট করে অর্জিত সম্পূর্ণ উইথড্রযোগ্য ক্যাপিটাল
            </p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-4 sm:pt-0 border-purple-500/20">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Zap className="w-3.5 h-3.5 fill-current" />
              AVAILABLE TO WITHDRAW
            </span>
            <span className="text-[11px] font-mono text-purple-300/70">
              সর্বনিম্ন উত্তোলন $1.00 (৳১০০)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Payment Gateway Selector Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-purple-200">
            পেআউট মেথড সিলেক্ট করুন (SELECT PAYOUT GATEWAY)
          </span>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            ACTIVE GATEWAYS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* bKash */}
          {methods?.bkash_enabled !== false && (
            <button
              type="button"
              onClick={() => setMethod('bKash')}
              className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 cursor-pointer ${
                method === 'bKash'
                  ? 'bg-purple-50/80 dark:bg-[#1f1035] border-[#E2136E] ring-2 ring-[#E2136E]/40 shadow-md'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 hover:border-slate-300 dark:hover:border-purple-500/40 shadow-sm'
              }`}
            >
              <BkashLogo className="w-12 h-12 rounded-xl" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                    bKash (বিকাশ)
                  </h4>
                </div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-wider">
                  Personal Account
                </p>
              </div>
              {method === 'bKash' && (
                <div className="w-5 h-5 rounded-full bg-[#E2136E] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          )}

          {/* Nagad */}
          {methods?.nagad_enabled !== false && (
            <button
              type="button"
              onClick={() => setMethod('Nagad')}
              className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 cursor-pointer ${
                method === 'Nagad'
                  ? 'bg-amber-50/80 dark:bg-[#251307] border-[#F7931E] ring-2 ring-[#F7931E]/40 shadow-md'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 hover:border-slate-300 dark:hover:border-purple-500/40 shadow-sm'
              }`}
            >
              <NagadLogo className="w-12 h-12 rounded-xl" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  Nagad (নগদ)
                </h4>
                <p className="text-[11px] font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-wider">
                  Personal Account
                </p>
              </div>
              {method === 'Nagad' && (
                <div className="w-5 h-5 rounded-full bg-[#F7931E] text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          )}

          {/* Mobile Recharge (All SIM) */}
          {methods?.recharge_enabled !== false && (
            <button
              type="button"
              onClick={() => setMethod('Recharge')}
              className={`relative text-left p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 cursor-pointer ${
                method === 'Recharge'
                  ? 'bg-blue-50/80 dark:bg-[#0d1e38] border-cyan-500 ring-2 ring-cyan-500/40 shadow-md'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 hover:border-slate-300 dark:hover:border-purple-500/40 shadow-sm'
              }`}
            >
              <RechargeLogo className="w-12 h-12 rounded-xl" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  Recharge (রিচার্জ)
                </h4>
                <p className="text-[11px] font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-wider">
                  All SIM (সকল সিম)
                </p>
              </div>
              {method === 'Recharge' && (
                <div className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 5. Withdrawal Submission Form */}
      <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-sm dark:shadow-xl dark:shadow-purple-950/40">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100 dark:border-purple-900/30">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600 dark:text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              উইথড্র রিকোয়েস্ট ফরম (Initiate Payout)
            </h2>
          </div>
          <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-500/30 font-mono">
            1$ = 100৳
          </span>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-xs sm:text-sm font-bold border border-red-200 dark:border-red-500/30 flex items-center gap-2.5">
            <XCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-4 rounded-2xl text-xs sm:text-sm font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleWithdraw} noValidate className="space-y-5">
          {/* Amount Field with Quick Preset Chips and 1$ = 100৳ calculation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider">
                উইথড্র এমাউন্ট (WITHDRAW AMOUNT - USD) <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-bold text-slate-500 dark:text-purple-300/70 font-mono">
                Available: ${earningBalance.toFixed(2)} (৳{Math.round(earningBalance * BDT_PER_USD)})
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1.00"
                className="w-full pl-9 pr-36 py-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-2xl text-slate-900 dark:text-white text-base sm:text-lg font-black font-mono focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all placeholder-slate-400 dark:placeholder-purple-400/30 shadow-inner"
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {parsedAmountUSD === 1
                  ? '1$ = 100৳'
                  : parsedAmountUSD > 0
                  ? `≈ ৳${calculatedBDT} BDT`
                  : '1$ = 100৳'}
              </div>
            </div>

            {/* Quick Amount Preset Chips */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setAmount('1')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                  parsedAmountUSD === 1
                    ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 shadow-sm'
                    : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/30 hover:border-slate-300'
                }`}
              >
                <span>$1 (1$ = 100৳)</span>
                {parsedAmountUSD === 1 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              <button
                type="button"
                onClick={() => setAmount('2')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                  parsedAmountUSD === 2
                    ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 shadow-sm'
                    : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/30 hover:border-slate-300'
                }`}
              >
                <span>$2 (৳200)</span>
                {parsedAmountUSD === 2 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              <button
                type="button"
                onClick={() => setAmount('5')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                  parsedAmountUSD === 5
                    ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 shadow-sm'
                    : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/30 hover:border-slate-300'
                }`}
              >
                <span>$5 (৳500)</span>
                {parsedAmountUSD === 5 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </button>

              {earningBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(earningBalance.toString())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                    parsedAmountUSD === earningBalance && earningBalance > 0
                      ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 shadow-sm'
                      : 'bg-slate-100 dark:bg-[#0a0718] text-slate-700 dark:text-purple-200 border-slate-200 dark:border-purple-500/30 hover:border-slate-300'
                  }`}
                >
                  <span>MAX (সব ব্যালেন্স)</span>
                </button>
              )}
            </div>
          </div>

          {/* Account Mobile Number Field */}
          <div>
            <label className="block text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider mb-2">
              {getDynamicAccountLabel()} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-2xl text-slate-900 dark:text-white text-sm sm:text-base font-bold font-mono focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all placeholder-slate-400 dark:placeholder-purple-400/30 shadow-inner"
              />
            </div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-purple-300/60 mt-1.5 ml-1">
              * ১১ ডিজিটের সঠিক বাংলাদেশী পার্সোনাল অথবা রিচার্জ নম্বর দিন।
            </p>
          </div>

          {/* Real-time Calculation Summary Box */}
          <div className="bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/20 rounded-2xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-purple-200/80">
              <span className="font-bold">উইথড্র রেট (Exchange Rate):</span>
              <span className="font-black font-mono text-purple-600 dark:text-amber-400">1$ = 100৳</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-purple-200/80">
              <span className="font-bold">গেটিং মেথড (Gateway):</span>
              <span className="font-black text-slate-900 dark:text-white">{method}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-purple-200/80">
              <span className="font-bold">প্ল্যাটফর্ম উইথড্র ফি ({controls.withdraw_fee_percent}%):</span>
              <span className={`font-black ${controls.withdraw_fee_percent > 0 ? 'text-rose-500 font-mono' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {controls.withdraw_fee_percent > 0 ? `- $${feeUSD.toFixed(2)} (৳${Math.round(feeUSD * BDT_PER_USD)})` : '৳০ (ফ্রি / Zero Fee)'}
              </span>
            </div>
            {controls.withdraw_bonus_percent > 0 && (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span className="font-bold">উইথড্র বোনাস ({controls.withdraw_bonus_percent}%):</span>
                <span className="font-black font-mono">+ ${bonusUSD.toFixed(2)} (৳${Math.round(bonusUSD * BDT_PER_USD)})</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-purple-900/40 flex items-center justify-between text-slate-900 dark:text-white text-sm font-black">
              <span>মোট নিট টাকা পাবেন (Net Received):</span>
              <span className="text-base sm:text-lg font-black font-mono text-purple-600 dark:text-amber-400">
                ৳{calculatedBDT} BDT (${netAmountUSD.toFixed(2)})
              </span>
            </div>
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
                <span>প্রসেসিং হচ্ছে...</span>
              </>
            ) : (
              <>
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                <span>INITIATE WITHDRAWAL (উইথড্র রিকোয়েস্ট পাঠান)</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 6. Withdrawal Logs / History Section (Cards view matching screenshot) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600 dark:text-amber-400" />
            WITHDRAWAL LOGS (উইথড্র হিস্টোরি)
          </h3>
          <span className="text-xs font-bold text-slate-500 dark:text-purple-300/70">
            মোট রেকর্ড: {requests.length}
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white dark:bg-[#130b2c]/80 border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 text-center shadow-sm">
            <CreditCard className="w-10 h-10 text-slate-300 dark:text-purple-500/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600 dark:text-purple-200">
              এখনো কোনো উইথড্র রিকোয়েস্ট রেকর্ড নেই।
            </p>
            <p className="text-xs font-medium text-slate-400 dark:text-purple-300/50 mt-1">
              উইথড্র রিকোয়েস্ট সাবমিট করলে এখানে স্ট্যাটাস ও হিস্টোরি দেখতে পারবেন।
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
                          {req.method} PAYOUT
                        </h4>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 dark:text-purple-300/50 uppercase mt-0.5">
                        {dateStr}
                      </p>
                      <p className="text-[11px] font-mono font-bold text-purple-600 dark:text-amber-300/80 truncate mt-0.5">
                        To: {req.accountNumber}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <div>
                      <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
                        -BDT {bdtVal}
                      </span>
                      <span className="text-xs font-bold text-slate-400 dark:text-purple-300/60 ml-1">
                        (-${req.amount.toFixed(2)})
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
