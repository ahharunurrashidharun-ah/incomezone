import React, { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import { useInView } from 'react-intersection-observer';
import { Users, Briefcase, CheckCircle2, DollarSign, Activity } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { isTableMissingError, getLocalJobs, getLocalSubmissions } from '../lib/localFallbackStore';

interface StatsData {
  totalUsers: number;
  activeJobs: number;
  completedTasks: number;
  totalPaid: number;
}

export default function LiveStats() {
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    activeJobs: 0,
    completedTasks: 0,
    totalPaid: 0,
  });
  const [isLive, setIsLive] = useState(true);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  const fetchLiveStats = async () => {
    try {
      // 1. Fetch Users Count
      let userCount = 0;
      try {
        const { count, error: userError } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true });
        if (!userError && typeof count === 'number') {
          userCount = count;
        }
      } catch {
        // fallback
      }

      // 2. Fetch Active Jobs Count
      let activeJobCount = 0;
      try {
        const { count, error: jobError } = await supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active');
        if (!jobError && typeof count === 'number') {
          activeJobCount = count;
        } else {
          activeJobCount = getLocalJobs().filter((j: any) => j.status === 'active').length;
        }
      } catch {
        activeJobCount = getLocalJobs().filter((j: any) => j.status === 'active').length;
      }

      // 3. Fetch Completed Tasks (Submissions)
      let completedCount = 0;
      try {
        const { count, error: subError } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved');
        if (!subError && typeof count === 'number') {
          completedCount = count;
        } else {
          completedCount = getLocalSubmissions().filter((s: any) => s.status === 'approved').length;
        }
      } catch {
        completedCount = getLocalSubmissions().filter((s: any) => s.status === 'approved').length;
      }

      // 4. Fetch Total Paid (Withdrawals)
      let paidTotal = 0;
      try {
        const { data: withdrawData, error: wError } = await supabase
          .from('withdraw_requests')
          .select('amount, status')
          .eq('status', 'approved');

        if (!wError && withdrawData && withdrawData.length > 0) {
          const sum = withdrawData.reduce((acc: number, item: any) => acc + Number(item.amount || 0), 0);
          paidTotal = sum;
        }
      } catch {
        // fallback
      }

      // 5. Fetch Marketing Stats Override
      try {
        let settingsData = null;
        try {
          const localSS = localStorage.getItem('iz_site_settings');
          if (localSS) {
            settingsData = JSON.parse(localSS);
          }
        } catch (e) {}

        const { data: dbData } = await supabase
          .from('site_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (dbData) {
          settingsData = dbData;
        }
          
        if (settingsData && settingsData.stats_mode === 'manual') {
          userCount = settingsData.manual_users || 0;
          activeJobCount = settingsData.manual_jobs || 0;
          completedCount = settingsData.manual_tasks || 0;
          paidTotal = settingsData.manual_paid || 0;
        }
      } catch {
        // fallback to live stats if settings fetch fails
      }

      setStats({
        totalUsers: userCount,
        activeJobs: activeJobCount,
        completedTasks: completedCount,
        totalPaid: paidTotal,
      });
      setIsLive(true);
    } catch (err) {
      console.warn('Error fetching live stats:', err);
      setIsLive(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();

    // Setup Realtime Channels for automatic updates without page refresh
    const usersChannel = supabase
      .channel('live-stats-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchLiveStats();
      })
      .subscribe();

    const jobsChannel = supabase
      .channel('live-stats-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchLiveStats();
      })
      .subscribe();

    const subsChannel = supabase
      .channel('live-stats-subs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        fetchLiveStats();
      })
      .subscribe();

    // Fallback polling interval every 10 seconds
    const interval = setInterval(fetchLiveStats, 10000);

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(subsChannel);
      clearInterval(interval);
    };
  }, []);

  const statItems = [
    {
      id: 'users',
      label: 'Active Digital Workers',
      value: stats.totalUsers,
      prefix: '',
      suffix: '+',
      icon: Users,
      color: 'from-amber-400 to-yellow-500',
      lightBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
      darkBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    },
    {
      id: 'jobs',
      label: 'Available Micro Jobs',
      value: stats.activeJobs,
      prefix: '',
      suffix: '+',
      icon: Briefcase,
      color: 'from-purple-400 to-indigo-500',
      lightBg: 'bg-purple-500/10 border-purple-500/20 text-purple-600',
      darkBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    },
    {
      id: 'submissions',
      label: 'Completed Tasks',
      value: stats.completedTasks,
      prefix: '',
      suffix: '+',
      icon: CheckCircle2,
      color: 'from-blue-400 to-cyan-500',
      lightBg: 'bg-purple-500/10 border-purple-500/20 text-purple-600',
      darkBg: 'bg-blue-500/10 border-blue-500/30 text-cyan-400',
    },
    {
      id: 'paid',
      label: 'Total Community Earnings',
      value: stats.totalPaid,
      prefix: '$',
      suffix: '',
      icon: DollarSign,
      color: 'from-emerald-400 to-teal-500',
      lightBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
      darkBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    },
  ];

  return (
    <div className="w-full" ref={ref}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Platform Activity Statistics
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-purple-300/70 mt-1">
            Real-time platform metrics updating live across our global community.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>{isLive ? 'Realtime Connected' : 'Live Feed'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-purple-950/50 hover:border-amber-400/50 transition-all duration-300 group hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${item.lightBg} dark:${item.darkBg}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <Activity className="w-4 h-4 text-slate-300 dark:text-purple-500/40 group-hover:text-amber-400 transition-colors" />
              </div>

              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                {inView ? (
                  <CountUp
                    start={0}
                    end={item.value || 0}
                    duration={item.value < 50 ? 4 : item.value < 500 ? 3 : 2}
                    separator=","
                    prefix={item.prefix}
                    suffix={item.suffix}
                  />
                ) : (
                  `${item.prefix}0${item.suffix}`
                )}
              </div>

              <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-purple-300/70">
                {item.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
