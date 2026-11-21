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
  BookOpen,
  Megaphone,
  Sparkles,
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, formatUserDisplayId } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';
import ThemeToggle from '../components/ThemeToggle';
import {
  getLocalNotifications,
  saveLocalNotification,
  markNotificationsAsRead,
  UserNotificationItem,
  getNotificationPermissionState,
  requestNativeNotificationPermission
} from '../lib/localFallbackStore';

const SIDEBAR_LINKS = [
  { name: 'Find Jobs', path: '/jobs', icon: Search },
  { name: 'Post Job', path: '/post-job', icon: PlusCircle },
  { name: 'My Job', path: '/my-jobs', icon: ClipboardList },
  { name: 'Submitted Jobs', path: '/submitted-jobs', icon: CheckSquare },
  { name: 'Post Ad', path: '/post-ad', icon: PlusCircle },
  { name: 'Posted Ads', path: '/posted-ads', icon: ClipboardList },
  { name: 'Deposit', path: '/deposit', icon: Wallet },
  { name: 'Withdraw', path: '/withdraw', icon: Banknote },
  { name: 'Notifications', path: '/notifications', icon: Bell },
];

export default function DashboardLayout() {
  const { user, profile, logout } = useAuth();
  const [userData, setUserData] = useState<any>(profile || null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUserData = async () => {
    if (!user?.uid) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.uid)
        .maybeSingle();

      if (!error && data) {
        const depBal = Number(data.deposit_balance ?? data.depositBalance ?? 0);
        const earnBal = Number(data.earning_balance ?? data.earningBalance ?? 0);
        setUserData((prev: any) => ({
          ...prev,
          depositBalance: depBal,
          earningBalance: earnBal,
          role: data.role || 'user',
          ...data
        }));
        if (
          profile &&
          (profile.depositBalance !== depBal || profile.earningBalance !== earnBal)
        ) {
          window.dispatchEvent(new CustomEvent('iz_balance_updated', {
            detail: {
              source: 'dashboard_layout',
              userId: user.uid,
              depositBalance: depBal,
              earningBalance: earnBal,
            }
          }));
        }
      } else if (profile) {
        setUserData(profile);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  useEffect(() => {
    if (user?.uid) {
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
  }, [user?.uid]);

  const [notice, setNotice] = useState<{ enabled: boolean; type: string; text: string }>({
    enabled: false,
    type: 'info',
    text: '',
  });
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>('granted');
  const [isPermissionBannerDismissed, setIsPermissionBannerDismissed] = useState(false);

  useEffect(() => {
    setNotifPermission(getNotificationPermissionState());
  }, []);

  const handleEnableNativeNotifications = async () => {
    const perm = await requestNativeNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.success('ফোনের সিস্টেমে নোটিফিকেশন চালু করা হয়েছে! 🎉');
      });
      if (user?.uid) {
        saveLocalNotification(user.uid, {
          title: 'ফোনের নোটিফিকেশন সচল হয়েছে! 🔔',
          message: 'আপনার ফোনে এখন সকল টাস্ক এপ্রুভ/রিজেক্ট, ডিপোজিট, উইথড্র ও নোটিশ এর ইনস্ট্যান্ট পুশ নোটিফিকেশন চলে আসবে।',
          type: 'announcement',
        });
      }
    } else if (perm === 'denied') {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error('নোটিফিকেশন পারমিশন ব্লক করা আছে। ডিভাইসের ব্রাউজার সেটিংস থেকে এলাউ করুন।');
      });
    }
  };

  const fetchUserNotifications = () => {
    if (!user?.uid) return;
    const list = getLocalNotifications(user.uid);
    setNotifications(list);
  };

  const fetchNotice = async () => {
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
      setNotice({
        enabled: Boolean(merged.user_notice_enabled),
        type: merged.user_notice_type || 'info',
        text: merged.user_notice_text || '',
      });
    } catch {}
  };

  const syncLatestBroadcast = async () => {
    if (!user?.uid) return;
    try {
      let latestBc: any = null;
      const { data } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'latest_broadcast')
        .maybeSingle();

      if (data?.value) {
        latestBc = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      } else {
        const localStr = localStorage.getItem('iz_latest_broadcast');
        if (localStr) latestBc = JSON.parse(localStr);
      }

      if (latestBc && latestBc.text) {
        const bcId = latestBc.id || 'default_bc';
        const receivedKey = `iz_user_received_bc_${user.uid}_${bcId}`;
        if (!localStorage.getItem(receivedKey)) {
          localStorage.setItem(receivedKey, 'true');
          saveLocalNotification(user.uid, {
            id: `bc_${bcId}`,
            title: '📢 অ্যাডমিন অফিশিয়াল ব্রডকাস্ট নোটিশ',
            message: latestBc.text,
            type: 'broadcast',
            created_at: latestBc.created_at || new Date().toISOString(),
          });
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotice();
    fetchUserNotifications();
    syncLatestBroadcast();

    const handleControlsUpdated = (e: any) => {
      if (e.detail) {
        setNotice({
          enabled: Boolean(e.detail.user_notice_enabled),
          type: e.detail.user_notice_type || 'info',
          text: e.detail.user_notice_text || '',
        });
        setIsNoticeDismissed(false);
      }
    };

    const handleUserNotifsUpdated = (e: any) => {
      if (user?.uid && (!e.detail || !e.detail.userId || e.detail.userId === user.uid)) {
        fetchUserNotifications();
      }
    };

    const handleBroadcastNotification = (e: any) => {
      if (e.detail && e.detail.text) {
        if (user?.uid) {
          saveLocalNotification(user.uid, {
            title: '📢 অ্যাডমিন অফিশিয়াল ব্রডকাস্ট নোটিশ',
            message: e.detail.text,
            type: 'broadcast',
          });
        }
        import('react-hot-toast').then(({ default: toast }) => {
          toast(e.detail.text, {
            icon: '📢',
            duration: 8000,
            style: {
              borderRadius: '16px',
              background: '#130b2c',
              color: '#fff',
              border: '1px solid rgba(245, 158, 11, 0.6)',
              fontWeight: 'bold',
            },
          });
        });
      }
    };

    window.addEventListener('iz_platform_controls_updated', handleControlsUpdated);
    window.addEventListener('iz_broadcast_notification', handleBroadcastNotification);
    window.addEventListener('iz_user_notifications_updated', handleUserNotifsUpdated);

    return () => {
      window.removeEventListener('iz_platform_controls_updated', handleControlsUpdated);
      window.removeEventListener('iz_broadcast_notification', handleBroadcastNotification);
      window.removeEventListener('iz_user_notifications_updated', handleUserNotifsUpdated);
    };
  }, [user?.uid]);

  // Keep synced with profile changes from context and global events
  useEffect(() => {
    if (profile) {
      setUserData((prev: any) => {
        if (
          prev &&
          prev.depositBalance === profile.depositBalance &&
          prev.earningBalance === profile.earningBalance &&
          prev.role === profile.role
        ) {
          return prev;
        }
        return {
          ...prev,
          depositBalance: profile.depositBalance ?? prev?.depositBalance ?? 0,
          earningBalance: profile.earningBalance ?? prev?.earningBalance ?? 0,
          role: profile.role ?? prev?.role ?? 'user'
        };
      });
    }

    const handleBalanceEvent = (e: any) => {
      const detail = e.detail;
      if (detail && (!detail.userId || detail.userId === user?.uid)) {
        setUserData((prev: any) => {
          const nextDep = typeof detail.depositBalance === 'number' ? detail.depositBalance : prev?.depositBalance;
          const nextEarn = typeof detail.earningBalance === 'number' ? detail.earningBalance : prev?.earningBalance;
          if (prev && prev.depositBalance === nextDep && prev.earningBalance === nextEarn) {
            return prev;
          }
          return {
            ...prev,
            depositBalance: nextDep,
            earningBalance: nextEarn,
          };
        });
      }
    };
    window.addEventListener('iz_balance_updated', handleBalanceEvent);
    return () => {
      window.removeEventListener('iz_balance_updated', handleBalanceEvent);
    };
  }, [profile?.depositBalance, profile?.earningBalance, profile?.role, user?.uid]);

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
          {/* Balance Cards Connected to Wallet */}
          <div className="mb-8 space-y-3.5">
            <Link
              to="/deposit"
              onClick={closeSidebar}
              className="block bg-gradient-to-r from-purple-600 to-indigo-600 dark:bg-[#130b2c] dark:from-transparent dark:to-transparent rounded-2xl p-4 shadow-lg shadow-purple-600/20 dark:shadow-black/40 border-none dark:border dark:border-amber-400/30 relative overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer"
              title="ক্লিক করে টাকা ডিপোজিট করুন"
            >
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="text-xs font-bold text-white/90 dark:text-amber-300 uppercase tracking-wider">Deposit Balance</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/20 dark:bg-amber-400/20 text-white dark:text-amber-300">
                  + Add
                </span>
              </div>
              <p className="text-2xl font-black text-white dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent relative z-10">
                ${(userData?.depositBalance ?? profile?.depositBalance ?? 0).toFixed(2)}
              </p>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/20 dark:border-amber-400/20 relative z-10">
                <span className="text-[11px] font-bold text-white/80 dark:text-purple-300/70 font-sans">
                  ≈ ৳{Math.round((userData?.depositBalance ?? profile?.depositBalance ?? 0) * 100)} BDT
                </span>
                <span className="text-[10px] font-mono text-white/70 dark:text-amber-300/80">1$ = 100৳</span>
              </div>
            </Link>

            <Link
              to="/withdraw"
              onClick={closeSidebar}
              className="block bg-white dark:bg-[#180d38] border border-slate-200 dark:border-purple-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/40 relative overflow-hidden group hover:scale-[1.02] transition-all cursor-pointer"
              title="ক্লিক করে টাকা উত্তোলন করুন"
            >
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="text-xs font-bold text-slate-700 dark:text-purple-200 uppercase tracking-wider">Earning Balance</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-500/30">
                  Withdraw
                </span>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white relative z-10">
                ${(userData?.earningBalance ?? profile?.earningBalance ?? 0).toFixed(2)}
              </p>
              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 dark:border-purple-900/40 relative z-10">
                <span className="text-[11px] font-bold text-purple-600 dark:text-amber-400 font-sans">
                  ≈ ৳{Math.round((userData?.earningBalance ?? profile?.earningBalance ?? 0) * 100)} BDT
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Withdrawable
                </span>
              </div>
            </Link>
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
        <header className="h-20 flex items-center justify-between px-3 sm:px-8 bg-white/95 dark:bg-[#090514]/95 border-b border-slate-200 dark:border-purple-900/30 z-30 sticky top-0 backdrop-blur-sm gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-1 rounded-xl text-slate-500 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/40 border border-transparent dark:hover:border-purple-500/30 lg:hidden transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="hidden lg:block">
               <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize tracking-wide">
                 {location.pathname.split('/').pop()?.replace('-', ' ') || 'Find Jobs'}
               </h2>
            </div>
          </div>

          {/* Quick Header Live Wallet & Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Live Wallet Pills */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/deposit"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-[#180d38] dark:hover:bg-[#201048] border border-purple-200 dark:border-purple-500/30 text-xs font-bold transition-all shadow-sm group"
                title="ডিপোজিট ব্যালেন্স ওয়ালেট"
              >
                <div className="w-5 h-5 rounded-md bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 flex items-center justify-center shrink-0">
                  <Wallet className="w-3 h-3" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-black uppercase tracking-wider text-purple-600 dark:text-amber-300 hidden md:block leading-none mb-0.5">Deposit</p>
                  <p className="font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm leading-none">
                    ${(userData?.depositBalance ?? profile?.depositBalance ?? 0).toFixed(2)}
                  </p>
                </div>
              </Link>

              <Link
                to="/withdraw"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-[#0c1f20] dark:hover:bg-[#112a2b] border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold transition-all shadow-sm group"
                title="উইথড্র / আর্নিং ব্যালেন্স ওয়ালেট"
              >
                <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Banknote className="w-3 h-3" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hidden md:block leading-none mb-0.5">Earning</p>
                  <p className="font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm leading-none">
                    ${(userData?.earningBalance ?? profile?.earningBalance ?? 0).toFixed(2)}
                  </p>
                </div>
              </Link>
            </div>

            {/* User Panel Notification Bell Center */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2.5 rounded-2xl bg-purple-50 dark:bg-[#180d38] border border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-amber-400 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all cursor-pointer flex items-center justify-center"
                title="নোটিফিকেশন সেন্টার"
              >
                <Bell className="w-5 h-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-[#090514] animate-pulse">
                    {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsNotifOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-[#130b2c] rounded-3xl shadow-2xl border border-slate-200 dark:border-purple-500/30 p-4 sm:p-5 z-30 transform origin-top-right transition-all space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-purple-900/40 pb-3">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">নোটিফিকেশন (Notifications)</h3>
                        {notifications.filter(n => !n.read).length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            {notifications.filter(n => !n.read).length} Unread
                          </span>
                        )}
                      </div>
                      {notifications.filter(n => !n.read).length > 0 && (
                        <button
                          onClick={() => {
                            if (user?.uid) markNotificationsAsRead(user.uid);
                          }}
                          className="text-[11px] font-bold text-purple-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          সব পঠিত
                        </button>
                      )}
                    </div>

                    {/* Enable Native Phone Notifications Prompt */}
                    {notifPermission === 'default' && (
                      <div className="p-3 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 rounded-2xl border border-amber-400/40 text-white space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-amber-300 animate-bounce" />
                            <span className="text-xs font-black text-amber-300">ফোনের নোটিফিকেশন অন করুন</span>
                          </div>
                        </div>
                        <p className="text-[11px] font-medium text-purple-100/90 leading-tight">
                          জব এপ্রুভ, রিজেক্ট, ডিপোজিট ও উইথড্র এর আপডেট সরাসরি ফোনে পেতে এলাউ ক্লিক করুন।
                        </p>
                        <button
                          onClick={handleEnableNativeNotifications}
                          className="w-full py-1.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                        >
                          <Bell className="w-3.5 h-3.5 fill-current" />
                          <span>এলাউ করুন (Enable Push)</span>
                        </button>
                      </div>
                    )}

                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1 smooth-scroll">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 dark:text-purple-300/50 space-y-1">
                          <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-purple-500/30" />
                          <p className="text-xs font-bold">এখনো কোনো নোটিফিকেশন নেই</p>
                          <p className="text-[10px] font-medium opacity-75">ডিপোজিট, উইথড্র ও সিস্টেম আপডেট এখানে দেখতে পাবেন</p>
                        </div>
                      ) : (
                        (showAllNotifs ? notifications : notifications.slice(0, 5)).map((n) => (
                          <div
                            key={n.id}
                            className={`p-3.5 rounded-2xl border transition-all text-xs space-y-1 ${
                              n.read
                                ? 'bg-slate-50/80 dark:bg-[#080412]/60 border-slate-200/60 dark:border-purple-900/20 opacity-80'
                                : 'bg-purple-50/90 dark:bg-purple-900/30 border-purple-300 dark:border-purple-500/40 font-bold'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-slate-900 dark:text-white truncate">{n.title}</span>
                              <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-purple-300/60 shrink-0">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-purple-200/90 leading-relaxed">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* View All Notifications Page Link */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-purple-900/40 text-center">
                      <Link
                        to="/notifications"
                        onClick={() => setIsNotifOpen(false)}
                        className="w-full py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-500/30 text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm group"
                      >
                        <span>সকল নোটিফিকেশন দেখুন (Show More)</span>
                        <ChevronDown className="w-4 h-4 -rotate-90 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-28 lg:pb-20 relative z-10 smooth-scroll overscroll-contain hardware-accelerate space-y-6">
          {/* Web Push Notification Permission Prompt Banner */}
          {notifPermission === 'default' && !isPermissionBannerDismissed && (
            <div className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 border border-amber-400/40 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-3 rounded-2xl bg-amber-400 text-slate-950 shrink-0 shadow-lg shadow-amber-400/30 animate-pulse">
                  <Bell className="w-6 h-6 fill-current" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      ফোনের নোটিফিকেশন সিস্টেম
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    ফোনে সরাসরি ইনস্ট্যান্ট নোটিফিকেশন অন করুন 🔔
                  </h4>
                  <p className="text-xs text-purple-200/90 leading-relaxed max-w-2xl font-medium">
                    টাস্ক এপ্রুভ বা রিজেক্ট হওয়া, ডিপোজিট বোনাস ও ক্যাশআউট উইথড্র এর সকল আপডেট সাথে সাথে নিজের ফোনের নোটিফিকেশনে দেখতে নোটিফিকেশন চালু করুন।
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                <button
                  onClick={handleEnableNativeNotifications}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Bell className="w-4 h-4 fill-current" />
                  <span>নোটিফিকেশন পারমিশন এলাউ করুন</span>
                </button>
                <button
                  onClick={() => setIsPermissionBannerDismissed(true)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
                  title="পরে চালু করব"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {/* Global Admin Announcement Notice Banner (Mandatory Notice) */}
          {notice.enabled && notice.text && (
            <div
              className={`relative rounded-2xl p-4 sm:p-5 shadow-lg border transition-all flex items-start justify-between gap-3 ${
                notice.type === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : notice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                  : notice.type === 'promo'
                  ? 'bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-950/90 border-purple-500/40 text-white shadow-purple-950/50'
                  : 'bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 ${
                  notice.type === 'promo'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-purple-600/10 dark:bg-amber-400/20 text-purple-600 dark:text-amber-400'
                }`}>
                  {notice.type === 'promo' ? (
                    <Sparkles className="w-5 h-5 fill-current" />
                  ) : notice.type === 'warning' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Megaphone className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600/20 dark:bg-amber-400/20 text-purple-700 dark:text-amber-300">
                      👑 MANDATORY NOTICE (অফিশিয়াল নোটিশ)
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold leading-relaxed">
                    {notice.text}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
}
