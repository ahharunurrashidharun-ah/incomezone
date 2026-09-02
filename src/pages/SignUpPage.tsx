import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export default function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResendConfirmation = async (targetEmail: string) => {
    if (!targetEmail) return;
    setResending(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail.trim(),
      });
      if (resendErr) throw resendErr;
      toast.success('Verification email resent! Please check your inbox.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend confirmation email.');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessInfo(null);

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      setError(msg);
      toast.error(msg);
      return;
    }
    
    if (!agreeTerms) {
      const msg = 'You must agree to the Terms of Service';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const cleanName = fullName.trim();

      // 1. Sign up with Supabase Auth (trigger handles public.users insertion)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            username: cleanUsername,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // 2. Immediate active session -> redirect to dashboard
      if (data.session) {
        toast.success('Account created successfully! Welcome to IncomeZone.');
        navigate('/jobs');
        return;
      }

      // 3. If session not auto-established, attempt instant sign in
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!signInErr && signInData.session) {
        toast.success('Account created successfully! Welcome to IncomeZone.');
        navigate('/jobs');
        return;
      }

      // 4. If confirmation is required, show dynamic message & toast
      const infoMsg = `Account created! We sent a verification link to ${cleanEmail}. Please verify your email before logging in.`;
      setSuccessInfo(infoMsg);
      toast.success('Account created! Please check your email to verify.');

    } catch (err: any) {
      // Dynamic exact error reporting from Supabase
      const errorMessage = err.message || 'An error occurred during registration.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-gradient-to-b dark:from-[#090514] dark:via-[#0f0926] dark:to-[#080512] min-h-screen flex flex-col font-sans relative overflow-hidden transition-colors duration-300">
      {/* Background Soft Accents */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-purple-900/5 dark:bg-purple-900/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
      
      {/* Top Navbar */}
      <nav className="absolute top-0 w-full p-6 sm:p-8 flex justify-center sm:justify-start z-20">
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
        <div className="w-full max-w-[460px]">
          
          {/* Floating Card */}
          <div className="bg-white dark:bg-[#130b2c]/60 dark:backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 shadow-2xl shadow-slate-200 dark:shadow-purple-950/60 rounded-2xl p-8 sm:p-10 relative hover:border-purple-300 dark:hover:border-amber-400/40 transition-all duration-300">
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Create an Account</h2>
              <p className="mt-2 text-slate-500 dark:text-purple-200/80 text-sm font-bold">Join us and start earning today.</p>
            </div>

            {successInfo ? (
              <div className="space-y-6">
                <div className="p-6 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Verify Your Email</h3>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {successInfo}
                  </p>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={resending}
                      onClick={() => handleResendConfirmation(email)}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-purple-600 dark:hover:text-amber-400 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                      {resending ? 'Resending email...' : 'Resend Verification Email'}
                    </button>
                    
                    <Link
                      to="/login"
                      className="inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-black text-white bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:text-slate-950 rounded-xl transition-all shadow-md"
                    >
                      Go to Login <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-medium border border-red-200 dark:border-red-500/30 flex items-start gap-2 font-bold mb-1">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
                    <span className="leading-tight">{error}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider ml-1">Full Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400 group-focus-within:text-purple-600 dark:group-focus-within:text-amber-400 transition-colors">
                      <User className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400/50 focus:border-purple-600 dark:focus:border-amber-400 transition-all text-sm font-medium shadow-inner shadow-slate-100 dark:shadow-black/20"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400 group-focus-within:text-purple-600 dark:group-focus-within:text-amber-400 transition-colors">
                      <span className="font-bold text-lg leading-none">@</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400/50 focus:border-purple-600 dark:focus:border-amber-400 transition-all text-sm font-medium shadow-inner shadow-slate-100 dark:shadow-black/20"
                      placeholder="johndoe"
                    />
                  </div>
                </div>

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
                      className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400/50 focus:border-purple-600 dark:focus:border-amber-400 transition-all text-sm font-medium shadow-inner shadow-slate-100 dark:shadow-black/20"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider ml-1">Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-purple-400 group-focus-within:text-purple-600 dark:group-focus-within:text-amber-400 transition-colors">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-9 py-3 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400/50 focus:border-purple-600 dark:focus:border-amber-400 transition-all text-xs font-medium shadow-inner shadow-slate-100 dark:shadow-black/20"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-purple-400 hover:text-purple-600 dark:hover:text-white transition-colors focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-purple-200 uppercase tracking-wider ml-1">Confirm</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-purple-400 group-focus-within:text-purple-600 dark:group-focus-within:text-amber-400 transition-colors">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full pl-10 pr-9 py-3 bg-slate-50 dark:bg-[#0a0718] border border-slate-200 dark:border-purple-500/30 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400/50 focus:border-purple-600 dark:focus:border-amber-400 transition-all text-xs font-medium shadow-inner shadow-slate-100 dark:shadow-black/20"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-purple-400 hover:text-purple-600 dark:hover:text-white transition-colors focus:outline-none"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center pt-1">
                  <label className="flex items-center cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={agreeTerms} 
                        onChange={(e) => setAgreeTerms(e.target.checked)} 
                      />
                      <div className={`w-5 h-5 border-2 rounded transition-all flex items-center justify-center ${agreeTerms ? 'bg-purple-600 border-purple-600 dark:bg-amber-400 dark:border-amber-400' : 'border-slate-300 dark:border-purple-500/50 group-hover:border-purple-600 dark:group-hover:border-purple-400'}`}>
                        {agreeTerms && <svg className="w-3 h-3 text-white dark:text-slate-950 fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>}
                      </div>
                    </div>
                    <span className="ml-3 text-xs font-medium text-slate-600 dark:text-purple-300/80 group-hover:text-slate-900 dark:group-hover:text-purple-200 transition-colors">
                      I agree to the <Link to="/terms" className="text-purple-600 dark:text-amber-400 font-bold hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-purple-600 dark:text-amber-400 font-bold hover:underline">Privacy Policy</Link>
                    </span>
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
                      Create Free Account <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-purple-300/70">
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-purple-600 dark:text-amber-400 hover:text-purple-700 dark:hover:text-amber-300 hover:underline">
                  Sign In
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
