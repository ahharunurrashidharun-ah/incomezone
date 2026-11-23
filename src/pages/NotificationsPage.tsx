import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Bell, 
  CheckCircle2, 
  Trash2, 
  Check, 
  Wallet, 
  Banknote, 
  CheckSquare, 
  Megaphone, 
  Filter,
  ArrowLeft,
  Clock,
  Sparkles,
  Briefcase,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getLocalNotifications,
  markNotificationsAsRead,
  saveLocalNotification,
  UserNotificationItem,
  getNotificationPermissionState,
  requestNativeNotificationPermission,
  registerNotificationServiceWorker,
  showDeviceNotification,
  syncRemoteUserNotifications,
  flushPendingDeviceNotifications,
  clearLocalNotifications,
  isInsideEmbeddedIframe,
  markAllExistingNotificationsNativeDone,
  ensureWebPushSubscription,
  isWebPushSubscribedLocal,
  sendTestServerWebPush,
} from '../lib/localFallbackStore';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'task' | 'broadcast'>('all');
  const [permissionState, setPermissionState] = useState<string>(() => getNotificationPermissionState());
  const [testingNotif, setTestingNotif] = useState(false);
  const [bgPushActive, setBgPushActive] = useState<boolean>(() => isWebPushSubscribedLocal(user?.uid));
  const inIframe = isInsideEmbeddedIframe();

  useEffect(() => {
    const state = getNotificationPermissionState();
    setPermissionState(state);
    if (state === 'granted') {
      void registerNotificationServiceWorker().then(async () => {
        if (user?.uid) {
          const pushRes = await ensureWebPushSubscription(user.uid);
          setBgPushActive(pushRes.subscribed || isWebPushSubscribedLocal(user.uid));
          void flushPendingDeviceNotifications(user.uid);
        }
      });
    }
  }, [user?.uid]);

  const handleRequestPermission = async () => {
    const perm = await requestNativeNotificationPermission();
    setPermissionState(perm);
    if (perm === 'granted') {
      if (user?.uid) {
        markAllExistingNotificationsNativeDone(user.uid);
        const pushRes = await ensureWebPushSubscription(user.uid);
        setBgPushActive(pushRes.subscribed);
      }
      const title = 'ফোনের সিস্টেমে নোটিফিকেশন একটিভ! 🔔';
      const message = 'এখন আপনার ডিভাইসে সমস্ত নতুন জব, টাস্ক, ডিপোজিট ও উইথড্র আপডেট যেকোনো সময় চলে আসবে—অ্যাপ বন্ধ থাকলেও।';
      const result = await showDeviceNotification(title, message, { tag: 'welcome_push_page', url: '/notifications' });
      if (user?.uid) {
        saveLocalNotification(user.uid, {
          id: `welcome_push_${Date.now()}`,
          title,
          message,
          type: 'announcement',
        }, { skipRemoteSync: true, skipNative: true, markNativeDone: true });
      }
      if (result.shown) {
        toast.success('ফোনের নোটিফিকেশন চালু হয়েছে! 🎉 এখন অন্য অ্যাপে থাকলেও নোটিফিকেশন আসবে।');
      } else {
        toast.error(result.reason || 'নোটিফিকেশন পারমিশন চালু হয়েছে, তবে ডিভাইসে পপআপ দেখানো যায়নি।');
      }
    } else if (perm === 'denied') {
      toast.error('নোটিফিকেশন পারমিশন ব্লক করা আছে। ফোনের ব্রাউজার সেটিংসে গিয়ে Allow করুন।');
    } else if (perm === 'unsupported') {
      toast.error('এই ব্রাউজারে সিস্টেম নোটিফিকেশন সাপোর্ট করে না। Chrome ব্রাউজার দিয়ে ওপেন করুন।');
    }
  };

  const handleSendTestNotification = async () => {
    setTestingNotif(true);
    try {
      if (user?.uid) {
        const pushTest = await sendTestServerWebPush(user.uid);
        if (pushTest.ok) {
          setBgPushActive(true);
          toast.success('সার্ভার ব্যাকগ্রাউন্ড Web Push টেস্ট পাঠানো হয়েছে! অ্যাপ বন্ধ থাকলেও এভাবেই ফোনে আসবে।');
          return;
        }
      }

      const result = await showDeviceNotification(
        'টেস্ট নোটিফিকেশন সফল! 🔔',
        'অভিনন্দন! আপনার ফোনে IncomeZone-এর নোটিফিকেশন সঠিকভাবে কাজ করছে।',
        { tag: `test_${Date.now()}`, url: '/notifications' }
      );
      if (result.shown) {
        toast.success('ফোনে টেস্ট নোটিফিকেশন পাঠানো হয়েছে! স্ক্রিনের উপরে নোটিফিকেশন বার দেখুন।');
      } else {
        toast.error(result.reason || 'নোটিফিকেশন পাঠানো যায়নি। ব্রাউজারের সেটিংস চেক করুন।');
      }
    } finally {
      setTestingNotif(false);
    }
  };

  const loadNotifications = () => {
    if (!user?.uid) return;
    const list = getLocalNotifications(user.uid);
    setNotifications(list);
  };

  useEffect(() => {
    if (!user?.uid) return;
    loadNotifications();
    void syncRemoteUserNotifications(user.uid);

    const handleUpdated = (e: any) => {
      if (!e.detail || !e.detail.userId || e.detail.userId === user.uid) {
        loadNotifications();
      }
    };

    window.addEventListener('iz_user_notifications_updated', handleUpdated);
    return () => {
      window.removeEventListener('iz_user_notifications_updated', handleUpdated);
    };
  }, [user?.uid]);

  const handleMarkAllRead = () => {
    if (!user?.uid) return;
    markNotificationsAsRead(user.uid);
    loadNotifications();
    toast.success('সকল নোটিফিকেশন পঠিত মার্ক করা হয়েছে!');
  };

  const handleClearAll = () => {
    if (!user?.uid) return;
    try {
      clearLocalNotifications(user.uid);
      setNotifications([]);
      toast.success('সকল নোটিফিকেশন মুছে ফেলা হয়েছে!');
    } catch {}
  };

  // Filter notifications
  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'deposit') return item.type === 'deposit';
    if (activeFilter === 'withdrawal') return item.type === 'withdrawal';
    if (activeFilter === 'task') return item.type === 'task' || item.type === 'submission' || item.type === 'job';
    if (activeFilter === 'broadcast') return item.type === 'broadcast' || item.type === 'general' || item.type === 'announcement';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotifIcon = (type?: string) => {
    switch (type) {
      case 'deposit':
        return (
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        );
      case 'withdrawal':
        return (
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
        );
      case 'job':
        return (
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
        );
      case 'task':
      case 'submission':
        return (
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-amber-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
        );
      case 'announcement':
        return (
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
        );
      case 'broadcast':
      default:
        return (
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-amber-400 text-white border border-amber-400/50 flex items-center justify-center shrink-0 shadow-md shadow-amber-400/20">
            <Megaphone className="w-5 h-5 fill-current" />
          </div>
        );
    }
  };

  const getBadgeColor = (type?: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      case 'withdrawal':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      case 'job':
        return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
      case 'task':
      case 'submission':
        return 'bg-purple-500/10 text-purple-700 dark:text-amber-300 border-purple-500/30';
      case 'broadcast':
        return 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50 font-black shadow-xs';
      default:
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
    }
  };

  const getBadgeLabel = (type?: string) => {
    switch (type) {
      case 'broadcast':
        return '👑 ADMIN OFFICIAL (সকলের জন্য)';
      case 'job':
        return '💼 নতুন জব (Find Jobs)';
      case 'submission':
      case 'task':
        return 'টাস্ক আপডেট';
      case 'deposit':
        return 'ডিপোজিট';
      case 'withdrawal':
        return 'উত্তোলন';
      case 'announcement':
        return 'সিস্টেম আপডেট';
      default:
        return type || 'System';
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 sm:pb-28">
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-[#130b2c]/80 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-5 sm:p-7 shadow-sm dark:shadow-xl dark:shadow-purple-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 dark:bg-gradient-to-tr dark:from-amber-400 dark:to-yellow-500 flex items-center justify-center text-white dark:text-slate-950 shadow-md shadow-purple-600/20 dark:shadow-amber-500/20 font-black shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  নোটিফিকেশন সেন্টার
                </h1>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-purple-300/60 uppercase tracking-widest mt-0.5">
                All Platform Activity & System Updates
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="px-3.5 py-2 rounded-2xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-amber-300 border border-purple-200 dark:border-purple-500/30 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>সব পঠিত চিহ্নিত করুন</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="px-3.5 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                <span>ক্লিয়ার করুন</span>
              </button>
            )}
          </div>
        </div>

        {/* System Web Push Notification Banner */}
        {permissionState === 'default' ? (
          <div className="mt-5 p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-purple-600 dark:text-amber-400 shrink-0 animate-bounce" />
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">ডিভাইস সিস্টেম নোটিফিকেশন অফ আছে</h4>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-purple-300/70">
                  কাজ এপ্রুভ বা রিজেক্ট, ডিপোজিট ও উইথড্র এর তথ্য ফোনের নোটিফিকেশন বারে দেখতে ক্লিক করুন।
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-4 py-2 rounded-xl bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 font-black text-xs shadow-md shrink-0 cursor-pointer hover:bg-purple-700 dark:hover:bg-amber-300 transition-all"
            >
              ফোনের নোটিফিকেশন চালু করুন (Enable)
            </button>
          </div>
        ) : permissionState === 'granted' ? (
          <div className="mt-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold">ডিভাইস নোটিফিকেশন সক্রিয় (Background Web Push)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">
                  {bgPushActive ? '24/7 Background Active' : 'Active'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                {bgPushActive
                  ? 'ওয়েবসাইট বন্ধ থাকলেও বা অন্য অ্যাপ চালানোর সময়ও গুরুত্বপূর্ণ আপডেট ফোনে পৌঁছে যাবে।'
                  : 'ব্যাকগ্রাউন্ড পুশ সিঙ্ক করতে একবার Test Notification চাপুন বা Chrome-এ ওপেন করুন।'}
              </p>
              {inIframe && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  প্রিভিউ মোডের পরিবর্তে সরাসরি ফোনের Chrome ব্রাউজারে ওপেন করলে ফোনের নোটিফিকেশন বারে সবচেয়ে ভালো কাজ করে।
                </p>
              )}
            </div>
            <button
              onClick={handleSendTestNotification}
              disabled={testingNotif}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-60"
            >
              {testingNotif ? 'পাঠানো হচ্ছে...' : 'টেস্ট নোটিফিকেশন পাঠান'}
            </button>
          </div>
        ) : permissionState === 'denied' ? (
          <div className="mt-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-800 dark:text-rose-200 space-y-1">
            <p className="font-black">ফোনের নোটিফিকেশন পারমিশন ব্লক (Blocked) করা রয়েছে</p>
            <p className="text-[11px] font-semibold opacity-90">
              চালু করতে ব্রাউজারের অ্যাড্রেস বারের বাম দিকের সেটিংস/লক আইকনে ট্যাপ করে Permissions → Notifications → Allow সিলেক্ট করুন।
            </p>
          </div>
        ) : (
          <div className="mt-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <p className="font-black">এই ব্রাউজারে সিস্টেম নোটিফিকেশন সাপোর্ট করে না</p>
            <p className="text-[11px] font-semibold opacity-90">
              সরাসরি ফোনের Google Chrome ব্রাউজারে ওয়েবসাইটটি ওপেন করে নোটিফিকেশন চালু করুন।
            </p>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 border-purple-600 dark:border-amber-400 shadow-md'
                : 'bg-slate-50 dark:bg-[#0a0718] text-slate-600 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
            }`}
          >
            <span>সব ({notifications.length})</span>
          </button>

          <button
            onClick={() => setActiveFilter('deposit')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
              activeFilter === 'deposit'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-slate-50 dark:bg-[#0a0718] text-slate-600 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>ডিপোজিট</span>
          </button>

          <button
            onClick={() => setActiveFilter('withdrawal')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
              activeFilter === 'withdrawal'
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                : 'bg-slate-50 dark:bg-[#0a0718] text-slate-600 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>উত্তোলন (Withdraw)</span>
          </button>

          <button
            onClick={() => setActiveFilter('task')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
              activeFilter === 'task'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                : 'bg-slate-50 dark:bg-[#0a0718] text-slate-600 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>টাস্ক ও জব</span>
          </button>

          <button
            onClick={() => setActiveFilter('broadcast')}
            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
              activeFilter === 'broadcast'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-slate-50 dark:bg-[#0a0718] text-slate-600 dark:text-purple-200 border-slate-200 dark:border-purple-500/20 hover:border-slate-300'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>অফিসিয়াল নোটিশ</span>
          </button>
        </div>
      </div>

      {/* Notifications Detailed Card List */}
      <div className="space-y-3.5">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-[#130b2c]/80 border border-slate-200 dark:border-purple-500/20 rounded-3xl p-12 text-center shadow-sm space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-purple-900/30 text-slate-400 dark:text-purple-400 flex items-center justify-center mx-auto">
              <Bell className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              কোনো নোটিফিকেশন পাওয়া যায়নি
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-purple-300/60 max-w-sm mx-auto">
              আপনি ডিপোজিট, উইথড্র, জব সাবমিশন বা অ্যাডমিন থেকে পাঠানো আপডেটগুলো এখানে নোটিফিকেশন আকারে দেখতে পাবেন।
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`bg-white dark:bg-[#130b2c]/90 border rounded-3xl p-5 sm:p-6 transition-all duration-200 shadow-sm relative overflow-hidden ${
                notif.type === 'broadcast'
                  ? 'border-amber-400/80 dark:border-amber-500/60 ring-2 ring-amber-400/30 bg-amber-500/5 dark:bg-amber-950/20'
                  : notif.read
                  ? 'border-slate-200 dark:border-purple-500/20 opacity-90'
                  : 'border-purple-400 dark:border-purple-500/50 ring-1 ring-purple-400/30 bg-purple-50/40 dark:bg-purple-950/20'
              }`}
            >
              {/* Unread indicator dot */}
              {!notif.read && (
                <span className="absolute top-5 right-5 w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
              )}

              <div className="flex items-start gap-4">
                {getNotifIcon(notif.type)}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        {notif.title}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getBadgeColor(notif.type)}`}>
                        {getBadgeLabel(notif.type)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-purple-300/60 text-xs font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTimestamp(notif.created_at)}</span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-purple-200/90 leading-relaxed">
                    {notif.message}
                  </p>

                  {notif.type === 'job' && (
                    <div className="pt-1">
                      <Link
                        to={notif.url || '/jobs'}
                        className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-amber-300 hover:underline"
                      >
                        <span>Find Jobs-এ দেখুন</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
