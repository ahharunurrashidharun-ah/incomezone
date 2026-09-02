import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  DollarSign, 
  Shield, 
  Zap, 
  CheckCircle2, 
  Users, 
  ArrowRight, 
  Search, 
  PlusCircle, 
  CheckSquare, 
  Award, 
  Clock, 
  MapPin, 
  Globe,
  HelpCircle,
  Mail,
  ChevronRight
} from 'lucide-react';
import LiveStats from '../components/LiveStats';
import ThemeToggle from '../components/ThemeToggle';
import Footer from '../components/Footer';
import { supabase } from '../lib/supabaseClient';
import { getLocalJobs, isTableMissingError } from '../lib/localFallbackStore';

interface FeaturedJob {
  id: string;
  title: string;
  category: string;
  location: string;
  pricePerTask: number;
  totalSlots: number;
  occupiedSlots: number;
}

export default function LandingPage() {
  const [featuredJobs, setFeaturedJobs] = useState<FeaturedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const fetchFeaturedJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'active')
        .order('price_per_task', { ascending: false })
        .limit(12);

      if (error && isTableMissingError(error)) {
        const local = getLocalJobs()
          .filter((j: any) => j.status === 'active')
          .sort((a: any, b: any) => Number(b.price_per_task || 0) - Number(a.price_per_task || 0))
          .slice(0, 12)
          .map((j: any) => ({
            id: j.id,
            title: j.title || 'Micro Job Task',
            category: j.category || 'General',
            location: j.location || 'GLOBAL',
            pricePerTask: Number(j.price_per_task || j.pricePerTask || 0),
            totalSlots: Number(j.total_slots || j.totalSlots || 0),
            occupiedSlots: Number(j.occupied_slots || j.occupiedSlots || 0),
          }));
        setFeaturedJobs(local);
        return;
      }

      if (data && data.length > 0) {
        const formatted = data.map((j: any) => ({
          id: j.id,
          title: j.title || 'Micro Job Task',
          category: j.category || 'General',
          location: j.location || 'GLOBAL',
          pricePerTask: Number(j.price_per_task || j.pricePerTask || 0),
          totalSlots: Number(j.total_slots || j.totalSlots || 0),
          occupiedSlots: Number(j.occupied_slots || j.occupiedSlots || 0),
        }));
        setFeaturedJobs(formatted);
      } else {
        const local = getLocalJobs()
          .filter((j: any) => j.status === 'active')
          .sort((a: any, b: any) => Number(b.price_per_task || 0) - Number(a.price_per_task || 0))
          .slice(0, 12)
          .map((j: any) => ({
            id: j.id,
            title: j.title || 'Micro Job Task',
            category: j.category || 'General',
            location: j.location || 'GLOBAL',
            pricePerTask: Number(j.price_per_task || j.pricePerTask || 0),
            totalSlots: Number(j.total_slots || j.totalSlots || 0),
            occupiedSlots: Number(j.occupied_slots || j.occupiedSlots || 0),
          }));
        setFeaturedJobs(local);
      }
    } catch {
      setFeaturedJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchFeaturedJobs();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090514] dark:text-white transition-colors duration-300 font-sans selection:bg-amber-400 selection:text-slate-950 flex flex-col">
      {/* 1. Header / Navbar */}
      <header className="fixed w-full z-50 bg-white/90 dark:bg-[#090514]/80 backdrop-blur-xl border-b border-slate-200 dark:border-purple-500/20 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <Link to="/" className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 font-black">
                IZ
              </div>
              <span>
                Income<span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 bg-clip-text text-transparent">Zone</span>
              </span>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center space-x-8 font-bold text-sm text-slate-600 dark:text-purple-200/80">
              <a href="#how-it-works" className="hover:text-amber-500 dark:hover:text-amber-300 transition-colors">How It Works</a>
              <a href="#live-stats" className="hover:text-amber-500 dark:hover:text-amber-300 transition-colors">Live Stats</a>
              <a href="#featured-jobs" className="hover:text-amber-500 dark:hover:text-amber-300 transition-colors">Top Jobs</a>
              <a href="#why-us" className="hover:text-amber-500 dark:hover:text-amber-300 transition-colors">Why Choose Us</a>
            </nav>

            {/* Actions & Theme Toggle */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              <ThemeToggle />

              <Link 
                to="/login" 
                className="text-sm font-bold text-slate-700 dark:text-purple-200 hover:text-amber-600 dark:hover:text-white transition-colors px-3 py-2"
              >
                Login
              </Link>

              <Link 
                to="/signup" 
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 hover:from-amber-300 hover:to-yellow-400 transition-all duration-300 hover:scale-105"
              >
                Register Now
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow pt-20">
        {/* 2. Hero Section */}
        <section className="relative overflow-hidden py-16 lg:py-28 bg-gradient-to-b from-slate-100 via-slate-50 to-white dark:from-[#090514] dark:via-[#0f0926] dark:to-[#080512]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative">
            
            {/* Left Column */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15] mb-6">
                Turn Your Free Time Into <span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 bg-clip-text text-transparent">Real Income Daily.</span>
              </h1>

              <p className="text-base sm:text-lg font-medium text-slate-600 dark:text-purple-200/80 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Connect with thousands of global employers. Complete simple online tasks like social media engagement, app testing, and signups to earn real cash directly to your balance.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link 
                  to="/signup" 
                  className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 text-base font-black text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 rounded-2xl shadow-xl shadow-amber-500/25 transition-all duration-300 hover:scale-105"
                >
                  Register Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>

                <Link 
                  to="/login" 
                  className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-4 text-base font-bold text-slate-800 dark:text-purple-200 bg-white dark:bg-[#130b2c]/80 border border-slate-300 dark:border-purple-500/30 rounded-2xl hover:border-amber-400 shadow-md hover:shadow-lg transition-all"
                >
                  Login
                </Link>
              </div>

              {/* Guarantees Badges */}
              <div className="mt-10 pt-8 border-t border-slate-200 dark:border-purple-900/40 flex flex-wrap justify-center lg:justify-start gap-6 text-xs sm:text-sm font-bold text-slate-500 dark:text-purple-300/70">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Instant Payouts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  <span>Verified Employers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-500" />
                  <span>Global Access 24/7</span>
                </div>
              </div>
            </div>

            {/* Right Column - Interactive Preview Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative w-full max-w-md mx-auto">
                <div className="bg-white dark:bg-[#130b2c]/90 backdrop-blur-2xl border border-slate-200 dark:border-purple-500/30 shadow-2xl rounded-3xl p-6 sm:p-8 hover:border-amber-400/50 transition-all duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-xs font-black text-slate-400 dark:text-purple-300/60 uppercase tracking-wider">User Earning Activity</p>
                      <p className="text-3xl font-black bg-gradient-to-r from-amber-500 to-yellow-500 dark:from-amber-300 dark:to-yellow-400 bg-clip-text text-transparent mt-1">
                        $2,450.80 Total
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                      <DollarSign className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { title: 'YouTube Engagement', time: '2 mins ago', payout: '+$0.35', status: 'Approved' },
                      { title: 'App Review & Rating', time: '12 mins ago', payout: '+$1.50', status: 'Approved' },
                      { title: 'Website Signup Task', time: '25 mins ago', payout: '+$0.60', status: 'Approved' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0e0822] border border-slate-200 dark:border-purple-500/20">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">{item.title}</p>
                            <p className="text-[10px] text-slate-400 dark:text-purple-300/50 font-medium">{item.time}</p>
                          </div>
                        </div>
                        <span className="text-xs font-black text-amber-500">{item.payout}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Live Animated Stats Section */}
        <section id="live-stats" className="py-16 bg-white dark:bg-[#0a0718] border-y border-slate-200 dark:border-purple-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <LiveStats />
          </div>
        </section>

        {/* 4. How It Works Section */}
        <section id="how-it-works" className="py-20 bg-slate-100/70 dark:bg-[#0d0822]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-4 tracking-tight">
                How Income Zone Works
              </h2>
              <p className="text-base font-medium text-slate-600 dark:text-purple-200/70 mt-3">
                Start making money in less than 3 minutes. Follow these simple steps to begin earning.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  step: '01',
                  title: 'Create Account',
                  desc: 'Sign up for free in under 60 seconds with instant verification.',
                  icon: Users,
                  color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
                },
                {
                  step: '02',
                  title: 'Select Micro Job',
                  desc: 'Browse hundreds of available tasks matched to your skills.',
                  icon: Search,
                  color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
                },
                {
                  step: '03',
                  title: 'Complete Task',
                  desc: 'Follow clear employer instructions and submit required proof.',
                  icon: CheckSquare,
                  color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
                },
                {
                  step: '04',
                  title: 'Get Paid Instantly',
                  desc: 'Receive rewards straight into your wallet and withdraw anytime.',
                  icon: DollarSign,
                  color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="relative bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 shadow-lg shadow-slate-200/50 dark:shadow-purple-950/40 hover:border-amber-400/50 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border font-black ${item.color}`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <span className="text-3xl font-black text-slate-200 dark:text-purple-900/60 font-mono">
                        {item.step}
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm font-medium text-slate-600 dark:text-purple-200/70 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. Featured / Top Jobs Preview */}
        <section id="featured-jobs" className="py-20 bg-white dark:bg-[#090514]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs font-black text-amber-500 uppercase tracking-widest">
                  Live Opportunities
                </span>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                  Featured Micro Tasks
                </h2>
                <p className="text-sm font-medium text-slate-600 dark:text-purple-300/70 mt-1">
                  Explore available missions ready for completion right now.
                </p>
              </div>

              <Link
                to="/signup"
                className="inline-flex items-center text-sm font-black text-amber-500 hover:text-amber-600 transition-colors"
              >
                View All Jobs
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            {loadingJobs ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <div key={n} className="h-48 bg-slate-200 dark:bg-[#130b2c] rounded-3xl animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {featuredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-slate-50 dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-6 shadow-md hover:shadow-xl dark:hover:border-amber-400/50 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {job.category}
                        </span>
                        <span className="text-xs font-bold text-slate-400 dark:text-purple-300/50 flex items-center">
                          <MapPin className="w-3.5 h-3.5 mr-1" /> {job.location}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 line-clamp-2">
                        {job.title}
                      </h3>
                    </div>

                    <div>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-purple-500/20 mb-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-purple-300/50 uppercase">Payout per task</p>
                          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">${job.pricePerTask.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-purple-300/50 uppercase">Slots Remaining</p>
                          <p className="text-xs font-bold text-slate-700 dark:text-purple-200">
                            {job.totalSlots - job.occupiedSlots}/{job.totalSlots} Left
                          </p>
                        </div>
                      </div>

                      <Link
                        to="/signup"
                        className="w-full py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs text-center block transition-all shadow-md shadow-amber-500/10"
                      >
                        Apply for Job
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 6. Why Choose Us Section */}
        <section id="why-us" className="py-20 bg-slate-100/80 dark:bg-[#0c071d] border-t border-slate-200 dark:border-purple-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Why Income Zone leads the industry
              </h2>
              <p className="text-base font-medium text-slate-600 dark:text-purple-200/70 mt-3">
                Designed for both micro-taskers and business advertisers looking for authentic engagement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 shadow-md">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black mb-6">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">High Approval Rates</h3>
                <p className="text-sm font-medium text-slate-600 dark:text-purple-200/70 leading-relaxed">
                  Our transparent proof submission guidelines ensure fast reviews and prompt worker approvals.
                </p>
              </div>

              <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 shadow-md">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black mb-6">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Bank-Grade Security</h3>
                <p className="text-sm font-medium text-slate-600 dark:text-purple-200/70 leading-relaxed">
                  All transactions and balances are protected with encrypted security protocols and Supabase Auth.
                </p>
              </div>

              <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 shadow-md">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black mb-6">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Instant Cash Out</h3>
                <p className="text-sm font-medium text-slate-600 dark:text-purple-200/70 leading-relaxed">
                  Withdraw earnings directly to your preferred payment account with minimal platform fees.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Professional Footer */}
      <Footer />
    </div>
  );
}
