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
  ChevronUp,
  Headphones
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, formatUserDisplayId } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';
import ThemeToggle from '../components/ThemeToggle';
import BrandLogo from '../components/BrandLogo';
import {
  getLocalNotifications,
  saveLocalNotification,
  markNotificationsAsRead,
  UserNotificationItem,
  getNotificationPermissionState,
  requestNativeNotificationPermission,
  registerNotificationServiceWorker,
  syncRemoteUserNotifications,
  flushPendingDeviceNotifications,
  showDeviceNotification,
  getLocalJobs,
  isTableMissingError,
  AdminBannerNotice,
  AdminBroadcastMessage,
  getDeletedBroadcastIdsLocal,
  saveDeletedBroadcastIdsLocal,
  removeUserNotificationsByIds,
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
  { name: 'Live Support', path: '/support', icon: Headphones },
];

export default function DashboardLayout() {
  const { user, profile, logout } = useAuth();
  const [userData, setUserData] = useState<any>(profile || null);
  const profileRef = React.useRef(profile);
  const fetchInFlightRef = React.useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    profileRef.current = profile;
    if (profile) {
      setUserData((prev: any) => ({ ...prev, ...profile }));
    }
  }, [profile]);

  const fetchUserData = async () => {
    if (!user?.uid || fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
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
        const latestProfile = profileRef.current;
        if (
          latestProfile &&
          (latestProfile.depositBalance !== depBal || latestProfile.earningBalance !== earnBal)
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
      } else if (profileRef.current) {
        setUserData(profileRef.current);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      fetchInFlightRef.current = false;
    }
  };

  const getSeenLiveJobs = (uid: string): string[] => {
    try {
      const raw = localStorage.getItem(`iz_seen_live_jobs_${uid}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  const saveSeenLiveJobs = (uid: string, ids: string[]) => {
    try {
      const deduped = Array.from(new Set(ids.map(String))).slice(0, 250);
      localStorage.setItem(`iz_seen_live_jobs_${uid}`, JSON.stringify(deduped));
    } catch {}
  };

  const notifyLiveJobForUser = (jobData: {
    id: string;
    title?: string;
    pricePerTask?: number;
    totalSlots?: number;
    occupiedSlots?: number;
    ownerId?: string;
    activatedAt?: string;
    created_at?: string;
  }) => {
    if (!user?.uid || !jobData?.id) return;
    const jobId = String(jobData.id);
    const seen = getSeenLiveJobs(user.uid);
    if (seen.includes(jobId)) return;

    saveSeenLiveJobs(user.uid, [jobId, ...seen]);

    // The employer who posted this job already receives "জব ক্যাম্পেইন লাইভ! 🚀"
    if (jobData.ownerId && jobData.ownerId === user.uid) return;

    const price = Number(jobData.pricePerTask || 0);
    const totalSlots = Number(jobData.totalSlots || 0);
    const slotsInfo = totalSlots > 0 ? ` · ${totalSlots}টি স্লট` : '';
    const bdt = Math.round(price * 100);

    saveLocalNotification(
      user.uid,
      {
        id: `live_job_${jobId}`,
        title: 'নতুন জব লাইভ হয়েছে! 💼',
        message: `"${jobData.title || 'New Micro-Job'}" — প্রতি টাস্ক $${price.toFixed(2)} (৳${bdt})${slotsInfo}। এখনই Find Jobs-এ কাজ শুরু করুন!`,
        type: 'job',
        url: '/jobs',
        created_at: jobData.activatedAt || new Date().toISOString(),
      },
      { skipRemoteSync: true }
    );
  };

  const syncNewLiveJobs = async () => {
    if (!user?.uid) return;
    try {
      const seenKey = `iz_seen_live_jobs_${user.uid}`;
      const isFirstSeed = localStorage.getItem(seenKey) === null;
      const existingSeen = getSeenLiveJobs(user.uid);
      const recentCutoff = Date.now() - 15 * 60 * 1000;

      // 1. Check remote/local latest_live_job signal (captures older pending jobs approved just now)
      let latestSignal: any = null;
      try {
        const { data: sigRow } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'latest_live_job')
          .maybeSingle();
        if (sigRow?.value) {
          latestSignal = typeof sigRow.value === 'string' ? JSON.parse(sigRow.value) : sigRow.value;
        }
      } catch {}

      if (!latestSignal) {
        try {
          const localSig = localStorage.getItem('iz_latest_live_job');
          if (localSig) latestSignal = JSON.parse(localSig);
        } catch {}
      }

      if (latestSignal?.id) {
        const sigTs = latestSignal.activatedAt ? new Date(latestSignal.activatedAt).getTime() : 0;
        if (!isFirstSeed || (!Number.isNaN(sigTs) && sigTs >= recentCutoff)) {
          notifyLiveJobForUser({
            id: latestSignal.id,
            title: latestSignal.title,
            pricePerTask: latestSignal.pricePerTask,
            totalSlots: latestSignal.totalSlots,
            ownerId: latestSignal.ownerId,
            activatedAt: latestSignal.activatedAt,
          });
        }
      }

      // 2. Check active jobs list in Find Jobs
      let activeJobs: any[] = [];
      try {
        const { data: jobsData, error: jobsErr } = await supabase
          .from('jobs')
          .select('id, title, price_per_task, total_slots, occupied_slots, owner_id, employer_id, status, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(25);

        if (!jobsErr && Array.isArray(jobsData)) {
          activeJobs = jobsData;
        } else if (jobsErr && isTableMissingError(jobsErr)) {
          activeJobs = getLocalJobs().filter((j: any) => j.status === 'active');
        }
      } catch {
        activeJobs = getLocalJobs().filter((j: any) => j.status === 'active');
      }

      if (isFirstSeed) {
        const currentSeen = getSeenLiveJobs(user.uid);
        const idsToSeed: string[] = [...currentSeen];
        for (const j of activeJobs) {
          if (!j?.id) continue;
          const jTs = j.created_at ? new Date(j.created_at).getTime() : 0;
          const hasSlots = Number(j.occupied_slots ?? j.occupiedSlots ?? 0) < Number(j.total_slots ?? j.totalSlots ?? 1);
          if (!Number.isNaN(jTs) && jTs >= recentCutoff && hasSlots && !idsToSeed.includes(String(j.id))) {
            notifyLiveJobForUser({
              id: j.id,
              title: j.title,
              pricePerTask: j.price_per_task ?? j.pricePerTask,
              totalSlots: j.total_slots ?? j.totalSlots,
              ownerId: j.owner_id ?? j.employer_id ?? j.ownerId,
              activatedAt: j.created_at,
            });
          } else {
            idsToSeed.push(String(j.id));
          }
        }
        saveSeenLiveJobs(user.uid, idsToSeed);
        return;
      }

      for (const j of activeJobs) {
        if (!j?.id) continue;
        const jobId = String(j.id);
        const occupied = Number(j.occupied_slots ?? j.occupiedSlots ?? 0);
        const total = Number(j.total_slots ?? j.totalSlots ?? 0);
        if (occupied >= total && total > 0) {
          if (!existingSeen.includes(jobId)) {
            saveSeenLiveJobs(user.uid, [jobId, ...getSeenLiveJobs(user.uid)]);
          }
          continue;
        }
        if (!getSeenLiveJobs(user.uid).includes(jobId)) {
          notifyLiveJobForUser({
            id: jobId,
            title: j.title,
            pricePerTask: j.price_per_task ?? j.pricePerTask,
            totalSlots: total,
            ownerId: j.owner_id ?? j.employer_id ?? j.ownerId,
            activatedAt: j.created_at,
          });
        }
      }
    } catch {}
  };

  const syncUserStatusNotifications = async () => {
    if (!user?.uid) return;
    try {
      const snapKey = `iz_status_snapshot_${user.uid}`;
      const rawSnap = localStorage.getItem(snapKey);
      const isFirstSeed = rawSnap === null;
      const snap: {
        subs: Record<string, string>;
        deps: Record<string, string>;
        wds: Record<string, string>;
        jobs: Record<string, string>;
        ads: Record<string, string>;
        empSubs: string[];
      } = rawSnap
        ? JSON.parse(rawSnap)
        : { subs: {}, deps: {}, wds: {}, jobs: {}, ads: {}, empSubs: [] };

      const recentWindow = Date.now() - 15 * 60 * 1000;

      const [subsRes, depsRes, wdsRes, jobsRes, adsRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('id, status, rejection_reason, reviewed_at, created_at')
          .eq('worker_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('deposit_requests')
          .select('id, amount, status, created_at')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase
          .from('withdraw_requests')
          .select('id, amount, status, created_at')
          .eq('user_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(15),
        supabase
          .from('jobs')
          .select('id, title, status, rejection_reason, created_at')
          .eq('owner_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('ads')
          .select('id, title, status, created_at')
          .eq('owner_id', user.uid)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      // 1. Worker Submissions status changes
      if (!subsRes.error && Array.isArray(subsRes.data)) {
        for (const row of subsRes.data) {
          const prevStatus = snap.subs[row.id];
          const isTerminal = row.status === 'approved' || row.status === 'rejected';
          const reviewedTs = row.reviewed_at ? new Date(row.reviewed_at).getTime() : 0;
          const shouldNotify =
            isTerminal &&
            ((prevStatus && prevStatus !== row.status) ||
              (!prevStatus && (!isFirstSeed || (!Number.isNaN(reviewedTs) && reviewedTs >= recentWindow))));

          if (shouldNotify) {
            saveLocalNotification(
              user.uid,
              {
                id: `sub_${row.id}_${row.status}`,
                title: row.status === 'approved' ? 'টাস্ক অ্যাপ্রুভড! 🏆' : 'টাস্ক রিজেক্টেড ⚠️',
                message:
                  row.status === 'approved'
                    ? 'আপনার সাবমিট করা কাজের প্রমাণপত্র সফলভাবে অ্যাপ্রুভ করা হয়েছে এবং আয় আপনার আর্নিং ব্যালেন্সে যোগ হয়েছে!'
                    : `আপনার সাবমিট করা কাজটির প্রমাণপত্র গ্রহণযোগ্য হয়নি।${row.rejection_reason ? ` কারণ: ${row.rejection_reason}` : ''}`,
                type: 'submission',
                url: '/submitted-jobs',
              },
              { skipRemoteSync: true }
            );
          }
          snap.subs[row.id] = row.status;
        }
      }

      // 2. Deposit status changes
      if (!depsRes.error && Array.isArray(depsRes.data)) {
        for (const row of depsRes.data) {
          const prevStatus = snap.deps[row.id];
          const isTerminal = row.status === 'approved' || row.status === 'rejected';
          const createdTs = row.created_at ? new Date(row.created_at).getTime() : 0;
          const shouldNotify =
            isTerminal &&
            ((prevStatus && prevStatus !== row.status) ||
              (!prevStatus && (!isFirstSeed || (!Number.isNaN(createdTs) && createdTs >= recentWindow))));

          if (shouldNotify) {
            const amt = Number(row.amount || 0);
            saveLocalNotification(
              user.uid,
              {
                id: `dep_${row.id}_${row.status}`,
                title: row.status === 'approved' ? 'ডিপোজিট অ্যাপ্রুভড! 🎉' : 'ডিপোজিট রিকোয়েস্ট রিজেক্টেড ❌',
                message:
                  row.status === 'approved'
                    ? `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) ডিপোজিট সফলভাবে অ্যাপ্রুভ হয়েছে ওয়ালেটে জমা হয়েছে।`
                    : `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) ডিপোজিট রিকোয়েস্টটি প্রত্যাখান করা হয়েছে।`,
                type: 'deposit',
                url: '/deposit',
              },
              { skipRemoteSync: true }
            );
          }
          snap.deps[row.id] = row.status;
        }
      }

      // 3. Withdrawal status changes
      if (!wdsRes.error && Array.isArray(wdsRes.data)) {
        for (const row of wdsRes.data) {
          const prevStatus = snap.wds[row.id];
          const isTerminal = row.status === 'approved' || row.status === 'rejected';
          const createdTs = row.created_at ? new Date(row.created_at).getTime() : 0;
          const shouldNotify =
            isTerminal &&
            ((prevStatus && prevStatus !== row.status) ||
              (!prevStatus && (!isFirstSeed || (!Number.isNaN(createdTs) && createdTs >= recentWindow))));

          if (shouldNotify) {
            const amt = Number(row.amount || 0);
            saveLocalNotification(
              user.uid,
              {
                id: `wd_${row.id}_${row.status}`,
                title: row.status === 'approved' ? 'উইথড্র সফল হয়েছে! 💸' : 'উইথড্র রিজেক্টেড ও রিফান্ডেড ❌',
                message:
                  row.status === 'approved'
                    ? `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) উত্তোলন রিকোয়েস্ট সফলভাবে সম্পন্ন হয়েছে।`
                    : `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) উইথড্র রিকোয়েস্ট রিজেক্ট করা হয়েছে এবং টাকা আপনার আর্নিং ব্যালেন্সে ফেরত দেওয়া হয়েছে।`,
                type: 'withdrawal',
                url: '/withdraw',
              },
              { skipRemoteSync: true }
            );
          }
          snap.wds[row.id] = row.status;
        }
      }

      // 4. Employer owned jobs status + incoming worker proofs
      if (!jobsRes.error && Array.isArray(jobsRes.data)) {
        const ownedJobMap = new Map<string, string>();
        for (const row of jobsRes.data) {
          ownedJobMap.set(row.id, row.title || 'Job');
          const prevStatus = snap.jobs[row.id];
          const isTerminal = row.status === 'active' || row.status === 'rejected';
          if (isTerminal && prevStatus && prevStatus !== row.status) {
            saveLocalNotification(
              user.uid,
              {
                id: `job_${row.id}_${row.status}`,
                title: row.status === 'active' ? 'জব ক্যাম্পেইন লাইভ! 🚀' : 'জব পোস্ট বাতিল ও রিফান্ড ⚠️',
                message:
                  row.status === 'active'
                    ? `আপনার পোস্ট করা নতুন মিশন "${row.title || 'Job'}" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং লাইভ করা হয়েছে।`
                    : `আপনার পোস্ট করা মিশন "${row.title || 'Job'}" বাতিল করা হয়েছে।${row.rejection_reason ? ` কারণ: ${row.rejection_reason}` : ''}`,
                type: 'announcement',
                url: '/my-jobs',
              },
              { skipRemoteSync: true }
            );
          }
          snap.jobs[row.id] = row.status;
        }

        const ownedIds = Array.from(ownedJobMap.keys());
        if (ownedIds.length > 0) {
          const { data: incomingSubs } = await supabase
            .from('submissions')
            .select('id, job_id, worker_id, status, created_at')
            .in('job_id', ownedIds.slice(0, 20))
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20);

          if (Array.isArray(incomingSubs)) {
            const seenEmpSubs = new Set(snap.empSubs || []);
            for (const sub of incomingSubs) {
              if (!sub?.id || sub.worker_id === user.uid) continue;
              const createdTs = sub.created_at ? new Date(sub.created_at).getTime() : 0;
              if (!seenEmpSubs.has(sub.id) && (!isFirstSeed || (!Number.isNaN(createdTs) && createdTs >= recentWindow))) {
                const jobTitle = ownedJobMap.get(sub.job_id) || 'Micro-Job';
                saveLocalNotification(
                  user.uid,
                  {
                    id: `emp_sub_${sub.id}`,
                    title: 'নতুন টাস্ক সাবমিশন! 📋',
                    message: `আপনার জব "${jobTitle}"-এ একজন কর্মী কাজের প্রমাণপত্র জমা দিয়েছেন। My Jobs থেকে পর্যালোচনা করুন।`,
                    type: 'submission',
                    url: '/my-jobs',
                  },
                  { skipRemoteSync: true }
                );
              }
              seenEmpSubs.add(sub.id);
            }
            snap.empSubs = Array.from(seenEmpSubs).slice(-200);
          }
        }
      }

      // 5. Ads status changes
      if (!adsRes.error && Array.isArray(adsRes.data)) {
        for (const row of adsRes.data) {
          const prevStatus = snap.ads[row.id];
          const isTerminal = row.status === 'active' || row.status === 'expired' || row.status === 'rejected';
          if (isTerminal && prevStatus && prevStatus !== row.status) {
            saveLocalNotification(
              user.uid,
              {
                id: `ad_${row.id}_${row.status}`,
                title: row.status === 'active' ? 'বিজ্ঞাপন অনুমোদন সফল! 📢' : 'বিজ্ঞাপন রিজেক্টেড ও রিফান্ডেড ⚠️',
                message:
                  row.status === 'active'
                    ? `আপনার স্পন্সরকৃত অ্যাড ক্যাম্পেইন "${row.title || 'Ad'}" সক্রিয় ও লাইভ করা হয়েছে।`
                    : `আপনার স্পন্সরকৃত অ্যাড ক্যাম্পেইন "${row.title || 'Ad'}" বাতিল করা হয়েছে এবং ব্যালেন্স রিফান্ড করা হয়েছে।`,
                type: 'announcement',
                url: '/posted-ads',
              },
              { skipRemoteSync: true }
            );
          }
          snap.ads[row.id] = row.status;
        }
      }

      localStorage.setItem(snapKey, JSON.stringify(snap));
    } catch {}
  };

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();

      const runFullSync = () => {
        fetchUserData();
        void syncRemoteUserNotifications(user.uid);
        void syncLatestBroadcast();
        void syncNewLiveJobs();
        void syncUserStatusNotifications();
      };

      const channel = supabase
        .channel(`layout-user-${user.uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${user.uid}` }, () => {
          fetchUserData();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `worker_id=eq.${user.uid}` }, (payload: any) => {
          fetchUserData();
          const row = payload?.new;
          if (row && (row.status === 'approved' || row.status === 'rejected')) {
            const recentEnough = !row.reviewed_at || (Date.now() - new Date(row.reviewed_at).getTime() < 24 * 60 * 60 * 1000);
            if (recentEnough) {
              saveLocalNotification(user.uid, {
                id: `sub_${row.id}_${row.status}`,
                title: row.status === 'approved' ? 'টাস্ক অ্যাপ্রুভড! 🏆' : 'টাস্ক রিজেক্টেড ⚠️',
                message: row.status === 'approved'
                  ? 'আপনার সাবমিট করা কাজের প্রমাণপত্র সফলভাবে অ্যাপ্রুভ করা হয়েছে এবং আয় আপনার আর্নিং ব্যালেন্সে যোগ হয়েছে!'
                  : `আপনার সাবমিট করা কাজটির প্রমাণপত্র গ্রহণযোগ্য হয়নি।${row.rejection_reason ? ` কারণ: ${row.rejection_reason}` : ''}`,
                type: 'submission',
                url: '/submitted-jobs',
              }, { skipRemoteSync: true });
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${user.uid}` }, (payload: any) => {
          fetchUserData();
          const row = payload?.new;
          if (row && (row.status === 'approved' || row.status === 'rejected')) {
            const amt = Number(row.amount || 0);
            saveLocalNotification(user.uid, {
              id: `dep_${row.id}_${row.status}`,
              title: row.status === 'approved' ? 'ডিপোজিট অ্যাপ্রুভড! 🎉' : 'ডিপোজিট রিকোয়েস্ট রিজেক্টেড ❌',
              message: row.status === 'approved'
                ? `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) ডিপোজিট সফলভাবে অ্যাপ্রুভ হয়েছে ওয়ালেটে জমা হয়েছে।`
                : `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) ডিপোজিট রিকোয়েস্টটি প্রত্যাখান করা হয়েছে।`,
              type: 'deposit',
              url: '/deposit',
            }, { skipRemoteSync: true });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'withdraw_requests', filter: `user_id=eq.${user.uid}` }, (payload: any) => {
          fetchUserData();
          const row = payload?.new;
          if (row && (row.status === 'approved' || row.status === 'rejected')) {
            const amt = Number(row.amount || 0);
            saveLocalNotification(user.uid, {
              id: `wd_${row.id}_${row.status}`,
              title: row.status === 'approved' ? 'উইথড্র সফল হয়েছে! 💸' : 'উইথড্র রিজেক্টেড ও রিফান্ডেড ❌',
              message: row.status === 'approved'
                ? `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) উত্তোলন রিকোয়েস্ট সফলভাবে সম্পন্ন হয়েছে।`
                : `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) উইথড্র রিকোয়েস্ট রিজেক্ট করা হয়েছে এবং টাকা আপনার আর্নিং ব্যালেন্সে ফেরত দেওয়া হয়েছে।`,
              type: 'withdrawal',
              url: '/withdraw',
            }, { skipRemoteSync: true });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          const rowOwnerId = row.owner_id || row.employer_id;

          if (rowOwnerId === user.uid) {
            fetchUserData();
            if (row.status === 'active' || row.status === 'rejected') {
              saveLocalNotification(user.uid, {
                id: `job_${row.id}_${row.status}`,
                title: row.status === 'active' ? 'জব ক্যাম্পেইন লাইভ! 🚀' : 'জব পোস্ট বাতিল ও রিফান্ড ⚠️',
                message: row.status === 'active'
                  ? `আপনার পোস্ট করা নতুন মিশন "${row.title || 'Job'}" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং লাইভ করা হয়েছে।`
                  : `আপনার পোস্ট করা মিশন "${row.title || 'Job'}" বাতিল করা হয়েছে।${row.rejection_reason ? ` কারণ: ${row.rejection_reason}` : ''}`,
                type: 'announcement',
                url: '/my-jobs',
              }, { skipRemoteSync: true });
            }
          }

          if (row.status === 'active') {
            notifyLiveJobForUser({
              id: row.id,
              title: row.title,
              pricePerTask: row.price_per_task ?? row.pricePerTask,
              totalSlots: row.total_slots ?? row.totalSlots,
              ownerId: rowOwnerId,
              activatedAt: new Date().toISOString(),
            });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ads', filter: `owner_id=eq.${user.uid}` }, (payload: any) => {
          fetchUserData();
          const row = payload?.new;
          if (row && (row.status === 'active' || row.status === 'expired' || row.status === 'rejected')) {
            saveLocalNotification(user.uid, {
              id: `ad_${row.id}_${row.status}`,
              title: row.status === 'active' ? 'বিজ্ঞাপন অনুমোদন সফল! 📢' : 'বিজ্ঞাপন রিজেক্টেড ও রিফান্ডেড ⚠️',
              message: row.status === 'active'
                ? `আপনার স্পন্সরকৃত অ্যাড ক্যাম্পেইন "${row.title || 'Ad'}" সক্রিয় ও লাইভ করা হয়েছে।`
                : `আপনার স্পন্সরকৃত অ্যাড ক্যাম্পেইন "${row.title || 'Ad'}" বাতিল করা হয়েছে এবং ব্যালেন্স রিফান্ড করা হয়েছে।`,
              type: 'announcement',
              url: '/posted-ads',
            }, { skipRemoteSync: true });
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload: any) => {
          const changedKey = payload?.new?.key;
          if (changedKey === 'latest_broadcast' || changedKey === 'admin_broadcasts' || changedKey === 'deleted_broadcast_ids') {
            void syncLatestBroadcast();
          } else if (changedKey === `user_notifs_${user.uid}` || changedKey === `user_deleted_notifs_${user.uid}`) {
            void syncRemoteUserNotifications(user.uid);
          } else if (changedKey === 'latest_live_job') {
            void syncNewLiveJobs();
          } else if (changedKey === 'platform_controls') {
            void fetchNotice();
          }
        })
        .subscribe();

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          runFullSync();
        }
      };

      const handleJobWentLive = (e: any) => {
        if (e?.detail?.id) {
          notifyLiveJobForUser(e.detail);
        } else {
          void syncNewLiveJobs();
        }
      };

      const handleStorageChange = (e: StorageEvent) => {
        if (!e.key) return;
        if (e.key === `iz_user_notifications_${user.uid}`) {
          fetchUserNotifications();
          void flushPendingDeviceNotifications(user.uid);
        } else if (e.key === 'iz_latest_broadcast' || e.key === 'iz_admin_broadcasts' || e.key === 'iz_deleted_broadcast_ids') {
          void syncLatestBroadcast();
        } else if (e.key === 'iz_latest_live_job') {
          void syncNewLiveJobs();
        } else if (e.key === 'iz_platform_controls') {
          void fetchNotice();
        }
      };

      const pollInterval = window.setInterval(runFullSync, 12000);

      window.addEventListener('submission_updated', runFullSync);
      window.addEventListener('iz_users_updated', runFullSync);
      window.addEventListener('iz_jobs_updated', syncNewLiveJobs);
      window.addEventListener('iz_job_went_live', handleJobWentLive);
      window.addEventListener('online', runFullSync);
      window.addEventListener('focus', runFullSync);
      window.addEventListener('storage', handleStorageChange);
      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        window.clearInterval(pollInterval);
        supabase.removeChannel(channel);
        window.removeEventListener('submission_updated', runFullSync);
        window.removeEventListener('iz_users_updated', runFullSync);
        window.removeEventListener('iz_jobs_updated', syncNewLiveJobs);
        window.removeEventListener('iz_job_went_live', handleJobWentLive);
        window.removeEventListener('online', runFullSync);
        window.removeEventListener('focus', runFullSync);
        window.removeEventListener('storage', handleStorageChange);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [user?.uid]);

  const [bannerNotices, setBannerNotices] = useState<AdminBannerNotice[]>([]);
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() => getNotificationPermissionState());
  const [isPermissionBannerDismissed, setIsPermissionBannerDismissed] = useState(false);

  useEffect(() => {
    const state = getNotificationPermissionState();
    setNotifPermission(state);
    if (state === 'granted') {
      void registerNotificationServiceWorker().then(() => {
        if (user?.uid) {
          void flushPendingDeviceNotifications(user.uid);
        }
      });
    }
  }, [user?.uid]);

  const handleEnableNativeNotifications = async () => {
    const perm = await requestNativeNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      const title = 'ফোনের নোটিফিকেশন সচল হয়েছে! 🔔';
      const message = 'আপনার ফোনে এখন সকল নতুন জব, টাস্ক এপ্রুভ/রিজেক্ট, ডিপোজিট, উইথড্র ও নোটিশ এর ইনস্ট্যান্ট নোটিফিকেশন চলে আসবে।';
      const result = await showDeviceNotification(title, message, { tag: 'welcome_push_enabled', url: '/notifications' });
      if (user?.uid) {
        saveLocalNotification(user.uid, {
          id: `welcome_push_${Date.now()}`,
          title,
          message,
          type: 'announcement',
        }, { skipRemoteSync: true, skipNative: true, markNativeDone: true });
        void flushPendingDeviceNotifications(user.uid);
      }
      import('react-hot-toast').then(({ default: toast }) => {
        if (result.shown) {
          toast.success('ফোনের সিস্টেম নোটিফিকেশন সফলভাবে চালু হয়েছে! 🎉');
        } else {
          toast.error(result.reason || 'পারমিশন চালু হয়েছে, তবে ফোনের প্রিভিউ ফ্রেম থেকে পপআপ ব্লক হতে পারে।');
        }
      });
    } else if (perm === 'denied') {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error('নোটিফিকেশন পারমিশন ব্লক করা আছে। ব্রাউজারের সাইট সেটিংস থেকে Allow করুন।');
      });
    } else if (perm === 'unsupported') {
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error('এই ব্রাউজারে ফোনের পুশ নোটিফিকেশন সাপোর্ট করে না। ফোনের Chrome ব্রাউজার ব্যবহার করুন।');
      });
    }
  };

  const fetchUserNotifications = () => {
    if (!user?.uid) return;
    const list = getLocalNotifications(user.uid);
    setNotifications(list);
  };

  const applyPlatformControlsToBanners = (merged: any) => {
    if (Array.isArray(merged?.user_notices)) {
      setBannerNotices(merged.user_notices.filter((n: AdminBannerNotice) => n && n.enabled && n.text?.trim()));
    } else if (merged?.user_notice_enabled && merged?.user_notice_text) {
      setBannerNotices([
        {
          id: 'notice_legacy_1',
          type: merged.user_notice_type || 'info',
          text: merged.user_notice_text,
          enabled: true,
          created_at: merged.updated_at || new Date().toISOString(),
        },
      ]);
    } else {
      setBannerNotices([]);
    }
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
      applyPlatformControlsToBanners(merged);
    } catch {}
  };

  const syncLatestBroadcast = async () => {
    if (!user?.uid) return;
    try {
      let broadcastsList: AdminBroadcastMessage[] = [];
      let latestBc: any = null;
      let deletedIds = new Set<string>(getDeletedBroadcastIdsLocal());

      const { data: rows, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['admin_broadcasts', 'latest_broadcast', 'deleted_broadcast_ids']);

      if (!error && Array.isArray(rows)) {
        for (const row of rows) {
          const parsed = typeof row.value === 'string' ? (() => { try { return JSON.parse(row.value); } catch { return null; } })() : row.value;
          if (row.key === 'deleted_broadcast_ids' && Array.isArray(parsed)) {
            const cleanDeleted = parsed.map(String);
            saveDeletedBroadcastIdsLocal(cleanDeleted);
            deletedIds = new Set(cleanDeleted);
          } else if (row.key === 'admin_broadcasts' && Array.isArray(parsed)) {
            broadcastsList = parsed;
          } else if (row.key === 'latest_broadcast' && parsed?.text) {
            latestBc = parsed;
          }
        }
      } else {
        try {
          const localListStr = localStorage.getItem('iz_admin_broadcasts');
          if (localListStr) {
            const parsed = JSON.parse(localListStr);
            if (Array.isArray(parsed)) broadcastsList = parsed;
          }
        } catch {}
        try {
          const localStr = localStorage.getItem('iz_latest_broadcast');
          if (localStr) latestBc = JSON.parse(localStr);
        } catch {}
      }

      // Remove any broadcasts deleted by Admin from user's local notification list
      const allDeletedNotifIds: string[] = [];
      deletedIds.forEach((rawId) => {
        allDeletedNotifIds.push(rawId);
        if (!rawId.startsWith('bc_')) allDeletedNotifIds.push(`bc_${rawId}`);
      });
      if (allDeletedNotifIds.length > 0) {
        removeUserNotificationsByIds(user.uid, allDeletedNotifIds);
      }

      if (broadcastsList.length === 0 && latestBc && latestBc.text) {
        broadcastsList = [latestBc];
      }

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      // Deliver active non-deleted broadcasts oldest-first so newest stays at top
      const ordered = [...broadcastsList].reverse();
      for (const bc of ordered) {
        if (!bc || !bc.text) continue;
        const rawBcId = String(bc.id || 'default_bc');
        const normalizedId = rawBcId.startsWith('bc_') ? rawBcId : `bc_${rawBcId}`;
        if (deletedIds.has(rawBcId) || deletedIds.has(normalizedId)) continue;

        const bcTs = bc.created_at ? new Date(bc.created_at).getTime() : Date.now();
        if (!Number.isNaN(bcTs) && bcTs < sevenDaysAgo) continue;

        const receivedKey = `iz_user_received_bc_${user.uid}_${normalizedId}`;
        if (!localStorage.getItem(receivedKey)) {
          localStorage.setItem(receivedKey, 'true');
          saveLocalNotification(user.uid, {
            id: normalizedId,
            title: bc.title || '📢 অ্যাডমিন অফিশিয়াল ব্রডকাস্ট নোটিশ',
            message: bc.text,
            type: 'broadcast',
            created_at: bc.created_at || new Date().toISOString(),
          }, { skipRemoteSync: true });
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotice();
    fetchUserNotifications();
    syncLatestBroadcast();
    if (user?.uid) {
      void syncRemoteUserNotifications(user.uid);
      void syncNewLiveJobs();
      void syncUserStatusNotifications();
    }

    const handleControlsUpdated = (e: any) => {
      if (e.detail) {
        applyPlatformControlsToBanners(e.detail);
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
        const rawBcId = String(e.detail.id || `bc_${Date.now()}`);
        const normalizedId = rawBcId.startsWith('bc_') ? rawBcId : `bc_${rawBcId}`;
        if (user?.uid) {
          localStorage.setItem(`iz_user_received_bc_${user.uid}_${normalizedId}`, 'true');
          saveLocalNotification(user.uid, {
            id: normalizedId,
            title: e.detail.title || '📢 অ্যাডমিন অফিশিয়াল ব্রডকাস্ট নোটিশ',
            message: e.detail.text,
            type: 'broadcast',
            created_at: e.detail.created_at || new Date().toISOString(),
          }, { skipRemoteSync: true });
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

    const handleBroadcastDeleted = (e: any) => {
      if (!user?.uid) return;
      const ids: string[] = [];
      if (e?.detail?.id) ids.push(String(e.detail.id));
      if (Array.isArray(e?.detail?.deletedIds)) {
        e.detail.deletedIds.forEach((x: any) => ids.push(String(x)));
      }
      const normalizedIds = ids.flatMap((id) => (id.startsWith('bc_') ? [id] : [id, `bc_${id}`]));
      if (normalizedIds.length > 0) {
        removeUserNotificationsByIds(user.uid, normalizedIds);
      }
    };

    window.addEventListener('iz_platform_controls_updated', handleControlsUpdated);
    window.addEventListener('iz_broadcast_notification', handleBroadcastNotification);
    window.addEventListener('iz_broadcast_deleted', handleBroadcastDeleted);
    window.addEventListener('iz_user_notifications_updated', handleUserNotifsUpdated);

    return () => {
      window.removeEventListener('iz_platform_controls_updated', handleControlsUpdated);
      window.removeEventListener('iz_broadcast_notification', handleBroadcastNotification);
      window.removeEventListener('iz_broadcast_deleted', handleBroadcastDeleted);
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
          <Link to="/jobs" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <BrandLogo size="md" />
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
          {/* Global Admin Announcement Notice Banners (Mandatory Notices) */}
          {bannerNotices.length > 0 && (
            <div className="space-y-3">
              {bannerNotices.map((bn) => (
                <div
                  key={bn.id}
                  className={`relative rounded-2xl p-4 sm:p-5 shadow-lg border transition-all flex items-start justify-between gap-3 ${
                    bn.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                      : bn.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                      : bn.type === 'promo'
                      ? 'bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-950/90 border-purple-500/40 text-white shadow-purple-950/50'
                      : 'bg-purple-500/10 border-purple-500/30 text-purple-950 dark:text-purple-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      bn.type === 'promo'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-purple-600/10 dark:bg-amber-400/20 text-purple-600 dark:text-amber-400'
                    }`}>
                      {bn.type === 'promo' ? (
                        <Sparkles className="w-5 h-5 fill-current" />
                      ) : bn.type === 'warning' ? (
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
                        {bn.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  );
}
