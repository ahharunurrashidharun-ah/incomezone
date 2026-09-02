import React from 'react';
import Footer from '../components/Footer';
import ThemeToggle from '../components/ThemeToggle';
import { Link } from 'react-router-dom';

export default function TermsPage() {
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
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Terms & Conditions</h1>
          <p className="text-slate-500 dark:text-purple-300/70 font-bold mb-10">Last Updated: September 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-a:text-purple-600 dark:prose-a:text-amber-400">
            <h3>1. Account Eligibility & Responsibilities</h3>
            <p>Welcome to IncomeZone. By accessing our platform, you agree to comply with and be bound by these Terms and Conditions. You must be at least 18 years of age to register as a worker or employer. Users are strictly prohibited from maintaining multiple accounts. Any attempt to use VPNs, proxies, or multiple accounts to artificially inflate earnings or bypass regional restrictions will result in immediate and permanent account suspension without access to accrued funds.</p>

            <h3>2. Worker & Employer Responsibilities</h3>
            <p><strong>Workers:</strong> You agree to complete micro-tasks honestly and accurately according to the employer's instructions. Submitting false proof, fabricated screenshots, or incomplete work constitutes fraud.</p>
            <p><strong>Employers:</strong> You agree to provide clear, actionable instructions for all posted campaigns. You must review submissions fairly and promptly. Rejecting valid work to avoid payment is strictly prohibited and will result in the suspension of your employer account and forfeiture of campaign funds.</p>

            <h3>3. Micro-task Approval & Rejection Rules</h3>
            <p>Employers have a standard review period (typically 72 hours) to approve or reject submitted task proofs. If no action is taken within this period, the platform may automatically approve the task and release funds to the worker. Disputes regarding rejected tasks will be mediated by IncomeZone administration, and our decision is final.</p>

            <h3>4. Anti-Fraud & Multiple Account Bans</h3>
            <p>We employ advanced security monitoring to ensure fair play. Any user caught utilizing automated bots, scripts, emulator farms, or sharing payment details across multiple accounts will face immediate termination. Any pending withdrawals on fraudulent accounts will be cancelled and the funds returned to the respective employers or absorbed as administrative penalties.</p>

            <h3>5. Withdrawal & Deposit Terms</h3>
            <p>All deposits are final and non-refundable except where explicitly stated in our Refund Policy. Withdrawals are processed according to our stated payout schedule (e.g., within 24-48 hours) and are subject to minimum payout thresholds and applicable payment gateway fees. IncomeZone is not responsible for delays caused by third-party payment processors or incorrect account details provided by the user.</p>

            <h3>6. Intellectual Property</h3>
            <p>All platform content, logos, trademarks, and software infrastructure belong exclusively to IncomeZone. You may not copy, modify, distribute, or reverse-engineer any part of our platform. Content submitted by users (such as task descriptions) remains the responsibility of the user, but you grant IncomeZone a non-exclusive license to display this content on the platform.</p>

            <h3>7. Limitation of Liability</h3>
            <p>IncomeZone acts strictly as a marketplace connecting independent digital workers with employers. We do not guarantee the availability of tasks, the quality of submitted work, or uninterrupted platform uptime. In no event shall IncomeZone be liable for indirect, incidental, or consequential damages arising from the use or inability to use the platform.</p>

            <h3>8. Termination of Service</h3>
            <p>We reserve the right to modify, suspend, or terminate the platform, or any user's access to it, at any time and for any reason, without prior notice. Users may terminate their accounts at any time by contacting support, provided all pending transactions and disputes are resolved.</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
