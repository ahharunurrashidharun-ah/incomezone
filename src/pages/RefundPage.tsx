import React from 'react';
import Footer from '../components/Footer';
import ThemeToggle from '../components/ThemeToggle';
import { Link } from 'react-router-dom';

export default function RefundPage() {
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
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Refund & Cancellation Policy</h1>
          <p className="text-slate-500 dark:text-purple-300/70 font-bold mb-10">Last Updated: September 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-a:text-purple-600 dark:prose-a:text-amber-400">
            <h3>1. Employer Deposit Refunds</h3>
            <p>Funds deposited into the IncomeZone platform are intended for creating micro-task campaigns. If an employer deposits funds but decides not to utilize the platform, they may request a full refund of their unspent wallet balance within 14 days of the initial deposit, provided no campaigns have been launched.</p>

            <h3>2. Unspent Campaign Funds</h3>
            <p>When an employer creates a micro-task campaign, the total estimated cost is held in escrow. If the campaign expires, is paused, or is manually cancelled by the employer before all tasks are completed, the remaining unspent escrowed funds will be immediately released back into the employer's platform wallet. These wallet funds can be used for future campaigns or requested for withdrawal.</p>

            <h3>3. Task Dispute Refund Eligibility</h3>
            <p>Employers are responsible for reviewing submitted tasks. If an employer correctly identifies and rejects a fraudulent or incomplete task, the funds allocated for that specific task are returned to the campaign pool. However, if a task is approved (either manually by the employer or automatically after the 72-hour auto-approval window), the funds are irrevocably transferred to the worker and cannot be refunded under any circumstances.</p>

            <h3>4. Processing Times</h3>
            <p>Approved refund requests back to an original payment method (e.g., credit card, mobile banking) may take between 5 to 10 business days to process and appear on your financial statement, depending heavily on the receiving institution's policies.</p>

            <h3>5. Non-refundable Administrative & Gateway Fees</h3>
            <p>Please note that third-party payment gateways often charge non-refundable processing fees at the time of deposit. IncomeZone does not retain these fees, and therefore, any refunds issued to external accounts will be minus the original payment gateway transaction fees. Internal administrative fees associated with platform violations or account bans are strictly non-refundable.</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
