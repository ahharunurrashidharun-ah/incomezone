import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isUserBlocked, isUserDeleted, isUserPending, getLocalUser } from '../lib/localFallbackStore';
import { supabase } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';
import AccountStatusModal from './AccountStatusModal';
import toast from 'react-hot-toast';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, logout, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingStatus, setCheckingStatus] = useState(false);

  if (loading) {
    return (
      <div className="bg-[#0a0718] min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isPrimaryAdmin = checkIsAdmin(user) || checkIsAdmin(profile);
  const uId = user.uid || user.id || '';
  const uEmail = user.email || '';

  const isDeleted = !isPrimaryAdmin && Boolean(
    user.status === 'deleted' ||
    profile?.status === 'deleted' ||
    user.role === 'deleted' ||
    profile?.role === 'deleted' ||
    isUserDeleted(uId) ||
    isUserDeleted(uEmail)
  );

  const isPendingUser = !isPrimaryAdmin && !isDeleted && Boolean(
    user.status === 'pending' ||
    profile?.status === 'pending' ||
    user.role === 'pending' ||
    profile?.role === 'pending' ||
    user.is_pending ||
    profile?.is_pending ||
    isUserPending(uId) ||
    isUserPending(uEmail)
  );

  const isBlocked = !isPrimaryAdmin && !isDeleted && !isPendingUser && Boolean(
    user.isLocked ||
    profile?.isLocked ||
    user.status === 'blocked' ||
    profile?.status === 'blocked' ||
    user.role === 'blocked' ||
    profile?.role === 'blocked' ||
    isUserBlocked(uId) ||
    isUserBlocked(uEmail)
  );

  const handleManualExitToLogin = async () => {
    try {
      await logout();
    } catch {}
    navigate('/login', { replace: true });
  };

  const handleManualCreateNewAccount = async () => {
    try {
      await logout();
    } catch {}
    navigate('/signup', { replace: true, state: { prefillEmail: uEmail } });
  };

  const handleManualCheckPending = async () => {
    if (!uId && !uEmail) return;
    setCheckingStatus(true);
    try {
      let dbUser: any = null;
      if (uId) {
        const { data } = await supabase.from('users').select('status, is_pending, is_locked').eq('id', uId).maybeSingle();
        dbUser = data;
      }
      if (!dbUser && uEmail) {
        const { data } = await supabase.from('users').select('status, is_pending, is_locked').ilike('email', uEmail).maybeSingle();
        dbUser = data;
      }
      const localUser = uId ? getLocalUser(uId) : null;
      const isNowActive = Boolean(
        (dbUser && dbUser.status === 'active' && !dbUser.is_pending && !dbUser.is_locked) ||
        (!dbUser && localUser && localUser.status === 'active' && !localUser.is_pending && !localUser.is_locked)
      );
      if (isNowActive) {
        await refreshProfile();
        toast.success('অভিনন্দন! আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক অনুমোদিত ও সক্রিয় হয়েছে।');
      } else {
        toast.error('আপনার অ্যাকাউন্টটি এখনো আইপি পেন্ডিংয়ে আছে। অ্যাডমিন অ্যাপ্রুভ করলে সক্রিয় হবে।');
      }
    } catch {
      toast.error('স্ট্যাটাস যাচাই করতে সমস্যা হয়েছে।');
    } finally {
      setCheckingStatus(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="bg-[#090514] min-h-screen">
        <AccountStatusModal
          status="deleted"
          email={uEmail}
          onClose={handleManualExitToLogin}
          onCreateNewAccount={handleManualCreateNewAccount}
        />
      </div>
    );
  }

  if (isPendingUser) {
    return (
      <div className="bg-[#090514] min-h-screen">
        <AccountStatusModal
          status="pending"
          email={uEmail}
          ip={user.ip_address || profile?.ip_address}
          onClose={handleManualExitToLogin}
          onCheckStatus={handleManualCheckPending}
          checkingStatus={checkingStatus}
        />
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="bg-[#090514] min-h-screen">
        <AccountStatusModal
          status="blocked"
          email={uEmail}
          ip={user.ip_address || profile?.ip_address}
          onClose={handleManualExitToLogin}
        />
      </div>
    );
  }

  return <>{children}</>;
}
