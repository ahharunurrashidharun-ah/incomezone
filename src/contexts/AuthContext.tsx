import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, formatUserDisplayId } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';
import { 
  saveLocalUser, 
  getLocalUser, 
  isUserBlocked, 
  isUserDeleted,
  deleteLocalUser,
  syncDeletedUsersWithRemote
} from '../lib/localFallbackStore';

export interface UserProfile {
  id: string;
  display_id?: number | string;
  displayId?: number | string;
  email: string;
  name?: string;
  username?: string;
  depositBalance: number;
  earningBalance: number;
  role: string;
  status?: string;
  is_pending?: boolean;
  ip_address?: string;
  isLocked?: boolean;
  createdAt?: string;
}

export interface AppUser extends User {
  uid: string;
  display_id?: number | string;
  displayId?: number | string;
  name?: string;
  username?: string;
  depositBalance?: number;
  earningBalance?: number;
  role?: string;
  status?: string;
  is_pending?: boolean;
  ip_address?: string;
  isLocked?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  updateBalances: (depositChange: number, earningChange: number) => void;
  setDirectBalances: (balances: { depositBalance?: number; earningBalance?: number }) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
  logout: async () => {},
  updateBalances: () => {},
  setDirectBalances: () => {},
});

const AUTH_SESSION_KEY = 'iz_auth_session';
const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

interface StoredSession {
  user: AppUser;
  profile: UserProfile;
  lastActivityAt: number;
}

export const getValidStoredSession = (): { user: AppUser; profile: UserProfile } | null => {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed: StoredSession = JSON.parse(raw);
    if (!parsed || !parsed.user || !parsed.profile) return null;

    const now = Date.now();
    const lastActivity = Number(parsed.lastActivityAt || 0);

    // If more than 3 hours have passed, expire the session
    if (now - lastActivity > SESSION_TIMEOUT_MS) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }

    // If account was deleted or blocked by Admin, invalidate stored session (never lock out primary admin)
    if (parsed.user?.id || parsed.profile?.id || parsed.user?.email) {
      const uId = parsed.user?.id || parsed.profile?.id || '';
      const uEmail = parsed.user?.email || parsed.profile?.email || '';
      const isAdminSess = checkIsAdmin({ email: uEmail, username: parsed.profile?.username || parsed.user?.username });
      if (isAdminSess) {
        if (parsed.profile) {
          parsed.profile.role = 'admin';
          parsed.profile.isLocked = false;
        }
        if (parsed.user) {
          parsed.user.role = 'admin';
          parsed.user.isLocked = false;
        }
      } else {
        if (isUserDeleted(uId) || isUserDeleted(uEmail)) {
          localStorage.removeItem(AUTH_SESSION_KEY);
          return null;
        }
        if (isUserBlocked(uId) || isUserBlocked(uEmail) || parsed.profile?.isLocked || parsed.user?.isLocked) {
          // Keep profile as locked
          if (parsed.profile) parsed.profile.isLocked = true;
          if (parsed.user) parsed.user.isLocked = true;
        }
      }
    }

    // Touch last activity timestamp
    parsed.lastActivityAt = now;
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
    return { user: parsed.user, profile: parsed.profile };
  } catch {
    return null;
  }
};

export const saveStoredSession = (user: AppUser, profile: UserProfile) => {
  try {
    const payload: StoredSession = {
      user,
      profile,
      lastActivityAt: Date.now(),
    };
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save session to storage:', e);
  }
};

export const clearStoredSession = () => {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {}
};

let lastTouchTime = 0;
export const touchSessionActivity = () => {
  const now = Date.now();
  if (now - lastTouchTime < 15000) return; // Throttle storage writes to once every 15s
  lastTouchTime = now;
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return;
    const parsed: StoredSession = JSON.parse(raw);
    if (parsed) {
      parsed.lastActivityAt = now;
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(parsed));
    }
  } catch {}
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialSession = getValidStoredSession();
  const [user, setUser] = useState<AppUser | null>(initialSession ? initialSession.user : null);
  const [profile, setProfile] = useState<UserProfile | null>(initialSession ? initialSession.profile : null);
  const [loading, setLoading] = useState<boolean>(!initialSession);

  const fetchProfile = async (authUserId: string, authUser: User) => {
    try {
      const email = authUser.email || '';
      const fallbackName = 
        authUser.user_metadata?.name || 
        authUser.user_metadata?.full_name || 
        email.split('@')[0] || 
        'User';
      const fallbackUsername = 
        authUser.user_metadata?.username || 
        authUser.user_metadata?.user_name || 
        email.split('@')[0] || 
        'user';
      const isAutoAdmin = checkIsAdmin({ email, username: fallbackUsername, user_metadata: authUser.user_metadata });
      const defaultRole = isAutoAdmin ? 'admin' : (authUser.user_metadata?.role || 'user');

      let userRow: any = null;

      // 1. Sync remote deleted accounts archive from Supabase settings table first
      try {
        await syncDeletedUsersWithRemote();
      } catch {}

      // 1.2 Check if user account was deleted by Admin BEFORE querying or upserting
      if (!isAutoAdmin && (isUserDeleted(authUserId) || (email && isUserDeleted(email)))) {
        clearStoredSession();
        setUser(null);
        setProfile(null);
        try {
          await supabase.auth.signOut();
        } catch {}
        return;
      }

      // 1.4 Try to fetch from users table
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();

        if (!error && data) {
          userRow = data;
        }
      } catch (e) {
        console.warn('Initial profile select warning:', e);
      }

      // 1.6 If DB userRow indicates user was marked deleted by Admin, lock them out permanently (unless primary admin)!
      if (!isAutoAdmin && userRow && (userRow.status === 'deleted' || userRow.role === 'deleted')) {
        deleteLocalUser(authUserId, 'Account marked as deleted by Administrator', userRow);
        clearStoredSession();
        setUser(null);
        setProfile(null);
        try {
          await supabase.auth.signOut();
        } catch {}
        return;
      }

      // 1.8 Check if user account was deleted by Admin BEFORE doing any DB upserts
      if (!isAutoAdmin && (isUserDeleted(authUserId) || (email && isUserDeleted(email)))) {
        clearStoredSession();
        setUser(null);
        setProfile(null);
        try {
          await supabase.auth.signOut();
        } catch {}
        return;
      }

      // Check if user is known to be pending or blocked locally or in fallback store
      const localUserData = getLocalUser(authUserId);
      const isKnownPending = Boolean(
        localUserData &&
        localUserData.status !== 'active' &&
        (localUserData.status === 'pending' || localUserData.is_pending)
      );
      const isKnownBlocked = !isKnownPending && Boolean(
        localUserData?.is_locked ||
        localUserData?.role === 'blocked' ||
        localUserData?.status === 'blocked' ||
        isUserBlocked(authUserId) ||
        (email && isUserBlocked(email))
      );

      // 2. If row not found in users table, attempt auto-upsert ONLY if NOT in deleted archive!
      if (!userRow) {
        // If user is deleted, DO NOT resurrect or auto-upsert!
        if (!isAutoAdmin && (isUserDeleted(authUserId) || (email && isUserDeleted(email)))) {
          clearStoredSession();
          setUser(null);
          setProfile(null);
          try {
            await supabase.auth.signOut();
          } catch {}
          return;
        }

        const metaPending = !isAutoAdmin && Boolean(
          isKnownPending ||
          authUser.user_metadata?.is_pending ||
          authUser.user_metadata?.status === 'pending'
        );
        try {
          const newUserData = {
            id: authUserId,
            email: email,
            name: fallbackName,
            username: fallbackUsername,
            deposit_balance: 0,
            earning_balance: 0,
            role: isAutoAdmin ? 'admin' : (metaPending ? 'user' : (isKnownBlocked ? 'blocked' : defaultRole)),
            is_locked: isAutoAdmin ? false : isKnownBlocked,
            status: isAutoAdmin ? 'active' : (metaPending ? 'pending' : (isKnownBlocked ? 'blocked' : 'active')),
            is_pending: isAutoAdmin ? false : metaPending,
          };

          const { data: inserted, error: insertError } = await supabase
            .from('users')
            .upsert(newUserData, { onConflict: 'id' })
            .select()
            .maybeSingle();

          if (!insertError && inserted) {
            userRow = inserted;
          } else {
            userRow = newUserData;
          }
        } catch {
          userRow = {
            id: authUserId,
            email: email,
            name: fallbackName,
            username: fallbackUsername,
            deposit_balance: 0,
            earning_balance: 0,
            role: isAutoAdmin ? 'admin' : (metaPending ? 'user' : (isKnownBlocked ? 'blocked' : defaultRole)),
            is_locked: isAutoAdmin ? false : isKnownBlocked,
            status: isAutoAdmin ? 'active' : (metaPending ? 'pending' : (isKnownBlocked ? 'blocked' : 'active')),
            is_pending: isAutoAdmin ? false : metaPending,
          };
        }
      } else if (isAutoAdmin && (userRow.role !== 'admin' || userRow.is_locked || userRow.is_pending || userRow.status !== 'active')) {
        // Ensure primary admin row in DB is always promoted to active admin
        try {
          await supabase
            .from('users')
            .update({
              role: 'admin',
              status: 'active',
              is_pending: false,
              is_locked: false,
              pending_reason: null,
            })
            .eq('id', authUserId);
          userRow = { ...userRow, role: 'admin', status: 'active', is_pending: false, is_locked: false, pending_reason: null };
        } catch {}
      }

      // Check again if user is archived in deleted list
      if (!isAutoAdmin && (isUserDeleted(authUserId) || (userRow?.email && isUserDeleted(userRow.email)) || userRow?.status === 'deleted' || userRow?.role === 'deleted')) {
        clearStoredSession();
        setUser(null);
        setProfile(null);
        try {
          await supabase.auth.signOut();
        } catch {}
        return;
      }

      // Separate pending status from blocked status (never restrict primary admin)
      const isPendingUser = isAutoAdmin ? false : Boolean(
        userRow.status === 'pending' ||
        userRow.is_pending ||
        (userRow.status !== 'active' && (localUserData?.status === 'pending' || localUserData?.is_pending))
      );

      const isLockedUser = (isAutoAdmin || isPendingUser) ? false : Boolean(
        userRow.is_locked || 
        userRow.isLocked || 
        userRow.status === 'blocked' ||
        userRow.role === 'blocked' ||
        (userRow.status !== 'active' && (
          localUserData?.is_locked ||
          localUserData?.role === 'blocked' ||
          localUserData?.status === 'blocked' ||
          isUserBlocked(authUserId) ||
          (userRow.email && isUserBlocked(userRow.email))
        ))
      );

      const finalRole = (isAutoAdmin || userRow.role === 'admin') ? 'admin' : (userRow.role || defaultRole);
      const resolvedStatus = isAutoAdmin
        ? 'active'
        : isPendingUser
          ? 'pending'
          : isLockedUser
            ? 'blocked'
            : (userRow.status || 'active');

      // 3. Map profile state cleanly
      const displayIdVal = formatUserDisplayId(userRow.display_id ?? userRow.displayId, authUserId);
      const mappedProfile: UserProfile = {
        id: authUserId,
        display_id: displayIdVal,
        displayId: displayIdVal,
        email: userRow.email || email,
        name: userRow.name || fallbackName,
        username: userRow.username || fallbackUsername,
        depositBalance: Number(userRow.deposit_balance ?? userRow.depositBalance ?? 0),
        earningBalance: Number(userRow.earning_balance ?? userRow.earningBalance ?? 0),
        role: isPendingUser ? 'pending' : (isLockedUser ? 'blocked' : finalRole),
        status: resolvedStatus,
        is_pending: isPendingUser,
        ip_address: userRow.ip_address || localUserData?.ip_address || '',
        isLocked: isLockedUser,
        createdAt: userRow.created_at || userRow.createdAt || new Date().toISOString(),
      };
      
      const appUser: AppUser = {
        ...authUser,
        uid: authUser.id,
        display_id: mappedProfile.display_id,
        displayId: mappedProfile.displayId,
        name: mappedProfile.name,
        username: mappedProfile.username,
        depositBalance: mappedProfile.depositBalance,
        earningBalance: mappedProfile.earningBalance,
        role: mappedProfile.role,
        status: resolvedStatus,
        is_pending: isPendingUser,
        ip_address: mappedProfile.ip_address,
        isLocked: isLockedUser,
      };

      setProfile(mappedProfile);
      setUser(appUser);
      saveStoredSession(appUser, mappedProfile);

    } catch (err) {
      console.error('Failed to resolve user profile:', err);
      // Fallback to basic session user to prevent app lockouts
      const email = authUser.email || '';
      if (isUserDeleted(authUser.id) || (email && isUserDeleted(email))) {
        clearStoredSession();
        setUser(null);
        setProfile(null);
        return;
      }
      const localUserData = getLocalUser(authUser.id);
      const isPendingUser = Boolean(
        localUserData && localUserData.status !== 'active' && (localUserData.status === 'pending' || localUserData.is_pending)
      );
      const isLockedUser = !isPendingUser && Boolean(
        localUserData?.is_locked ||
        localUserData?.role === 'blocked' ||
        localUserData?.status === 'blocked' ||
        isUserBlocked(authUser.id) ||
        (email && isUserBlocked(email))
      );
      const fallbackUser = authUser.user_metadata?.username || email.split('@')[0] || 'user';
      const fallbackRole = checkIsAdmin({ email, username: fallbackUser, user_metadata: authUser.user_metadata })
        ? 'admin'
        : isPendingUser
          ? 'pending'
          : isLockedUser
            ? 'blocked'
            : 'user';
      const fallbackStatus = fallbackRole === 'admin' ? 'active' : isPendingUser ? 'pending' : isLockedUser ? 'blocked' : 'active';
      const fallbackProfile: UserProfile = {
        id: authUser.id,
        email,
        name: authUser.user_metadata?.name || email.split('@')[0] || 'User',
        username: fallbackUser,
        depositBalance: 0,
        earningBalance: 0,
        role: fallbackRole,
        status: fallbackStatus,
        is_pending: isPendingUser,
        ip_address: localUserData?.ip_address || '',
        isLocked: isLockedUser,
      };
      const fallbackAppUser: AppUser = {
        ...authUser,
        uid: authUser.id,
        name: fallbackProfile.name,
        username: fallbackProfile.username,
        depositBalance: 0,
        earningBalance: 0,
        role: fallbackRole,
        status: fallbackStatus,
        is_pending: isPendingUser,
        ip_address: fallbackProfile.ip_address,
        isLocked: isLockedUser,
      };
      setUser(fallbackAppUser);
      setProfile(fallbackProfile);
      saveStoredSession(fallbackAppUser, fallbackProfile);
    }
  };

  const updateBalances = (depositChange: number, earningChange: number) => {
    if (!user) return;

    // Security Guard: Prevent any client-side fake or test balance injection
    // Balance increases MUST only be credited via official Admin approval (deposits, tasks)
    if (depositChange > 0 || earningChange > 0) {
      console.warn("Unauthorized client-side balance addition blocked.");
      return;
    }

    const currentDeposit = Number(profile?.depositBalance ?? user?.depositBalance ?? 0);
    const currentEarning = Number(profile?.earningBalance ?? user?.earningBalance ?? 0);
    const newDeposit = Math.max(0, Number((currentDeposit + depositChange).toFixed(2)));
    const newEarning = Math.max(0, Number((currentEarning + earningChange).toFixed(2)));

    const updatedProfile: UserProfile = {
      ...(profile || {
        id: user.uid,
        email: user.email || '',
        name: user.name || 'User',
        username: user.username || 'user',
        role: user.role || 'user',
        isLocked: false,
        createdAt: new Date().toISOString(),
      }),
      depositBalance: newDeposit,
      earningBalance: newEarning,
    };

    const updatedUser: AppUser = {
      ...user,
      depositBalance: newDeposit,
      earningBalance: newEarning,
    };

    setProfile(updatedProfile);
    setUser(updatedUser);
    saveStoredSession(updatedUser, updatedProfile);
    saveLocalUser(user.uid, { deposit_balance: newDeposit, earning_balance: newEarning });

    (async () => {
      try {
        await supabase
          .from('users')
          .update({
            deposit_balance: newDeposit,
            earning_balance: newEarning,
          })
          .eq('id', user.uid);
      } catch (err) {
        console.warn('Balance background update notice:', err);
      }
    })();

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('iz_balance_updated', {
        detail: {
          source: 'auth_context',
          userId: user.uid,
          depositBalance: newDeposit,
          earningBalance: newEarning,
        }
      }));
    }, 0);
  };

  const setDirectBalances = (balances: { depositBalance?: number; earningBalance?: number }) => {
    if (!user) return;
    const currentDeposit = Number(profile?.depositBalance ?? user?.depositBalance ?? 0);
    const currentEarning = Number(profile?.earningBalance ?? user?.earningBalance ?? 0);
    const newDeposit = balances.depositBalance !== undefined
      ? Math.max(0, Number(balances.depositBalance.toFixed(2)))
      : currentDeposit;
    const newEarning = balances.earningBalance !== undefined
      ? Math.max(0, Number(balances.earningBalance.toFixed(2)))
      : currentEarning;

    const updatedProfile: UserProfile = {
      ...(profile || {
        id: user.uid,
        email: user.email || '',
        name: user.name || 'User',
        username: user.username || 'user',
        role: user.role || 'user',
        isLocked: false,
        createdAt: new Date().toISOString(),
      }),
      depositBalance: newDeposit,
      earningBalance: newEarning,
    };

    const updatedUser: AppUser = {
      ...user,
      depositBalance: newDeposit,
      earningBalance: newEarning,
    };

    setProfile(updatedProfile);
    setUser(updatedUser);
    saveStoredSession(updatedUser, updatedProfile);
    saveLocalUser(user.uid, { deposit_balance: newDeposit, earning_balance: newEarning });

    (async () => {
      try {
        await supabase
          .from('users')
          .update({
            deposit_balance: newDeposit,
            earning_balance: newEarning,
          })
          .eq('id', user.uid);
      } catch (err) {
        console.warn('Direct balance update notice:', err);
      }
    })();

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('iz_balance_updated', {
        detail: {
          source: 'auth_context',
          userId: user.uid,
          depositBalance: newDeposit,
          earningBalance: newEarning,
        }
      }));
    }, 0);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid, user);
    }
  };

  const signOut = async () => {
    clearStoredSession();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setUser(null);
    setProfile(null);
  };

  useEffect(() => {
    let mounted = true;

    // 1. Initial auth check
    const initializeAuth = async () => {
      try {
        // Check if stored session has exceeded 3 hours
        const validSession = getValidStoredSession();
        if (!validSession) {
          clearStoredSession();
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        // Active session under 3 hours is preserved
        if (mounted) {
          setUser(validSession.user);
          setProfile(validSession.profile);
        }

        // Validate or refresh with Supabase in background
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session?.user && mounted) {
          await fetchProfile(session.user.id, session.user);
        }
      } catch (err) {
        console.error('Error fetching initial session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          if (mounted) await fetchProfile(session.user.id, session.user);
        } else if (event === 'SIGNED_OUT') {
          clearStoredSession();
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        } else {
          // If event has no active session, ensure local session is checked
          const valid = getValidStoredSession();
          if (!valid && mounted) {
            setUser(null);
            setProfile(null);
          }
        }
        if (mounted) setLoading(false);
      }
    );

    // 3. User activity tracking to keep session alive during active usage
    const handleUserActivity = () => {
      touchSessionActivity();
    };

    window.addEventListener('mousedown', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });

    // 4. Inactivity checker: runs every 30 seconds to automatically logout after 3 hours of inactivity
    const inactivityInterval = setInterval(() => {
      const activeSession = getValidStoredSession();
      if (!activeSession) {
        // 3 hours expired!
        const hadUser = localStorage.getItem(AUTH_SESSION_KEY) !== null || user !== null;
        if (hadUser) {
          clearStoredSession();
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      }
    }, 30000);

    // 5. Cross-component balance synchronization listener
    const handleBalanceEvent = (e: any) => {
      if (!mounted) return;
      const detail = e.detail;
      // Skip events dispatched by auth_context itself to avoid loop
      if (detail && detail.source !== 'auth_context') {
        // If event specifies target userId, only apply to current user if matching
        if (detail.userId && user && detail.userId !== user.uid) {
          return;
        }

        const nextDeposit = typeof detail.depositBalance === 'number' ? detail.depositBalance : undefined;
        const nextEarning = typeof detail.earningBalance === 'number' ? detail.earningBalance : undefined;

        if (nextDeposit !== undefined || nextEarning !== undefined) {
          setProfile((prev) => {
            if (!prev) return prev;
            const updatedDep = nextDeposit !== undefined ? nextDeposit : prev.depositBalance;
            const updatedEarn = nextEarning !== undefined ? nextEarning : prev.earningBalance;
            if (prev.depositBalance === updatedDep && prev.earningBalance === updatedEarn) {
              return prev;
            }
            const updated = {
              ...prev,
              depositBalance: updatedDep,
              earningBalance: updatedEarn,
            };
            if (user) {
              saveStoredSession({ ...user, depositBalance: updatedDep, earningBalance: updatedEarn }, updated);
              saveLocalUser(user.uid, { deposit_balance: updatedDep, earning_balance: updatedEarn });
            }
            return updated;
          });

          setUser((prev) => {
            if (!prev) return prev;
            const updatedDep = nextDeposit !== undefined ? nextDeposit : (prev.depositBalance ?? 0);
            const updatedEarn = nextEarning !== undefined ? nextEarning : (prev.earningBalance ?? 0);
            return {
              ...prev,
              depositBalance: updatedDep,
              earningBalance: updatedEarn,
            };
          });
        }
      }
    };
    window.addEventListener('iz_balance_updated', handleBalanceEvent);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('iz_balance_updated', handleBalanceEvent);
      clearInterval(inactivityInterval);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        refreshProfile,
        signOut,
        logout: signOut,
        updateBalances,
        setDirectBalances,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
