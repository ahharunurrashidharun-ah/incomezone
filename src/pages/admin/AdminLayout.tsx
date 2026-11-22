import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Settings, 
  LogOut,
  Menu,
  X,
  Briefcase,
  Banknote,
  FileCheck,
  Clock,
  Megaphone,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import { checkIsAdmin } from '../../lib/adminConfig';
import NotificationsLoader from '../../components/NotificationsLoader';
import ThemeToggle from '../../components/ThemeToggle';
import BrandLogo from '../../components/BrandLogo';
import { fetchLiveAdminStats } from '../../lib/adminStats';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingJobCount, setPendingJobCount] = useState(0);
  const [pendingAdCount, setPendingAdCount] = useState(0);
  const [pendingSubmissionCount, setPendingSubmissionCount] = useState(0);
  const [pendingDepositCount, setPendingDepositCount] = useState(0);
  const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState(0);
  const [pendingUserCount, setPendingUserCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const countsInFlightRef = React.useRef(false);
  const countsDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchAllCounts = async () => {
      if (countsInFlightRef.current) return;
      countsInFlightRef.current = true;
      try {
        const stats = await fetchLiveAdminStats();
        setPendingJobCount(stats.pendingJobsCount);
        setPendingAdCount(stats.pendingAdsCount);
        setPendingSubmissionCount(stats.pendingSubmissionsCount);
        setPendingDepositCount(stats.pendingDepositsCount);
        setPendingWithdrawalCount(stats.pendingWithdrawalsCount);
        setPendingUserCount(stats.pendingUsersCount);
      } catch (err) {
        console.warn('AdminLayout fetchAllCounts fallback error', err);
      } finally {
        countsInFlightRef.current = false;
      }
    };

    const scheduleFetchAllCounts = () => {
      if (countsDebounceRef.current) clearTimeout(countsDebounceRef.current);
      countsDebounceRef.current = setTimeout(() => {
        fetchAllCounts();
      }, 250);
    };

    fetchAllCounts();

    // Subscribe to realtime changes in all relevant tables
    const channel = supabase
      .channel('admin-layout-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, scheduleFetchAllCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, scheduleFetchAllCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, scheduleFetchAllCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests' }, scheduleFetchAllCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdraw_requests' }, scheduleFetchAllCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, scheduleFetchAllCounts)
      .subscribe();

    window.addEventListener('iz_email_notification_queued', scheduleFetchAllCounts);
    window.addEventListener('iz_users_updated', scheduleFetchAllCounts);
    window.addEventListener('iz_balance_updated', scheduleFetchAllCounts);
    window.addEventListener('iz_platform_controls_updated', scheduleFetchAllCounts);
    window.addEventListener('iz_jobs_updated', scheduleFetchAllCounts);
    window.addEventListener('submission_updated', scheduleFetchAllCounts);
    window.addEventListener('iz_ads_updated', scheduleFetchAllCounts);

    return () => {
      if (countsDebounceRef.current) clearTimeout(countsDebounceRef.current);
      supabase.removeChannel(channel);
      window.removeEventListener('iz_email_notification_queued', scheduleFetchAllCounts);
      window.removeEventListener('iz_users_updated', scheduleFetchAllCounts);
      window.removeEventListener('iz_balance_updated', scheduleFetchAllCounts);
      window.removeEventListener('iz_platform_controls_updated', scheduleFetchAllCounts);
      window.removeEventListener('iz_jobs_updated', scheduleFetchAllCounts);
      window.removeEventListener('submission_updated', scheduleFetchAllCounts);
      window.removeEventListener('iz_ads_updated', scheduleFetchAllCounts);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0a0718] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdminUser = checkIsAdmin(user) || user.role === 'admin';
  if (!isAdminUser) {
    return <Navigate to="/jobs" replace />;
  }

  const handleLogout = async () => {
    try {
      if (logout) {
        await logout();
      } else {
        await supabase.auth.signOut();
      }
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout error', error);
    }
  };

  const navItems = [
    { name: 'Dashboard Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Pending Jobs', path: '/admin/jobs', icon: Briefcase, badge: pendingJobCount },
    { name: 'Pending Ads', path: '/admin/ads', icon: Megaphone, badge: pendingAdCount },
    { name: 'Manage Users', path: '/admin/users', icon: Users, badge: pendingUserCount },
    { name: 'Deposits', path: '/admin/deposits', icon: Wallet, badge: pendingDepositCount },
    { name: 'Withdrawals', path: '/admin/withdrawals', icon: Banknote, badge: pendingWithdrawalCount },
    { name: 'Submissions', path: '/admin/submissions', icon: FileCheck, badge: pendingSubmissionCount },
    { name: 'System Config', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="bg-slate-50 dark:bg-[#0a0718] min-h-screen h-[100dvh] flex font-sans text-slate-900 dark:text-white selection:bg-purple-500/30 selection:text-white overflow-hidden">
      {/* Background Email Notification Dispatcher */}
      <NotificationsLoader />

      {/* Mobile/Overlay background for sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-72 bg-white dark:bg-[#080412] border-r border-slate-200 dark:border-purple-900/30
        transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 transition-transform duration-300 ease-in-out
        flex flex-col shadow-xl dark:shadow-2xl dark:shadow-purple-900/20
      `}>
        <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-purple-900/30 bg-slate-50/50 dark:bg-[#090514]/50 h-20">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">Admin<span className="text-purple-600 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">Panel</span></h1>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold tracking-widest mt-1">INCOME ZONE</p>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-slate-500 dark:text-purple-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-purple-900/50 rounded-xl transition-colors border border-transparent hover:border-slate-300 dark:hover:border-purple-500/30"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 mt-2 hardware-accelerate">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            const hasPending = item.badge !== undefined && item.badge > 0;
            
            return (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={() => {
                  if(window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`
                  flex items-center justify-between px-4 py-3.5 rounded-xl font-bold transition-all duration-300 relative
                  ${isActive 
                    ? 'bg-purple-50 dark:bg-amber-400/10 border-l-4 border-purple-600 dark:border-amber-400 text-purple-700 dark:text-amber-300 shadow-inner' 
                    : 'text-slate-600 dark:text-purple-200/70 hover:text-purple-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/20 border-l-4 border-transparent'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} className={isActive ? 'text-purple-600 dark:text-amber-400 drop-shadow-md' : 'text-slate-400 dark:text-purple-400/70'} />
                  <span>{item.name}</span>
                </div>

                {hasPending && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-md shadow-rose-500/40 flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-purple-900/30 bg-white dark:bg-[#080412]/80 space-y-2">
          {/* Dark / Light Theme Toggle Switch in Sidebar */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#130b2c]/80 border border-slate-200 dark:border-purple-500/20 shadow-sm">
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Moon size={18} className="text-amber-400" />
              ) : (
                <Sun size={18} className="text-purple-600" />
              )}
              <span className="text-xs font-bold text-slate-700 dark:text-purple-200">
                {theme === 'dark' ? 'ডার্ক মোড (Dark)' : 'লাইট মোড (Light)'}
              </span>
            </div>
            <ThemeToggle />
          </div>

          <Link to="/jobs" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 dark:text-purple-200/70 hover:text-purple-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-all font-bold">
            <LayoutDashboard size={18} className="text-slate-400 dark:text-purple-400/70" />
            User Dashboard
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 rounded-xl transition-all"
          >
            <LogOut size={18} />
            Secure Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative bg-slate-50 dark:bg-[#0a0718]">
        {/* Background glow effects for the main area */}
        <div className="absolute top-0 right-0 w-full h-[500px] bg-purple-100/50 dark:bg-purple-900/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
        
        {/* Admin Header Navbar */}
        <header className="bg-white/90 dark:bg-[#090514]/90 border-b border-slate-200 dark:border-purple-900/30 px-6 py-4 flex items-center h-20 shadow-sm sticky top-0 z-10 backdrop-blur-md">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 mr-4 text-slate-500 dark:text-purple-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-purple-900/40 border border-transparent hover:border-slate-300 dark:hover:border-purple-500/30 rounded-xl transition-colors lg:hidden"
          >
            <Menu size={24} />
          </button>
          <div className="flex-1 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize tracking-wide hidden sm:block">
              {location.pathname.split('/').pop()?.replace('-', ' ')}
            </h2>
            <div className="flex items-center gap-3 sm:gap-4 ml-auto">
              {/* Header Dark/Light Switch */}
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
              <span className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-200 bg-purple-50 dark:bg-purple-900/30 px-3.5 py-1.5 rounded-full border border-purple-200 dark:border-purple-500/20 shadow-inner truncate max-w-[160px] sm:max-w-none">
                {user?.email}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain relative z-10 p-4 sm:p-6 pb-24 sm:pb-28">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

