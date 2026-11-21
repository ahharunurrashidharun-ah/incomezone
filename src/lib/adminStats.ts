import { supabase } from './supabaseClient';
import { checkIsAdmin } from './adminConfig';
import {
  getLocalUsers,
  getLocalJobs,
  getLocalSubmissions,
  getLocalAds,
  getLocalDeposits,
  getLocalWithdrawals,
  getDeletedUsers,
  isUserDeleted,
  syncLocalUsersFromRemote,
  clearOrphanedDeletedArchiveWhenEmpty,
  clearAllStaleLocalCachesWhenPlatformEmpty,
} from './localFallbackStore';

export interface AdminPlatformStats {
  // Total Metrics
  totalUsers: number;
  totalTasks: number;
  totalSubmissions: number;
  totalAds: number;
  totalDepositUSD: number;
  totalWithdrawalUSD: number;
  totalUserDepositBalanceUSD: number;
  totalUserEarningBalanceUSD: number;

  // Pending Metrics
  pendingUsersCount: number;
  pendingSubmissionsCount: number;
  pendingJobsCount: number;
  pendingAdsCount: number;
  pendingDepositsCount: number;
  pendingDepositsUSD: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsUSD: number;

  // Pending user list for quick review
  pendingUsersList: any[];
}

export async function fetchLiveAdminStats(): Promise<AdminPlatformStats> {
  try {
    const [
      usersRes, 
      jobsRes, 
      subsRes, 
      adsRes,
      depsRes, 
      withRes
    ] = await Promise.allSettled([
      supabase.from('users').select('*'),
      supabase.from('jobs').select('*'),
      supabase.from('submissions').select('*'),
      supabase.from('ads').select('*'),
      supabase.from('deposit_requests').select('*'),
      supabase.from('withdraw_requests').select('*')
    ]);

    const rawUsers = (usersRes.status === 'fulfilled' && usersRes.value.data) ? [...usersRes.value.data] : [];
    const rawJobs = (jobsRes.status === 'fulfilled' && jobsRes.value.data) ? [...jobsRes.value.data] : [];
    const rawSubs = (subsRes.status === 'fulfilled' && subsRes.value.data) ? [...subsRes.value.data] : [];
    const rawAds = (adsRes.status === 'fulfilled' && adsRes.value.data) ? [...adsRes.value.data] : [];
    const rawDeps = (depsRes.status === 'fulfilled' && depsRes.value.data) ? [...depsRes.value.data] : [];
    const rawWiths = (withRes.status === 'fulfilled' && withRes.value.data) ? [...withRes.value.data] : [];

    // Check if tables are connected and returned valid data without table-missing errors
    const isUsersTableConnected = usersRes.status === 'fulfilled' && !usersRes.value.error;
    const isJobsTableConnected = jobsRes.status === 'fulfilled' && !jobsRes.value.error;
    const isSubsTableConnected = subsRes.status === 'fulfilled' && !subsRes.value.error;
    const isAdsTableConnected = adsRes.status === 'fulfilled' && !adsRes.value.error;
    const isDepsTableConnected = depsRes.status === 'fulfilled' && !depsRes.value.error;
    const isWithsTableConnected = withRes.status === 'fulfilled' && !withRes.value.error;

    // -------------------------------------------------------------
    // 1. USERS: Remote Database is the Single Source of Truth
    // -------------------------------------------------------------
    let sourceUsers: any[] = [];
    if (isUsersTableConnected) {
      sourceUsers = rawUsers;
      syncLocalUsersFromRemote(rawUsers);
      // If DB has no non-admin users and no deleted-status rows, clear orphaned deleted/IP archives
      const hasAnyDeletedRow = rawUsers.some((u: any) => u.status === 'deleted' || u.role === 'deleted');
      const nonAdminRaw = rawUsers.filter(
        (u: any) => !checkIsAdmin({ email: u.email, username: u.username, role: u.role, user_metadata: u.raw_user_meta_data })
      );
      if (!hasAnyDeletedRow && nonAdminRaw.length === 0) {
        await clearOrphanedDeletedArchiveWhenEmpty();
        if (
          isJobsTableConnected && rawJobs.length === 0 &&
          isSubsTableConnected && rawSubs.length === 0 &&
          isAdsTableConnected && rawAds.length === 0 &&
          isDepsTableConnected && rawDeps.length === 0 &&
          isWithsTableConnected && rawWiths.length === 0
        ) {
          clearAllStaleLocalCachesWhenPlatformEmpty();
        }
      }
    } else {
      sourceUsers = getLocalUsers();
    }

    const deletedList = getDeletedUsers();
    const deletedIds = new Set(deletedList.map(d => String(d.id || '').toLowerCase().trim()).filter(Boolean));
    const deletedEmails = new Set(deletedList.map(d => String(d.email || '').toLowerCase().trim()).filter(Boolean));

    const mergedUsersMap = new Map<string, any>();
    sourceUsers.forEach((ru: any) => {
      const emailKey = String(ru.email || '').toLowerCase().trim();
      const idKey = String(ru.id || '').toLowerCase().trim();
      const primaryKey = emailKey || idKey;
      if (primaryKey) {
        mergedUsersMap.set(primaryKey, { ...ru });
      }
    });

    // Filter strictly to non-deleted, non-admin regular users so platform counts start from 0
    const allUsers = Array.from(mergedUsersMap.values()).filter((u: any) => {
      const isAdmin = checkIsAdmin({ email: u.email, username: u.username, role: u.role, user_metadata: u.raw_user_meta_data });
      if (isAdmin) return false;
      const uId = String(u.id || '').toLowerCase().trim();
      const uEmail = String(u.email || '').toLowerCase().trim();
      if (deletedIds.has(uId)) return false;
      if (uEmail && deletedEmails.has(uEmail)) return false;
      if (isUserDeleted(u.id) || (u.email && isUserDeleted(u.email))) return false;
      if (u.status === 'deleted' || u.role === 'deleted') return false;
      return true;
    });

    let totalUserDepositBal = 0;
    let totalUserEarnBal = 0;
    const pendingUsersList: any[] = [];

    allUsers.forEach((u: any) => {
      totalUserDepositBal += Number(u.deposit_balance ?? u.depositBalance ?? 0);
      totalUserEarnBal += Number(u.earning_balance ?? u.earningBalance ?? 0);

      const isApprovedActive = u.status === 'active' && !u.is_pending && !u.is_locked && u.role !== 'blocked';
      const isPending = !isApprovedActive && Boolean(
        u.status === 'pending' || 
        u.is_pending || 
        u.status === 'flagged_ip'
      );

      if (isPending) {
        pendingUsersList.push({
          id: u.id,
          display_id: u.display_id || u.displayId,
          name: u.name || u.raw_user_meta_data?.name || (u.email ? u.email.split('@')[0] : 'User'),
          email: u.email || '',
          ip_address: u.ip_address || u.ipAddress || '',
          pending_reason: u.pending_reason || 'Same IP / Multi-Account',
          created_at: u.created_at || u.createdAt
        });
      }
    });

    // -------------------------------------------------------------
    // 2. JOBS: Remote Database is the Single Source of Truth
    // -------------------------------------------------------------
    let validJobs: any[] = [];
    if (isJobsTableConnected) {
      // Remote table is connected: database records ARE the truth!
      // If the admin deleted all jobs from the database, validJobs will be [] (0 jobs).
      validJobs = rawJobs.filter((rj: any) => rj && rj.id && rj.status !== 'deleted');
      // Sync local storage so stale deleted jobs are cleared from browser cache
      try {
        localStorage.setItem('iz_fallback_jobs', JSON.stringify(validJobs));
      } catch {}
    } else {
      // Remote table does not exist or network is offline: use local fallback store
      const localJobs = getLocalJobs();
      validJobs = localJobs.filter((lj: any) => lj && lj.id && lj.status !== 'deleted');
    }

    const pendingJobsCount = validJobs.filter((j: any) => j.status === 'pending').length;

    // -------------------------------------------------------------
    // 3. SUBMISSIONS: Remote Database is the Single Source of Truth
    // -------------------------------------------------------------
    let validSubs: any[] = [];
    if (isSubsTableConnected) {
      // Remote table is connected: database records ARE the truth!
      validSubs = rawSubs.filter((rs: any) => rs && rs.id);
      try {
        localStorage.setItem('iz_fallback_submissions', JSON.stringify(validSubs));
      } catch {}
    } else {
      const localSubs = getLocalSubmissions();
      validSubs = localSubs.filter((ls: any) => ls && ls.id);
    }

    const pendingSubsCount = validSubs.filter((s: any) => s.status === 'pending').length;

    // -------------------------------------------------------------
    // 4. ADS: Remote Database is the Single Source of Truth
    // -------------------------------------------------------------
    let validAds: any[] = [];
    if (isAdsTableConnected) {
      validAds = rawAds.filter((ra: any) => ra && ra.id && ra.status !== 'deleted');
      try {
        localStorage.setItem('iz_fallback_ads', JSON.stringify(validAds));
      } catch {}
    } else {
      const localAds = getLocalAds();
      validAds = localAds.filter((la: any) => la && la.id && la.status !== 'deleted');
    }

    const pendingAdsCount = validAds.filter((a: any) => a.status === 'pending').length;

    // -------------------------------------------------------------
    // 5. DEPOSITS: Remote Database is the Single Source of Truth
    // -------------------------------------------------------------
    let allRawDeps: any[] = [];
    if (isDepsTableConnected) {
      allRawDeps = [...rawDeps];
      try {
        localStorage.setItem('iz_fallback_deposits', JSON.stringify(allRawDeps));
      } catch {}
    } else {
      allRawDeps = getLocalDeposits();
    }

    // Deduplicate duplicate spam submissions within 3-minute windows
    const seenDepIds = new Set<string>();
    const seenDepSignatures = new Set<string>();
    const dedupedDeps: any[] = [];

    for (const rec of allRawDeps) {
      if (!rec || !rec.id) continue;
      if (seenDepIds.has(rec.id)) continue;
      seenDepIds.add(rec.id);

      const uId = rec.user_id || rec.userId;
      const amt = Number(rec.amount || 0).toFixed(2);
      const trx = String(rec.transaction_id || rec.transactionId || '').trim().toUpperCase();
      const status = rec.status || 'pending';
      const d = new Date(rec.created_at || rec.createdAt || Date.now());
      const timeBlock = Math.floor(d.getTime() / (3 * 60 * 1000));
      const sig = `${uId}_${amt}_${trx}_${status}_${timeBlock}`;

      if (seenDepSignatures.has(sig)) continue;
      seenDepSignatures.add(sig);

      dedupedDeps.push(rec);
    }

    let totalDepositUSD = 0;
    let pendingDepositsCount = 0;
    let pendingDepositsUSD = 0;

    dedupedDeps.forEach((d: any) => {
      const amt = Number(d.amount) || 0;
      if (d.status === 'approved') {
        totalDepositUSD += amt;
      } else if (d.status === 'pending') {
        pendingDepositsCount++;
        pendingDepositsUSD += amt;
      }
    });

    // -------------------------------------------------------------
    // 6. WITHDRAWALS: Remote Database is the Single Source of Truth
    // -------------------------------------------------------------
    let allRawWiths: any[] = [];
    if (isWithsTableConnected) {
      allRawWiths = [...rawWiths];
      try {
        localStorage.setItem('iz_fallback_withdrawals', JSON.stringify(allRawWiths));
      } catch {}
    } else {
      allRawWiths = getLocalWithdrawals();
    }

    const seenWithIds = new Set<string>();
    const seenWithSignatures = new Set<string>();
    const dedupedWiths: any[] = [];

    for (const rec of allRawWiths) {
      if (!rec || !rec.id) continue;
      if (seenWithIds.has(rec.id)) continue;
      seenWithIds.add(rec.id);

      const uId = rec.user_id || rec.userId;
      const amt = Number(rec.amount || 0).toFixed(2);
      const acc = String(rec.account_number || rec.account_details || rec.accountDetails || '').trim();
      const status = rec.status || 'pending';
      const d = new Date(rec.created_at || rec.createdAt || Date.now());
      const timeBlock = Math.floor(d.getTime() / (3 * 60 * 1000));
      const sig = `${uId}_${amt}_${acc}_${status}_${timeBlock}`;

      if (seenWithSignatures.has(sig)) continue;
      seenWithSignatures.add(sig);

      dedupedWiths.push(rec);
    }

    let totalWithdrawalUSD = 0;
    let pendingWithdrawalsCount = 0;
    let pendingWithdrawalsUSD = 0;

    dedupedWiths.forEach((w: any) => {
      const amt = Number(w.amount) || 0;
      if (w.status === 'approved') {
        totalWithdrawalUSD += amt;
      } else if (w.status === 'pending') {
        pendingWithdrawalsCount++;
        pendingWithdrawalsUSD += amt;
      }
    });

    return {
      totalUsers: allUsers.length,
      totalTasks: validJobs.length,
      totalSubmissions: validSubs.length,
      totalAds: validAds.length,
      totalDepositUSD,
      totalWithdrawalUSD,
      totalUserDepositBalanceUSD: totalUserDepositBal,
      totalUserEarningBalanceUSD: totalUserEarnBal,

      pendingUsersCount: pendingUsersList.length,
      pendingSubmissionsCount: pendingSubsCount,
      pendingJobsCount,
      pendingAdsCount,
      pendingDepositsCount,
      pendingDepositsUSD,
      pendingWithdrawalsCount,
      pendingWithdrawalsUSD,

      pendingUsersList,
    };
  } catch (err) {
    console.warn('Error fetching live admin stats, calculating local fallback:', err);
    // Local fallback calculation
    const deletedList = getDeletedUsers();
    const deletedIds = new Set(deletedList.map(d => String(d.id || '').toLowerCase().trim()).filter(Boolean));
    const deletedEmails = new Set(deletedList.map(d => String(d.email || '').toLowerCase().trim()).filter(Boolean));

    const allUsers = getLocalUsers().filter((u: any) => {
      const isAdmin = checkIsAdmin({ email: u.email, username: u.username, role: u.role });
      if (isAdmin) return false;
      const uId = String(u.id || '').toLowerCase().trim();
      const uEmail = String(u.email || '').toLowerCase().trim();
      if (deletedIds.has(uId) || (uEmail && deletedEmails.has(uEmail))) return false;
      if (isUserDeleted(u.id) || (u.email && isUserDeleted(u.email))) return false;
      if (u.status === 'deleted' || u.role === 'deleted') return false;
      return true;
    });

    const pendingUsersList = allUsers.filter((u: any) => (u.status === 'pending' || u.is_pending) && u.status !== 'active');
    let totalUserDepositBal = 0;
    let totalUserEarnBal = 0;
    allUsers.forEach((u: any) => {
      totalUserDepositBal += Number(u.deposit_balance ?? 0);
      totalUserEarnBal += Number(u.earning_balance ?? 0);
    });

    const validJobs = getLocalJobs().filter((j: any) => j.status !== 'deleted');
    const validSubs = getLocalSubmissions();
    const validAds = getLocalAds().filter((a: any) => a.status !== 'deleted');
    const localDeps = getLocalDeposits();
    const localWiths = getLocalWithdrawals();

    let totalDepositUSD = 0;
    let pendingDepositsCount = 0;
    let pendingDepositsUSD = 0;
    localDeps.forEach((d: any) => {
      const amt = Number(d.amount) || 0;
      if (d.status === 'approved') totalDepositUSD += amt;
      if (d.status === 'pending') {
        pendingDepositsCount++;
        pendingDepositsUSD += amt;
      }
    });

    let totalWithdrawalUSD = 0;
    let pendingWithdrawalsCount = 0;
    let pendingWithdrawalsUSD = 0;
    localWiths.forEach((w: any) => {
      const amt = Number(w.amount) || 0;
      if (w.status === 'approved') totalWithdrawalUSD += amt;
      if (w.status === 'pending') {
        pendingWithdrawalsCount++;
        pendingWithdrawalsUSD += amt;
      }
    });

    return {
      totalUsers: allUsers.length,
      totalTasks: validJobs.length,
      totalSubmissions: validSubs.length,
      totalAds: validAds.length,
      totalDepositUSD,
      totalWithdrawalUSD,
      totalUserDepositBalanceUSD: totalUserDepositBal,
      totalUserEarningBalanceUSD: totalUserEarnBal,

      pendingUsersCount: pendingUsersList.length,
      pendingSubmissionsCount: validSubs.filter((s: any) => s.status === 'pending').length,
      pendingJobsCount: validJobs.filter((j: any) => j.status === 'pending').length,
      pendingAdsCount: validAds.filter((a: any) => a.status === 'pending').length,
      pendingDepositsCount,
      pendingDepositsUSD,
      pendingWithdrawalsCount,
      pendingWithdrawalsUSD,

      pendingUsersList,
    };
  }
}
