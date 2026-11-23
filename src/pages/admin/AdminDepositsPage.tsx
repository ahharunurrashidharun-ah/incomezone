import React, { useEffect, useState, useRef } from 'react';
import { supabase, formatUserDisplayId, formatDateTime } from '../../lib/supabaseClient';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getLocalDeposits,
  updateLocalDeposit,
  getLocalUser,
  saveLocalUser,
  isTableMissingError,
  saveLocalNotification,
} from '../../lib/localFallbackStore';

export default function AdminDepositsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const actionLockRef = useRef<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();

    try {
      const channel = supabase
        .channel('admin-deposits-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests' }, () => {
          fetchRequests();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Ignored
    }
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: records, error } = await supabase
        .from('deposit_requests')
        .select('*')
        .order('created_at', { ascending: false });

      let rawRecords: any[] = [];
      if (!error && records) {
        rawRecords = [...records];
      } else {
        rawRecords = getLocalDeposits();
      }

      // Internal deduplication of rawRecords in case multiple spam clicks were recorded previously
      const seenIds = new Set<string>();
      const seenSignatures = new Set<string>();
      const dedupedRecords: any[] = [];

      for (const rec of rawRecords) {
        if (rec.id && seenIds.has(rec.id)) continue;
        if (rec.id) seenIds.add(rec.id);

        const uId = rec.user_id || rec.userId;
        const amt = Number(rec.amount || 0).toFixed(2);
        const trx = String(rec.transaction_id || rec.transactionId || '').trim().toUpperCase();
        const status = rec.status || 'pending';
        // Cluster spam clicks within 3-minute window
        const d = new Date(rec.created_at || rec.createdAt || Date.now());
        const timeBlock = Math.floor(d.getTime() / (3 * 60 * 1000));
        const sig = `${uId}_${amt}_${trx}_${status}_${timeBlock}`;

        if (seenSignatures.has(sig)) continue;
        seenSignatures.add(sig);

        dedupedRecords.push(rec);
      }

      const userIds = [...new Set(dedupedRecords.map((r: any) => r.user_id || r.userId))].filter(Boolean);

      let users: any[] = [];
      if (userIds.length > 0) {
        try {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, display_id')
            .in('id', userIds);
          users = usersData || [];
        } catch {}
      }

      const merged = dedupedRecords.map((record: any) => {
        const targetId = record.user_id || record.userId;
        return {
          id: record.id,
          userId: targetId,
          amount: Number(record.amount || 0),
          method: record.method || (record.transaction_id ? 'bKash/Nagad' : 'bKash'),
          senderNumber: record.sender_number || record.senderNumber || 'N/A',
          transactionId: record.transaction_id || record.transactionId || 'N/A',
          status: record.status || 'pending',
          createdAt: record.created_at || record.createdAt,
          user: users.find(u => u.id === targetId)
        };
      });

      setRequests(merged);
    } catch {
      const local = getLocalDeposits().map((d: any) => ({
        id: d.id,
        userId: d.user_id || d.userId,
        amount: Number(d.amount || 0),
        method: d.method || 'bKash/Nagad',
        senderNumber: d.sender_number || d.senderNumber || 'N/A',
        transactionId: d.transaction_id || d.transactionId || 'N/A',
        status: d.status || 'pending',
        createdAt: d.created_at || d.createdAt,
        user: null
      }));
      setRequests(local);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (reqId: string, userId: string, amount: number, newStatus: string) => {
    // Synchronous immediate lockout for double-click / rapid spam-click
    if (actionLockRef.current.has(reqId)) return;
    actionLockRef.current.add(reqId);
    setActionLoading(reqId);

    const currentReq = requests.find(r => r.id === reqId);
    if (currentReq && currentReq.status !== 'pending') {
      toast.error('এই ডিপোজিট রিকোয়েস্টটি ইতিমধ্যে সম্পন্ন করা হয়েছে!');
      actionLockRef.current.delete(reqId);
      setActionLoading(null);
      return;
    }

    // Immediately update UI to prevent any concurrent click visual glitches
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: newStatus } : r));

    try {
      const parsedAmount = Number(amount) || 0;

      // 1. If approved, fetch live user balance, credit deposit + bonus in Supabase FIRST
      if (newStatus === 'approved') {
        let currentBalance = 0;
        let hasRemoteUser = false;
        const { data: userDoc, error: userFetchErr } = await supabase
          .from('users')
          .select('id, deposit_balance')
          .eq('id', userId)
          .maybeSingle();

        if (userFetchErr && !isTableMissingError(userFetchErr)) {
          throw new Error(`ইউজারের ব্যালেন্স তথ্য লোড হয়নি: ${userFetchErr.message}`);
        }

        if (userDoc) {
          hasRemoteUser = true;
          currentBalance = Number(userDoc.deposit_balance ?? 0);
        } else if (!userFetchErr) {
          throw new Error('ইউজারের অ্যাকাউন্ট ডাটাবেজে পাওয়া যায়নি, তাই ডিপোজিট ব্যালেন্স যোগ করা যায়নি।');
        } else {
          const user = getLocalUser(userId);
          currentBalance = Number(user?.deposit_balance || 0);
        }

        // Check deposit bonus percentage from Supabase settings first, fallback to localStorage
        let depositBonusPercent = 0;
        try {
          const { data: ctrlData } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'platform_controls')
            .maybeSingle();
          let val: any = ctrlData?.value;
          if (typeof val === 'string') {
            try { val = JSON.parse(val); } catch {}
          }
          if (val && val.deposit_bonus_percent !== undefined) {
            depositBonusPercent = Number(val.deposit_bonus_percent || 0);
          } else {
            const str = localStorage.getItem('iz_platform_controls');
            if (str) {
              const parsed = JSON.parse(str);
              depositBonusPercent = Number(parsed.deposit_bonus_percent || 0);
            }
          }
        } catch {
          try {
            const str = localStorage.getItem('iz_platform_controls');
            if (str) {
              const parsed = JSON.parse(str);
              depositBonusPercent = Number(parsed.deposit_bonus_percent || 0);
            }
          } catch {}
        }

        const bonusVal = Number((parsedAmount * (depositBonusPercent / 100)).toFixed(2));
        const creditTotal = Number((parsedAmount + bonusVal).toFixed(2));
        const newBalance = Number((currentBalance + creditTotal).toFixed(2));

        // Update Supabase users table and verify persistence
        if (hasRemoteUser) {
          const { data: updatedUser, error: balErr } = await supabase
            .from('users')
            .update({ deposit_balance: newBalance })
            .eq('id', userId)
            .select('id, deposit_balance')
            .maybeSingle();

          if (balErr && !isTableMissingError(balErr)) {
            throw new Error(`ডিপোজিট ব্যালেন্স যোগ হয়নি: ${balErr.message}`);
          }
          if (!balErr && !updatedUser) {
            throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে ইউজারের ডিপোজিট ব্যালেন্স আপডেট হয়নি।');
          }
        }

        // 2. Now mark deposit request as approved in Supabase
        const { data: updatedDep, error: depErr } = await supabase
          .from('deposit_requests')
          .update({ status: 'approved' })
          .eq('id', reqId)
          .select('id, status')
          .maybeSingle();

        if (depErr && !isTableMissingError(depErr)) {
          throw new Error(`ডাটাবেজে ডিপোজিট স্ট্যাটাস আপডেট হয়নি: ${depErr.message}`);
        }
        if (!depErr && (!updatedDep || updatedDep.status !== 'approved')) {
          throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে ডিপোজিট স্ট্যাটাস আপডেট হয়নি।');
        }

        updateLocalDeposit(reqId, { status: 'approved' });
        saveLocalUser(userId, { deposit_balance: newBalance });

        // Update active session in localStorage if user is logged in here
        try {
          const raw = localStorage.getItem('iz_auth_session');
          if (raw) {
            const sess = JSON.parse(raw);
            if (sess?.user?.uid === userId || sess?.profile?.id === userId) {
              sess.user.depositBalance = newBalance;
              sess.profile.depositBalance = newBalance;
              localStorage.setItem('iz_auth_session', JSON.stringify(sess));
            }
          }
        } catch {}

        // Dispatch balance update event for live UI reactivity
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('iz_balance_updated', {
            detail: { userId, depositBalance: newBalance }
          }));
        }, 0);

        saveLocalNotification(userId, {
          id: `dep_${reqId}_approved`,
          title: 'ডিপোজিট অ্যাপ্রুভড! 🎉',
          message: depositBonusPercent > 0 && bonusVal > 0
            ? `আপনার $${parsedAmount.toFixed(2)} (৳${Math.round(parsedAmount * 100)}) ডিপোজিট এবং ${depositBonusPercent}% বোনাস ($${bonusVal.toFixed(2)}) সফলভাবে অ্যাপ্রুভ করা হয়েছে!`
            : `আপনার $${parsedAmount.toFixed(2)} (৳${Math.round(parsedAmount * 100)}) ডিপোজিট সফলভাবে অ্যাপ্রুভ হয়েছে এবং ওয়ালেটে জমা হয়েছে।`,
          type: 'deposit',
        });

        if (depositBonusPercent > 0 && bonusVal > 0) {
          toast.success(`ডিপোজিট অ্যাপ্রুভড! মূল $${parsedAmount.toFixed(2)} + ${depositBonusPercent}% বোনাস ($${bonusVal.toFixed(2)}) = মোট $${creditTotal.toFixed(2)} অ্যাকাউন্টে যোগ হয়েছে!`);
        } else {
          toast.success(`ডিপোজিট সফলভাবে অ্যাপ্রুভ হয়েছে এবং $${parsedAmount.toFixed(2)} (৳${Math.round(parsedAmount * 100)}) অ্যাকাউন্টে যোগ করা হয়েছে!`);
        }
      } else {
        // Rejected: NEVER add any balance
        const { data: updatedDep, error: depErr } = await supabase
          .from('deposit_requests')
          .update({ status: 'rejected' })
          .eq('id', reqId)
          .select('id, status')
          .maybeSingle();

        if (depErr && !isTableMissingError(depErr)) {
          throw new Error(`ডাটাবেজে ডিপোজিট রিজেক্ট আপডেট হয়নি: ${depErr.message}`);
        }
        if (!depErr && (!updatedDep || updatedDep.status !== 'rejected')) {
          throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে ডিপোজিট স্ট্যাটাস আপডেট হয়নি।');
        }

        updateLocalDeposit(reqId, { status: 'rejected' });

        saveLocalNotification(userId, {
          id: `dep_${reqId}_rejected`,
          title: 'ডিপোজিট রিকোয়েস্ট রিজেক্টেড ❌',
          message: `আপনার $${parsedAmount.toFixed(2)} (৳${Math.round(parsedAmount * 100)}) ডিপোজিট রিকোয়েস্টটি প্রত্যাখান করা হয়েছে। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।`,
          type: 'deposit',
        });
        toast.error("ডিপোজিট রিকোয়েস্ট রিজেক্ট করা হয়েছে।");
      }

      window.dispatchEvent(new CustomEvent('iz_users_updated'));
      await fetchRequests();
    } catch (err: any) {
      console.error('Update deposit status error:', err);
      // Revert optimistic UI update so it reflects real DB state
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'pending' } : r));
      actionLockRef.current.delete(reqId);
      toast.error(err?.message || 'ডিপোজিট আপডেট করতে সমস্যা হয়েছে।');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div></div>;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight">Deposit Requests</h1>
      <div className="bg-white dark:bg-[#130b2c]/60 backdrop-blur-md rounded-[2rem] shadow-sm dark:shadow-lg dark:shadow-purple-900/20 border border-slate-200 dark:border-purple-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-purple-950/40 border-b border-slate-200 dark:border-purple-500/20">
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">User ID</th>
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Amount</th>
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Method & Sender</th>
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Transaction ID</th>
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Date & Time (তারিখ ও সময়)</th>
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Status</th>
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-purple-500/10">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-colors">
                <td className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white">
                  User #{formatUserDisplayId(req.user?.display_id, req.userId)}
                </td>
                <td className="py-4 px-6 text-sm font-black text-emerald-600 font-mono">
                  ${req.amount.toFixed(2)}
                  <span className="text-xs font-semibold text-slate-500 dark:text-purple-300/70 ml-1.5 font-sans">
                    (৳{Math.round(req.amount * 100)})
                  </span>
                </td>
                <td className="py-4 px-6 text-sm font-bold text-slate-600 dark:text-purple-200">
                  <div>{req.method}</div>
                  {req.senderNumber && req.senderNumber !== 'N/A' && (
                    <div className="text-xs font-mono font-semibold text-purple-600 dark:text-amber-300/80">
                      📱 {req.senderNumber}
                    </div>
                  )}
                </td>
                <td className="py-4 px-6 text-sm font-mono text-slate-500 dark:text-purple-300/60 font-bold tracking-wider">{req.transactionId}</td>
                <td className="py-4 px-6 text-xs font-bold text-slate-700 dark:text-purple-200 font-mono">
                  {formatDateTime(req.createdAt)}
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black tracking-wide border ${
                    req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-500/30' :
                    req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-500/30' :
                    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-500/30'
                  }`}>
                    {req.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-4 px-6 text-right">
                  {req.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <button 
                        disabled={actionLoading === req.id || actionLockRef.current.has(req.id)}
                        onClick={() => handleUpdateStatus(req.id, req.userId, req.amount, 'approved')} 
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Approve Deposit"
                      >
                        <CheckCircle className="w-5 h-5"/>
                      </button>
                      <button 
                        disabled={actionLoading === req.id || actionLockRef.current.has(req.id)}
                        onClick={() => handleUpdateStatus(req.id, req.userId, req.amount, 'rejected')} 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        title="Reject Deposit"
                      >
                        <XCircle className="w-5 h-5"/>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
