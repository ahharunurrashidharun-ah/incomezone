import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { checkIsAdmin } from '../lib/adminConfig';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, ArrowRight, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResendConfirmation = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = 'Please enter your email address to resend confirmation.';
      setError(msg);
      toast.error(msg);
      return;
    }
    setResending(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      if (resendErr) throw resendErr;
      toast.success('Confirmation email resent! Please check your inbox.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend confirmation email.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsEmailUnconfirmed(false);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      
      // 1. Sign In with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        throw authError;
      }

      toast.success('Signed in successfully! Welcome back.');

      // 2. Check admin access
      if (data.user) {
        if (checkIsAdmin({ email: cleanEmail, user_metadata: data.user.user_metadata })) {
          navigate('/admin');
          return;
        }

        try {
          const { data: userData } = await supabase
            .from('users')
            .select('role, username')
            .eq('id', data.user.id)
            .maybeSingle();

          if (userData && (userData.role === 'admin' || checkIsAdmin(userData))) {
            navigate('/admin');
            return;
          }
        } catch {
          // If query fails, proceed as normal user
        }
      }

      navigate('/jobs');
    } catch (err: any) {
      // Dynamic exact error reporting from Supabase
      const errorMessage = err.message || 'Invalid email or password.';
      setError(errorMessage);
      toast.error(errorMessage);

      const msg = (err.message || '').toString().toLowerCase();
      if (msg.includes('email not confirmed') || msg.includes('not confirmed') || err.code === 'email_not_confirmed') {
        setIsEmailUnconfirmed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-[#090514] dark:via-[#0f0926] dark:to-[#080512] min-h-screen flex flex-col font-sans relative overflow-hidden transition-colors duration-300">
      {/* Background Soft Accents */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-purple-900/5 dark:bg-purple-900/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
      
      {/* Top Navbar */}
      <nav className="absolute top-0 w-full p-6 sm:p-8 flex justify-between items-center z-20">
        <Link to="/" className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-purple-600 dark:bg-gradient-to-tr dark:from-amber-400 dark:to-yellow-500 flex items-center justify-center text-white dark:text-slate-950 shadow-md font-black text-sm">
             IZ
           </div>
           <span>
             Income<span className="text-purple-600 dark:bg-gradient-to-r dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 dark:bg-clip-text dark:text-transparent">Zone</span>
           </span>
        </Link>
      </nav>

      {/* Main Content */}
      <div className="flex-grow flex items-center justify-center p-4 sm:p-6 z-10 pt-24 pb-12">
        <div className="w-full max-w-[440px]">
          
          {/* Floating Card */}
          <div className="bg-white dark:bg-[#130b2c]/60 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 shadow-2xl shadow-slate-200 dark:shadow-purple-950/60 rounded-2xl p-8 sm:p-10 relative hover:border-purple-300 dark:hover:border-amber-400/40 transition-all duration-300">
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Welcome Back</h2>
              <p className="mt-2 text-slate-500 dark:text-purple-200/80 text-sm font-bold">Please enter your details to sign in.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className={`p-4 rounded-xl text-sm font-medium border flex flex-col gap-2 mb-1 ${
                  isEmailUnconfirmed 
                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30' 
                    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30'
                }`}>
                  <div className="flex items-start gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="leading-tight">{error}</span>
                  </div>

                  {isEmailUnconfirmed && (
                    <div className="mt-1 pt-2 border-t border-amber-200 dark:border-amber-500/20 flex flex-col gap-2">
                      <p className="text-xs font-normal opacity-90">
                        Check your inbox for the confirmation link, or click below to resend:
                      </p>
                      <button
                        type="button"
                        disabled={resending}
                        onClick={handleResendConfirmation}
                        className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-black bg-amber-200/80 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-400/30 rounded-lg transition-all self-start"
                      >
                        <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
                        {resending ? 'Sending...' : 'Resend Confirmation Email'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider ml-1">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400 group-focus-within:text-purple-600 dark:group-focus-within:text-amber-400 transition-colors">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400/50 focus:border-purple-600 dark:focus:border-amber-400 transition-all text-sm font-medium shadow-inner shadow-slate-100 dark:shadow-black/20"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider">Password</label>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400 group-focus-within:text-purple-600 dark:group-focus-within:text-amber-400 transition-colors">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-12 py-3.5 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400/50 focus:border-purple-600 dark:focus:border-amber-400 transition-all text-sm font-medium shadow-inner shadow-slate-100 dark:shadow-black/20"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 dark:text-purple-400 hover:text-purple-600 dark:hover:text-white transition-colors focus:outline-none"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)} 
                    />
                    <div className={`w-5 h-5 border-2 rounded transition-all flex items-center justify-center ${rememberMe ? 'bg-purple-600 border-purple-600 dark:bg-amber-400 dark:border-amber-400' : 'border-slate-300 dark:border-purple-500/50 group-hover:border-purple-600 dark:group-hover:border-purple-400'}`}>
                      {rememberMe && <svg className="w-3 h-3 text-white dark:text-slate-950 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>}
                    </div>
                  </div>
                  <span className="ml-3 text-sm font-medium text-slate-600 dark:text-purple-300/80 group-hover:text-slate-900 dark:group-hover:text-purple-200 transition-colors">Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-purple-600/20 dark:shadow-amber-500/20 text-sm font-black text-white dark:text-slate-950 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 dark:focus:ring-amber-400 dark:focus:ring-offset-[#130b2c] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 dark:border-slate-950/30 border-t-white dark:border-t-slate-950 rounded-full animate-spin"></div>
                ) : (
                  <>
                    Sign In <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-purple-500/20 text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-purple-300/70">
                Don't have an account?{' '}
                <Link to="/signup" className="font-bold text-purple-600 dark:text-amber-400 hover:text-purple-700 dark:hover:text-amber-300 hover:underline">
                  Create Account
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
