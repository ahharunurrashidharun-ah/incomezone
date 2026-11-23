// Local fallback persistence store for when Supabase tables are not yet created in PostgreSQL (PGRST205)
import { supabase } from './supabaseClient';
import { ADMIN_EMAILS } from './adminConfig';

const isPrimaryAdminEmail = (val?: string | null): boolean => {
  if (!val) return false;
  const clean = String(val).toLowerCase().trim();
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === clean);
};

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  username: string;
  deposit_balance: number;
  earning_balance: number;
  role: string;
  is_locked: boolean;
  status?: string;
  is_pending?: boolean;
  ip_address?: string;
  pending_reason?: string;
  created_at: string;
}

const IP_TRACKER_KEY = 'iz_registered_user_ips';

export const getRegisteredIps = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(IP_TRACKER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const registerUserIp = (ip: string, userId: string) => {
  if (!ip) return;
  try {
    const map = getRegisteredIps();
    const list = map[ip] || [];
    if (!list.includes(userId)) {
      list.push(userId);
    }
    map[ip] = list;
    localStorage.setItem(IP_TRACKER_KEY, JSON.stringify(map));
  } catch {}
};

export const isIpAlreadyUsed = (ip: string, excludeUserId?: string): boolean => {
  if (!ip || ip === 'unknown') return false;
  try {
    const map = getRegisteredIps();
    if (map[ip]) {
      const otherUsers = map[ip].filter(uid => uid !== excludeUserId);
      if (otherUsers.length > 0) return true;
    }

    const users = getLocalUsers();
    const match = users.find(u => u.ip_address === ip && u.id !== excludeUserId);
    if (match) return true;

    return false;
  } catch {
    return false;
  }
};

let cachedClientIp = '';
export const fetchClientPublicIp = async (): Promise<string> => {
  if (cachedClientIp) return cachedClientIp;

  const storedIp = localStorage.getItem('iz_detected_client_ip');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedClientIp = String(data.ip).trim();
        localStorage.setItem('iz_detected_client_ip', cachedClientIp);
        return cachedClientIp;
      }
    }
  } catch {
    try {
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 2000);
      const res2 = await fetch('https://ipapi.co/json/', { signal: controller2.signal });
      clearTimeout(timeoutId2);
      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.ip) {
          cachedClientIp = String(data2.ip).trim();
          localStorage.setItem('iz_detected_client_ip', cachedClientIp);
          return cachedClientIp;
        }
      }
    } catch {}
  }

  if (storedIp) {
    cachedClientIp = storedIp;
    return storedIp;
  }

  let devId = localStorage.getItem('iz_device_network_token');
  if (!devId) {
    devId = `dev_${Math.floor(100 + Math.random() * 900)}.${Math.floor(10 + Math.random() * 90)}.${Date.now().toString().slice(-4)}`;
    localStorage.setItem('iz_device_network_token', devId);
  }
  cachedClientIp = devId;
  return devId;
};

export interface LocalJob {
  id: string;
  title: string;
  category: string;
  location: string;
  total_slots: number;
  occupied_slots: number;
  price_per_task: number;
  required_screenshots: number;
  require_text_proof: boolean;
  text_proof_requirement?: string;
  text_proof_instruction?: string;
  screenshot_instructions?: string[];
  image_url?: string;
  description: string;
  owner_id: string;
  employer_id: string;
  status: 'active' | 'pending' | 'rejected' | 'completed';
  rejection_reason?: string;
  created_at: string;
}

export interface LocalSubmission {
  id: string;
  job_id: string;
  worker_id: string;
  worker_display_id?: string | number;
  workerDisplayId?: string | number;
  proof_text: string;
  proof_screenshot_url?: string | null;
  proof_screenshot_urls?: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface LocalAd {
  id: string;
  title: string;
  target_url: string;
  image_url: string;
  tier_id?: string;
  duration_days?: number;
  price_paid?: number;
  status: 'active' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface LocalDepositRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  sender_number: string;
  transaction_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface LocalWithdrawRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  account_number: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const msg = (error.message || '').toString().toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') &&
      msg.includes('does not exist') &&
      !msg.includes('column') &&
      !msg.includes('operator'))
  );
}

// Storage keys
const STORAGE_KEYS = {
  USERS: 'iz_fallback_users',
  JOBS: 'iz_fallback_jobs',
  SUBMISSIONS: 'iz_fallback_submissions',
  ADS: 'iz_fallback_ads',
  DEPOSITS: 'iz_fallback_deposits',
  WITHDRAWALS: 'iz_fallback_withdrawals'
};

export const getLocalUser = (userId: string): LocalUser | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) return null;
    const users = JSON.parse(data) as Record<string, LocalUser>;
    return users[userId] || null;
  } catch { return null; }
};

export const saveLocalUser = (userId: string, data: Partial<LocalUser> & { isRestoring?: boolean }): LocalUser => {
  const isAdminAcc = isPrimaryAdminEmail(data.email);
  // If user is currently deleted and NOT explicitly being restored, refuse to re-add to active store (except primary admin)!
  if (!data.isRestoring && !isAdminAcc) {
    if (isUserDeleted(userId) || (data.email && isUserDeleted(data.email))) {
      return {
        id: userId,
        email: data.email || '',
        name: data.name || 'Deleted User',
        username: data.username || 'deleted',
        deposit_balance: 0,
        earning_balance: 0,
        role: 'deleted',
        is_locked: true,
        created_at: new Date().toISOString()
      };
    }
  }

  let currentUsers: Record<string, LocalUser> = {};
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.USERS);
    if (cached) currentUsers = JSON.parse(cached);
  } catch {}
  
  const existing = currentUsers[userId] || {
    id: userId,
    email: '',
    name: 'User',
    username: 'user',
    deposit_balance: 0,
    earning_balance: 0,
    role: 'user',
    is_locked: false,
    created_at: new Date().toISOString()
  };
  
  const updated = {
    ...existing,
    ...data,
    ...(isAdminAcc ? { role: 'admin', is_locked: false, status: 'active', is_pending: false } : {}),
  };
  delete (updated as any).isRestoring;
  currentUsers[userId] = updated;
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentUsers));
  return updated;
};

export const syncLocalUsersFromRemote = (remoteUsers: any[]) => {
  try {
    const activeMap: Record<string, any> = {};
    (remoteUsers || []).forEach((u: any) => {
      if (u && u.id && u.status !== 'deleted' && u.role !== 'deleted') {
        activeMap[u.id] = u;
      }
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(activeMap));

    // Also prune stale IP tracking records that no longer match any remote user
    const activeIds = new Set((remoteUsers || []).map((u: any) => String(u.id || '').trim()).filter(Boolean));
    if (activeIds.size === 0) {
      localStorage.removeItem(IP_TRACKER_KEY);
    } else {
      const ipMap = getRegisteredIps();
      const cleanedMap: Record<string, string[]> = {};
      for (const [ipKey, uids] of Object.entries(ipMap)) {
        const filtered = (uids || []).filter((uid) => activeIds.has(String(uid).trim()));
        if (filtered.length > 0) {
          cleanedMap[ipKey] = filtered;
        }
      }
      localStorage.setItem(IP_TRACKER_KEY, JSON.stringify(cleanedMap));
    }
  } catch {}
};

export const clearOrphanedDeletedArchiveWhenEmpty = async () => {
  try {
    localStorage.removeItem(DELETED_USERS_KEY);
    localStorage.removeItem(IP_TRACKER_KEY);
    await pushDeletedUsersToRemote([]);
  } catch {}
};

export const clearAllStaleLocalCachesWhenPlatformEmpty = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.JOBS);
    localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.ADS);
    localStorage.removeItem(STORAGE_KEYS.DEPOSITS);
    localStorage.removeItem(STORAGE_KEYS.WITHDRAWALS);
    localStorage.removeItem(DELETED_USERS_KEY);
    localStorage.removeItem(IP_TRACKER_KEY);
    // Clear orphaned per-user notifications
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('iz_user_notifications_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
};

export const getLocalJobs = (): LocalJob[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.JOBS);
    if (!data) return [];
    return JSON.parse(data) as LocalJob[];
  } catch { return []; }
};

export const getLocalAds = (): LocalAd[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ADS);
    if (!data) return [];
    return JSON.parse(data) as LocalAd[];
  } catch { return []; }
};

export const saveLocalAd = (ad: LocalAd) => {
  try {
    const ads = getLocalAds();
    ads.unshift(ad);
    localStorage.setItem(STORAGE_KEYS.ADS, JSON.stringify(ads));
  } catch {}
};

export const getLocalSubmissions = (): LocalSubmission[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    if (!data) return [];
    return JSON.parse(data) as LocalSubmission[];
  } catch { return []; }
};

export const saveLocalJob = (job: any): any => {
  const newJob = { 
    ...job, 
    id: job.id || `local_job_${Date.now()}`,
    created_at: job.created_at || new Date().toISOString() 
  };
  try {
    const jobs = getLocalJobs();
    const idx = jobs.findIndex(j => j.id === newJob.id);
    if (idx >= 0) {
      jobs[idx] = { ...jobs[idx], ...newJob };
    } else {
      jobs.unshift(newJob);
    }
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  } catch {}
  return newJob;
};
export const updateLocalJob = (id: string, updates: any): any => {
  try {
    const jobs = getLocalJobs();
    const idx = jobs.findIndex(j => j.id === id);
    if (idx >= 0) {
      jobs[idx] = { ...jobs[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
      return jobs[idx];
    }
  } catch {}
  return { id, ...updates };
};
export const hasUserSubmittedJobLocally = (jobId: string, workerId: string): boolean => {
  if (!jobId || !workerId) return false;
  try {
    const subs = getLocalSubmissions();
    return subs.some(s => {
      const sJobId = s.job_id || (s as any).jobId;
      const sWorkerId = s.worker_id || (s as any).workerId;
      return sJobId === jobId && sWorkerId === workerId;
    });
  } catch {
    return false;
  }
};

export const saveLocalSubmission = (sub: any): any => {
  const jobId = sub.job_id || sub.jobId;
  const workerId = sub.worker_id || sub.workerId;

  try {
    const subs = getLocalSubmissions();
    
    // Prevent duplicate submission for same job by same worker
    if (jobId && workerId) {
      const existing = subs.find(s => {
        const sJobId = s.job_id || (s as any).jobId;
        const sWorkerId = s.worker_id || (s as any).workerId;
        return sJobId === jobId && sWorkerId === workerId;
      });
      if (existing) {
        return existing;
      }
    }

    const newSub = { 
      ...sub, 
      id: sub.id || `local_sub_${Date.now()}`,
      created_at: sub.created_at || new Date().toISOString()
    };

    const idx = subs.findIndex(s => s.id === newSub.id);
    if (idx >= 0) {
      subs[idx] = { ...subs[idx], ...newSub };
    } else {
      subs.unshift(newSub);
    }
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
    return newSub;
  } catch {}
  return { id: sub.id || `local_sub_${Date.now()}`, ...sub };
};
export const updateLocalSubmission = (id: string, updates: any, jobId?: string, workerId?: string): any => {
  try {
    const subs = getLocalSubmissions();
    let updated = false;
    const newSubs = subs.map(s => {
      const matchId = s.id === id;
      const matchJobAndWorker = Boolean(jobId && workerId && s.job_id === jobId && s.worker_id === workerId && s.status === 'pending');
      const matchJobPending = Boolean(jobId && !workerId && s.job_id === jobId && s.status === 'pending');
      if (matchId || matchJobAndWorker || matchJobPending) {
        updated = true;
        return { ...s, ...updates };
      }
      return s;
    });
    if (updated) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(newSubs));
    }
  } catch {}
  return { id, ...updates };
};
export const getLocalDeposits = (): LocalDepositRequest[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DEPOSITS);
    if (!data) return [];
    return JSON.parse(data);
  } catch { return []; }
};

export const saveLocalDeposit = (dep: any): any => {
  const newDep = {
    ...dep,
    id: dep.id || `local_dep_${Date.now()}`,
    created_at: dep.created_at || new Date().toISOString(),
    status: dep.status || 'pending',
  };
  try {
    const deps = getLocalDeposits();
    const idx = deps.findIndex((d: any) => d.id === newDep.id);
    if (idx >= 0) {
      deps[idx] = { ...deps[idx], ...newDep };
    } else {
      deps.unshift(newDep);
    }
    localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deps));
  } catch {}
  return newDep;
};

export const addLocalDeposit = saveLocalDeposit;

export const updateLocalDeposit = (id: string, updates: any): any => {
  try {
    const deps = getLocalDeposits();
    const idx = deps.findIndex((d: any) => d.id === id);
    if (idx >= 0) {
      deps[idx] = { ...deps[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.DEPOSITS, JSON.stringify(deps));
      return deps[idx];
    }
  } catch {}
  return { id, ...updates };
};

export const getLocalWithdrawals = (): LocalWithdrawRequest[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WITHDRAWALS);
    if (!data) return [];
    return JSON.parse(data);
  } catch { return []; }
};

export const saveLocalWithdrawal = (wd: any): any => {
  const newWd = {
    ...wd,
    id: wd.id || `local_wd_${Date.now()}`,
    created_at: wd.created_at || new Date().toISOString(),
    status: wd.status || 'pending',
  };
  try {
    const wds = getLocalWithdrawals();
    const idx = wds.findIndex((w: any) => w.id === newWd.id);
    if (idx >= 0) {
      wds[idx] = { ...wds[idx], ...newWd };
    } else {
      wds.unshift(newWd);
    }
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(wds));
  } catch {}
  return newWd;
};

export const addLocalWithdrawal = saveLocalWithdrawal;

export const updateLocalWithdrawal = (id: string, updates: any): any => {
  try {
    const wds = getLocalWithdrawals();
    const idx = wds.findIndex((w: any) => w.id === id);
    if (idx >= 0) {
      wds[idx] = { ...wds[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(wds));
      return wds[idx];
    }
  } catch {}
  return { id, ...updates };
};
export const getLocalUsers = (): LocalUser[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) return [];
    const usersObj = JSON.parse(data) as Record<string, LocalUser>;
    const deletedList = getDeletedUsers();
    const deletedIds = new Set(deletedList.map(d => String(d.id || '').toLowerCase().trim()).filter(Boolean));
    const deletedEmails = new Set(deletedList.map(d => String(d.email || '').toLowerCase().trim()).filter(Boolean));

    return Object.values(usersObj).filter(u => {
      const uId = String(u.id || '').toLowerCase().trim();
      const uEmail = String(u.email || '').toLowerCase().trim();
      if (deletedIds.has(uId)) return false;
      if (uEmail && deletedEmails.has(uEmail)) return false;
      if (u.role === 'deleted' || (u as any).status === 'deleted') return false;
      return true;
    });
  } catch {
    return [];
  }
};

export interface DeletedUserItem extends LocalUser {
  deleted_at: string;
  reason?: string;
}

const DELETED_USERS_KEY = 'iz_deleted_users';

export const getDeletedUsers = (): DeletedUserItem[] => {
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const pushDeletedUsersToRemote = async (deletedList?: DeletedUserItem[]): Promise<void> => {
  try {
    const listToPush = deletedList || getDeletedUsers();
    await supabase.from('settings').upsert({
      key: 'deleted_users_archive',
      value: JSON.stringify(listToPush),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch (err) {
    console.warn('Could not push deleted users to remote settings:', err);
  }
};

export const syncDeletedUsersWithRemote = async (): Promise<DeletedUserItem[]> => {
  try {
    const localDeleted = getDeletedUsers();
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'deleted_users_archive')
      .maybeSingle();

    if (!error && data && data.value) {
      let remoteDeleted: DeletedUserItem[] = [];
      try {
        remoteDeleted = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      } catch {}

      if (Array.isArray(remoteDeleted)) {
        // Merge remote and local by id and email
        const mergedMap = new Map<string, DeletedUserItem>();
        remoteDeleted.forEach(item => {
          if (item && (item.id || item.email)) {
            const key = (item.id || item.email).toLowerCase().trim();
            mergedMap.set(key, item);
          }
        });
        localDeleted.forEach(item => {
          if (item && (item.id || item.email)) {
            const key = (item.id || item.email).toLowerCase().trim();
            if (!mergedMap.has(key)) {
              mergedMap.set(key, item);
            }
          }
        });

        const mergedList = Array.from(mergedMap.values());
        localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(mergedList));
        return mergedList;
      }
    } else if (localDeleted.length > 0) {
      // Push local deleted to remote if remote didn't have it yet
      await pushDeletedUsersToRemote(localDeleted);
    }
    return localDeleted;
  } catch {
    return getDeletedUsers();
  }
};

export const deleteLocalUser = (
  id: string,
  reason?: string,
  fallbackUser?: any,
  options?: { silent?: boolean }
) => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    let userToArchive: LocalUser | null = fallbackUser ? { ...fallbackUser } : null;
    const targetEmail = (fallbackUser?.email || '').toLowerCase().trim();

    // 1. Remove from active local users thoroughly by key, ID, and Email
    if (data) {
      const usersObj = JSON.parse(data) as Record<string, LocalUser>;
      if (usersObj[id]) {
        userToArchive = userToArchive || usersObj[id];
        delete usersObj[id];
      }
      for (const [k, v] of Object.entries(usersObj) as [string, any][]) {
        if (
          k === id ||
          v.id === id ||
          (targetEmail && v.email && v.email.toLowerCase().trim() === targetEmail)
        ) {
          userToArchive = userToArchive || v;
          delete usersObj[k];
        }
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(usersObj));
    }

    // 2. Add to deleted users archive with complete metadata
    const deletedList = getDeletedUsers();
    const resolvedEmail = (userToArchive?.email || fallbackUser?.email || '').trim();
    const resolvedName = userToArchive?.name || fallbackUser?.name || resolvedEmail.split('@')[0] || 'User';
    const resolvedUsername = userToArchive?.username || fallbackUser?.username || resolvedEmail.split('@')[0] || 'user';

    const archivedItem: DeletedUserItem = {
      ...(userToArchive || {}),
      id: id,
      email: resolvedEmail,
      name: resolvedName,
      username: resolvedUsername,
      deposit_balance: Number(userToArchive?.deposit_balance ?? fallbackUser?.depositBalance ?? fallbackUser?.deposit_balance ?? 0),
      earning_balance: Number(userToArchive?.earning_balance ?? fallbackUser?.earningBalance ?? fallbackUser?.earning_balance ?? 0),
      role: 'deleted',
      is_locked: true,
      created_at: userToArchive?.created_at || fallbackUser?.created_at || fallbackUser?.createdAt || new Date().toISOString(),
      deleted_at: new Date().toISOString(),
      reason: reason || 'Deleted by Administrator'
    };

    const existingIdx = deletedList.findIndex(
      u => u.id === id || (resolvedEmail && u.email?.toLowerCase().trim() === resolvedEmail.toLowerCase().trim())
    );

    if (existingIdx >= 0) {
      deletedList[existingIdx] = archivedItem;
    } else {
      deletedList.unshift(archivedItem);
    }
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(deletedList));
    pushDeletedUsersToRemote(deletedList);
    if (!options?.silent) {
      window.dispatchEvent(new CustomEvent('iz_users_updated'));
    }
  } catch {}
};

export const restoreDeletedUser = (id: string): LocalUser | null => {
  try {
    const deletedList = getDeletedUsers();
    const target = deletedList.find(u => u.id === id);
    if (!target) return null;

    // Remove from deleted list
    const updatedDeleted = deletedList.filter(u => u.id !== id);
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(updatedDeleted));
    pushDeletedUsersToRemote(updatedDeleted);

    // Restore to active users with explicit isRestoring flag
    const restoredUser: LocalUser = {
      id: target.id,
      email: target.email,
      name: target.name,
      username: target.username,
      deposit_balance: target.deposit_balance,
      earning_balance: target.earning_balance,
      role: target.role === 'blocked' ? 'user' : (target.role === 'deleted' ? 'user' : (target.role || 'user')),
      is_locked: false,
      created_at: target.created_at || new Date().toISOString()
    };
    saveLocalUser(id, { ...restoredUser, isRestoring: true } as any);
    window.dispatchEvent(new CustomEvent('iz_users_updated'));
    return restoredUser;
  } catch {
    return null;
  }
};

export const permanentPurgeDeletedUser = (id: string, email?: string) => {
  try {
    const deletedList = getDeletedUsers();
    const target = deletedList.find(u => u.id === id || (email && u.email?.toLowerCase().trim() === email.toLowerCase().trim()));
    const targetEmail = (email || target?.email || '').toLowerCase().trim();

    // 1. Remove from deleted archive
    const updated = deletedList.filter(u => u.id !== id && (!targetEmail || (u.email || '').toLowerCase().trim() !== targetEmail));
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(updated));
    pushDeletedUsersToRemote(updated);

    // 2. Remove from active local users
    const usersData = localStorage.getItem(STORAGE_KEYS.USERS);
    if (usersData) {
      const usersObj = JSON.parse(usersData);
      delete usersObj[id];
      if (targetEmail) {
        for (const [k, v] of Object.entries(usersObj) as [string, any][]) {
          if ((v.email || '').toLowerCase().trim() === targetEmail) {
            delete usersObj[k];
          }
        }
      }
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(usersObj));
    }

    // 3. Clear IP tracker mapping so the device/IP can register a fresh account
    const ipMap = getRegisteredIps();
    let ipMapChanged = false;
    for (const [ipKey, uids] of Object.entries(ipMap)) {
      if (uids.includes(id)) {
        ipMap[ipKey] = uids.filter(uid => uid !== id);
        ipMapChanged = true;
      }
    }
    if (ipMapChanged) {
      localStorage.setItem(IP_TRACKER_KEY, JSON.stringify(ipMap));
    }

    window.dispatchEvent(new CustomEvent('iz_users_updated'));
  } catch {}
};

export const isUserDeleted = (userIdOrEmail: string): boolean => {
  if (!userIdOrEmail) return false;
  if (isPrimaryAdminEmail(userIdOrEmail)) return false;
  try {
    const deletedList = getDeletedUsers();
    const needle = String(userIdOrEmail).toLowerCase().trim();
    return deletedList.some(u => {
      const uId = String(u.id || '').toLowerCase().trim();
      const uEmail = String(u.email || '').toLowerCase().trim();
      const uUsername = String(u.username || '').toLowerCase().trim();
      return uId === needle || uEmail === needle || uUsername === needle;
    });
  } catch {
    return false;
  }
};

export const isUserPending = (userIdOrEmail: string): boolean => {
  if (!userIdOrEmail) return false;
  if (isPrimaryAdminEmail(userIdOrEmail)) return false;
  try {
    const needle = userIdOrEmail.toLowerCase().trim();
    const localUsers = getLocalUsers();
    const found = localUsers.find(
      u => (u.id && u.id.toLowerCase().trim() === needle) || (u.email && u.email.toLowerCase().trim() === needle)
    );
    if (found && found.status !== 'active' && (found.status === 'pending' || Boolean(found.is_pending))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const isUserBlocked = (userIdOrEmail: string): boolean => {
  if (!userIdOrEmail) return false;
  if (isPrimaryAdminEmail(userIdOrEmail)) return false;
  try {
    const needle = userIdOrEmail.toLowerCase().trim();
    const localUsers = getLocalUsers();
    const found = localUsers.find(
      u => (u.id && u.id.toLowerCase().trim() === needle) || (u.email && u.email.toLowerCase().trim() === needle)
    );
    if (found) {
      // Pending users have their own separate popup and must not be marked as blocked
      if (found.status === 'pending' || Boolean(found.is_pending)) {
        return false;
      }
      if (found.status === 'active' && !found.is_locked && found.role !== 'blocked') {
        return false;
      }
      if (found.is_locked || found.role === 'blocked' || found.status === 'blocked') {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
};

export interface UserNotificationItem {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: 'broadcast' | 'deposit' | 'withdrawal' | 'submission' | 'announcement';
  read: boolean;
  created_at: string;
}

const NOTIF_ICON_PATH = '/assets/aistudio/1795356168824_9e1cf2d3.jpg';

const getActiveSessionUserId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('iz_auth_session');
    if (!raw) return null;
    const sess = JSON.parse(raw);
    return sess?.user?.uid || sess?.profile?.id || null;
  } catch {
    return null;
  }
};

export const isInsideEmbeddedIframe = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const getLocalNotifications = (userId: string): UserNotificationItem[] => {
  try {
    const raw = localStorage.getItem(`iz_user_notifications_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch {
    return [];
  }
};

export const registerNotificationServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    let registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const readyReg = (await Promise.race([readyPromise, timeoutPromise])) as ServiceWorkerRegistration | null;
    return readyReg || registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
};

export const showDeviceNotification = async (
  title: string,
  message: string,
  options?: { tag?: string; url?: string }
): Promise<{ shown: boolean; method?: 'sw' | 'window'; reason?: string }> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { shown: false, reason: 'এই ব্রাউজারে সিস্টেম নোটিফিকেশন সাপোর্ট করে না।' };
  }
  if (Notification.permission !== 'granted') {
    return { shown: false, reason: 'ফোনের নোটিফিকেশন পারমিশন চালু করা নেই।' };
  }

  const tag = options?.tag || `iz_${Date.now()}`;
  const notifOptions: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: message,
    icon: NOTIF_ICON_PATH,
    badge: NOTIF_ICON_PATH,
    tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: options?.url || '/notifications' },
  };

  // 1. Mobile Chrome / Android / modern browsers REQUIRE ServiceWorkerRegistration.showNotification
  try {
    const reg = await registerNotificationServiceWorker();
    if (reg && typeof reg.showNotification === 'function') {
      await reg.showNotification(title, notifOptions);
      return { shown: true, method: 'sw' };
    }
  } catch (swErr) {
    console.warn('ServiceWorker showNotification failed, checking fallback:', swErr);
  }

  // 2. Fallback to window Notification constructor ONLY on desktop browsers where supported
  try {
    const nativeNotif = new Notification(title, {
      body: message,
      icon: NOTIF_ICON_PATH,
      tag,
    });
    nativeNotif.onclick = () => {
      try { window.focus(); } catch {}
    };
    return { shown: true, method: 'window' };
  } catch (winErr: any) {
    console.warn('Native Notification fallback failed:', winErr);
    return {
      shown: false,
      reason: isInsideEmbeddedIframe()
        ? 'প্রিভিউ ফ্রেম থেকে মোবাইল নোটিফিকেশন ব্লক হতে পারে। সরাসরি ফোনের Chrome ব্রাউজারে লিংকটি ওপেন করুন।'
        : (winErr?.message || 'ডিভাইসে নোটিফিকেশন দেখানো যায়নি।'),
    };
  }
};

export const getNotificationPermissionState = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const requestNativeNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    let perm: NotificationPermission;
    if (typeof Notification.requestPermission === 'function') {
      const result = Notification.requestPermission();
      perm = result instanceof Promise ? await result : result;
    } else {
      perm = Notification.permission;
    }
    if (perm === 'granted') {
      await registerNotificationServiceWorker();
    }
    return perm;
  } catch {
    return Notification.permission;
  }
};

export const pushRemoteUserNotification = async (
  userId: string,
  item: UserNotificationItem
): Promise<void> => {
  if (!userId || !item?.id) return;
  try {
    const settingsKey = `user_notifs_${userId}`;
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle();

    let existing: UserNotificationItem[] = [];
    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed)) existing = parsed;
    }

    if (existing.some((n) => n.id === item.id)) return;
    const merged = [item, ...existing].slice(0, 30);

    await supabase
      .from('settings')
      .upsert(
        {
          key: settingsKey,
          value: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
  } catch {
    // Non-blocking best-effort cross-device sync
  }
};

export const syncRemoteUserNotifications = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const settingsKey = `user_notifs_${userId}`;
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', settingsKey)
      .maybeSingle();

    if (error || !data?.value) return;
    const remoteList: UserNotificationItem[] =
      typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    if (!Array.isArray(remoteList) || remoteList.length === 0) return;

    const localList = getLocalNotifications(userId);
    const localIds = new Set(localList.map((n) => n.id));
    const newItems = remoteList.filter((item) => item && item.id && !localIds.has(item.id));
    if (newItems.length === 0) return;

    const merged = [...newItems, ...localList]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);

    localStorage.setItem(`iz_user_notifications_${userId}`, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent('iz_user_notifications_updated', { detail: { userId } }));

    // Trigger native OS notification on the recipient's phone for fresh unseen notifications (last 24h)
    const activeUid = getActiveSessionUserId();
    if (!activeUid || activeUid === userId) {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const freshUnread = newItems
        .filter((n) => !n.read && (!n.created_at || new Date(n.created_at).getTime() >= cutoff))
        .slice(0, 3);
      for (const n of freshUnread) {
        void showDeviceNotification(n.title, n.message, { tag: n.id });
      }
    }
  } catch {}
};

export const saveLocalNotification = (
  userId: string,
  notif: {
    title: string;
    message: string;
    type: 'broadcast' | 'deposit' | 'withdrawal' | 'submission' | 'announcement';
    id?: string;
    created_at?: string;
    read?: boolean;
  },
  options?: { skipRemoteSync?: boolean; skipNative?: boolean }
) => {
  try {
    const list = getLocalNotifications(userId);
    const itemId = notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Deduplicate: do not store or re-fire OS notification for an already-recorded ID
    if (list.some((existing) => existing.id === itemId)) {
      return list.find((existing) => existing.id === itemId);
    }

    const item: UserNotificationItem = {
      id: itemId,
      userId,
      title: notif.title,
      message: notif.message,
      type: notif.type,
      read: notif.read ?? false,
      created_at: notif.created_at || new Date().toISOString(),
    };
    const updatedList = [item, ...list].slice(0, 100);
    localStorage.setItem(`iz_user_notifications_${userId}`, JSON.stringify(updatedList));
    window.dispatchEvent(new CustomEvent('iz_user_notifications_updated', { detail: { userId } }));

    const activeUid = getActiveSessionUserId();
    const isTargetCurrentDeviceUser = !activeUid || activeUid === userId;

    // Only pop native notification on THIS device if the recipient is the logged-in user here
    if (!options?.skipNative && isTargetCurrentDeviceUser) {
      void showDeviceNotification(notif.title, notif.message, { tag: item.id });
    }

    // Persist to Supabase remote mailbox so notifications arrive on the user's phone even from Admin/Employer devices
    if (!options?.skipRemoteSync) {
      void pushRemoteUserNotification(userId, item);
    }

    return item;
  } catch {}
};

export const markNotificationsAsRead = (userId: string) => {
  try {
    const list = getLocalNotifications(userId);
    const updated = list.map((n) => ({ ...n, read: true }));
    localStorage.setItem(`iz_user_notifications_${userId}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('iz_user_notifications_updated', { detail: { userId } }));
  } catch {}
};


