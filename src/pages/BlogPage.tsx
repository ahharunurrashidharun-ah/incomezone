import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Calendar, 
  Eye, 
  BookOpen, 
  User as UserIcon, 
  ArrowLeft, 
  Sparkles, 
  Clock, 
  Share2, 
  CheckCircle2, 
  AlertTriangle, 
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import toast from 'react-hot-toast';

import blogAccountGuideImg from '../assets/images/blog_account_guide_1790427456890.jpg';
import blogSubmitWorkImg from '../assets/images/blog_submit_work_1790427494267.jpg';
import blogPaymentMethodsImg from '../assets/images/blog_payment_methods_1790427508895.jpg';
import blogBanWarningImg from '../assets/images/blog_ban_warning_1790427534231.jpg';

export interface BlogPost {
  id: number;
  category: 'Tutorial' | 'Guidelines' | 'Payment' | 'Warning' | string;
  title: string;
  excerpt: string;
  date: string;
  views: number;
  imageUrl: string;
  content?: string[];
  tips?: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 1,
    category: "Tutorial",
    title: "IncomeZone-এ সঠিক নিয়মে একাউন্ট খোলার এ টু জেড গাইড!",
    excerpt: "ভুল ছাড়াই কীভাবে একটি ভেরিফায়েড একাউন্ট তৈরি করবেন এবং কাজ শুরু করার জন্য প্রোফাইল সেটআপ করবেন, তার বিস্তারিত নিয়মাবলি।",
    date: "25 Aug, 2026",
    views: 1240,
    imageUrl: blogAccountGuideImg,
    content: [
      "IncomeZone প্ল্যাটফর্মে কাজ শুরু করার প্রথম ধাপ হলো একটি সঠিক ও বৈধ তথ্যে একাউন্ট তৈরি করা। আপনার ব্যক্তিগত নাম ও সঠিক ইমেইল ব্যবহার করা অত্যন্ত জরুরি।",
      "একাউন্ট রেজিস্টার করার সময় পাসওয়ার্ডে শক্তিশালী ক্যারেক্টার (ছোট-বড় অক্ষর এবং সংখ্যা) ব্যবহার করুন। রেজিস্ট্রেশন শেষে কনফার্মেশন যাচাই সম্পন্ন করুন।",
      "প্রোফাইল সেকশনে গিয়ে আপনার ইউজারনেম এবং প্রয়োজনীয় তথ্য সম্পূর্ণ করুন। মনে রাখবেন, একাধিক ভুয়া একাউন্ট তৈরি করা সম্পূর্ণ নিষিদ্ধ।"
    ],
    tips: [
      "সবসময় আপনার নিজস্ব সচল ইমেইল এড্রেস ব্যবহার করুন।",
      "প্রোফাইল নেম আপনার পেমেন্ট একাউন্টের নামের সাথে মিল রাখলে উত্তোলন সহজ হয়।",
      "একটি ডিভাইস থেকে কেবল একটি একাউন্টই ব্যবহার করুন।"
    ]
  },
  {
    id: 2,
    category: "Guidelines",
    title: "কাজ সাবমিট করার সঠিক নিয়ম - ১০০% পেমেন্ট গ্যারান্টি!",
    excerpt: "কীভাবে টাস্ক কমপ্লিট করবেন, সঠিক স্ক্রিনশট নিবেন এবং প্রুফ জমা দিবেন যাতে বায়ার আপনার কাজ রিজেক্ট করতে না পারে।",
    date: "26 Aug, 2026",
    views: 3450,
    imageUrl: blogSubmitWorkImg,
    content: [
      "ইনকাম জোনে প্রতিটি মাইক্রো টাস্কে বায়ারের স্পষ্ট নির্দেশনা উল্লেখ থাকে। কাজ শুরু করার পূর্বে বায়ারের রিকোয়ারমেন্ট ভালো করে পড়ে নেওয়া অপরিহার্য।",
      "টাস্কের শর্ত অনুযায়ী সঠিক প্রমাণ যেমন টেক্সট প্রুফ বা ক্লিয়ার স্ক্রিনশট প্রদান করতে হবে। অস্পষ্ট বা ভুল স্ক্রিনশট দিলে বায়ার কাজটি রিজেক্ট করতে পারে।",
      "সততার সাথে সম্পন্ন করা প্রুফ সাবমিট করলে বায়ার দ্রুত অ্যাপ্রুভ করে এবং আপনার একাউন্টে নির্ধারিত আর্নিং ব্যালেন্স স্বয়ংক্রিয়ভাবে যোগ হয়ে যায়।"
    ],
    tips: [
      "বায়ার যে লিংক বা কীওয়ার্ড খুঁজতে বলেছেন তা নিখুঁতভাবে অনুসরণ করুন।",
      "স্ক্রিনশটে টাইম ও চ্যানেল/পেজ নেম যেন স্পষ্টভাবে পড়া যায়।",
      "ভুল বা কপি করা প্রুফ জমা দেওয়া থেকে বিরত থাকুন।"
    ]
  },
  {
    id: 3,
    category: "Payment",
    title: "বিকাশ, নগদ বা রকেটে পেমেন্ট নেওয়ার সহজ উপায়",
    excerpt: "আপনার কষ্টার্জিত টাকা কোনো ঝামেলা ছাড়াই কীভাবে সরাসরি নিজের মোবাইল ব্যাংকিং একাউন্টে তুলবেন, তার বিস্তারিত গাইড।",
    date: "28 Aug, 2026",
    views: 5600,
    imageUrl: blogPaymentMethodsImg,
    content: [
      "IncomeZone-এ উপার্জিত অর্থ আপনি খুব সহজেই বিকাশ, নগদ কিংবা রকেটের মাধ্যমে নিজের একাউন্টে উইথড্র করতে পারেন।",
      "উইথড্র করার জন্য আপনার ড্যাশবোর্ডের 'Withdraw' পেজে যান, এরপর পেমেন্ট মেথড নির্বাচন করুন এবং আপনার মোবাইল একাউন্ট নাম্বারটি নির্ভুলভাবে দিন।",
      "এডমিন প্যানেল থেকে আপনার রিকোয়েস্ট দ্রুত ভেরিফাই করে সরাসরি আপনার ওয়ালেটে টাকা পাঠিয়ে দেওয়া হবে।"
    ],
    tips: [
      "উইথড্র করার পূর্বে সর্বনিম্ন ব্যালেন্স লিমিট দেখে নিন।",
      "একাউন্ট নাম্বারে পার্সোনাল নাকি এজেন্ট তা নিশ্চিত করে দিন।",
      "কোনো বিলম্ব হলে ট্রানজেকশন হিস্ট্রি ও সাপোর্ট প্যানেলে যোগাযোগ করুন।"
    ]
  },
  {
    id: 4,
    category: "Warning",
    title: "সাবধান! যে ৩টি ভুলে আপনার একাউন্ট ব্যান হতে পারে",
    excerpt: "ইনকাম জোনে কাজ করার সময় কোন কোন কাজগুলো একদমই করা যাবে না এবং কীভাবে নিজের একাউন্ট আজীবনের জন্য সুরক্ষিত রাখবেন।",
    date: "01 Sep, 2026",
    views: 8900,
    imageUrl: blogBanWarningImg,
    content: [
      "IncomeZone একটি বিশ্বস্ত ও নিরাপদ আর্নিং প্ল্যাটফর্ম। প্ল্যাটফর্মের স্বচ্ছতা বজায় রাখতে সিস্টেম স্বয়ংক্রিয়ভাবে স্প্যাম এবং জালিয়াতি পর্যবেক্ষণ করে।",
      "১. একই আইপি বা ডিভাইস থেকে একাধিক ফেক একাউন্ট খুলে কাজ নেওয়া সম্পূর্ণ নিষিদ্ধ।",
      "২. ফেক স্ক্রিনশট বা অন্য কারো প্রুফ কপি করে সাবমিট করলে একাউন্ট সাময়িক বা স্থায়ীভাবে ব্যান করা হতে পারে।",
      "৩. বায়ারকে প্রতারিত করা বা আপত্তিকর মেসেজ প্রদান করা যাবে না।"
    ],
    tips: [
      "ভিপিএন (VPN) বা প্রক্সি ব্যবহার করে কাজ করা এড়িয়ে চলুন।",
      "একটি জেনুইন একাউন্ট ব্যবহার করে নিয়মিত আর্ন করুন।",
      "সঠিক নিয়ম মেনে কাজ করলে আপনার একাউন্ট সবসময় নিরাপদ ও সুরক্ষিত থাকবে।"
    ]
  }
];

export default function BlogPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activePost, setActivePost] = useState<BlogPost | null>(null);

  // User display metadata
  const userName = profile?.name || user?.name || user?.email?.split('@')[0] || 'ব্যবহারকারী';
  const userRole = profile?.role || user?.role || 'User';
  const userAvatarInitial = (userName.charAt(0) || 'U').toUpperCase();

  // Filtered posts based on search query and category
  const filteredPosts = useMemo(() => {
    return BLOG_POSTS.filter((post) => {
      const matchesSearch = 
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = 
        selectedCategory === 'All' || 
        post.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const categories = ['All', 'Tutorial', 'Guidelines', 'Payment', 'Warning'];

  // Category badge badge styles
  const getCategoryBadgeClass = (category: string) => {
    switch (category.toLowerCase()) {
      case 'tutorial':
        return 'bg-blue-500/90 text-white border-blue-400/40 shadow-blue-500/30';
      case 'guidelines':
        return 'bg-emerald-500/90 text-white border-emerald-400/40 shadow-emerald-500/30';
      case 'payment':
        return 'bg-amber-500/90 text-slate-950 font-black border-amber-300 shadow-amber-500/30';
      case 'warning':
        return 'bg-rose-500/90 text-white border-rose-400/40 shadow-rose-500/30';
      default:
        return 'bg-purple-500/90 text-white border-purple-400/40 shadow-purple-500/30';
    }
  };

  const handleShare = (post: BlogPost, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.excerpt,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${post.title} - ${window.location.href}`);
      toast.success('আর্টিকেল লিংক কপি করা হয়েছে!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080414] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950 relative overflow-x-hidden transition-colors duration-200">
      {/* Background Decorative Ambient Lighting */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-purple-200/50 dark:bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-10 w-80 h-80 bg-amber-200/40 dark:bg-amber-500/10 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/3 w-96 h-96 bg-blue-200/40 dark:bg-blue-600/10 rounded-full blur-[150px] pointer-events-none -z-10" />

      {/* 1. TOP USER HEADER BAR */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0d0722]/85 backdrop-blur-md border-b border-slate-200 dark:border-purple-900/30 shadow-sm dark:shadow-lg transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Back & Logo */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-purple-950/60 border border-slate-200 dark:border-purple-500/30 text-slate-600 dark:text-purple-200 hover:text-slate-900 dark:hover:text-white hover:border-amber-400 dark:hover:border-amber-400 hover:bg-slate-200 dark:hover:bg-purple-900/60 transition-all duration-200 group shadow-sm"
              title="পিছনে ফিরে যান"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="leading-tight">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-amber-300 transition-colors">
                  Income<span className="text-amber-500 dark:text-amber-400">Zone</span>
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                  Blog & Guide
                </span>
              </div>
            </Link>
          </div>

          {/* User Profile Info & Dashboard Link */}
          <div className="flex items-center gap-3 sm:gap-4">
            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-slate-200 dark:border-purple-900/40">
                <Link 
                  to="/jobs"
                  className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-800/60 text-purple-700 dark:text-purple-200 hover:text-purple-900 dark:hover:text-white text-xs font-bold border border-purple-200 dark:border-purple-500/20 transition-all"
                >
                  ড্যাশবোর্ড
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 via-amber-500 to-yellow-400 p-[2px] shadow-md shadow-purple-950/20 dark:shadow-purple-950">
                      <div className="w-full h-full rounded-full bg-slate-100 dark:bg-[#130b2c] flex items-center justify-center text-purple-700 dark:text-amber-300 font-black text-sm">
                        {userAvatarInitial}
                      </div>
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0d0722] rounded-full" title="অনলাইন" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[130px]">
                      {userName}
                    </p>
                    <span className="inline-block text-[10px] font-semibold text-purple-700 dark:text-purple-300/80 bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded capitalize">
                      {userRole}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-200 hover:text-purple-900 dark:hover:text-white bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/70 border border-purple-200 dark:border-purple-500/30 rounded-xl transition-all"
                >
                  লগইন
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-xs sm:text-sm font-black text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 rounded-xl shadow-md shadow-amber-500/20 transition-all"
                >
                  রেজিস্টার
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO / HEADER SECTION */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-purple-900/20 overflow-hidden bg-gradient-to-b from-purple-50/70 via-slate-50/40 to-transparent dark:from-[#11092e]/60 dark:via-[#0d0724]/40 dark:to-transparent transition-colors duration-200">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-400/10 border border-amber-300 dark:border-amber-400/30 text-amber-800 dark:text-amber-300 text-xs font-bold mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>IncomeZone জ্ঞান ভান্ডার ও আপডেট</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4 leading-tight">
            IncomeZone <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 dark:from-amber-300 dark:via-yellow-400 dark:to-amber-500 bg-clip-text text-transparent">Blog</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-purple-200/80 max-w-2xl mx-auto leading-relaxed mb-8">
            IncomeZone-এ কাজ করার টিপস, গাইডলাইন এবং অনলাইনে আয় করার বিশ্বস্ত মাধ্যম।
          </p>

          {/* 3. SEARCH BAR */}
          <div className="max-w-xl mx-auto relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-purple-400 group-focus-within:text-amber-500 dark:group-focus-within:text-amber-400 transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="আর্টিকেল বা টপিকের নাম দিয়ে খুঁজুন..."
              className="w-full pl-12 pr-10 py-3.5 sm:py-4 rounded-2xl bg-white dark:bg-[#140b30]/90 border border-slate-200 dark:border-purple-500/30 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/50 text-sm sm:text-base font-medium focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 shadow-md dark:shadow-xl backdrop-blur-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 dark:text-purple-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                title="মুছে ফেলুন"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/25 scale-105'
                    : 'bg-white dark:bg-[#140b30] text-slate-600 dark:text-purple-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-purple-800/40 hover:border-purple-400 dark:hover:border-purple-600 shadow-sm'
                }`}
              >
                {cat === 'All' ? 'সবগুলো' : cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. MAIN BLOG GRID SECTION */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#120a2c]/40 border border-slate-200 dark:border-purple-900/30 rounded-3xl p-8 max-w-md mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-300">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">কোনো আর্টিকেল পাওয়া যায়নি!</h3>
            <p className="text-sm text-slate-600 dark:text-purple-300/70 mb-6">
              "{searchQuery}" এর সাথে সম্পর্কিত কোনো ব্লগ পোস্ট মেলেনি। অনুগ্রহ করে অন্য কোনো কিওয়ার্ড দিয়ে খুঁজুন।
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/20"
            >
              সব আর্টিকেল দেখুন
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                onClick={() => setActivePost(post)}
                className="group bg-white dark:bg-[#120a2c] border border-slate-200 dark:border-purple-900/40 hover:border-amber-400/80 dark:hover:border-amber-400/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl dark:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-purple-900/30 transition-all duration-300 flex flex-col cursor-pointer transform hover:-translate-y-1.5"
              >
                {/* Image Container with Floating Category Badge */}
                <div className="relative w-full h-48 overflow-hidden bg-slate-100 dark:bg-purple-950/80">
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 
                        'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22400%22%20height%3D%22200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%231d1045%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%23fbbf24%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20font-weight%3D%22bold%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EIncomeZone%20Blog%3C%2Ftext%3E%3C%2Fsvg%3E';
                    }}
                  />
                  {/* Subtle dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                  {/* Floating Category Badge */}
                  <span
                    className={`absolute top-3 left-3 px-3 py-1 text-xs font-black rounded-full border shadow-md backdrop-blur-md uppercase tracking-wider ${getCategoryBadgeClass(
                      post.category
                    )}`}
                  >
                    {post.category}
                  </span>

                  {/* Quick Share Button */}
                  <button
                    onClick={(e) => handleShare(post, e)}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-[#0d0722]/80 hover:bg-amber-400 text-slate-700 dark:text-purple-200 hover:text-slate-950 backdrop-blur-md border border-slate-200 dark:border-purple-500/20 transition-all duration-200 opacity-90 group-hover:opacity-100 shadow-sm"
                    title="শেয়ার করুন"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Card Body */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Bold Bengali Title */}
                    <h2 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug mb-3">
                      {post.title}
                    </h2>

                    {/* Excerpt Clamped to 2 lines */}
                    <p className="text-sm text-slate-600 dark:text-purple-200/70 leading-relaxed line-clamp-2 mb-4">
                      {post.excerpt}
                    </p>
                  </div>

                  {/* Card Footer: Date on left, Views on right */}
                  <div className="pt-4 border-t border-slate-100 dark:border-purple-900/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-purple-300/80 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>{post.date}</span>
                    </div>

                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-400/20">
                      <Eye className="w-3.5 h-3.5" />
                      <span>{post.views.toLocaleString()} ভিউ</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* 5. FULL ARTICLE DETAIL MODAL */}
      {activePost && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setActivePost(null)}
        >
          <div 
            className="bg-white dark:bg-[#120a2c] border border-slate-200 dark:border-purple-500/40 rounded-3xl max-w-2xl w-full my-8 overflow-hidden shadow-2xl relative text-left transition-colors duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Image */}
            <div className="relative w-full h-56 sm:h-64 overflow-hidden bg-slate-900">
              <img
                src={activePost.imageUrl}
                alt={activePost.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              <button
                onClick={() => setActivePost(null)}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-rose-600 text-white backdrop-blur-md transition-colors"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>

              <span
                className={`absolute bottom-4 left-6 px-3.5 py-1 text-xs font-black rounded-full border shadow-md uppercase tracking-wider ${getCategoryBadgeClass(
                  activePost.category
                )}`}
              >
                {activePost.category}
              </span>
            </div>

            {/* Modal Content */}
            <div className="p-6 sm:p-8 max-h-[60vh] overflow-y-auto space-y-5">
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-purple-300/80 border-b border-slate-200 dark:border-purple-900/30 pb-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  {activePost.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  {activePost.views.toLocaleString()} জন পড়েছেন
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  ৩ মিনিট পড়া
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {activePost.title}
              </h2>

              <p className="text-base text-amber-900 dark:text-amber-200/90 font-medium bg-amber-50 dark:bg-amber-400/10 border-l-4 border-amber-400 p-3.5 rounded-r-xl">
                {activePost.excerpt}
              </p>

              {/* Detailed paragraphs */}
              {activePost.content && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">বিস্তারিত তথ্য:</h3>
                  {activePost.content.map((paragraph, idx) => (
                    <p key={idx} className="text-sm sm:text-base text-slate-700 dark:text-purple-100/80 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}

              {/* Key Tips */}
              {activePost.tips && (
                <div className="bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/40 rounded-2xl p-5 mt-4">
                  <h4 className="text-sm font-black text-purple-900 dark:text-amber-300 mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    জরুরি পরামর্শ ও টিপস:
                  </h4>
                  <ul className="space-y-2">
                    {activePost.tips.map((tip, idx) => (
                      <li key={idx} className="text-xs sm:text-sm text-slate-700 dark:text-purple-200/90 flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#0e0724] border-t border-slate-200 dark:border-purple-900/30 flex items-center justify-between">
              <button
                onClick={(e) => handleShare(activePost, e)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-purple-900/40 hover:bg-slate-100 dark:hover:bg-purple-800/60 text-slate-700 dark:text-purple-200 hover:text-slate-900 dark:hover:text-white text-xs font-bold border border-slate-200 dark:border-purple-500/20 transition-all shadow-sm"
              >
                <Share2 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                শেয়ার করুন
              </button>

              <button
                onClick={() => setActivePost(null)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs hover:from-amber-300 hover:to-yellow-400 transition-all shadow-md shadow-amber-400/20"
              >
                পড়া শেষ হয়েছে
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FOOTER INFO */}
      <footer className="mt-auto border-t border-slate-200 dark:border-purple-900/30 bg-slate-100 dark:bg-[#090418] py-8 text-center text-xs text-slate-500 dark:text-purple-400/70 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 IncomeZone. সর্বস্বত্ব সংরক্ষিত।</p>
          <div className="flex items-center gap-6">
            <Link to="/rules" className="hover:text-amber-500 dark:hover:text-amber-400 transition-colors">নিয়মাবলি</Link>
            <Link to="/privacy" className="hover:text-amber-500 dark:hover:text-amber-400 transition-colors">প্রাইভেসি পলিসি</Link>
            <Link to="/terms" className="hover:text-amber-500 dark:hover:text-amber-400 transition-colors">শর্তাবলি</Link>
            <Link to="/jobs" className="hover:text-amber-500 dark:hover:text-amber-400 transition-colors font-bold text-purple-700 dark:text-amber-300">টাস্ক খুঁজুন</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
