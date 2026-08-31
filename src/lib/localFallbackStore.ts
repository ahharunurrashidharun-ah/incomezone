// Local fallback persistence store for when Supabase tables are not yet created in PostgreSQL (PGRST205)

export interface LocalUser {
  id: string;
  email: string;
  name: string;
  username: string;
  deposit_balance: number;
  earning_balance: number;
  role: string;
  is_locked: boolean;
  created_at: string;
}

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
  const code = error.code || '';
  const msg = (error.message || error.stack || '').toString().toLowerCase();
  return (
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('fetch')
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

export const saveLocalUser = (userId: string, data: Partial<LocalUser>): LocalUser => {
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
  
  const updated = { ...existing, ...data };
  currentUsers[userId] = updated;
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentUsers));
  return updated;
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
export const saveLocalSubmission = (sub: any): any => {
  const newSub = { 
    ...sub, 
    id: sub.id || `local_sub_${Date.now()}`,
    created_at: sub.created_at || new Date().toISOString()
  };
  try {
    const subs = getLocalSubmissions();
    const idx = subs.findIndex(s => s.id === newSub.id);
    if (idx >= 0) {
      subs[idx] = { ...subs[idx], ...newSub };
    } else {
      subs.unshift(newSub);
    }
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
  } catch {}
  return newSub;
};
export const updateLocalSubmission = (id: string, updates: any): any => {
  try {
    const subs = getLocalSubmissions();
    const idx = subs.findIndex(s => s.id === id);
    if (idx >= 0) {
      subs[idx] = { ...subs[idx], ...updates };
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
      return subs[idx];
    }
  } catch {}
  return { id, ...updates };
};
export const saveLocalDeposit = (dep: any): any => {
  return { ...dep, id: dep.id || `local_dep_${Date.now()}` };
};
export const saveLocalWithdrawal = (wd: any): any => {
  return { ...wd, id: wd.id || `local_wd_${Date.now()}` };
};
export const updateLocalWithdrawal = (id: string, updates: any): any => {
  return { id, ...updates };
};
export const getLocalDeposits = (): any[] => [];
export const addLocalDeposit = (dep: any): any => ({ ...dep, id: dep.id || `dep_${Date.now()}` });
export const updateLocalDeposit = (id: string, updates: any): any => ({ id, ...updates });
export const getLocalWithdrawals = (): any[] => [];
export const addLocalWithdrawal = (wd: any): any => ({ ...wd, id: wd.id || `wd_${Date.now()}` });
export const deleteLocalUser = (id: string) => {};
export const getLocalUsers = (): any[] => [];
