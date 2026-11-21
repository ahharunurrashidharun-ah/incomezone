import React, { useEffect, useState, useRef } from 'react';
import { supabase, formatUserDisplayId, formatDateTime } from '../../lib/supabaseClient';
import { CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getLocalWithdrawals,
  updateLocalWithdrawal,
  getLocalUser,
  saveLocalUser,
  isTableMissingError,
  saveLocalNotification,
} from '../../lib/localFallbackStore';

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const actionLockRef = useRef<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();

    try {
      const channel = supabase
        .channel('admin-withdrawals-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'withdraw_requests' }, () => {
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
        .from('withdraw_requests')
        .select('*')
        .order('created_at', { ascending: false });

      let rawRecords: any[] = [];
      if (!error && records) {
        rawRecords = [...records];
      } else {
        rawRecords = getLocalWithdrawals();
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
        const acc = String(rec.account_number || rec.account_details || rec.accountDetails || '').trim();
        const status = rec.status || 'pending';
        // Cluster spam clicks within 3-minute window
        const d = new Date(rec.created_at || rec.createdAt || Date.now());
        const timeBlock = Math.floor(d.getTime() / (3 * 60 * 1000));
        const sig = `${uId}_${amt}_${acc}_${status}_${timeBlock}`;

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
          method: record.method || 'bKash',
          accountDetails: record.account_number || record.account_details || record.accountDetails || 'N/A',
          status: record.status || 'pending',
          createdAt: record.created_at || record.createdAt,
          user: users.find(u => u.id === targetId)
        };
      });

      setRequests(merged);
    } catch {
      const local = getLocalWithdrawals().map((d: any) => ({
        id: d.id,
        userId: d.user_id || d.userId,
        amount: Number(d.amount || 0),
        method: d.method || 'bKash',
        accountDetails: d.account_number || d.account_details || d.accountDetails || 'N/A',
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
      toast.error('এই রিকোয়েস্টটি ইতিমধ্যে সম্পন্ন করা হয়েছে!');
      actionLockRef.current.delete(reqId);
      setActionLoading(null);
      return;
    }

    // Immediately update UI to prevent any concurrent click visual glitches
    setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: newStatus } : r));

    try {
      const parsedAmount = Number(amount) || 0;

      // 1. If approved: User was already deducted on request. Balance is permanent payment, will NEVER be returned.
      if (newStatus === 'approved') {
        const { data: updatedWith, error: withErr } = await supabase
          .from('withdraw_requests')
          .update({ status: 'approved' })
          .eq('id', reqId)
          .select('id, status')
          .maybeSingle();

        if (withErr && !isTableMissingError(withErr)) {
          throw new Error(`ডাটাবেজে উইথড্র অ্যাপ্রুভ আপডেট হয়নি: ${withErr.message}`);
        }
        if (!withErr && (!updatedWith || updatedWith.status !== 'approved')) {
          throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে উইথড্র স্ট্যাটাস আপডেট হয়নি।');
        }

        updateLocalWithdrawal(reqId, { status: 'approved' });

        saveLocalNotification(userId, {
          title: 'উইথড্র সফল হয়েছে! 💸',
          message: `আপনার $${parsedAmount.toFixed(2)} (৳${Math.round(parsedAmount * 100)}) উত্তোলন রিকোয়েস্ট সফলভাবে সম্পন্ন হয়েছে। টাকা আপনার একাউন্টে পাঠানো হয়েছে।`,
          type: 'withdrawal',
        });
        toast.success(`উইথড্র ($${parsedAmount.toFixed(2)}) সফলভাবে অ্যাপ্রুভ করা হয়েছে! পেমেন্ট সম্পন্ন।`);
      } else if (newStatus === 'rejected') {
        // 2. If rejected: REFUND user's earning_balance in Supabase FIRST
        let currentBalance = 0;
        let hasRemoteUser = false;
        const { data: userDoc, error: userFetchErr } = await supabase
          .from('users')
          .select('id, earning_balance')
          .eq('id', userId)
          .maybeSingle();

        if (userFetchErr && !isTableMissingError(userFetchErr)) {
          throw new Error(`ইউজারের আর্নিং ব্যালেন্স লোড হয়নি: ${userFetchErr.message}`);
        }

        if (userDoc) {
          hasRemoteUser = true;
          currentBalance = Number(userDoc.earning_balance ?? 0);
        } else if (!userFetchErr) {
          throw new Error('ইউজারের অ্যাকাউন্ট ডাটাবেজে পাওয়া যায়নি, তাই ব্যালেন্স রিফান্ড করা যায়নি।');
        } else {
          const user = getLocalUser(userId);
          currentBalance = Number(user?.earning_balance || 0);
        }

        const newBalance = Number((currentBalance + parsedAmount).toFixed(2));

        if (hasRemoteUser) {
          const { data: updatedUser, error: balErr } = await supabase
            .from('users')
            .update({ earning_balance: newBalance })
            .eq('id', userId)
            .select('id, earning_balance')
            .maybeSingle();

          if (balErr && !isTableMissingError(balErr)) {
            throw new Error(`ব্যালেন্স রিফান্ড হয়নি: ${balErr.message}`);
          }
          if (!balErr && !updatedUser) {
            throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে ব্যালেন্স রিফান্ড হয়নি।');
          }
        }

        // Now mark withdrawal request as rejected in Supabase
        const { data: updatedWith, error: withErr } = await supabase
          .from('withdraw_requests')
          .update({ status: 'rejected' })
          .eq('id', reqId)
          .select('id, status')
          .maybeSingle();

        if (withErr && !isTableMissingError(withErr)) {
          throw new Error(`ডাটাবেজে উইথড্র রিজেক্ট আপডেট হয়নি: ${withErr.message}`);
        }
        if (!withErr && (!updatedWith || updatedWith.status !== 'rejected')) {
          throw new Error('ডাটাবেজ পারমিশন (RLS) সমস্যার কারণে উইথড্র স্ট্যাটাস আপডেট হয়নি।');
        }

        updateLocalWithdrawal(reqId, { status: 'rejected' });
        saveLocalUser(userId, { earning_balance: newBalance });

        // Update active session in localStorage if user is on this device
        try {
          const raw = localStorage.getItem('iz_auth_session');
          if (raw) {
            const sess = JSON.parse(raw);
            if (sess?.user?.uid === userId || sess?.profile?.id === userId) {
              sess.user.earningBalance = newBalance;
              sess.profile.earningBalance = newBalance;
              localStorage.setItem('iz_auth_session', JSON.stringify(sess));
            }
          }
        } catch {}

        // Dispatch balance update event for live UI reactivity
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('iz_balance_updated', {
            detail: { userId, earningBalance: newBalance }
          }));
        }, 0);

        saveLocalNotification(userId, {
          title: 'উইথড্র রিজেক্টেড ও রিফান্ডেড ❌',
          message: `আপনার $${parsedAmount.toFixed(2)} (৳${Math.round(parsedAmount * 100)}) উইথড্র রিকোয়েস্ট রিজেক্ট করা হয়েছে এবং টাকা আপনার আর্নিং ব্যালেন্সে ফেরত দেওয়া হয়েছে।`,
          type: 'withdrawal',
        });

        toast.error(`উইথড্র রিজেক্ট করা হয়েছে এবং $${parsedAmount.toFixed(2)} (৳${Math.round(parsedAmount * 100)}) ইউজারের আর্নিং ব্যালেন্সে ফেরত দেওয়া হয়েছে।`);
      }

      window.dispatchEvent(new CustomEvent('iz_users_updated'));
      await fetchRequests();
    } catch (err: any) {
      console.error('Update withdrawal status error:', err);
      // Revert optimistic UI update so it reflects real DB state
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'pending' } : r));
      actionLockRef.current.delete(reqId);
      toast.error(err?.message || 'উইথড্র আপডেট করতে সমস্যা হয়েছে।');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div></div>;

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight">Withdrawal Requests</h1>
      <div className="bg-white dark:bg-[#130b2c]/60 backdrop-blur-md rounded-[2rem] shadow-sm dark:shadow-lg dark:shadow-purple-900/20 border border-slate-200 dark:border-purple-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-purple-950/40 border-b border-slate-200 dark:border-purple-500/20">
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">User ID</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Method</th>
                <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Account Info</th>
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
                  <td className="py-4 px-6 text-sm font-black text-amber-500 dark:text-amber-400 font-mono">
                    ${req.amount.toFixed(2)}
                    <span className="text-xs font-semibold text-slate-500 dark:text-purple-300/70 ml-1.5 font-sans">
                      (৳{Math.round(req.amount * 100)})
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm font-bold text-slate-600 dark:text-purple-200">{req.method}</td>
                  <td className="py-4 px-6 text-sm font-mono text-slate-500 dark:text-purple-300/60 font-bold">{req.accountDetails}</td>
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
                          title="Approve Withdrawal"
                        >
                          <CheckCircle className="w-5 h-5"/>
                        </button>
                        <button 
                          disabled={actionLoading === req.id || actionLockRef.current.has(req.id)}
                          onClick={() => handleUpdateStatus(req.id, req.userId, req.amount, 'rejected')} 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          title="Reject Withdrawal"
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
