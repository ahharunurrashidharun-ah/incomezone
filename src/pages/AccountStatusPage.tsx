import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getLocalUser, isUserBlocked, isUserDeleted } from '../lib/localFallbackStore';
import { useAuth, clearStoredSession } from '../contexts/AuthContext';
import AccountStatusModal, { AccountStatusType } from '../components/AccountStatusModal';
import toast from 'react-hot-toast';

interface AccountStatusState {
  status?: AccountStatusType;
  email?: string;
  name?: string;
  username?: string;
  ip?: string;
  reason?: string;
}

export default function AccountStatusPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [statusInfo] = useState<AccountStatusState>(() => {
    const fromState = location.state as AccountStatusState;
    if (fromState && fromState.status) {
      try {
        sessionStorage.setItem('iz_current_account_status', JSON.stringify(fromState));
      } catch {}
      return fromState;
    }
    try {
      const saved = sessionStorage.getItem('iz_current_account_status');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { status: 'blocked' };
  });

  const [checking, setChecking] = useState(false);
  const statusType: AccountStatusType = statusInfo.status || 'blocked';

  const handleCheckStatus = async () => {
    const targetEmail = statusInfo.email?.trim().toLowerCase();
    if (!targetEmail) {
      toast.error('যাচাই করার জন্য ইমেইল পাওয়া যায়নি।');
      return;
    }

    setChecking(true);
    try {
      let isNowActive = false;
      const { data: dbUser } = await supabase
        .from('users')
        .select('id, email, status, is_pending, is_locked, role')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (dbUser && dbUser.status === 'active' && !dbUser.is_pending && !dbUser.is_locked && dbUser.role !== 'blocked') {
        isNowActive = true;
      }

      const localUser = getLocalUser(dbUser?.id || targetEmail);
      if (!dbUser && localUser && localUser.status === 'active' && !localUser.is_pending && !localUser.is_locked) {
        isNowActive = true;
      }

      const currentlyBlocked = isUserBlocked(targetEmail);
      const currentlyDeleted = isUserDeleted(targetEmail);

      if (isNowActive && !currentlyBlocked && !currentlyDeleted) {
        toast.success('অভিনন্দন! আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক অনুমোদিত ও সক্রিয় করা হয়েছে। লগইন পেজে ফিরে গিয়ে সাইন ইন করুন।');
      } else {
        toast.error('আপনার অ্যাকাউন্টটি এখনো আইপি পেন্ডিংয়ে রয়েছে। অ্যাডমিন অ্যাপ্রুভ করলে সক্রিয় হবে।');
      }
    } catch (err: any) {
      toast.error('যাচাই করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
    } finally {
      setChecking(false);
    }
  };

  const handleReturnToLogin = async () => {
    try {
      sessionStorage.removeItem('iz_current_account_status');
      clearStoredSession();
      await signOut();
    } catch {}
    navigate('/login', { replace: true });
  };

  const handleCreateNewAccount = async () => {
    try {
      sessionStorage.removeItem('iz_current_account_status');
      clearStoredSession();
      await signOut();
    } catch {}
    navigate('/signup', { replace: true, state: { prefillEmail: statusInfo.email || '' } });
  };

  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-[#090514] dark:via-[#0f0926] dark:to-[#080512] min-h-screen flex flex-col font-sans relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 left-0 w-full h-[500px] bg-purple-900/10 dark:bg-purple-900/20 rounded-full blur-[140px] pointer-events-none -translate-y-1/2"></div>

      <nav className="w-full p-6 sm:p-8 flex justify-between items-center z-20 max-w-5xl mx-auto">
        <Link to="/" className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-600 dark:bg-gradient-to-tr dark:from-amber-400 dark:to-yellow-500 flex items-center justify-center text-white dark:text-slate-950 shadow-md font-black text-sm">
            IZ
          </div>
          <span>
            Income<span className="text-purple-600 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">Zone</span>
          </span>
        </Link>

        <button
          onClick={handleReturnToLogin}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-purple-200 bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/30 hover:bg-slate-100 dark:hover:bg-[#1c1042] transition-all cursor-pointer shadow-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>লগইন পেজে ফিরে যান</span>
        </button>
      </nav>

      <div className="flex-grow flex items-center justify-center p-4 sm:p-6 z-10">
        <AccountStatusModal
          embedded
          status={statusType}
          email={statusInfo.email}
          ip={statusInfo.ip}
          onClose={handleReturnToLogin}
          onCreateNewAccount={statusType === 'deleted' ? handleCreateNewAccount : undefined}
          onCheckStatus={statusType === 'pending' ? handleCheckStatus : undefined}
          checkingStatus={checking}
        />
      </div>
    </div>
  );
}
