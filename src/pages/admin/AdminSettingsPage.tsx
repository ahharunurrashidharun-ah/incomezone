import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Settings, Save, Bell, DollarSign, Percent, Gift, Megaphone, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [siteSettings, setSiteSettings] = useState({
    bkash_enabled: true,
    bkash_number: '',
    nagad_enabled: true,
    nagad_number: '',
    rocket_enabled: true,
    rocket_number: '',
    stats_mode: 'live',
    manual_users: 0,
    manual_jobs: 0,
    manual_tasks: 0,
    manual_paid: 0,
    help_center_url: '',
    contact_support_url: '',

    // User Panel Controls
    withdraw_fee_percent: 0,
    deposit_bonus_percent: 0,
    withdraw_bonus_percent: 0,
    user_notice_enabled: false,
    user_notice_type: 'info' as 'info' | 'warning' | 'success' | 'promo',
    user_notice_text: '',
    broadcast_text: '',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        // Fetch payment methods from 'settings' table
        let paymentData = null;
        let controlsData = null;

        try {
          const { data: payData } = await supabase
            .from('settings')
            .select('*')
            .eq('key', 'deposit_methods')
            .maybeSingle();
            
          if (payData && payData.value) {
            paymentData = typeof payData.value === 'string' ? JSON.parse(payData.value) : payData.value;
          }
        } catch (e) { console.warn(e); }

        try {
          const { data: ctrlData } = await supabase
            .from('settings')
            .select('*')
            .eq('key', 'platform_controls')
            .maybeSingle();

          if (ctrlData && ctrlData.value) {
            controlsData = typeof ctrlData.value === 'string' ? JSON.parse(ctrlData.value) : ctrlData.value;
          }
        } catch (e) { console.warn(e); }

        const { data } = await supabase
          .from('site_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        // Check local storage fallback for platform controls
        let localCtrls = null;
        try {
          const str = localStorage.getItem('iz_platform_controls');
          if (str) localCtrls = JSON.parse(str);
        } catch {}

        const mergedCtrls = controlsData || localCtrls || {};

        setSiteSettings({
          bkash_enabled: paymentData?.bkash?.enabled ?? paymentData?.bkash_enabled ?? data?.bkash_enabled ?? true,
          bkash_number: paymentData?.bkash?.number ?? paymentData?.bkash_number ?? data?.bkash_number ?? '',
          nagad_enabled: paymentData?.nagad?.enabled ?? paymentData?.nagad_enabled ?? data?.nagad_enabled ?? true,
          nagad_number: paymentData?.nagad?.number ?? paymentData?.nagad_number ?? data?.nagad_number ?? '',
          rocket_enabled: paymentData?.rocket?.enabled ?? paymentData?.rocket_enabled ?? data?.rocket_enabled ?? true,
          rocket_number: paymentData?.rocket?.number ?? paymentData?.rocket_number ?? data?.rocket_number ?? '',
          stats_mode: data?.stats_mode || 'live',
          manual_users: data?.manual_users || 0,
          manual_jobs: data?.manual_jobs || 0,
          manual_tasks: data?.manual_tasks || 0,
          manual_paid: data?.manual_paid || 0,
          help_center_url: data?.help_center_url || '',
          contact_support_url: data?.contact_support_url || '',

          // Controls
          withdraw_fee_percent: mergedCtrls.withdraw_fee_percent ?? 0,
          deposit_bonus_percent: mergedCtrls.deposit_bonus_percent ?? 0,
          withdraw_bonus_percent: mergedCtrls.withdraw_bonus_percent ?? 0,
          user_notice_enabled: mergedCtrls.user_notice_enabled ?? false,
          user_notice_type: mergedCtrls.user_notice_type || 'info',
          user_notice_text: mergedCtrls.user_notice_text || '',
          broadcast_text: '',
        });
      } catch (err) {
        console.error('Failed to load settings from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const paymentPayload = {
        bkash_enabled: siteSettings.bkash_enabled,
        bkash_number: siteSettings.bkash_number,
        nagad_enabled: siteSettings.nagad_enabled,
        nagad_number: siteSettings.nagad_number,
        rocket_enabled: siteSettings.rocket_enabled,
        rocket_number: siteSettings.rocket_number,
      };

      const marketingPayload = {
        stats_mode: siteSettings.stats_mode,
        manual_users: siteSettings.manual_users,
        manual_jobs: siteSettings.manual_jobs,
        manual_tasks: siteSettings.manual_tasks,
        manual_paid: siteSettings.manual_paid,
        help_center_url: siteSettings.help_center_url,
        contact_support_url: siteSettings.contact_support_url,
      };

      const controlsPayload = {
        withdraw_fee_percent: Number(siteSettings.withdraw_fee_percent) || 0,
        deposit_bonus_percent: Number(siteSettings.deposit_bonus_percent) || 0,
        withdraw_bonus_percent: Number(siteSettings.withdraw_bonus_percent) || 0,
        user_notice_enabled: Boolean(siteSettings.user_notice_enabled),
        user_notice_type: siteSettings.user_notice_type,
        user_notice_text: siteSettings.user_notice_text.trim(),
        updated_at: new Date().toISOString(),
      };

      localStorage.setItem('iz_site_settings', JSON.stringify(marketingPayload));
      localStorage.setItem('iz_payment_methods', JSON.stringify(paymentPayload));
      localStorage.setItem('iz_platform_controls', JSON.stringify(controlsPayload));

      // Save payment settings
      await supabase
        .from('settings')
        .upsert({
          key: 'deposit_methods',
          value: paymentPayload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      // Save platform financial and notice controls
      await supabase
        .from('settings')
        .upsert({
          key: 'platform_controls',
          value: controlsPayload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      // Save marketing settings
      await supabase
        .from('site_settings')
        .upsert({
          id: 1,
          ...marketingPayload
        });

      // Dispatch global event for live client reactivity
      window.dispatchEvent(new CustomEvent('iz_platform_controls_updated', { detail: controlsPayload }));

      toast.success("সকল কনফিগারেশন সফলভাবে সেভ হয়েছে!");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error('সেভ করতে সমস্যা হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!siteSettings.broadcast_text.trim()) {
      toast.error("অনুগ্রহ করে নোটিফিকেশনের বার্তা লিখুন।");
      return;
    }

    setBroadcasting(true);
    try {
      const broadcastData = {
        id: `bc_${Date.now()}`,
        text: siteSettings.broadcast_text.trim(),
        created_at: new Date().toISOString(),
      };

      // Store broadcast in localStorage and dispatch realtime event
      localStorage.setItem('iz_latest_broadcast', JSON.stringify(broadcastData));
      
      try {
        await supabase.from('settings').upsert({
          key: 'latest_broadcast',
          value: broadcastData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } catch {}

      window.dispatchEvent(new CustomEvent('iz_broadcast_notification', { detail: broadcastData }));

      toast.success("ইউজারদের কাছে নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!");
      setSiteSettings(prev => ({ ...prev, broadcast_text: '' }));
    } catch (err: any) {
      toast.error("নোটিফিকেশন পাঠাতে ব্যর্থ হয়েছে।");
    } finally {
      setBroadcasting(false);
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
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
            <Settings className="w-7 h-7 text-purple-600 dark:text-amber-400" />
            System Configuration & User Controls
          </h1>
          <p className="text-slate-500 dark:text-purple-300/60 mt-1 font-bold">
            ইউজার প্যানেলের উইথড্র ফি, ডিপোজিট বোনাস, উইথড্র বোনাস ও গ্লোবাল নোটিফিকেশন কন্ট্রোল করুন।
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* SECTION 1: USER PANEL CONTROLS (উইথড্র ফি, ডিপোজিট বোনাস, উইথড্র বোনাস, নোটিফিকেশন) */}
        <div className="bg-white dark:bg-[#130b2c]/85 backdrop-blur-xl border border-purple-200 dark:border-purple-500/30 rounded-3xl shadow-md p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 dark:border-purple-900/40 pb-4">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600 dark:text-amber-400" />
              ইউজার প্যানেল ফাইনান্সিয়াল কন্ট্রোল (Fees & Bonuses)
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-purple-300/70 mt-1">
              ইউজারদের ডিপোজিট ও উইথড্রয়ের উপর ফি ও বোনাসের হার নির্ধারণ করুন।
            </p>
          </div>

          {/* Mode Selection Filter Switch for Withdraw Fee vs Withdraw Bonus */}
          <div className="bg-slate-50 dark:bg-[#080412]/80 p-4 rounded-2xl border border-purple-200 dark:border-purple-500/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Percent className="w-4 h-4 text-purple-600 dark:text-amber-400" />
                  উইথড্র মোড ফিল্টার সুইচ (Withdraw Fee vs Bonus Mode)
                </h3>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-purple-300/60 mt-0.5">
                  ফি এবং বোনাস একটি ফিল্টার সুইচের মাধ্যমে মিউচুয়ালি এক্সক্লুসিভ রাখা হয়েছে (ফি থাকলে বোনাস থাকবে না, বোনাস থাকলে ফি থাকবে না)।
                </p>
              </div>

              {/* Mode Selector Buttons */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-[#130b2c] p-1.5 rounded-xl border border-slate-200 dark:border-purple-500/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setSiteSettings({ ...siteSettings, withdraw_bonus_percent: 0 })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    siteSettings.withdraw_fee_percent > 0
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-900/40'
                  }`}
                >
                  🔴 ফি মোড (Fee)
                </button>

                <button
                  type="button"
                  onClick={() => setSiteSettings({ ...siteSettings, withdraw_fee_percent: 0 })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    siteSettings.withdraw_bonus_percent > 0
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-900/40'
                  }`}
                >
                  🟢 বোনাস মোড (Bonus)
                </button>

                <button
                  type="button"
                  onClick={() => setSiteSettings({ ...siteSettings, withdraw_fee_percent: 0, withdraw_bonus_percent: 0 })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    siteSettings.withdraw_fee_percent === 0 && siteSettings.withdraw_bonus_percent === 0
                      ? 'bg-purple-600 dark:bg-amber-400 text-white dark:text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-900/40'
                  }`}
                >
                  ⚪ সাধারণ (0%)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-slate-200 dark:border-purple-900/40">
              {/* 1. Withdraw Fee */}
              <div className={`p-4 rounded-2xl border transition-all ${
                siteSettings.withdraw_fee_percent > 0
                  ? 'bg-rose-50/80 dark:bg-[#200a12] border-rose-300 dark:border-rose-500/40 ring-1 ring-rose-500/30'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 opacity-70'
              }`}>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-purple-200 flex items-center gap-1.5 mb-2">
                  <Percent className="w-4 h-4 text-rose-500" />
                  উইথড্র ফি (Withdraw Fee %)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={siteSettings.withdraw_fee_percent}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSiteSettings({
                        ...siteSettings,
                        withdraw_fee_percent: val,
                        withdraw_bonus_percent: val > 0 ? 0 : siteSettings.withdraw_bonus_percent
                      });
                    }}
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-[#080412] text-slate-900 dark:text-white font-mono font-black border border-slate-300 dark:border-purple-500/30 rounded-xl outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-2.5 text-sm font-black text-slate-400 dark:text-purple-400">%</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-purple-300/60 mt-1.5">
                  {siteSettings.withdraw_fee_percent > 0 ? '✓ একটিভ: উইথড্রতে ফি প্রযোজ্য হবে (বোনাস ০% করা হয়েছে)' : 'ফি প্রয়োগ করতে মান লিখুন'}
                </p>
              </div>

              {/* 2. Deposit Bonus */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#130b2c] border border-slate-200 dark:border-purple-500/20 space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-purple-200 flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-emerald-500" />
                  ডিপোজিট বোনাস (Deposit Bonus %)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={siteSettings.deposit_bonus_percent}
                    onChange={(e) => setSiteSettings({ ...siteSettings, deposit_bonus_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-[#080412] text-slate-900 dark:text-white font-mono font-black border border-slate-300 dark:border-purple-500/30 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-2.5 text-sm font-black text-slate-400 dark:text-purple-400">%</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-purple-300/60 mt-1.5">
                  ডিপোজিট অ্যাপ্রুভ হলে অতিরিক্ত বোনাস পাওয়ার হার
                </p>
              </div>

              {/* 3. Withdraw Bonus */}
              <div className={`p-4 rounded-2xl border transition-all ${
                siteSettings.withdraw_bonus_percent > 0
                  ? 'bg-emerald-50/80 dark:bg-[#092015] border-emerald-300 dark:border-emerald-500/40 ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-[#130b2c] border-slate-200 dark:border-purple-500/20 opacity-70'
              }`}>
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-purple-200 flex items-center gap-1.5 mb-2">
                  <DollarSign className="w-4 h-4 text-amber-500" />
                  উইথড্র বোনাস (Withdraw Bonus %)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={siteSettings.withdraw_bonus_percent}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSiteSettings({
                        ...siteSettings,
                        withdraw_bonus_percent: val,
                        withdraw_fee_percent: val > 0 ? 0 : siteSettings.withdraw_fee_percent
                      });
                    }}
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-[#080412] text-slate-900 dark:text-white font-mono font-black border border-slate-300 dark:border-purple-500/30 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-2.5 text-sm font-black text-slate-400 dark:text-purple-400">%</span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-purple-300/60 mt-1.5">
                  {siteSettings.withdraw_bonus_percent > 0 ? '✓ একটিভ: উইথড্রতে বোনাস প্রদান করা হবে (ফি ০% করা হয়েছে)' : 'বোনাস প্রদান করতে মান লিখুন'}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: GLOBAL USER ANNOUNCEMENT BANNER */}
          <div className="pt-4 border-t border-slate-100 dark:border-purple-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">গ্লোবাল এনাউন্সমেন্ট ব্যানার (Notice Banner)</h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-purple-300/70">ইউজারদের ড্যাশবোর্ডের উপরে স্থায়ীভাবে নোটিশ ব্যানার দেখান</p>
                </div>
              </div>

              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={siteSettings.user_notice_enabled} 
                    onChange={(e) => setSiteSettings({ ...siteSettings, user_notice_enabled: e.target.checked })} 
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${siteSettings.user_notice_enabled ? 'bg-purple-600 dark:bg-amber-400' : 'bg-slate-200 dark:bg-purple-900/50 border border-slate-300 dark:border-purple-500/30'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white dark:bg-slate-950 w-4 h-4 rounded-full transition-transform ${siteSettings.user_notice_enabled ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-2.5 text-xs font-black text-slate-700 dark:text-purple-200">
                  {siteSettings.user_notice_enabled ? 'Active' : 'Hidden'}
                </span>
              </label>
            </div>

            {siteSettings.user_notice_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-[#080412]/80 p-4 rounded-2xl border border-slate-200 dark:border-purple-500/20">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-purple-200 mb-1">Banner Style Type</label>
                  <select
                    value={siteSettings.user_notice_type}
                    onChange={(e) => setSiteSettings({ ...siteSettings, user_notice_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white dark:bg-[#130b2c] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl outline-none font-bold text-xs"
                  >
                    <option value="info">💡 Information (Purple)</option>
                    <option value="warning">⚠️ Warning (Amber)</option>
                    <option value="success">🎉 Special Offer (Emerald)</option>
                    <option value="promo">🚀 Mega Promo (Gradient)</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-purple-200 mb-1">Announcement Message Text</label>
                  <input
                    type="text"
                    value={siteSettings.user_notice_text}
                    onChange={(e) => setSiteSettings({ ...siteSettings, user_notice_text: e.target.value })}
                    placeholder="e.g. আজকে যে কোনো বিকাশে ডিপোজিট করলে পাচ্ছেন ১০% ইনস্ট্যান্ট বোনাস! 🚀"
                    className="w-full px-4 py-2 bg-white dark:bg-[#130b2c] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl outline-none font-medium text-xs sm:text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: INSTANT BROADCAST PUSH NOTIFICATION */}
          <div className="pt-4 border-t border-slate-100 dark:border-purple-900/40 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600 dark:text-amber-400" />
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">ইনস্ট্যান্ট পুশ নোটিফিকেশন সেন্ড করুন (Instant Broadcast)</h3>
                <p className="text-xs font-semibold text-slate-500 dark:text-purple-300/70">এক ক্লিকে সকল একটিভ ইউজারদের পপ-আপ নোটিফিকেশন জানান</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={siteSettings.broadcast_text}
                onChange={(e) => setSiteSettings({ ...siteSettings, broadcast_text: e.target.value })}
                placeholder="ইউজারদের উদ্দেশ্যে নোটিফিকেশনের বার্তা লিখুন (e.g. বিকাশে নতুন নোটিশ পোস্ট করা হয়েছে)..."
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-[#080412]/80 text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl outline-none text-xs sm:text-sm font-medium"
              />
              <button
                type="button"
                onClick={handleSendBroadcast}
                disabled={broadcasting || !siteSettings.broadcast_text.trim()}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {broadcasting ? 'Sending...' : 'Send Broadcast Notification'}
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: PAYMENT METHODS & CONFIGURATION */}
        <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-purple-900/40 pb-3">
            পেমেন্ট মেথড একাউন্ট নম্বর
          </h2>

          {/* bKash */}
          <div className="pb-6 border-b border-slate-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">bKash Configuration</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={siteSettings.bkash_enabled} onChange={(e) => setSiteSettings({ ...siteSettings, bkash_enabled: e.target.checked })} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${siteSettings.bkash_enabled ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500' : 'bg-slate-200 dark:bg-purple-900/50 border border-slate-300 dark:border-purple-500/30'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${siteSettings.bkash_enabled ? 'transform translate-x-4 shadow-sm dark:shadow-lg dark:shadow-black/40' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-black text-slate-600 dark:text-purple-200">{siteSettings.bkash_enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
            {siteSettings.bkash_enabled && (
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Receiver Account Number</label>
                <input 
                  type="text" 
                  value={siteSettings.bkash_number} 
                  onChange={(e) => setSiteSettings({ ...siteSettings, bkash_number: e.target.value })} 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium" 
                  placeholder="e.g. 017XXXXXXXX" 
                />
              </div>
            )}
          </div>

          {/* Nagad */}
          <div className="py-6 border-b border-slate-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Nagad Configuration</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={siteSettings.nagad_enabled} onChange={(e) => setSiteSettings({ ...siteSettings, nagad_enabled: e.target.checked })} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${siteSettings.nagad_enabled ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500' : 'bg-slate-200 dark:bg-purple-900/50 border border-slate-300 dark:border-purple-500/30'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${siteSettings.nagad_enabled ? 'transform translate-x-4 shadow-sm dark:shadow-lg dark:shadow-black/40' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-black text-slate-600 dark:text-purple-200">{siteSettings.nagad_enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
            {siteSettings.nagad_enabled && (
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Receiver Account Number</label>
                <input 
                  type="text" 
                  value={siteSettings.nagad_number} 
                  onChange={(e) => setSiteSettings({ ...siteSettings, nagad_number: e.target.value })} 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium" 
                  placeholder="e.g. 017XXXXXXXX" 
                />
              </div>
            )}
          </div>

          {/* Rocket */}
          <div className="py-6 border-b border-slate-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Rocket Configuration</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={siteSettings.rocket_enabled} onChange={(e) => setSiteSettings({ ...siteSettings, rocket_enabled: e.target.checked })} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${siteSettings.rocket_enabled ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500' : 'bg-slate-200 dark:bg-purple-900/50 border border-slate-300 dark:border-purple-500/30'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${siteSettings.rocket_enabled ? 'transform translate-x-4 shadow-sm dark:shadow-lg dark:shadow-black/40' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-black text-slate-600 dark:text-purple-200">{siteSettings.rocket_enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
            {siteSettings.rocket_enabled && (
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Receiver Account Number</label>
                <input 
                  type="text" 
                  value={siteSettings.rocket_number} 
                  onChange={(e) => setSiteSettings({ ...siteSettings, rocket_number: e.target.value })} 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium" 
                  placeholder="e.g. 017XXXXXXXX" 
                />
              </div>
            )}
          </div>

          {/* Support Links */}
          <div className="py-6 border-b border-slate-100 dark:border-purple-900/30">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4">Support Links</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Help Center URL</label>
                <input
                  type="url"
                  value={siteSettings.help_center_url}
                  onChange={(e) => setSiteSettings({ ...siteSettings, help_center_url: e.target.value })}
                  placeholder="https://t.me/yourgroup"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Contact Support URL</label>
                <input
                  type="url"
                  value={siteSettings.contact_support_url}
                  onChange={(e) => setSiteSettings({ ...siteSettings, contact_support_url: e.target.value })}
                  placeholder="https://wa.me/1234567890"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium"
                />
              </div>
            </div>
          </div>

          {/* Marketing Stats */}
          <div className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Landing Page Statistics</h3>
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-slate-700 dark:text-purple-200">Stats Mode:</label>
                <select
                  value={siteSettings.stats_mode}
                  onChange={(e) => setSiteSettings({ ...siteSettings, stats_mode: e.target.value })}
                  className="px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-bold"
                >
                  <option value="live">Live (Real Data)</option>
                  <option value="manual">Manual (Marketing Data)</option>
                </select>
              </div>
            </div>

            {siteSettings.stats_mode === 'manual' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Manual Users Count</label>
                  <input
                    type="number"
                    value={siteSettings.manual_users}
                    onChange={(e) => setSiteSettings({ ...siteSettings, manual_users: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Manual Active Jobs</label>
                  <input
                    type="number"
                    value={siteSettings.manual_jobs}
                    onChange={(e) => setSiteSettings({ ...siteSettings, manual_jobs: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Manual Completed Tasks</label>
                  <input
                    type="number"
                    value={siteSettings.manual_tasks}
                    onChange={(e) => setSiteSettings({ ...siteSettings, manual_tasks: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Manual Total Paid</label>
                  <input
                    type="number"
                    value={siteSettings.manual_paid}
                    onChange={(e) => setSiteSettings({ ...siteSettings, manual_paid: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-purple-900/30">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save All Configurations'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
