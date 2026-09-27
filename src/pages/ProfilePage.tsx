import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, formatUserDisplayId } from '../lib/supabaseClient';
import { User, Mail, Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user || profile) {
      setName(profile?.name || user?.user_metadata?.name || '');
      setUsername(profile?.username || user?.user_metadata?.username || '');
      setEmail(user?.email || profile?.email || '');
    }
  }, [user, profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // If changing password, validate first
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error('New passwords do not match.');
        }
        
        // Update Password with Supabase
        const { error: pwdError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (pwdError) {
          throw pwdError;
        }
      }

      // Update in Auth metadata
      await supabase.auth.updateUser({
        data: { name, full_name: name, username },
      });
      
      // Update in public.users table
      const userId = user.uid || user.id;
      const { error: dbError } = await supabase
        .from('users')
        .update({ name, username })
        .eq('id', userId);

      if (dbError) {
        console.warn('Database user update warning:', dbError);
      }

      await refreshProfile();

      setSuccess('Profile updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 pb-24 sm:pb-28">
      <div className="bg-white dark:bg-[#130b2c]/60 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-purple-900/40">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
              <User className="w-6 h-6 mr-3 text-purple-600 dark:text-amber-400" />
              Profile Settings
            </h2>
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-amber-300 font-mono text-xs font-bold w-fit shadow-sm">
              User ID: #{formatUserDisplayId(profile?.display_id || profile?.displayId || (user as any)?.display_id, user?.uid)}
            </div>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 rounded-xl flex items-center gap-3 border border-emerald-200 dark:border-emerald-100">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-bold">{success}</p>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-purple-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white dark:bg-transparent border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all font-bold text-slate-900 dark:text-white"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Username (Read Only)</label>
              <div className="relative opacity-70">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-purple-400 font-bold">@</span>
                <input
                  type="text"
                  value={username}
                  readOnly
                  disabled
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-[#180d38]/80 text-slate-600 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/40 border border-slate-300 dark:border-purple-500/20 rounded-xl cursor-not-allowed font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Email Address (Read Only)</label>
              <div className="relative opacity-70">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-purple-400" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-[#180d38]/80 text-slate-600 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/40 border border-slate-300 dark:border-purple-500/20 rounded-xl cursor-not-allowed font-bold"
                />
              </div>
            </div>

            <hr className="border-slate-200 dark:border-purple-500/20" />

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                <Lock className="w-5 h-5 mr-2 text-purple-600 dark:text-amber-400" />
                Change Password
              </h3>
              <p className="text-sm text-slate-500 dark:text-purple-300/60 font-bold mb-4">
                Enter a new password below to update your login credentials.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">New Password (Optional)</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-purple-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white dark:bg-transparent border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all font-bold text-slate-900 dark:text-white placeholder-slate-400"
                      placeholder="Leave blank to keep current password"
                    />
                  </div>
                </div>
                
                {newPassword && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-purple-200 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-purple-400" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-transparent border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 focus:border-purple-600 dark:focus:border-amber-400 outline-none transition-all font-bold text-slate-900 dark:text-white placeholder-slate-400"
                        placeholder="Re-enter new password"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center px-6 py-4 border border-transparent rounded-xl shadow-md shadow-purple-600/20 dark:shadow-lg dark:shadow-amber-500/30 text-sm font-bold text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-500 dark:to-yellow-600 dark:hover:from-amber-600 dark:hover:to-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-amber-400 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95 disabled:hover:scale-100"
              >
                {loading ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
