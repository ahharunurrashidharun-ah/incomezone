import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createClient, type SupabaseClient, type User as SupabaseUser } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.NODE_ENV === 'production' ? (Number(process.env.PORT) || 3000) : 3000;

// Admin emails mirrored from adminConfig for strict server-side RBAC on broadcast routes
const ADMIN_EMAILS = new Set([
  'incomezone2729@gmail.com',
  'ahharunurrashidharun@gmail.com',
]);

interface StoredPushSub {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 1. Supabase Server Client & VAPID Web Push Configuration
// ---------------------------------------------------------------------------
const supabaseUrl = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).trim();

const supabaseServerKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  ''
).trim();

const isSupabaseReady = supabaseUrl.startsWith('https://') && supabaseServerKey.length > 20;
const supabaseServer: SupabaseClient | null = isSupabaseReady
  ? createClient(supabaseUrl, supabaseServerKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const envPublicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
const envPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
const vapidSubject = (process.env.VAPID_SUBJECT || 'mailto:alerts@incomezone.com').trim();

const vapidKeys =
  envPublicKey && envPrivateKey
    ? { publicKey: envPublicKey, privateKey: envPrivateKey }
    : webpush.generateVAPIDKeys();

webpush.setVapidDetails(vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);

// ---------------------------------------------------------------------------
// 2. Push Endpoint Security & Subscription Store
// ---------------------------------------------------------------------------
const ALLOWED_PUSH_HOST_SUFFIXES = [
  '.googleapis.com',
  '.push.services.mozilla.com',
  '.push.apple.com',
  '.notify.windows.com',
  '.push.samsungosp.com',
];

const ALLOWED_EXACT_PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'updates-autopush.stage.mozaws.net',
]);

function isValidPushEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    if (ALLOWED_EXACT_PUSH_HOSTS.has(host)) return true;
    return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

function validatePushSubscription(sub: any): StoredPushSub | null {
  if (!sub || typeof sub !== 'object') return null;
  if (!isValidPushEndpoint(sub.endpoint)) return null;
  const p256dh = typeof sub.keys?.p256dh === 'string' ? sub.keys.p256dh.trim() : '';
  const auth = typeof sub.keys?.auth === 'string' ? sub.keys.auth.trim() : '';
  if (!p256dh || !auth || p256dh.length > 512 || auth.length > 512) return null;
  return {
    endpoint: sub.endpoint,
    expirationTime: typeof sub.expirationTime === 'number' ? sub.expirationTime : null,
    keys: { p256dh, auth },
    updatedAt: new Date().toISOString(),
  };
}

const subscriptionsByUser = new Map<string, StoredPushSub[]>();
const sentPushTags = new Set<string>();
const MAX_TRACKED_TAGS = 3000;

function markTagSent(tag: string) {
  if (sentPushTags.size >= MAX_TRACKED_TAGS) {
    const oldest = sentPushTags.values().next().value;
    if (oldest) sentPushTags.delete(oldest);
  }
  sentPushTags.add(tag);
}

async function persistUserSubscriptions(userId: string, subs: StoredPushSub[]) {
  if (!supabaseServer) return;
  try {
    await supabaseServer.from('settings').upsert(
      {
        key: `push_subs_${userId}`,
        value: subs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    const allUserIds = Array.from(subscriptionsByUser.keys()).filter(
      (uid) => (subscriptionsByUser.get(uid)?.length || 0) > 0
    );
    await supabaseServer.from('settings').upsert(
      {
        key: 'push_subs_users',
        value: allUserIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch {}
}

async function loadAllPushSubscriptions() {
  if (!supabaseServer) return;
  try {
    const { data: idxRow } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', 'push_subs_users')
      .maybeSingle();

    let userIds: string[] = [];
    if (idxRow?.value) {
      const parsed = typeof idxRow.value === 'string' ? JSON.parse(idxRow.value) : idxRow.value;
      if (Array.isArray(parsed)) userIds = parsed.map(String).filter(Boolean);
    }
    if (!userIds.length) return;

    const keys = userIds.map((uid) => `push_subs_${uid}`);
    const { data: rows } = await supabaseServer
      .from('settings')
      .select('key, value')
      .in('key', keys);

    if (Array.isArray(rows)) {
      for (const row of rows) {
        const uid = String(row.key || '').replace(/^push_subs_/, '');
        if (!uid) continue;
        const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (Array.isArray(parsed)) {
          const valid = parsed.map(validatePushSubscription).filter(Boolean) as StoredPushSub[];
          if (valid.length > 0) {
            subscriptionsByUser.set(uid, valid);
          }
        }
      }
    }
  } catch {}
}

async function refreshUserSubscriptionsFromDb(userId: string): Promise<StoredPushSub[]> {
  const existing = subscriptionsByUser.get(userId) || [];
  if (existing.length > 0 || !supabaseServer) return existing;
  try {
    const { data } = await supabaseServer
      .from('settings')
      .select('value')
      .eq('key', `push_subs_${userId}`)
      .maybeSingle();
    const parsed = data?.value
      ? typeof data.value === 'string'
        ? JSON.parse(data.value)
        : data.value
      : [];
    if (Array.isArray(parsed)) {
      const valid = parsed.map(validatePushSubscription).filter(Boolean) as StoredPushSub[];
      if (valid.length > 0) {
        subscriptionsByUser.set(userId, valid);
      }
      return valid;
    }
  } catch {}
  return existing;
}

async function sendWebPushToUser(
  userId: string,
  payload: { title: string; message: string; url?: string; tag?: string; silent?: boolean },
  options?: { allowDuplicateTag?: boolean }
): Promise<{ delivered: number; attempted: number }> {
  if (!userId) return { delivered: 0, attempted: 0 };
  const tag = payload.tag || `iz_push_${Date.now()}`;
  const dedupKey = `${userId}:${tag}`;
  if (!options?.allowDuplicateTag && sentPushTags.has(dedupKey)) {
    return { delivered: 0, attempted: 0 };
  }
  markTagSent(dedupKey);

  const subs = await refreshUserSubscriptionsFromDb(userId);
  if (!subs.length) return { delivered: 0, attempted: 0 };

  const bodyStr = JSON.stringify({
    title: String(payload.title || 'IncomeZone').slice(0, 140),
    message: String(payload.message || '').slice(0, 400),
    url: payload.url || '/notifications',
    tag,
    silent: Boolean(payload.silent),
  });

  let delivered = 0;
  const expiredEndpoints = new Set<string>();

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime ?? null,
            keys: sub.keys,
          },
          bodyStr,
          { TTL: 86400, urgency: 'high' }
        );
        delivered += 1;
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.add(sub.endpoint);
        }
      }
    })
  );

  if (expiredEndpoints.size > 0) {
    const remaining = subs.filter((s) => !expiredEndpoints.has(s.endpoint));
    if (remaining.length > 0) {
      subscriptionsByUser.set(userId, remaining);
    } else {
      subscriptionsByUser.delete(userId);
    }
    void persistUserSubscriptions(userId, remaining);
  }

  return { delivered, attempted: subs.length };
}

async function sendWebPushBroadcast(
  payload: { title: string; message: string; url?: string; tag?: string; excludeUserId?: string }
): Promise<{ usersNotified: number; devicesDelivered: number }> {
  await loadAllPushSubscriptionsIfEmpty();
  const userIds = Array.from(subscriptionsByUser.keys()).filter(
    (uid) => !payload.excludeUserId || uid !== payload.excludeUserId
  );

  let usersNotified = 0;
  let devicesDelivered = 0;
  for (const uid of userIds) {
    const res = await sendWebPushToUser(uid, {
      title: payload.title,
      message: payload.message,
      url: payload.url,
      tag: payload.tag,
    });
    if (res.delivered > 0) {
      usersNotified += 1;
      devicesDelivered += res.delivered;
    }
  }
  return { usersNotified, devicesDelivered };
}

let initialSubsLoaded = false;
async function loadAllPushSubscriptionsIfEmpty() {
  if (initialSubsLoaded) return;
  initialSubsLoaded = true;
  await loadAllPushSubscriptions();
}

// ---------------------------------------------------------------------------
// 3. Auth Verification Helpers for /api/push/*
// ---------------------------------------------------------------------------
async function getCallerAuthUser(req: Request): Promise<SupabaseUser | null> {
  if (!supabaseServer) return null;
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function isAdminCaller(authUser: SupabaseUser | null): Promise<boolean> {
  if (!authUser) return false;
  const email = String(authUser.email || '').toLowerCase().trim();
  if (ADMIN_EMAILS.has(email)) return true;
  if (!supabaseServer) return false;
  try {
    const { data } = await supabaseServer
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .maybeSingle();
    return String(data?.role || '').toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 4. Server-Side Background Supabase Notification Watcher (Works When Tabs Closed)
// ---------------------------------------------------------------------------
const watcherState = {
  seeded: false,
  subs: new Map<string, string>(),
  seenPendingSubs: new Set<string>(),
  deps: new Map<string, string>(),
  wds: new Map<string, string>(),
  jobs: new Map<string, string>(),
  ads: new Map<string, string>(),
  lastBroadcastId: '' as string,
  lastLiveJobId: '' as string,
  seenUserNotifIds: new Map<string, Set<string>>(),
};

async function pollAndPushNotifications() {
  if (!supabaseServer) return;
  await loadAllPushSubscriptionsIfEmpty();
  if (subscriptionsByUser.size === 0) return;

  try {
    const isSeed = !watcherState.seeded;
    const recentWindow = Date.now() - 2 * 60 * 1000;

    const [subsRes, depsRes, wdsRes, jobsRes, adsRes, settingsRes] = await Promise.all([
      supabaseServer
        .from('submissions')
        .select('id, job_id, worker_id, status, rejection_reason, reviewed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      supabaseServer
        .from('deposit_requests')
        .select('id, user_id, amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseServer
        .from('withdraw_requests')
        .select('id, user_id, amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseServer
        .from('jobs')
        .select('id, owner_id, employer_id, title, price_per_task, total_slots, status, rejection_reason, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      supabaseServer
        .from('ads')
        .select('id, owner_id, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseServer
        .from('settings')
        .select('key, value')
        .in('key', ['latest_broadcast', 'latest_live_job', 'deleted_broadcast_ids']),
    ]);

    const jobMetaMap = new Map<string, { title: string; ownerId: string }>();

    // Jobs (employer approval + broadcast new live jobs to all users)
    if (!jobsRes.error && Array.isArray(jobsRes.data)) {
      for (const job of jobsRes.data) {
        const ownerId = job.owner_id || job.employer_id || '';
        jobMetaMap.set(job.id, { title: job.title || 'Micro-Job', ownerId });
        const prev = watcherState.jobs.get(job.id);
        const createdTs = job.created_at ? new Date(job.created_at).getTime() : 0;

        if (!isSeed && prev && prev !== job.status) {
          if (job.status === 'active') {
            if (ownerId) {
              void sendWebPushToUser(ownerId, {
                tag: `job_${job.id}_active`,
                title: 'জব ক্যাম্পেইন লাইভ! 🚀',
                message: `আপনার পোস্ট করা মিশন "${job.title || 'Job'}" অনুমোদিত হয়েছে এবং লাইভ করা হয়েছে।`,
                url: '/my-jobs',
              });
            }
            const price = Number(job.price_per_task || 0);
            const slots = Number(job.total_slots || 0);
            void sendWebPushBroadcast({
              tag: `live_job_${job.id}`,
              title: 'নতুন জব লাইভ হয়েছে! 💼',
              message: `"${job.title || 'New Micro-Job'}" — প্রতি টাস্ক $${price.toFixed(2)} (৳${Math.round(price * 100)})${slots > 0 ? ` · ${slots}টি স্লট` : ''}। এখনই কাজ শুরু করুন!`,
              url: '/jobs',
              excludeUserId: ownerId || undefined,
            });
          } else if (job.status === 'rejected' && ownerId) {
            void sendWebPushToUser(ownerId, {
              tag: `job_${job.id}_rejected`,
              title: 'জব পোস্ট বাতিল ও রিফান্ড ⚠️',
              message: `আপনার মিশন "${job.title || 'Job'}" বাতিল করা হয়েছে।${job.rejection_reason ? ` কারণ: ${job.rejection_reason}` : ''}`,
              url: '/my-jobs',
            });
          }
        } else if (isSeed && job.status === 'active' && !Number.isNaN(createdTs) && createdTs >= recentWindow) {
          markTagSent(`live_job_${job.id}`);
        }
        watcherState.jobs.set(job.id, job.status);
      }
    }

    // Submissions (worker approval/rejection + employer incoming proof)
    if (!subsRes.error && Array.isArray(subsRes.data)) {
      for (const sub of subsRes.data) {
        const prev = watcherState.subs.get(sub.id);
        if (!isSeed && prev && prev !== sub.status && (sub.status === 'approved' || sub.status === 'rejected')) {
          if (sub.worker_id) {
            void sendWebPushToUser(sub.worker_id, {
              tag: `sub_${sub.id}_${sub.status}`,
              title: sub.status === 'approved' ? 'টাস্ক অ্যাপ্রুভড! 🏆' : 'টাস্ক রিজেক্টেড ⚠️',
              message:
                sub.status === 'approved'
                  ? 'আপনার কাজের প্রমাণপত্র অ্যাপ্রুভ হয়েছে এবং আয় ব্যালেন্সে যোগ হয়েছে!'
                  : `আপনার জমা দেওয়া কাজটি গ্রহণযোগ্য হয়নি।${sub.rejection_reason ? ` কারণ: ${sub.rejection_reason}` : ''}`,
              url: '/submitted-jobs',
            });
          }
        }
        if (sub.status === 'pending' && !watcherState.seenPendingSubs.has(sub.id)) {
          watcherState.seenPendingSubs.add(sub.id);
          if (!isSeed) {
            const jobInfo = jobMetaMap.get(sub.job_id);
            if (jobInfo?.ownerId && jobInfo.ownerId !== sub.worker_id) {
              void sendWebPushToUser(jobInfo.ownerId, {
                tag: `emp_sub_${sub.id}`,
                title: 'নতুন টাস্ক সাবমিশন! 📋',
                message: `আপনার জব "${jobInfo.title}"-এ একজন কর্মী কাজের প্রমাণ জমা দিয়েছেন।`,
                url: '/my-jobs',
              });
            }
          }
        }
        watcherState.subs.set(sub.id, sub.status);
      }
    }

    // Deposits
    if (!depsRes.error && Array.isArray(depsRes.data)) {
      for (const dep of depsRes.data) {
        const prev = watcherState.deps.get(dep.id);
        if (!isSeed && prev && prev !== dep.status && (dep.status === 'approved' || dep.status === 'rejected')) {
          const amt = Number(dep.amount || 0);
          if (dep.user_id) {
            void sendWebPushToUser(dep.user_id, {
              tag: `dep_${dep.id}_${dep.status}`,
              title: dep.status === 'approved' ? 'ডিপোজিট অ্যাপ্রুভড! 🎉' : 'ডিপোজিট রিজেক্টেড ❌',
              message:
                dep.status === 'approved'
                  ? `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) ডিপোজিট ওয়ালেটে জমা হয়েছে।`
                  : `আপনার $${amt.toFixed(2)} ডিপোজিট রিকোয়েস্ট প্রত্যাখ্যান করা হয়েছে।`,
              url: '/deposit',
            });
          }
        }
        watcherState.deps.set(dep.id, dep.status);
      }
    }

    // Withdrawals
    if (!wdsRes.error && Array.isArray(wdsRes.data)) {
      for (const wd of wdsRes.data) {
        const prev = watcherState.wds.get(wd.id);
        if (!isSeed && prev && prev !== wd.status && (wd.status === 'approved' || wd.status === 'rejected')) {
          const amt = Number(wd.amount || 0);
          if (wd.user_id) {
            void sendWebPushToUser(wd.user_id, {
              tag: `wd_${wd.id}_${wd.status}`,
              title: wd.status === 'approved' ? 'উইথড্র সফল হয়েছে! 💸' : 'উইথড্র রিজেক্টেড ও রিফান্ডেড ❌',
              message:
                wd.status === 'approved'
                  ? `আপনার $${amt.toFixed(2)} (৳${Math.round(amt * 100)}) উত্তোলন সম্পন্ন হয়েছে।`
                  : `আপনার $${amt.toFixed(2)} উইথড্র রিজেক্ট হয়েছে এবং ব্যালেন্স ফেরত দেওয়া হয়েছে।`,
              url: '/withdraw',
            });
          }
        }
        watcherState.wds.set(wd.id, wd.status);
      }
    }

    // Ads
    if (!adsRes.error && Array.isArray(adsRes.data)) {
      for (const ad of adsRes.data) {
        const prev = watcherState.ads.get(ad.id);
        if (!isSeed && prev && prev !== ad.status && (ad.status === 'active' || ad.status === 'rejected' || ad.status === 'expired')) {
          if (ad.owner_id) {
            void sendWebPushToUser(ad.owner_id, {
              tag: `ad_${ad.id}_${ad.status}`,
              title: ad.status === 'active' ? 'বিজ্ঞাপন অনুমোদন সফল! 📢' : 'বিজ্ঞাপন বাতিল ও রিফান্ডেড ⚠️',
              message:
                ad.status === 'active'
                  ? `আপনার অ্যাড ক্যাম্পেইন "${ad.title || 'Ad'}" লাইভ করা হয়েছে।`
                  : `আপনার অ্যাড ক্যাম্পেইন "${ad.title || 'Ad'}" বাতিল ও রিফান্ড করা হয়েছে।`,
              url: '/posted-ads',
            });
          }
        }
        watcherState.ads.set(ad.id, ad.status);
      }
    }

    // Global Broadcasts & Live Job Signal
    if (!settingsRes.error && Array.isArray(settingsRes.data)) {
      let deletedBcIds = new Set<string>();
      let latestBc: any = null;
      let latestJobSig: any = null;

      for (const row of settingsRes.data) {
        const parsed = typeof row.value === 'string' ? (() => { try { return JSON.parse(row.value); } catch { return null; } })() : row.value;
        if (row.key === 'deleted_broadcast_ids' && Array.isArray(parsed)) {
          deletedBcIds = new Set(parsed.map(String));
        } else if (row.key === 'latest_broadcast' && parsed?.text) {
          latestBc = parsed;
        } else if (row.key === 'latest_live_job' && parsed?.id) {
          latestJobSig = parsed;
        }
      }

      if (latestBc?.id) {
        const bcId = String(latestBc.id);
        const normBcId = bcId.startsWith('bc_') ? bcId : `bc_${bcId}`;
        if (!isSeed && bcId !== watcherState.lastBroadcastId && !deletedBcIds.has(bcId) && !deletedBcIds.has(normBcId)) {
          void sendWebPushBroadcast({
            tag: normBcId,
            title: latestBc.title || '📢 অ্যাডমিন অফিশিয়াল ব্রডকাস্ট নোটিশ',
            message: latestBc.text,
            url: '/notifications',
          });
        }
        watcherState.lastBroadcastId = bcId;
      }

      if (latestJobSig?.id) {
        const sigId = String(latestJobSig.id);
        if (!isSeed && sigId !== watcherState.lastLiveJobId) {
          const price = Number(latestJobSig.pricePerTask || 0);
          const slots = Number(latestJobSig.totalSlots || 0);
          void sendWebPushBroadcast({
            tag: `live_job_${sigId}`,
            title: 'নতুন জব লাইভ হয়েছে! 💼',
            message: `"${latestJobSig.title || 'New Micro-Job'}" — প্রতি টাস্ক $${price.toFixed(2)} (৳${Math.round(price * 100)})${slots > 0 ? ` · ${slots}টি স্লট` : ''}। এখনই কাজ শুরু করুন!`,
            url: '/jobs',
            excludeUserId: latestJobSig.ownerId || undefined,
          });
        }
        watcherState.lastLiveJobId = sigId;
      }
    }

    // Watch direct user mailboxes (`user_notifs_${uid}`) for subscribed users
    const trackedUids = Array.from(subscriptionsByUser.keys());
    if (trackedUids.length > 0) {
      const notifKeys = trackedUids.flatMap((uid) => [`user_notifs_${uid}`, `user_deleted_notifs_${uid}`]);
      const { data: mailboxRows } = await supabaseServer
        .from('settings')
        .select('key, value')
        .in('key', notifKeys.slice(0, 80));

      if (Array.isArray(mailboxRows)) {
        const deletedByUid = new Map<string, Set<string>>();
        const listByUid = new Map<string, any[]>();
        for (const row of mailboxRows) {
          const parsed = typeof row.value === 'string' ? (() => { try { return JSON.parse(row.value); } catch { return null; } })() : row.value;
          if (row.key.startsWith('user_deleted_notifs_') && Array.isArray(parsed)) {
            const uid = row.key.replace('user_deleted_notifs_', '');
            deletedByUid.set(uid, new Set(parsed.map(String)));
          } else if (row.key.startsWith('user_notifs_') && Array.isArray(parsed)) {
            const uid = row.key.replace('user_notifs_', '');
            listByUid.set(uid, parsed);
          }
        }

        for (const [uid, items] of listByUid.entries()) {
          const seenSet = watcherState.seenUserNotifIds.get(uid) || new Set<string>();
          const deletedSet = deletedByUid.get(uid) || new Set<string>();
          for (const item of items) {
            if (!item?.id || deletedSet.has(item.id) || item.read) continue;
            if (!seenSet.has(item.id)) {
              seenSet.add(item.id);
              const createdTs = item.created_at ? new Date(item.created_at).getTime() : 0;
              if (!isSeed && (Number.isNaN(createdTs) || createdTs >= Date.now() - 10 * 60 * 1000)) {
                void sendWebPushToUser(uid, {
                  tag: item.id,
                  title: item.title || 'IncomeZone',
                  message: item.message || '',
                  url: item.url || '/notifications',
                });
              }
            }
          }
          watcherState.seenUserNotifIds.set(uid, seenSet);
        }
      }
    }

    watcherState.seeded = true;
  } catch {
    // Non-blocking background poll
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, mode: 'readymade-faq', webPushEnabled: true });
  });

  // Public VAPID Key endpoint (only public key is exposed)
  app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  // Subscribe device to Web Push
  app.post('/api/push/subscribe', async (req: Request, res: Response) => {
    const authUser = await getCallerAuthUser(req);
    const { userId, subscription } = req.body || {};
    if (typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'Invalid userId' });
      return;
    }
    if (!authUser || authUser.id !== userId.trim()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const validSub = validatePushSubscription(subscription);
    if (!validSub) {
      res.status(400).json({ error: 'Invalid push subscription' });
      return;
    }

    await loadAllPushSubscriptionsIfEmpty();
    const existing = await refreshUserSubscriptionsFromDb(authUser.id);
    const merged = [validSub, ...existing.filter((s) => s.endpoint !== validSub.endpoint)].slice(0, 8);
    subscriptionsByUser.set(authUser.id, merged);
    await persistUserSubscriptions(authUser.id, merged);

    res.json({ ok: true, count: merged.length });
  });

  // Unsubscribe device
  app.post('/api/push/unsubscribe', async (req: Request, res: Response) => {
    const authUser = await getCallerAuthUser(req);
    const { userId, endpoint } = req.body || {};
    if (!authUser || typeof userId !== 'string' || authUser.id !== userId.trim()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const existing = await refreshUserSubscriptionsFromDb(authUser.id);
    const remaining = endpoint ? existing.filter((s) => s.endpoint !== endpoint) : [];
    if (remaining.length > 0) {
      subscriptionsByUser.set(authUser.id, remaining);
    } else {
      subscriptionsByUser.delete(authUser.id);
    }
    await persistUserSubscriptions(authUser.id, remaining);
    res.json({ ok: true });
  });

  // Send real test Web Push to caller's device
  app.post('/api/push/test', async (req: Request, res: Response) => {
    const authUser = await getCallerAuthUser(req);
    const { userId, title, message, url } = req.body || {};
    if (!authUser || typeof userId !== 'string' || authUser.id !== userId.trim()) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await sendWebPushToUser(
      authUser.id,
      {
        title: typeof title === 'string' && title.trim() ? title.trim() : 'টেস্ট নোটিফিকেশন সফল! 🔔',
        message:
          typeof message === 'string' && message.trim()
            ? message.trim()
            : 'অভিনন্দন! আপনার ফোনে ব্যাকগ্রাউন্ড Web Push সচল আছে—অ্যাপ বন্ধ থাকলেও নোটিফিকেশন আসবে।',
        url: typeof url === 'string' ? url : '/notifications',
        tag: `test_push_${Date.now()}`,
      },
      { allowDuplicateTag: true }
    );

    res.json({ ok: result.delivered > 0, ...result });
  });

  // Send targeted Web Push to a user (requires authenticated caller)
  app.post('/api/push/send', async (req: Request, res: Response) => {
    const authUser = await getCallerAuthUser(req);
    if (!authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { userId, title, message, url, tag } = req.body || {};
    if (typeof userId !== 'string' || !userId.trim() || typeof title !== 'string' || typeof message !== 'string') {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const isSelf = authUser.id === userId.trim();
    const isAdmin = isSelf ? true : await isAdminCaller(authUser);

    // Allow authenticated non-admin users only for legitimate peer events (e.g. worker submitting task to employer)
    if (!isSelf && !isAdmin) {
      const allowedPeerTag = typeof tag === 'string' && (tag.startsWith('emp_sub_') || tag.startsWith('notif_'));
      if (!allowedPeerTag) {
        res.status(403).json({ error: 'Not authorized to notify this user' });
        return;
      }
    }

    const result = await sendWebPushToUser(userId.trim(), {
      title,
      message,
      url: typeof url === 'string' ? url : '/notifications',
      tag: typeof tag === 'string' ? tag : undefined,
    });

    res.json({ ok: true, ...result });
  });

  // Send global broadcast Web Push (Admin only)
  app.post('/api/push/broadcast', async (req: Request, res: Response) => {
    const authUser = await getCallerAuthUser(req);
    if (!(await isAdminCaller(authUser))) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { title, message, url, tag, excludeUserId } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Title and message are required' });
      return;
    }

    const result = await sendWebPushBroadcast({
      title: title.trim(),
      message: message.trim(),
      url: typeof url === 'string' ? url : '/notifications',
      tag: typeof tag === 'string' ? tag : undefined,
      excludeUserId: typeof excludeUserId === 'string' ? excludeUserId : undefined,
    });

    res.json({ ok: true, ...result });
  });

  // Never let unmatched /api routes fall through to SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IncomeZone server running on http://0.0.0.0:${PORT}`);
    if (isSupabaseReady) {
      void loadAllPushSubscriptionsIfEmpty().then(() => pollAndPushNotifications());
      setInterval(() => {
        void pollAndPushNotifications();
      }, 15000);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
