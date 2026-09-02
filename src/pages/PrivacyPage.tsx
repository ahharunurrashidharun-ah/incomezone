import React from 'react';
import Footer from '../components/Footer';
import ThemeToggle from '../components/ThemeToggle';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0718] font-sans selection:bg-purple-500/30">
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-[#0a0718]/80 backdrop-blur-xl border-b border-slate-200 dark:border-purple-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Income<span className="text-purple-600 dark:text-amber-400">Zone</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/login" className="hidden sm:block text-sm font-bold text-slate-600 dark:text-purple-200 hover:text-purple-600 dark:hover:text-amber-400 transition-colors">Sign In</Link>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl p-8 sm:p-12 shadow-xl shadow-slate-200/50 dark:shadow-purple-950/50">
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-slate-500 dark:text-purple-300/70 font-bold mb-10">Last Updated: September 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-a:text-purple-600 dark:prose-a:text-amber-400">
            <h3>1. Information We Collect</h3>
            <p>At IncomeZone, we collect essential data necessary to operate our micro-task platform securely and efficiently. This includes:</p>
            <ul>
              <li><strong>Account Details:</strong> Name, email address, password, and registered payment methods.</li>
              <li><strong>Technical Data:</strong> IP addresses, browser types, device fingerprints, and location data to enforce our anti-fraud and geo-targeting policies.</li>
              <li><strong>Task Evidence:</strong> Screenshots, text responses, and URLs submitted as proof of completed micro-tasks.</li>
            </ul>

            <h3>2. How We Use Data</h3>
            <p>Your data is strictly utilized to facilitate the core functions of the marketplace. We use this information to verify task completions, process secure deposits and withdrawals, mediate disputes between employers and workers, and proactively monitor for fraudulent or automated (bot) activities across the platform.</p>

            <h3>3. Data Security & Encryption</h3>
            <p>We take your privacy seriously. All sensitive data, including passwords and payment routing information, is encrypted in transit utilizing modern TLS standards and encrypted at rest within our secured database infrastructure. We utilize enterprise-grade authentication providers to ensure account integrity.</p>

            <h3>4. Third-Party Service Disclosures</h3>
            <p>IncomeZone does not sell your personal data to third-party marketers. However, we do share necessary operational data with verified third-party payment gateways (e.g., bKash, Nagad, Stripe) exclusively for the purpose of processing your requested financial transactions.</p>

            <h3>5. Cookies Policy</h3>
            <p>Our platform uses essential session cookies to maintain your login status and secure your account against Cross-Site Request Forgery (CSRF). We may also use analytical cookies to understand platform traffic patterns, but these can be opted out of via your browser settings without impacting core functionality.</p>

            <h3>6. User Rights</h3>
            <p>You maintain full control over your personal data. You have the right to request a copy of the data we hold about you, request corrections to inaccurate information, or request full account deletion. Account deletion requests will remove your personal identifying information, though anonymized financial ledgers may be retained for legal compliance.</p>

            <h3>7. Data Retention</h3>
            <p>We retain your account information for as long as your account remains active. Task proof screenshots are routinely purged from our active storage servers 90 days after a task has been finalized and paid out, minimizing our digital footprint and protecting user privacy.</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
