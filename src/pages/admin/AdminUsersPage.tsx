import React, { useEffect, useState } from 'react';
import { supabase, formatUserDisplayId } from '../../lib/supabaseClient';
import { 
  Trash2, 
  User, 
  Mail, 
  Calendar, 
  AlertCircle, 
  Edit2, 
  Lock, 
  Unlock, 
  X,
  Bell,
  Send,
  Key,
  ShieldAlert,
  CheckCircle2,
  DollarSign,
  RotateCcw,
  UserX,
  Archive,
  RefreshCw,
  Search
} from 'lucide-react';
import {
  getLocalUsers,
  saveLocalUser,
  deleteLocalUser,
  isTableMissingError,
  saveLocalNotification,
  getDeletedUsers,
  restoreDeletedUser,
  permanentPurgeDeletedUser,
  isUserDeleted,
  syncDeletedUsersWithRemote,
  pushDeletedUsersToRemote,
  syncLocalUsersFromRemote,
  clearOrphanedDeletedArchiveWhenEmpty,
  DeletedUserItem,
} from '../../lib/localFallbackStore';
import { checkIsAdmin } from '../../lib/adminConfig';
import toast from 'react-hot-toast';

interface UserData {
  id: string;
  display_id?: number | string;
  displayId?: number | string;
  name?: string;
  username?: string;
  email?: string;
  createdAt?: any;
  created_at?: any;
  depositBalance?: number;
  deposit_balance?: number;
  earningBalance?: number;
  isLocked?: boolean;
  is_locked?: boolean;
  status?: string;
  is_pending?: boolean;
  ip_address?: string;
  pending_reason?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<DeletedUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'locked' | 'pending' | 'deleted'>('all');

  // Modal States
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '', email: '', password: '' });
  
  const [editingBalanceUser, setEditingBalanceUser] = useState<UserData | null>(null);
  const [balanceForm, setBalanceForm] = useState({ deposit: 0, earning: 0 });

  const [notifUser, setNotifUser] = useState<UserData | null>(null);
  const [notifForm, setNotifForm] = useState({ title: '', message: '' });

  const [confirmLockUser, setConfirmLockUser] = useState<UserData | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserData | null>(null);
  const [confirmRestoreUser, setConfirmRestoreUser] = useState<DeletedUserItem | null>(null);
  const [confirmPurgeUser, setConfirmPurgeUser] = useState<DeletedUserItem | null>(null);
  const [actionProcessing, setActionProcessing] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 1. Fetch and synchronize deleted users from remote Supabase settings and store
      const deletedList = await syncDeletedUsersWithRemote();
      setDeletedUsers(deletedList);
      const deletedIds = new Set(deletedList.map(d => String(d.id || '').toLowerCase().trim()).filter(Boolean));
      const deletedEmails = new Set(deletedList.map(d => String(d.email || '').toLowerCase().trim()).filter(Boolean));

      const { data, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      // Auto-capture any deleted users from Supabase into deleted archive so they never leak into active
      if (data && data.length > 0) {
        data.forEach((ru: any) => {
          if (ru.status === 'deleted' || ru.role === 'deleted') {
            const ruId = String(ru.id || '').toLowerCase().trim();
            const ruEmail = String(ru.email || '').toLowerCase().trim();
            if (!deletedIds.has(ruId) && (!ruEmail || !deletedEmails.has(ruEmail))) {
              deleteLocalUser(ru.id, 'Deleted by Administrator', ru);
              deletedIds.add(ruId);
              if (ruEmail) deletedEmails.add(ruEmail);
            }
          }
        });
      }

      if (fetchErr && isTableMissingError(fetchErr)) {
        const local = getLocalUsers()
          .filter((u: any) => {
            if (checkIsAdmin({ email: u.email, username: u.username, role: u.role })) return false;
            const uId = String(u.id || '').toLowerCase().trim();
            const uEmail = String(u.email || '').toLowerCase().trim();
            if (deletedIds.has(uId)) return false;
            if (uEmail && deletedEmails.has(uEmail)) return false;
            if (isUserDeleted(u.id) || (u.email && isUserDeleted(u.email))) return false;
            if (u.status === 'deleted' || u.role === 'deleted') return false;
            return true;
          })
          .map((u: any) => ({
            id: u.id,
            display_id: u.display_id || u.displayId,
            displayId: u.display_id || u.displayId,
            name: u.name || u.email.split('@')[0],
            username: u.username || u.email.split('@')[0],
            email: u.email,
            createdAt: u.created_at,
            depositBalance: Number(u.deposit_balance || 0),
            earningBalance: Number(u.earning_balance || 0),
            isLocked: Boolean(u.is_locked || u.role === 'blocked'),
            status: (u.status === 'pending' || u.is_pending) ? 'pending' : ((u.is_locked || u.role === 'blocked') ? 'blocked' : 'active'),
            is_pending: Boolean(u.is_pending || u.status === 'pending'),
            ip_address: u.ip_address || '',
            pending_reason: u.pending_reason || (u.status === 'pending' ? 'Same IP Multi-Account' : ''),
          }));
        setUsers(local);
        return;
      }

      let rawList: any[] = [];
      if (!fetchErr && Array.isArray(data)) {
        rawList = [...data];
        syncLocalUsersFromRemote(rawList);
        const hasAnyDeletedRow = rawList.some((u: any) => u.status === 'deleted' || u.role === 'deleted');
        const nonAdminRaw = rawList.filter(
          (u: any) => !checkIsAdmin({ email: u.email, username: u.username, role: u.role, user_metadata: u.raw_user_meta_data })
        );
        if (!hasAnyDeletedRow && nonAdminRaw.length === 0) {
          await clearOrphanedDeletedArchiveWhenEmpty();
          setDeletedUsers([]);
        }
      } else {
        rawList = getLocalUsers();
      }

      // Filter out admin accounts and any user in deleted archive or marked deleted
      const activeRawList = rawList.filter(u => {
        if (checkIsAdmin({ email: u.email, username: u.username, role: u.role, user_metadata: u.raw_user_meta_data })) return false;
        const uId = String(u.id || '').toLowerCase().trim();
        const uEmail = String(u.email || '').toLowerCase().trim();
        if (deletedIds.has(uId)) return false;
        if (uEmail && deletedEmails.has(uEmail)) return false;
        if (isUserDeleted(u.id) || (u.email && isUserDeleted(u.email))) return false;
        if (u.status === 'deleted' || u.role === 'deleted') return false;
        return true;
      });

      const mappedUsers = activeRawList.map((u: any) => ({
        id: u.id,
        display_id: u.display_id ?? u.displayId,
        displayId: u.display_id ?? u.displayId,
        name: u.name || u.raw_user_meta_data?.name || u.email?.split('@')[0] || '',
        username: u.username || u.raw_user_meta_data?.username || u.email?.split('@')[0] || '',
        email: u.email || '',
        createdAt: u.created_at || u.createdAt,
        depositBalance: Number(u.depositBalance ?? u.deposit_balance ?? 0),
        earningBalance: Number(u.earningBalance ?? u.earning_balance ?? 0),
        isLocked: !!(u.isLocked ?? u.is_locked ?? (u.status === 'blocked') ?? (u.role === 'blocked')),
        status: (u.status === 'pending' || u.is_pending) ? 'pending' : ((u.is_locked || u.role === 'blocked' || u.status === 'blocked') ? 'blocked' : 'active'),
        is_pending: Boolean(u.is_pending || u.status === 'pending'),
        ip_address: u.ip_address || u.ipAddress || '',
        pending_reason: u.pending_reason || (u.status === 'pending' ? 'Same IP Multi-Account' : ''),
      }));

      setUsers(mappedUsers);
    } catch {
      const deletedList = getDeletedUsers();
      setDeletedUsers(deletedList);
      const deletedIds = new Set(deletedList.map(d => String(d.id || '').toLowerCase().trim()).filter(Boolean));
      const deletedEmails = new Set(deletedList.map(d => String(d.email || '').toLowerCase().trim()).filter(Boolean));
      const local = getLocalUsers()
        .filter((u: any) => {
          const uId = String(u.id || '').toLowerCase().trim();
          const uEmail = String(u.email || '').toLowerCase().trim();
          if (deletedIds.has(uId)) return false;
          if (uEmail && deletedEmails.has(uEmail)) return false;
          if (isUserDeleted(u.id) || (u.email && isUserDeleted(u.email))) return false;
          if (u.status === 'deleted' || u.role === 'deleted') return false;
          return true;
        })
        .map((u: any) => ({
          id: u.id,
          display_id: u.display_id || u.displayId,
          displayId: u.display_id || u.displayId,
          name: u.name || u.email.split('@')[0],
          username: u.username || u.email.split('@')[0],
          email: u.email,
          createdAt: u.created_at,
          depositBalance: Number(u.deposit_balance || 0),
          earningBalance: Number(u.earning_balance || 0),
          isLocked: Boolean(u.is_locked || u.role === 'blocked'),
          status: (u.status === 'pending' || u.is_pending) ? 'pending' : ((u.is_locked || u.role === 'blocked') ? 'blocked' : 'active'),
          is_pending: Boolean(u.is_pending || u.status === 'pending'),
          ip_address: u.ip_address || '',
          pending_reason: u.pending_reason || (u.status === 'pending' ? 'Same IP Multi-Account' : ''),
        }));
      setUsers(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    const handleUsersUpdate = () => {
      fetchUsers();
    };

    window.addEventListener('iz_users_updated', handleUsersUpdate);
    return () => {
      window.removeEventListener('iz_users_updated', handleUsersUpdate);
    };
  }, []);

  // Action: Soft Delete User -> Move to Deleted Accounts Archive
  const handleConfirmDelete = async () => {
    if (!confirmDeleteUser) return;
    const target = confirmDeleteUser;
    setActionProcessing(true);

    try {
      // 1. Move to deleted archive in localFallbackStore with complete target object
      deleteLocalUser(target.id, 'Deleted by Admin', target);
      const updatedDeleted = getDeletedUsers();
      setDeletedUsers(updatedDeleted);

      // 2. Persist to remote Supabase settings table so all devices and sessions know this user is deleted
      await pushDeletedUsersToRemote(updatedDeleted);

      // 3. Keep row in Supabase users table with status: 'deleted', role: 'deleted', is_locked: true
      // CRITICAL: We do NOT delete the row from users table during soft delete!
      // This prevents the auth listener from detecting an empty row and auto-recreating it as active!
      const { error: delUpdateErr } = await supabase
        .from('users')
        .update({
          status: 'deleted',
          role: 'deleted',
          is_locked: true,
        })
        .eq('id', target.id);

      if (delUpdateErr && !isTableMissingError(delUpdateErr)) {
        throw new Error(`ডাটাবেজে ইউজার ডিলিট আপডেট হয়নি: ${delUpdateErr.message}`);
      }

      if (target.email) {
        await supabase
          .from('users')
          .update({
            status: 'deleted',
            role: 'deleted',
            is_locked: true,
          })
          .eq('email', target.email);
      }

      setUsers(prev => prev.filter(u => {
        const matchId = u.id === target.id;
        const matchEmail = Boolean(target.email && u.email && u.email.toLowerCase().trim() === target.email.toLowerCase().trim());
        return !matchId && !matchEmail;
      }));
      window.dispatchEvent(new CustomEvent('iz_users_updated'));
      toast.success(`ইউজার ${target.name || target.email} সফলভাবে ডিলিট তালিকায় স্থানান্তর করা হয়েছে!`);
      setConfirmDeleteUser(null);
    } catch (err: any) {
      toast.error('ইউজার ডিলিট করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setActionProcessing(false);
    }
  };

  // Action: Recover User from Deleted Archive (Manual Only)
  const handleConfirmRestore = async () => {
    if (!confirmRestoreUser) return;
    const target = confirmRestoreUser;
    setActionProcessing(true);

    try {
      const restored = restoreDeletedUser(target.id);
      if (!restored) {
        throw new Error('Failed to restore user from archive');
      }

      const updatedDeleted = getDeletedUsers();
      setDeletedUsers(updatedDeleted);
      await pushDeletedUsersToRemote(updatedDeleted);

      // Upsert back to database with active status
      try {
        await supabase
          .from('users')
          .upsert({
            id: restored.id,
            email: restored.email,
            name: restored.name,
            username: restored.username,
            deposit_balance: restored.deposit_balance,
            earning_balance: restored.earning_balance,
            role: 'user',
            is_locked: false,
            status: 'active',
          }, { onConflict: 'id' });
      } catch (dbErr) {
        console.warn('DB restore upsert note:', dbErr);
      }

      await fetchUsers();
      toast.success(`ইউজার "${target.name || target.email}" সফলভাবে রিকভার করা হয়েছে!`);
      setConfirmRestoreUser(null);
    } catch (err: any) {
      toast.error('ইউজার রিকভার করতে ব্যর্থ হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setActionProcessing(false);
    }
  };

  // Action: Permanent Purge from Deleted Archive
  const handleConfirmPermanentPurge = async () => {
    if (!confirmPurgeUser) return;
    const target = confirmPurgeUser;
    setActionProcessing(true);

    try {
      // 1. Purge from local store and free IP registrations
      permanentPurgeDeletedUser(target.id, target.email);
      const updatedDeleted = getDeletedUsers();
      setDeletedUsers(updatedDeleted);
      await pushDeletedUsersToRemote(updatedDeleted);

      // 2. Permanently delete from Supabase DB users table
      const { error: purgeErr } = await supabase
        .from('users')
        .delete()
        .eq('id', target.id);
      if (purgeErr && !isTableMissingError(purgeErr)) {
        throw new Error(`ডাটাবেজ থেকে স্থায়ী ডিলিট ব্যর্থ হয়েছে: ${purgeErr.message}`);
      }
      if (target.email) {
        await supabase
          .from('users')
          .delete()
          .eq('email', target.email);
      }

      // 3. Delete from Supabase Auth admin if available
      try {
        const adminAuth = (supabase.auth as any)?.admin;
        if (adminAuth && typeof adminAuth.deleteUser === 'function') {
          await adminAuth.deleteUser(target.id);
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('iz_users_updated'));
      toast.success(`ইউজার ${target.name || target.email} ডাটা চিরতরে মুছে ফেলা হয়েছে! এই ইমেইল দিয়ে এখন পুনরায় নতুন অ্যাকাউন্ট খোলা যাবে।`);
      setConfirmPurgeUser(null);
    } catch (err: any) {
      toast.error('পার্মানেন্ট ডিলিট করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setActionProcessing(false);
    }
  };

  // Action: Toggle Block/Lock User (PERMANENT)
  const handleConfirmToggleLock = async () => {
    if (!confirmLockUser) return;
    const targetId = confirmLockUser.id;
    const newStatus = !confirmLockUser.isLocked;
    setActionProcessing(true);

    try {
      // 1. Update in Supabase
      const { error: lockErr } = await supabase
        .from('users')
        .update({ 
          is_locked: newStatus,
          status: newStatus ? 'blocked' : 'active',
          role: newStatus ? 'blocked' : 'user'
        })
        .eq('id', targetId);

      if (lockErr && !isTableMissingError(lockErr)) {
        throw new Error(`ডাটাবেজে ব্লক/আনব্লক স্ট্যাটাস পরিবর্তন হয়নি: ${lockErr.message}`);
      }

      // 2. Update in Local Fallback Store
      saveLocalUser(targetId, { 
        is_locked: newStatus, 
        role: newStatus ? 'blocked' : 'user' 
      });

      setUsers(prev => prev.map(u => u.id === targetId ? { 
        ...u, 
        isLocked: newStatus,
        status: newStatus ? 'blocked' : 'active'
      } : u));

      toast.success(
        newStatus 
          ? 'ইউজার অ্যাকাউন্ট স্থায়ীভাবে ব্লক/লক করা হয়েছে! অ্যাডমিন আনব্লক না করলে আর কখনোই আনব্লক হবে না।' 
          : 'ইউজার অ্যাকাউন্ট সফলভাবে আনলক করা হয়েছে!'
      );
      setConfirmLockUser(null);
    } catch (err: any) {
      toast.error('লক স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setActionProcessing(false);
    }
  };

  // Action: Save Edit User Profile & Reset Password
  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setEditForm({ 
      name: user.name || '', 
      username: user.username || '', 
      email: user.email || '', 
      password: '' 
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionProcessing(true);

    try {
      const updates: any = {
        name: editForm.name.trim(),
        username: editForm.username.trim().toLowerCase(),
        email: editForm.email.trim().toLowerCase(),
      };

      // Update Database user profile
      const { error: updateErr } = await supabase
        .from('users')
        .update(updates)
        .eq('id', editingUser.id);

      if (updateErr && !isTableMissingError(updateErr)) {
        throw updateErr;
      }

      // If New Password provided, update user auth password
      if (editForm.password.trim()) {
        try {
          const { error: passErr } = await supabase.auth.admin.updateUserById(
            editingUser.id,
            { password: editForm.password.trim() }
          );
          if (passErr) {
            console.warn('Supabase Auth Admin password update note:', passErr);
          }
        } catch (passCatch) {
          console.warn('Password reset note:', passCatch);
        }
      }

      saveLocalUser(editingUser.id, updates);

      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updates } : u));
      toast.success('ইউজারের তথ্য ও পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে!');
      setEditingUser(null);
    } catch (err: any) {
      toast.error('তথ্য সেভ করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setActionProcessing(false);
    }
  };

  // Action: Edit Balances
  const openBalanceModal = (user: UserData) => {
    setEditingBalanceUser(user);
    setBalanceForm({ 
      deposit: user.depositBalance || 0, 
      earning: user.earningBalance || 0 
    });
  };

  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBalanceUser) return;
    setActionProcessing(true);

    try {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ 
          deposit_balance: balanceForm.deposit,
          earning_balance: balanceForm.earning
        })
        .eq('id', editingBalanceUser.id);

      if (updateErr && !isTableMissingError(updateErr)) {
        throw updateErr;
      }

      saveLocalUser(editingBalanceUser.id, {
        deposit_balance: balanceForm.deposit,
        earning_balance: balanceForm.earning
      });

      setUsers(prev => prev.map(u => u.id === editingBalanceUser.id ? { 
        ...u, 
        depositBalance: balanceForm.deposit, 
        earningBalance: balanceForm.earning 
      } : u));
      toast.success('ইউজারের ডিপোজিট ও উইথড্র ব্যালেন্স সফলভাবে আপডেট করা হয়েছে!');
      setEditingBalanceUser(null);
    } catch (err: any) {
      toast.error('ব্যালেন্স আপডেট করতে ব্যর্থ হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setActionProcessing(false);
    }
  };

  // Action: Send Direct Custom Notification to User
  const openNotifModal = (user: UserData) => {
    setNotifUser(user);
    setNotifForm({
      title: '📢 অ্যাডমিন অফিশিয়াল বার্তা',
      message: '',
    });
  };

  const handleSendCustomNotif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifUser) return;
    if (!notifForm.message.trim()) {
      toast.error('অনুগ্রহ করে নোটিফিকেশনের বার্তা লিখুন।');
      return;
    }

    try {
      saveLocalNotification(notifUser.id, {
        title: notifForm.title.trim() || '📢 অ্যাডমিন নোটিফিকেশন',
        message: notifForm.message.trim(),
        type: 'announcement',
      });

      toast.success(`ইউজার ${notifUser.name || notifUser.email}-এর কাছে নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!`);
      setNotifUser(null);
    } catch {
      toast.error('নোটিফিকেশন পাঠাতে ব্যর্থ হয়েছে।');
    }
  };

  // Action: Approve Pending User PERMANENTLY
  const handleApprovePendingUser = async (user: UserData) => {
    try {
      // 1. Update in Supabase users table
      const { error: approveErr } = await supabase
        .from('users')
        .update({ 
          status: 'active', 
          is_pending: false, 
          is_locked: false,
          role: 'user',
          pending_reason: null
        })
        .eq('id', user.id);

      if (approveErr && !isTableMissingError(approveErr)) {
        throw new Error(`ডাটাবেজে ইউজার অ্যাপ্রুভ হয়নি: ${approveErr.message}`);
      }

      // 2. Update in Local Fallback Store PERMANENTLY
      saveLocalUser(user.id, { 
        status: 'active',
        is_pending: false, 
        is_locked: false, 
        role: 'user',
        pending_reason: undefined 
      });

      // 3. Update React State
      setUsers(prev => prev.map(u => u.id === user.id ? { 
        ...u, 
        status: 'active', 
        isLocked: false,
        is_pending: false,
        pending_reason: undefined 
      } : u));

      // 4. Save welcoming notification for user
      saveLocalNotification(user.id, {
        title: 'অ্যাকাউন্ট ভেরিফিকেশন সম্পন্ন! ✅',
        message: 'আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক ভেরিফাই করে সফলভাবে এপ্রুভ (অনুমোদন) করা হয়েছে। এখন আপনি সকল ফিচার ও মিশন ব্যবহার করতে পারবেন।',
        type: 'announcement'
      });

      window.dispatchEvent(new CustomEvent('iz_users_updated'));
      toast.success(`ইউজার "${user.name || user.email}" স্থায়ীভাবে অ্যাপ্রুভ ও সক্রিয় করা হয়েছে!`);
    } catch (err: any) {
      toast.error('সক্রিয় করতে ব্যর্থ হয়েছে: ' + (err.message || 'Error'));
    }
  };

  // Action: Reject Pending User PERMANENTLY
  const handleRejectPendingUser = async (user: UserData) => {
    try {
      // 1. Move to deleted archive in local store with complete user data
      deleteLocalUser(user.id, 'Rejected by Admin during Security Review', user);
      const updatedDeleted = getDeletedUsers();
      setDeletedUsers(updatedDeleted);
      await pushDeletedUsersToRemote(updatedDeleted);

      // 2. Mark as deleted in Supabase so it cannot be auto-recreated
      try {
        await supabase
          .from('users')
          .update({
            status: 'deleted',
            role: 'deleted',
            is_locked: true,
          })
          .eq('id', user.id);

        if (user.email) {
          await supabase
            .from('users')
            .update({
              status: 'deleted',
              role: 'deleted',
              is_locked: true,
            })
            .eq('email', user.email);
        }
      } catch (dbErr) {
        console.warn('Supabase DB reject note:', dbErr);
      }

      setUsers(prev => prev.filter(u => {
        const matchId = u.id === user.id;
        const matchEmail = Boolean(user.email && u.email && u.email.toLowerCase().trim() === user.email.toLowerCase().trim());
        return !matchId && !matchEmail;
      }));
      window.dispatchEvent(new CustomEvent('iz_users_updated'));
      toast.success(`ইউজার "${user.name || user.email}" রিজেক্ট করা হয়েছে এবং ডিলিট আর্কাইভে স্থানান্তর করা হয়েছে!`);
    } catch (err: any) {
      toast.error('রিজেক্ট করতে ব্যর্থ হয়েছে: ' + (err.message || 'Error'));
    }
  };

  // Filtered Active Users
  const filteredUsers = users.filter((u) => {
    const matchesTab = 
      filterTab === 'all' ? true :
      filterTab === 'active' ? (!u.isLocked && u.status !== 'pending') :
      filterTab === 'locked' ? Boolean(u.isLocked || u.status === 'blocked') :
      filterTab === 'pending' ? (u.status === 'pending') : true;

    const matchesSearch = searchQuery === '' || 
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(u.display_id || u.displayId || '').includes(searchQuery) ||
      u.id?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  // Filtered Deleted Users
  const filteredDeletedUsers = deletedUsers.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const activeCount = users.filter(u => !u.isLocked && u.status !== 'pending').length;
  const lockedCount = users.filter(u => u.isLocked || u.status === 'blocked').length;
  const pendingCount = users.filter(u => u.status === 'pending').length;
  const deletedCount = deletedUsers.length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 hardware-accelerate">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <User className="w-7 h-7 text-purple-600 dark:text-amber-400" />
            User Management & Control
          </h1>
          <p className="text-slate-500 dark:text-purple-300/70 text-sm mt-1 font-semibold">
            ইউজারদের ইমেইল, ইউজারনেম ও পাসওয়ার্ড পরিবর্তন, স্থায়ী ব্লক/আনব্লক, ব্যালেন্স টিউন এবং ডিলিটেড অ্যাকাউন্ট রিকভারি।
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-amber-300 px-4 py-2 rounded-2xl text-xs font-black border border-purple-200 dark:border-purple-500/30 shadow-sm">
            Total Active Users: {users.length}
          </div>
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-4 py-2 rounded-2xl text-xs font-black border border-rose-200 dark:border-rose-500/30 shadow-sm flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" />
            Deleted Archive: {deletedCount}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-500/30">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-xl">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
              filterTab === 'all'
                ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            All Users ({users.length})
          </button>
          
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
              filterTab === 'active'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            Active ({activeCount})
          </button>

          <button
            onClick={() => setFilterTab('locked')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
              filterTab === 'locked'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Blocked / Locked ({lockedCount})
          </button>

          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-slate-50 dark:bg-[#180d38] text-slate-600 dark:text-purple-300 border border-slate-200 dark:border-purple-500/20'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Pending Security ({pendingCount})
          </button>

          {/* DEDICATED DELETED ACCOUNTS TAB */}
          <button
            onClick={() => setFilterTab('deleted')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 border ${
              filterTab === 'deleted'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md ring-2 ring-rose-500/40'
                : 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 dark:hover:bg-rose-900/50'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>ডিলিটেড অ্যাকাউন্ট ({deletedCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 dark:text-purple-400/50 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={filterTab === 'deleted' ? 'Search deleted users...' : 'Search name, username, email, ID...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/40 text-xs focus:outline-none focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 font-medium"
          />
        </div>
      </div>

      {/* VIEW A: DELETED ACCOUNTS ARCHIVE TABLE */}
      {filterTab === 'deleted' ? (
        <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-md rounded-3xl shadow-sm dark:shadow-lg dark:shadow-rose-900/10 border border-rose-200 dark:border-rose-500/30 overflow-hidden space-y-0">
          <div className="bg-rose-50/80 dark:bg-rose-950/30 px-6 py-4 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 font-black">
                <UserX className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-rose-900 dark:text-rose-200">
                  ডিলিটেড অ্যাকাউন্ট আর্কাইভ (Deleted Accounts Archive)
                </h3>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-300/70 font-medium">
                  এখানে মুছে ফেলা সমস্ত অ্যাকাউন্ট নিরাপদে সংরক্ষিত থাকে। আপনি চাইলে যেকোনো অ্যাকাউন্ট "রিকভার" করে আবার সক্রিয় করতে পারবেন।
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setDeletedUsers(getDeletedUsers());
                toast.success('ডিলিটেড অ্যাকাউন্ট তালিকা রিফ্রেশ করা হয়েছে!');
              }}
              className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl transition-all"
              title="Refresh Deleted List"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-purple-950/40 border-b border-slate-200 dark:border-purple-500/20">
                  <th className="py-4 px-6 text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">Deleted User</th>
                  <th className="py-4 px-6 text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">Deletion Status</th>
                  <th className="py-4 px-6 text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">Saved Balances</th>
                  <th className="py-4 px-6 text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider">Deleted Date</th>
                  <th className="py-4 px-6 text-xs font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider text-right">Recovery & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                {filteredDeletedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Archive className="w-10 h-10 text-slate-300 dark:text-purple-400/30 mx-auto" />
                        <p className="text-sm font-black text-slate-600 dark:text-purple-300/80">কোনো ডিলিটেড অ্যাকাউন্ট পাওয়া যায়নি</p>
                        <p className="text-xs text-slate-400 dark:text-purple-400/50">এডমিন কর্তৃক কোনো অ্যাকাউন্ট ডিলিট করা হলে তা এখানে জমা হবে এবং রিকভার করা যাবে।</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDeletedUsers.map(u => (
                    <tr key={u.id} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors">
                      <td className="py-4 px-6 min-w-[240px]">
                        <div className="flex items-center">
                          <div className="h-11 w-11 rounded-2xl bg-rose-50 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 font-black text-base flex-shrink-0 border border-rose-200 dark:border-rose-500/30 shadow-sm">
                            <UserX className="w-5 h-5" />
                          </div>
                          <div className="ml-3.5 flex-1 min-w-0">
                            <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                              <span className="truncate">{u.name || 'Unknown User'}</span>
                              <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/40">
                                DELETED
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-purple-300/80 font-medium flex items-center gap-2 mt-0.5">
                              <span>@{u.username || 'user'}</span>
                              <span>•</span>
                              <span className="truncate">{u.email || 'No email'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 min-w-[140px]">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 tracking-wide uppercase">
                          {u.reason || 'Admin Deleted'}
                        </span>
                      </td>

                      <td className="py-4 px-6 min-w-[180px]">
                        <div className="text-xs font-mono text-slate-600 dark:text-purple-300">
                          <div>Dep: <strong className="text-purple-700 dark:text-amber-300">${Number(u.deposit_balance || 0).toFixed(2)}</strong></div>
                          <div>Earn: <strong className="text-emerald-600 dark:text-emerald-400">${Number(u.earning_balance || 0).toFixed(2)}</strong></div>
                        </div>
                      </td>

                      <td className="py-4 px-6 min-w-[140px]">
                        <div className="text-xs text-slate-500 dark:text-purple-300/70 font-mono font-bold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                          {u.deleted_at ? new Date(u.deleted_at).toLocaleString() : 'N/A'}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right min-w-[200px]">
                        <div className="flex justify-end items-center gap-2">
                          {/* RECOVER BUTTON */}
                          <button
                            onClick={() => setConfirmRestoreUser(u)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            title="Recover Account"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>রিকভার করুন</span>
                          </button>

                          {/* PERMANENT PURGE BUTTON */}
                          <button
                            onClick={() => setConfirmPurgeUser(u)}
                            className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-xl transition-all border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                            title="Permanently Purge from Database"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW B: ACTIVE & BLOCKED USERS TABLE */
        <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-md rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 border border-slate-200 dark:border-purple-500/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-purple-950/40 border-b border-slate-200 dark:border-purple-500/20">
                  <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">User Details</th>
                  <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">Wallet Balances</th>
                  <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">Joined</th>
                  <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400 mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-purple-300/60 font-bold">
                      No users matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id} className={`transition-colors ${user.isLocked ? 'bg-red-50/60 dark:bg-red-950/20' : 'hover:bg-slate-50 dark:hover:bg-purple-900/20'}`}>
                      <td className="py-4 px-6 min-w-[240px]">
                        <div className="flex items-center">
                          <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-base flex-shrink-0 border shadow-sm ${
                            user.isLocked 
                              ? 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' 
                              : 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-amber-400 border-purple-200 dark:border-purple-500/30'
                          }`}>
                            {user.isLocked ? <Lock className="w-5 h-5 text-red-500" /> : (user.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />)}
                          </div>
                          <div className="ml-3.5 flex-1 min-w-0">
                            <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                              <span className="truncate">{user.name || 'Unknown User'}</span>
                              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-amber-400 bg-purple-50 dark:bg-purple-900/40 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800/40">
                                ID: #{formatUserDisplayId(user.display_id || user.displayId, user.id)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-purple-300/80 font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                              <span>@{user.username || 'user'}</span>
                              <span>•</span>
                              <span className="truncate">{user.email || 'No email'}</span>
                              {user.ip_address && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[10px] bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded text-purple-700 dark:text-amber-300 font-bold border border-purple-200 dark:border-purple-800/40">
                                    IP: {user.ip_address}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 min-w-[150px]">
                        {user.status === 'pending' ? (
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 tracking-wide uppercase">
                              Pending IP ({user.ip_address || 'Same Device'})
                            </span>
                            {user.pending_reason && (
                              <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 font-bold leading-tight">
                                {user.pending_reason}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                onClick={() => handleApprovePendingUser(user)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer shadow-xs transition-all flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>এপ্রুভ</span>
                              </button>
                              <button
                                onClick={() => handleRejectPendingUser(user)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black cursor-pointer shadow-xs transition-all"
                              >
                                রিজেক্ট
                              </button>
                            </div>
                          </div>
                        ) : user.isLocked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 tracking-wide uppercase">
                            Blocked / Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 tracking-wide uppercase">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 min-w-[200px]">
                        <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-[#0a0718] p-2 rounded-xl border border-slate-200 dark:border-purple-900/40">
                          <div className="flex flex-col text-xs font-mono">
                            <span className="text-slate-600 dark:text-purple-300">
                              Dep: <strong className="text-purple-700 dark:text-amber-300">${(user.depositBalance || 0).toFixed(2)}</strong>
                            </span>
                            <span className="text-slate-600 dark:text-purple-300">
                              Earn: <strong className="text-emerald-600 dark:text-emerald-400">${(user.earningBalance || 0).toFixed(2)}</strong>
                            </span>
                          </div>
                          <button
                            onClick={() => openBalanceModal(user)}
                            className="px-2 py-1 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-amber-300 hover:bg-purple-100 rounded-lg text-[10px] font-black border border-purple-200 dark:border-purple-500/30 transition-all shrink-0 cursor-pointer"
                            title="Edit Wallet Balance"
                          >
                            Edit $
                          </button>
                        </div>
                      </td>

                      <td className="py-4 px-6 min-w-[130px]">
                        <div className="text-xs text-slate-500 dark:text-purple-300/70 font-mono font-bold flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right min-w-[180px]">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Send Notification Button */}
                          <button
                            onClick={() => openNotifModal(user)}
                            className="p-2 rounded-xl text-purple-600 dark:text-amber-400 hover:bg-purple-50 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-500/30 transition-colors cursor-pointer"
                            title="Send Direct Notification to User"
                          >
                            <Send className="w-4 h-4" />
                          </button>

                          {/* Edit User Profile & Password */}
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 rounded-xl text-slate-600 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-900/40 border border-slate-200 dark:border-purple-500/30 transition-colors cursor-pointer"
                            title="Edit Profile (Name, Username, Email, Password)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Block/Unblock Button (PERMANENT) */}
                          <button
                            onClick={() => setConfirmLockUser(user)}
                            className={`p-2 rounded-xl transition-colors border cursor-pointer ${
                              user.isLocked 
                                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30' 
                                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-200 dark:border-amber-500/30'
                            }`}
                            title={user.isLocked ? 'Unlock Account' : 'Block / Lock Account'}
                          >
                            {user.isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>

                          {/* Delete Button (Moves to Deleted Archive) */}
                          <button
                            onClick={() => setConfirmDeleteUser(user)}
                            className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors border border-rose-200 dark:border-rose-500/30 cursor-pointer"
                            title="Delete Account (Move to Deleted Archive)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Edit Profile (Name, Username, Email, Password Reset) */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/40 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-purple-900/50 bg-slate-50 dark:bg-purple-950/40">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-600 dark:text-amber-400" />
                Edit User Profile & Reset Password
              </h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-purple-400 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Full Name (ইউজারের নাম)
                </label>
                <input 
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Username (ইউজারনেম)
                </label>
                <input 
                  type="text"
                  value={editForm.username}
                  onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Email Address (ইউজার ইমেইল)
                </label>
                <input 
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  New Password (পাসওয়ার্ড পরিবর্তন করুন - ঐচ্ছিক)
                </label>
                <input 
                  type="password"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="পাসওয়ার্ড পরিবর্তন না করতে ফাঁকা রাখুন"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-amber-300 dark:border-amber-500/40 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-amber-400 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-purple-900/40">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionProcessing}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-amber-400 dark:hover:bg-amber-300 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  Save Changes & Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Send Direct Custom Notification */}
      {notifUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/40 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-purple-900/50 bg-slate-50 dark:bg-purple-950/40">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-600 dark:text-amber-400" />
                Send Notification to {notifUser.name || notifUser.email}
              </h3>
              <button 
                onClick={() => setNotifUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-purple-400 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendCustomNotif} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Notification Title (শিরোনাম)
                </label>
                <input 
                  type="text"
                  value={notifForm.title}
                  onChange={e => setNotifForm({ ...notifForm, title: e.target.value })}
                  placeholder="e.g. পেমেন্ট আপডেট / সিকিউরিটি নোটিশ"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Notification Message (নোটিফিকেশন বার্তা)
                </label>
                <textarea 
                  rows={4}
                  value={notifForm.message}
                  onChange={e => setNotifForm({ ...notifForm, message: e.target.value })}
                  placeholder="ইউজারকে পাঠানোর বার্তা লিখুন..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-purple-900/40">
                <button
                  type="button"
                  onClick={() => setNotifUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-amber-400 dark:hover:bg-amber-300 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Notification</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Interactive Confirmation Popup for PERMANENT BLOCK/LOCK */}
      {confirmLockUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-purple-900/50 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                {confirmLockUser.isLocked ? 'অ্যাকাউন্ট আনলক করুন' : 'অ্যাকাউন্ট স্থায়ীভাবে ব্লক / লক করুন'}
              </h3>
              <button 
                onClick={() => setConfirmLockUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-purple-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-purple-200/90 leading-relaxed font-semibold">
              {confirmLockUser.isLocked ? (
                <>আপনি কি নিশ্চিত যে ইউজার <strong className="text-slate-900 dark:text-white">"{confirmLockUser.name || confirmLockUser.email}"</strong>-এর অ্যাকাউন্ট আনলক করে পুনরায় ব্যবহারের সুযোগ দিতে চান?</>
              ) : (
                <>আপনি কি নিশ্চিত যে ইউজার <strong className="text-amber-600 dark:text-amber-400">"{confirmLockUser.name || confirmLockUser.email}"</strong>-এর অ্যাকাউন্ট স্থায়ীভাবে ব্লক/লক করবেন? <strong className="text-red-500">অ্যাডমিন নিজে আনলক না করা পর্যন্ত ইউজার কখনোই কোনোভাবে লগইন বা কোনো পেজে প্রবেশ করতে পারবে না।</strong></>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-purple-900/40">
              <button
                onClick={() => setConfirmLockUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/30 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmToggleLock}
                disabled={actionProcessing}
                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {confirmLockUser.isLocked ? 'Confirm Unlock' : 'Confirm Permanent Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Interactive Confirmation Popup for MOVE TO DELETED */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-purple-900/50 pb-3">
              <h3 className="text-base font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                অ্যাকাউন্ট ডিলিট ও আর্কাইভে স্থানান্তর
              </h3>
              <button 
                onClick={() => setConfirmDeleteUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-purple-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-purple-200/90 leading-relaxed font-semibold">
              আপনি কি নিশ্চিত যে ইউজার <strong className="text-rose-600 dark:text-rose-300">"{confirmDeleteUser.name || confirmDeleteUser.email}"</strong>-এর অ্যাকাউন্ট ডিলিট তালিকায় স্থানান্তর করবেন? 
            </p>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 leading-normal">
              💡 অ্যাকাউন্টটি ডিলিট হয়ে <strong>"ডিলিটেড অ্যাকাউন্ট"</strong> অপশনে জমা থাকবে। ইউজার লগইন করতে পারবে না। পরবর্তীতে প্রয়োজন হলে অ্যাডমিন সেখান থেকে যেকোনো সময় <strong>"রিকভার"</strong> করতে পারবেন।
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-purple-900/40">
              <button
                onClick={() => setConfirmDeleteUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/30 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={actionProcessing}
                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                Move to Deleted Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Interactive Confirmation Popup for RECOVERING DELETED USER */}
      {confirmRestoreUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] border border-emerald-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-purple-900/50 pb-3">
              <h3 className="text-base font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                অ্যাকাউন্ট রিকভার করুন (Recover Account)
              </h3>
              <button 
                onClick={() => setConfirmRestoreUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-purple-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-purple-200/90 leading-relaxed font-semibold">
              আপনি কি নিশ্চিত যে ডিলিটেড ইউজার <strong className="text-emerald-600 dark:text-emerald-400">"{confirmRestoreUser.name || confirmRestoreUser.email}"</strong>-এর অ্যাকাউন্ট পুনরায় সক্রিয় তালিকায় রিকভার (পুনরুদ্ধার) করতে চান?
            </p>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-700 dark:text-emerald-300 leading-normal">
              ✅ রিকভার করার সাথে সাথে ইউজারের অ্যাকাউন্ট একটিভ হয়ে যাবে এবং তিনি আগের মতোই লগইন করে কাজ করতে পারবেন।
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-purple-900/40">
              <button
                onClick={() => setConfirmRestoreUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/30 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={actionProcessing}
                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Confirm Recover Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Interactive Confirmation Popup for PERMANENT PURGE */}
      {confirmPurgeUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] border border-red-600/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-purple-900/50 pb-3">
              <h3 className="text-base font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                স্থায়ীভাবে চিরতরে ডিলিট (Permanent Purge)
              </h3>
              <button 
                onClick={() => setConfirmPurgeUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-purple-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-purple-200/90 leading-relaxed font-semibold">
              সতর্কতা: ইউজার <strong className="text-red-600 dark:text-red-400">"{confirmPurgeUser.name || confirmPurgeUser.email}"</strong>-এর সমস্ত তথ্য সম্পূর্ণ মুছে ফেলা হবে। এটি আর কখনো রিকভার করা সম্ভব হবে না।
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-purple-900/40">
              <button
                onClick={() => setConfirmPurgeUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/30 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPermanentPurge}
                disabled={actionProcessing}
                className="px-5 py-2 rounded-xl text-xs font-black text-white bg-red-700 hover:bg-red-800 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>Permanently Purge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      {editingBalanceUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/40 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden space-y-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-purple-900/50 bg-slate-50 dark:bg-purple-950/40">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Edit Wallet Balances
              </h3>
              <button 
                onClick={() => setEditingBalanceUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-purple-400 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveBalance} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Deposit Balance ($)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={balanceForm.deposit}
                  onChange={e => setBalanceForm({ ...balanceForm, deposit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-slate-900 dark:text-white font-mono font-bold focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-purple-300 uppercase tracking-wider mb-1">
                  Earning Balance ($)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={balanceForm.earning}
                  onChange={e => setBalanceForm({ ...balanceForm, earning: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-300 dark:border-purple-500/40 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 dark:border-purple-900/40">
                <button
                  type="button"
                  onClick={() => setEditingBalanceUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-purple-300 hover:bg-slate-100 dark:hover:bg-purple-900/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionProcessing}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-amber-400 dark:hover:bg-amber-300 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  Save Wallet Balances
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
