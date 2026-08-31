import React, { useEffect, useState } from 'react';
import { supabase, formatUserDisplayId } from '../../lib/supabaseClient';
import { Trash2, User, Mail, Calendar, AlertCircle, Edit2, Lock, Unlock, X } from 'lucide-react';
import {
  getLocalUsers,
  saveLocalUser,
  deleteLocalUser,
  isTableMissingError,
} from '../../lib/localFallbackStore';

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
  earning_balance?: number;
  isLocked?: boolean;
  is_locked?: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Edit Profile State
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '', email: '', password: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr && isTableMissingError(fetchErr)) {
        const local = getLocalUsers().map((u) => ({
          id: u.id,
          name: u.name || u.email.split('@')[0],
          username: u.username || u.email.split('@')[0],
          email: u.email,
          createdAt: u.created_at,
          depositBalance: Number(u.deposit_balance),
          earningBalance: Number(u.earning_balance),
          isLocked: Boolean(u.is_locked),
        }));
        setUsers(local);
        return;
      }

      if (data && data.length > 0) {
        const mappedUsers = data.map((u: any) => ({
          id: u.id,
          display_id: u.display_id ?? u.displayId,
          displayId: u.display_id ?? u.displayId,
          name: u.name || u.raw_user_meta_data?.name || u.email?.split('@')[0] || '',
          username: u.username || u.raw_user_meta_data?.username || '',
          email: u.email || '',
          createdAt: u.created_at || u.createdAt,
          depositBalance: Number(u.depositBalance ?? u.deposit_balance ?? 0),
          earningBalance: Number(u.earningBalance ?? u.earning_balance ?? 0),
          isLocked: !!(u.isLocked ?? u.is_locked),
        }));

        setUsers(mappedUsers);
      } else {
        const local = getLocalUsers().map((u) => ({
          id: u.id,
          name: u.name || u.email.split('@')[0],
          username: u.username || u.email.split('@')[0],
          email: u.email,
          createdAt: u.created_at,
          depositBalance: Number(u.deposit_balance),
          earningBalance: Number(u.earning_balance),
          isLocked: Boolean(u.is_locked),
        }));
        setUsers(local);
      }
    } catch {
      const local = getLocalUsers().map((u) => ({
        id: u.id,
        name: u.name || u.email.split('@')[0],
        username: u.username || u.email.split('@')[0],
        email: u.email,
        createdAt: u.created_at,
        depositBalance: Number(u.deposit_balance),
        earningBalance: Number(u.earning_balance),
        isLocked: Boolean(u.is_locked),
      }));
      setUsers(local);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This will remove their record.')) {
      return;
    }

    try {
      const { error: delErr } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (delErr) throw delErr;
      setUsers(users.filter(u => u.id !== userId));
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete user: ' + (err.message || 'Unknown error'));
    }
  };

  const [editingBalanceUser, setEditingBalanceUser] = useState<UserData | null>(null);
  const [balanceForm, setBalanceForm] = useState({ deposit: 0, earning: 0 });

  // Handle opening balance edit modal
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

    try {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ 
          deposit_balance: balanceForm.deposit,
          earning_balance: balanceForm.earning
        })
        .eq('id', editingBalanceUser.id);

      if (updateErr) {
        throw updateErr;
      }

      setUsers(users.map(u => u.id === editingBalanceUser.id ? { 
        ...u, 
        depositBalance: balanceForm.deposit, 
        earningBalance: balanceForm.earning 
      } : u));
      setEditingBalanceUser(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update balance: ' + (err.message || 'Unknown error'));
    }
  };

  const handleToggleLock = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    if (window.confirm(`Are you sure you want to ${newStatus ? 'lock' : 'unlock'} this user?`)) {
      try {
        const { error: lockErr } = await supabase
          .from('users')
          .update({ is_locked: newStatus })
          .eq('id', userId);

        if (lockErr) {
          throw lockErr;
        }

        setUsers(users.map(u => u.id === userId ? { ...u, isLocked: newStatus } : u));
      } catch (err: any) {
        console.error(err);
        alert('Failed to update lock status: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    setEditForm({ name: user.name || '', username: user.username || '', email: user.email || '', password: '' });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const { error: updateErr } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          username: editForm.username,
          email: editForm.email
        })
        .eq('id', editingUser.id);

      if (updateErr) throw updateErr;
      
      setUsers(users.map(u => u.id === editingUser.id ? { 
        ...u, 
        name: editForm.name, 
        username: editForm.username, 
        email: editForm.email 
      } : u));
      
      setEditingUser(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update user profile: ' + (err.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-slate-500 dark:text-purple-300/60 mt-1">Manage users, adjust balances, and control access.</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-bold border border-purple-200 dark:border-purple-500/30 shadow-sm dark:shadow-lg dark:shadow-black/40">
          Total Users: {users.length}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-500/30">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-md rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 border border-slate-200 dark:border-purple-500/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-purple-950/40 border-b border-slate-200 dark:border-purple-500/20">
                <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">User</th>
                <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">Balance</th>
                <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider">Joined</th>
                <th className="py-4 px-6 text-xs font-black text-purple-700 dark:text-amber-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-purple-300/60 font-bold">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className={`transition-colors ${user.isLocked ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40' : 'hover:bg-slate-50 dark:hover:bg-purple-900/20'}`}>
                    <td className="py-4 px-6 min-w-[200px]">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-purple-50 dark:bg-purple-900/40 flex items-center justify-center text-purple-700 dark:text-amber-400 font-black flex-shrink-0 border border-purple-200 dark:border-purple-500/30 shadow-sm dark:shadow-lg dark:shadow-purple-900/20">
                          {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {user.name || 'Unknown User'}
                            <span className="text-[11px] font-mono font-bold text-purple-600 dark:text-amber-400 bg-purple-50 dark:bg-purple-900/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/40">
                              ID: #{formatUserDisplayId(user.display_id || user.displayId, user.id)}
                            </span>
                            <button 
                              onClick={() => openEditModal(user)}
                              className="text-slate-400 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-amber-400 transition-colors"
                              title="Edit User Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-sm text-slate-500 dark:text-purple-300/60 font-medium flex items-center gap-1 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                            {user.email || 'No email available'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 min-w-[120px]">
                      {user.isLocked ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30 tracking-wide uppercase">
                          Inactive
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 tracking-wide uppercase">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-600 dark:text-purple-200">
                            Dep: <span className="text-slate-900 dark:text-white">${(user.depositBalance || 0).toFixed(2)}</span>
                          </span>
                          <span className="text-sm font-bold text-slate-600 dark:text-purple-200">
                            Earn: <span className="text-amber-600 dark:text-amber-400 font-black">${(user.earningBalance || 0).toFixed(2)}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => openBalanceModal(user)}
                          className="p-1.5 ml-2 text-slate-400 dark:text-purple-300/40 hover:text-purple-600 dark:hover:text-amber-400 hover:bg-purple-50 dark:hover:bg-amber-900/20 rounded-xl transition-colors border border-transparent hover:border-purple-200 dark:hover:border-amber-500/30"
                          title="Edit Balance"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6 min-w-[140px]">
                      <div className="text-sm text-slate-500 dark:text-purple-300/60 font-bold flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right min-w-[120px]">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => handleToggleLock(user.id, !!user.isLocked)}
                          className={`inline-flex items-center justify-center p-2 rounded-xl transition-colors border border-transparent ${
                            user.isLocked 
                              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 dark:hover:border-emerald-500/30' 
                              : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-500/30'
                          }`}
                          title={user.isLocked ? 'Unlock User' : 'Lock User'}
                        >
                          {user.isLocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="inline-flex items-center justify-center p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
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

      {/* Edit Profile Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-[#080412]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-[2rem] w-full max-w-md shadow-xl dark:shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-purple-500/20 bg-slate-50 dark:bg-purple-950/40">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Edit User Profile</h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-500 dark:text-purple-300/40 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Full Name</label>
                <input 
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white font-medium"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Username</label>
                <input 
                  type="text"
                  value={editForm.username}
                  onChange={e => setEditForm({...editForm, username: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white font-medium"
                  placeholder="e.g. johndoe123"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Email Address</label>
                <input 
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white font-medium"
                  placeholder="john@example.com"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-purple-200/80 hover:bg-slate-100 dark:hover:bg-transparent hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors border border-slate-300 dark:border-purple-500/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 rounded-xl transition-all shadow-md dark:shadow-xl dark:shadow-amber-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Balance Modal */}
      {editingBalanceUser && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-[#080412]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#130b2c] backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-[2rem] w-full max-w-sm shadow-xl dark:shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-purple-500/20 bg-slate-50 dark:bg-purple-950/40">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Edit Balances</h3>
              <button 
                onClick={() => setEditingBalanceUser(null)}
                className="text-slate-500 dark:text-purple-300/40 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveBalance} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Deposit Balance ($)</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={balanceForm.deposit}
                  onChange={e => setBalanceForm({...balanceForm, deposit: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Earning Balance ($)</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={balanceForm.earning}
                  onChange={e => setBalanceForm({...balanceForm, earning: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none bg-slate-50 dark:bg-[#0a0718] text-amber-600 dark:text-amber-400 font-bold"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingBalanceUser(null)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-purple-200/80 hover:bg-slate-100 dark:hover:bg-transparent hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors border border-slate-300 dark:border-purple-500/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 rounded-xl transition-all shadow-md dark:shadow-xl dark:shadow-amber-500/20"
                >
                  Save Balances
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
