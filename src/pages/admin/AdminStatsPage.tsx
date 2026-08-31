import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Users, Briefcase, FileText, CheckCircle, ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react';
import {
  getLocalUsers,
  getLocalJobs,
  getLocalSubmissions,
  getLocalDeposits,
  getLocalWithdrawals,
} from '../../lib/localFallbackStore';

export default function AdminStatsPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTasks: 0,
    totalSubmissions: 0,
    completedTasks: 0,
    totalDeposit: 0,
    totalWithdrawal: 0,
    pendingDepositCount: 0,
    pendingWithdrawalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [
          usersRes, 
          jobsRes, 
          subsRes, 
          depsRes, 
          withRes
        ] = await Promise.allSettled([
          supabase.from('users').select('*'),
          supabase.from('jobs').select('*'),
          supabase.from('submissions').select('*'),
          supabase.from('deposit_requests').select('*'),
          supabase.from('withdraw_requests').select('*')
        ]);

        const usersList = (usersRes.status === 'fulfilled' && usersRes.value.data) ? usersRes.value.data : getLocalUsers();
        const jobsList = (jobsRes.status === 'fulfilled' && jobsRes.value.data) ? jobsRes.value.data : getLocalJobs();
        const subsList = (subsRes.status === 'fulfilled' && subsRes.value.data) ? subsRes.value.data : getLocalSubmissions();
        const depsList = (depsRes.status === 'fulfilled' && depsRes.value.data) ? depsRes.value.data : getLocalDeposits();
        const withList = (withRes.status === 'fulfilled' && withRes.value.data) ? withRes.value.data : getLocalWithdrawals();

        let completed = 0;
        subsList.forEach((d: any) => {
          if (d.status === 'approved') completed++;
        });

        let totalDep = 0;
        let pendingDepCount = 0;
        depsList.forEach((d: any) => {
          if (d.status === 'approved') totalDep += Number(d.amount) || 0;
          if (d.status === 'pending') pendingDepCount++;
        });

        let totalWith = 0;
        let pendingWithCount = 0;
        withList.forEach((d: any) => {
          if (d.status === 'approved') totalWith += Number(d.amount) || 0;
          if (d.status === 'pending') pendingWithCount++;
        });

        setStats({
          totalUsers: usersList.length,
          totalTasks: jobsList.length,
          totalSubmissions: subsList.length,
          completedTasks: completed,
          totalDeposit: totalDep,
          totalWithdrawal: totalWith,
          pendingDepositCount: pendingDepCount,
          pendingWithdrawalCount: pendingWithCount,
        });
      } catch {
        const usersList = getLocalUsers();
        const jobsList = getLocalJobs();
        const subsList = getLocalSubmissions();
        const depsList = getLocalDeposits();
        const withList = getLocalWithdrawals();

        let completed = 0;
        subsList.forEach((d: any) => {
          if (d.status === 'approved') completed++;
        });

        let totalDep = 0;
        let pendingDepCount = 0;
        depsList.forEach((d: any) => {
          if (d.status === 'approved') totalDep += Number(d.amount) || 0;
          if (d.status === 'pending') pendingDepCount++;
        });

        let totalWith = 0;
        let pendingWithCount = 0;
        withList.forEach((d: any) => {
          if (d.status === 'approved') totalWith += Number(d.amount) || 0;
          if (d.status === 'pending') pendingWithCount++;
        });

        setStats({
          totalUsers: usersList.length,
          totalTasks: jobsList.length,
          totalSubmissions: subsList.length,
          completedTasks: completed,
          totalDeposit: totalDep,
          totalWithdrawal: totalWith,
          pendingDepositCount: pendingDepCount,
          pendingWithdrawalCount: pendingWithCount,
        });
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-purple-600 dark:text-amber-400', bg: 'bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:border-purple-500/30' },
    { label: 'Total Tasks (Jobs)', value: stats.totalTasks, icon: Briefcase, color: 'text-purple-600 dark:text-amber-400', bg: 'bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:border-purple-500/30' },
    { label: 'Total Submissions', value: stats.totalSubmissions, icon: FileText, color: 'text-slate-600 dark:text-purple-300', bg: 'bg-slate-100 border-slate-200 dark:bg-purple-900/30 dark:border-purple-500/30' },
    { label: 'Completed Tasks', value: stats.completedTasks, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' },
    { label: 'Total Deposits', value: `$${stats.totalDeposit.toFixed(2)}`, icon: ArrowDownCircle, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' },
    { label: 'Total Withdrawals', value: `$${stats.totalWithdrawal.toFixed(2)}`, icon: ArrowUpCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30' },
    { label: 'Pending Deposits', value: stats.pendingDepositCount, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' },
    { label: 'Pending Withdrawals', value: stats.pendingWithdrawalCount, icon: Clock, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30' },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-slate-500 dark:text-purple-300/60 mt-1 font-bold">Overview of platform metrics and financial activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-md rounded-3xl p-6 shadow-sm dark:shadow-lg dark:shadow-purple-900/20 border border-slate-200 dark:border-purple-500/20 flex items-center hover:border-purple-300 dark:hover:border-amber-400/40 transition-all hover:-translate-y-1">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-4 border ${stat.bg}`}>
                <Icon className={`w-7 h-7 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-500 dark:text-purple-300/60 mb-1 uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
