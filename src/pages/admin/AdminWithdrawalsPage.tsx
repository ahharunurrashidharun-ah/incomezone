import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  getLocalWithdrawals,
  updateLocalWithdrawal,
  getLocalUser,
  saveLocalUser,
  isTableMissingError,
} from '../../lib/localFallbackStore';

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      let rawRecords = records || [];
      
      if (error && isTableMissingError(error)) {
        rawRecords = getLocalWithdrawals();
      } else if (!records) {
        rawRecords = getLocalWithdrawals();
      }

      const userIds = [...new Set(rawRecords.map((r: any) => r.user_id || r.userId))].filter(Boolean);

      let users: any[] = [];
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, display_id')
          .in('id', userIds);
        
        if (usersError) {
          console.error("Error fetching users:", usersError);
        }
        users = usersData || [];
      }

      const merged = rawRecords.map((record: any) => {
        const targetId = record.user_id || record.userId;
        return {
          id: record.id,
          userId: targetId,
          amount: Number(record.amount || 0),
          method: record.method || 'Bkash',
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
    try {
      const parsedAmount = Number(amount) || 0;

      // 1. Update withdraw request status
      const { error: reqError } = await supabase
        .from('withdraw_requests')
        .update({ status: newStatus })
        .eq('id', reqId);

      if (reqError && isTableMissingError(reqError)) {
        updateLocalWithdrawal(reqId, { status: newStatus as any });
        if (newStatus === 'rejected' && userId) {
          const user = getLocalUser(userId);
          const currentBal = Number(user?.earning_balance || 0);
          saveLocalUser(userId, { earning_balance: currentBal + parsedAmount });
        }
        setRequests(requests.map(r => r.id === reqId ? { ...r, status: newStatus } : r));
        return;
      }

      // 2. If rejected, refund user's earning balance
      if (newStatus === 'rejected') {
        const { data: userDoc } = await supabase
          .from('users')
          .select('earning_balance, earningBalance')
          .eq('id', userId)
          .single();

        if (userDoc) {
          const currentBalance = Number(userDoc.earning_balance ?? userDoc.earningBalance ?? 0);
          const newBalance = currentBalance + parsedAmount;

          await supabase
            .from('users')
            .update({
              earning_balance: newBalance,
            })
            .eq('id', userId);
        } else {
          const user = getLocalUser(userId);
          const currentBal = Number(user?.earning_balance || 0);
          saveLocalUser(userId, { earning_balance: currentBal + parsedAmount });
        }
      }
      
      setRequests(requests.map(r => r.id === reqId ? { ...r, status: newStatus } : r));
    } catch {
      updateLocalWithdrawal(reqId, { status: newStatus as any });
      setRequests(requests.map(r => r.id === reqId ? { ...r, status: newStatus } : r));
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
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider">Status</th>
              <th className="py-4 px-6 text-xs font-black text-slate-600 dark:text-amber-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-purple-500/10">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-transparent transition-colors">
                <td className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white">
                  {req.user?.display_id ? `User #${req.user.display_id}` : 'Unknown'}
                </td>
                <td className="py-4 px-6 text-sm font-black text-amber-500 dark:text-amber-400">${req.amount}</td>
                <td className="py-4 px-6 text-sm font-bold text-slate-600 dark:text-purple-200">{req.method}</td>
                <td className="py-4 px-6 text-sm font-bold text-slate-500 dark:text-purple-300/60">{req.accountDetails}</td>
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
                      <button onClick={() => handleUpdateStatus(req.id, req.userId, req.amount, 'approved')} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-600"><CheckCircle className="w-5 h-5"/></button>
                      <button onClick={() => handleUpdateStatus(req.id, req.userId, req.amount, 'rejected')} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-600"><XCircle className="w-5 h-5"/></button>
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
