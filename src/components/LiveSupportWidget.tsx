import React, { useState, useEffect } from 'react';
import { Headphones, X, Maximize2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { checkIsAdmin } from '../lib/adminConfig';
import { isUserBlocked, isUserDeleted, isUserPending } from '../lib/localFallbackStore';
import SupportChatPanel from './SupportChatPanel';

const USER_DASHBOARD_PREFIXES = [
  '/jobs',
  '/post-job',
  '/my-jobs',
  '/submitted-jobs',
  '/post-ad',
  '/posted-ads',
  '/deposit',
  '/withdraw',
  '/profile',
  '/notifications',
  '/dashboard',
];

export default function LiveSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  const uId = user?.uid || user?.id || '';
  const uEmail = user?.email || '';
  const isAdminUser = Boolean(user && (user.role === 'admin' || checkIsAdmin(user) || checkIsAdmin(profile)));
  const isRestrictedUser = Boolean(
    user &&
      !isAdminUser &&
      (user.status === 'pending' ||
        user.status === 'blocked' ||
        user.status === 'deleted' ||
        profile?.status === 'pending' ||
        profile?.status === 'blocked' ||
        profile?.status === 'deleted' ||
        user.is_pending ||
        profile?.is_pending ||
        user.isLocked ||
        profile?.isLocked ||
        isUserPending(uId) ||
        isUserPending(uEmail) ||
        isUserBlocked(uId) ||
        isUserBlocked(uEmail) ||
        isUserDeleted(uId) ||
        isUserDeleted(uEmail))
  );

  const isDashboardRoute = USER_DASHBOARD_PREFIXES.some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
  );

  const shouldShowWidget = Boolean(
    !loading &&
      user &&
      !isAdminUser &&
      !isRestrictedUser &&
      isDashboardRoute &&
      location.pathname !== '/support' &&
      !location.pathname.startsWith('/admin')
  );

  // Close widget automatically whenever user switches accounts or leaves dashboard
  useEffect(() => {
    if (!shouldShowWidget) {
      setIsOpen(false);
    }
  }, [shouldShowWidget, uId]);

  useEffect(() => {
    if (!shouldShowWidget) return;
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('iz_open_live_support', handleOpen);
    return () => {
      window.removeEventListener('iz_open_live_support', handleOpen);
    };
  }, [shouldShowWidget]);

  // Never render on Landing Page, Login, Registration, Legal/Blog, Admin, or standalone /support page
  if (!shouldShowWidget) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
      {isOpen ? (
        <div className="w-[calc(100vw-2rem)] sm:w-[400px] h-[520px] max-h-[80dvh] bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-purple-500/20 bg-slate-50 dark:bg-[#0e0822] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 flex items-center justify-center shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  IncomeZone লাইভ সাপোর্ট
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-purple-300/70 truncate">
                  তাৎক্ষণিক কমন প্রশ্ন ও উত্তর
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/support');
                }}
                title="সম্পূর্ণ পেজে খুলুন"
                className="w-9 h-9 rounded-xl text-slate-500 dark:text-purple-300 hover:bg-slate-200/70 dark:hover:bg-purple-900/40 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="বন্ধ করুন"
                className="w-9 h-9 rounded-xl text-slate-500 dark:text-purple-300 hover:bg-slate-200/70 dark:hover:bg-purple-900/40 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="flex-1 min-h-0">
            <SupportChatPanel variant="widget" onNavigate={() => setIsOpen(false)} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="লাইভ সাপোর্ট চ্যাট খুলুন"
          className="h-12 sm:h-12 px-4 rounded-full bg-purple-600 hover:bg-purple-700 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-bold text-xs sm:text-sm shadow-xl shadow-purple-900/20 dark:shadow-black/40 border border-purple-500/30 dark:border-amber-300 flex items-center gap-2 transition-transform duration-150 hover:scale-[1.03] active:scale-95 cursor-pointer"
        >
          <Headphones className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">লাইভ সাপোর্ট</span>
        </button>
      )}
    </div>
  );
}
