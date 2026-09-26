import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, formatUserDisplayId } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';

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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
  logout: async () => {},
  updateBalances: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

      // 1. Try to fetch from users table
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

      // 2. If row not found in users table, attempt auto-upsert
      if (!userRow) {
        try {
          const newUserData = {
            id: authUserId,
            email: email,
            name: fallbackName,
            username: fallbackUsername,
            deposit_balance: 0,
            earning_balance: 0,
            role: defaultRole,
            is_locked: false,
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
            role: defaultRole,
            is_locked: false,
          };
        }
      }

      const finalRole = (isAutoAdmin || userRow.role === 'admin') ? 'admin' : (userRow.role || defaultRole);

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
        role: finalRole,
        isLocked: Boolean(userRow.is_locked || userRow.isLocked),
        createdAt: userRow.created_at || userRow.createdAt || new Date().toISOString(),
      };
      
      setProfile(mappedProfile);
      
      setUser({
        ...authUser,
        uid: authUser.id,
        display_id: mappedProfile.display_id,
        displayId: mappedProfile.displayId,
        name: mappedProfile.name,
        username: mappedProfile.username,
        depositBalance: mappedProfile.depositBalance,
        earningBalance: mappedProfile.earningBalance,
        role: mappedProfile.role,
        isLocked: mappedProfile.isLocked,
      });

    } catch (err) {
      console.error('Failed to resolve user profile:', err);
      // Fallback to basic session user to prevent app lockouts
      const email = authUser.email || '';
      const fallbackUser = authUser.user_metadata?.username || email.split('@')[0] || 'user';
      const fallbackRole = checkIsAdmin({ email, username: fallbackUser, user_metadata: authUser.user_metadata }) ? 'admin' : 'user';
      setUser({
        ...authUser,
        uid: authUser.id,
        name: authUser.user_metadata?.name || email.split('@')[0] || 'User',
        username: fallbackUser,
        depositBalance: 0,
        earningBalance: 0,
        role: fallbackRole,
        isLocked: false,
      });
    }
  };

  const updateBalances = (depositChange: number, earningChange: number) => {
    if (!user) return;
    setProfile((prev) => {
      if (!prev) return prev;
      const newDeposit = Math.max(0, prev.depositBalance + depositChange);
      const newEarning = Math.max(0, prev.earningBalance + earningChange);
      
      // Update Supabase in background
      (async () => {
        try {
          const { error } = await supabase
            .from('users')
            .update({
              deposit_balance: newDeposit,
              earning_balance: newEarning,
            })
            .eq('id', user.uid);
            
          if (error) {
            console.error('Supabase balance update error:', error.message);
          }
        } catch (err) {
          console.warn('Balance background update notice:', err);
        }
      })();

      return {
        ...prev,
        depositBalance: newDeposit,
        earningBalance: newEarning,
      };
    });
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid, user);
    }
  };

  const signOut = async () => {
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

    const initializeAuth = async () => {
      try {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          if (mounted) await fetchProfile(session.user.id, session.user);
        } else {
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
