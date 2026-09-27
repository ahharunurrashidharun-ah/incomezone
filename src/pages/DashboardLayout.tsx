import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Wallet, 
  Banknote, 
  PlusCircle, 
  Search, 
  ClipboardList,
  CheckSquare, 
  LogOut, 
  Menu, 
  X, 
  User as UserIcon, 
  Shield,
  BookOpen 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, formatUserDisplayId } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';
import ThemeToggle from '../components/ThemeToggle';

const SIDEBAR_LINKS = [
  { name: 'Find Jobs', path: '/jobs', icon: Search },
  { name: 'Post Job', path: '/post-job', icon: PlusCircle },
  { name: 'My Job', path: '/my-jobs', icon: ClipboardList },
  { name: 'Submitted Jobs', path: '/submitted-jobs', icon: CheckSquare },
  { name: 'Post Ad', path: '/post-ad', icon: PlusCircle },
  { name: 'Posted Ads', path: '/posted-ads', icon: ClipboardList },
  { name: 'Deposit', path: '/deposit', icon: Wallet },
  { name: 'Withdraw', path: '/withdraw', icon: Banknote },
];

export default function DashboardLayout() {
  const { user, profile, logout } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUserData = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.uid)
        .maybeSingle();

      if (!error && data) {
        setUserData({
          depositBalance: Number(data.deposit_balance ?? data.depositBalance ?? 0),
          earningBalance: Number(data.earning_balance ?? data.earningBalance ?? 0),
          role: data.role || 'user',
          ...data
        });
      } else if (profile) {
        setUserData(profile);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserData();

      const channel = supabase
        .channel(`layout-user-${user.uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` }, () => {
          fetchUserData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Keep synced with profile changes from context
  useEffect(() => {
    if (profile) {
      setUserData((prev: any) => ({
        ...prev,
        depositBalance: profile.depositBalance ?? prev?.depositBalance ?? 0,
        earningBalance: profile.earningBalance ?? prev?.earningBalance ?? 0,
        role: profile.role ?? prev?.role ?? 'user'
      }));
    }
  }, [profile]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const closeSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const isAdmin = checkIsAdmin(user) || checkIsAdmin(profile) || checkIsAdmin(userData);

  return (
    <div className="bg-slate-50 dark:bg-[#0a0718] h-[100dvh] min-h-screen overflow-hidden text-slate-900 dark:text-white flex font-sans transition-colors duration-300">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-[#080412] border-r border-slate-200 dark:border-purple-900/30
          transform transition-transform duration-300 ease-in-out flex flex-col
          lg:translate-x-0 lg:static shadow-2xl shadow-slate-200/50 dark:shadow-purple-900/20
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200 dark:border-purple-900/30 bg-slate-50 dark:bg-[#090514]">
          <Link to="/jobs" className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 dark:bg-gradient-to-tr dark:from-amber-400 dark:to-yellow-500 flex items-center justify-center text-white dark:text-slate-950 shadow-md font-black text-sm">
              IZ
            </div>
            <span>
              Income<span className="text-purple-600 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">Zone</span>
            </span>
          </Link>
          <button 
            className="p-2 rounded-xl text-slate-500 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/50 hover:text-slate-900 dark:hover:text-white transition-colors lg:hidden border border-transparent dark:hover:border-purple-500/30"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 hardware-accelerate">
          {/* Balance Cards */}
          <div className="mb-8 space-y-4">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:bg-[#130b2c] dark:from-transparent dark:to-transparent rounded-2xl p-4 shadow-lg shadow-purple-600/20 dark:shadow-black/40 border-none dark:border dark:border-amber-400/30 relative overflow-hidden group">
              <p className="text-xs font-bold text-white/80 dark:text-amber-300/80 uppercase tracking-wider mb-1 relative z-10">Deposit Balance</p>
              <p className="text-2xl font-black text-white dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent relative z-10">${(userData?.depositBalance || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-[#180d38] border border-slate-200 dark:border-purple-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/40 relative overflow-hidden group">
              <p className="text-xs font-bold text-slate-500 dark:text-purple-300/80 uppercase tracking-wider mb-1 relative z-10">Earning Balance</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white relative z-10">${(userData?.earningBalance || 0).toFixed(2)}</p>
            </div>
          </div>

          <p className="px-2 text-xs font-bold text-slate-400 dark:text-purple-400/50 uppercase tracking-wider mb-4">Menu</p>
          {SIDEBAR_LINKS.map((link) => {
            const isActive = location.pathname === link.path;
            const Icon = link.icon;
            
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={closeSidebar}
                className={`
                  flex items-center px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300
                  ${isActive 
                    ? 'bg-purple-50 dark:bg-amber-400/10 border-l-4 border-purple-600 dark:border-amber-400 text-purple-700 dark:text-amber-300 shadow-sm dark:shadow-inner' 
                    : 'text-slate-600 dark:text-purple-200/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/20 border-l-4 border-transparent'}
                `}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-purple-600 dark:text-amber-400 drop-shadow-sm dark:drop-shadow-md' : 'text-slate-400 dark:text-purple-400/70'}`} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50 dark:bg-[#0a0718]">
        {/* Background subtle glow */}
        <div className="absolute top-0 left-0 w-full h-[300px] bg-purple-900/5 dark:bg-purple-900/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2"></div>

        {/* Top Navbar */}
        <header className="h-20 flex items-center justify-between px-4 sm:px-8 bg-white/95 dark:bg-[#090514]/95 border-b border-slate-200 dark:border-purple-900/30 z-30 sticky top-0 backdrop-blur-sm">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-xl text-slate-500 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/40 border border-transparent dark:hover:border-purple-500/30 lg:hidden transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="hidden lg:block">
             <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize tracking-wide">
               {location.pathname.split('/').pop()?.replace('-', ' ') || 'Find Jobs'}
             </h2>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-purple-50 dark:bg-[#1a0f3d] text-purple-600 dark:text-amber-400 border border-purple-200 dark:border-amber-400/30 hover:bg-purple-100 dark:hover:bg-[#251554] transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-amber-500 shadow-sm dark:shadow-lg dark:shadow-amber-500/10"
              >
                <UserIcon className="w-5 h-5" />
              </button>

              {isUserMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsUserMenuOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-[#130b2c] rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/80 border border-slate-200 dark:border-purple-500/30 py-2 z-20 transform origin-top-right transition-all">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-purple-900/50 mb-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500 dark:text-purple-400 uppercase tracking-wider">Account</p>
                        <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-amber-400 bg-purple-50 dark:bg-purple-900/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/40">
                          ID: #{formatUserDisplayId(userData?.display_id || userData?.displayId || profile?.display_id || (user as any)?.display_id, user?.uid)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate mt-1">{user?.email}</p>
                    </div>

                    {isAdmin && (
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full flex items-center px-4 py-2.5 text-sm text-purple-600 dark:text-amber-300 font-bold hover:bg-purple-50 dark:hover:bg-amber-400/10 transition-colors border-b border-slate-100 dark:border-purple-900/50 mb-1"
                      >
                        <Shield className="w-4 h-4 mr-3" />
                        Admin Panel
                      </Link>
                    )}
                    
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-purple-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/40 transition-colors"
                    >
                      <UserIcon className="w-4 h-4 mr-3 text-slate-400 dark:text-purple-400" />
                      My Profile
                    </Link>

                    <Link
                      to="/blog"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-purple-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/40 transition-colors"
                    >
                      <BookOpen className="w-4 h-4 mr-3 text-amber-500" />
                      Blog
                    </Link>
                    
                    <Link
                      to="/deposit"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-purple-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/40 transition-colors"
                    >
                      <Wallet className="w-4 h-4 mr-3 text-slate-400 dark:text-purple-400" />
                      Deposit
                    </Link>
                    
                    <Link
                      to="/withdraw"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-purple-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-purple-900/40 transition-colors"
                    >
                      <Banknote className="w-4 h-4 mr-3 text-slate-400 dark:text-purple-400" />
                      Withdraw
                    </Link>
                    
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors mt-1 border-t border-slate-100 dark:border-purple-900/50"
                    >
                      <LogOut className="w-4 h-4 mr-3" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-28 lg:pb-20 relative z-10 smooth-scroll overscroll-contain hardware-accelerate">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
