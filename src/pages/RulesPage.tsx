import React from 'react';
import Footer from '../components/Footer';
import ThemeToggle from '../components/ThemeToggle';
import { Link } from 'react-router-dom';

export default function RulesPage() {
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
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Community Rules & Guidelines</h1>
          <p className="text-slate-500 dark:text-purple-300/70 font-bold mb-10">Last Updated: September 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-a:text-purple-600 dark:prose-a:text-amber-400">
            <h3>1. Worker Guidelines: Submitting Valid Proof</h3>
            <p>To ensure a high-quality ecosystem, all digital workers must adhere to strict submission standards:</p>
            <ul>
              <li><strong>Clarity:</strong> Screenshots must be unedited, clearly visible, and capture the exact requirements stated by the employer (e.g., showing the account name, timestamp, or completed action).</li>
              <li><strong>Accuracy:</strong> Text proofs must directly answer the employer's prompt. Do not submit generic text, irrelevant links, or spam.</li>
              <li><strong>One-to-One Match:</strong> You may only submit proof for a task you have genuinely completed. Reusing old screenshots for new tasks is strictly forbidden.</li>
            </ul>

            <h3>2. Consequences of Fraudulent Submissions</h3>
            <p>IncomeZone maintains a zero-tolerance policy for fake proofs. Our system tracks rejection rates and reports of fabricated screenshots. Workers caught submitting fake, duplicate, or manipulated screenshots will face:</p>
            <ul>
              <li>Immediate rejection of the pending task and loss of associated earnings.</li>
              <li>A temporary shadow-ban reducing visibility of high-paying jobs.</li>
              <li>Permanent account termination and forfeiture of all wallet balances upon repeated offenses or blatant fraud.</li>
            </ul>

            <h3>3. Employer Guidelines: Creating Valid Tasks</h3>
            <p>Employers are the lifeblood of the platform, but must also follow community standards to protect workers:</p>
            <ul>
              <li><strong>Clear Instructions:</strong> Task steps must be explicit, easy to follow, and mathematically possible within the provided time estimate. Do not hide hidden requirements in the proof section.</li>
              <li><strong>Fair Compensation:</strong> Tasks must be priced fairly according to the time and effort required. Exploitative pricing will result in campaign removal.</li>
              <li><strong>Prohibited Content:</strong> Employers may not post tasks that involve illegal activities, adult content, hate speech, downloading malware, or creating fake reviews that violate third-party platform terms.</li>
            </ul>

            <h3>4. Review & Mediation</h3>
            <p>Employers must review tasks in good faith. Mass-rejecting valid work to artificially lower campaign costs is a severe violation. IncomeZone administrators regularly audit rejection rates. Employers found engaging in malicious rejections will have their campaigns paused, funds seized to compensate affected workers, and their accounts permanently banned.</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
