import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
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
  Megaphone
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { checkIsAdmin } from '../../lib/adminConfig';

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingJobCount, setPendingJobCount] = useState(0);
  const [pendingAdCount, setPendingAdCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Fetch pending jobs count
    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (!error && count !== null) {
          setPendingJobCount(count);
        }
      } catch (err) {
        console.warn('Silent note: pending jobs count fetch deferred', err);
      }
    };

    // Fetch pending ads count
    const fetchPendingAdCount = async () => {
      try {
        const { count, error } = await supabase
          .from('ads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (!error && count !== null) {
          setPendingAdCount(count);
        }
      } catch (err) {
        console.warn('Silent note: pending ads count fetch deferred', err);
      }
    };

    fetchPendingCount();
    fetchPendingAdCount();

    // Subscribe to realtime changes in jobs table
    const channel = supabase
      .channel('admin-layout-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchPendingCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, () => {
        fetchPendingAdCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0a0718] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
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
    { name: 'Manage Users', path: '/admin/users', icon: Users },
    { name: 'Deposits', path: '/admin/deposits', icon: Wallet },
    { name: 'Withdrawals', path: '/admin/withdrawals', icon: Banknote },
    { name: 'Submissions', path: '/admin/submissions', icon: FileCheck },
    { name: 'System Config', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="bg-slate-50 dark:bg-[#0a0718] min-h-screen flex font-sans text-slate-900 dark:text-white selection:bg-purple-500/30 selection:text-white">
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
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Admin<span className="text-purple-600 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">Panel</span></h1>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-bold tracking-widest mt-1">INCOME ZONE</p>
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
            
            return (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={() => {
                  if(window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`
                  flex items-center justify-between px-4 py-3.5 rounded-xl font-bold transition-all duration-300
                  ${isActive 
                    ? 'bg-purple-50 dark:bg-amber-400/10 border-l-4 border-purple-600 dark:border-amber-400 text-purple-700 dark:text-amber-300 shadow-inner' 
                    : 'text-slate-600 dark:text-purple-200/70 hover:text-purple-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/20 border-l-4 border-transparent'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} className={isActive ? 'text-purple-600 dark:text-amber-400 drop-shadow-md' : 'text-slate-400 dark:text-purple-400/70'} />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-purple-900/30 bg-white dark:bg-[#080412]/80">
          <Link to="/jobs" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-purple-200/70 hover:text-purple-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/20 transition-all font-bold mb-2">
            <LayoutDashboard size={20} className="text-slate-400 dark:text-purple-400/70" />
            User Dashboard
          </Link>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300 rounded-xl transition-all"
          >
            <LogOut size={20} />
            Secure Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col relative bg-slate-50 dark:bg-[#0a0718]">
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
            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sm font-bold text-purple-700 dark:text-purple-200 bg-purple-50 dark:bg-purple-900/30 px-4 py-1.5 rounded-full border border-purple-200 dark:border-purple-500/20 shadow-inner">
                {user?.email}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto relative z-10 transform-gpu hardware-accelerate">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

