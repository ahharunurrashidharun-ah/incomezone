import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Settings, Save, CheckCircle } from 'lucide-react';
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
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        
        // Fetch payment methods from 'settings' table
        let paymentData = null;
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

        const { data, error } = await supabase
          .from('site_settings')
          .select('*')
          .eq('id', 1)
          .single();

          
        if (data || paymentData) {
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
          });
        }
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

      localStorage.setItem('iz_site_settings', JSON.stringify(marketingPayload));
      localStorage.setItem('iz_payment_methods', JSON.stringify(paymentPayload));

      // Save payment settings as JSON
      const { error: paymentError } = await supabase
        .from('settings')
        .upsert({
          key: 'deposit_methods',
          value: paymentPayload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })
        .select();
        
      if (paymentError) throw paymentError;

      // Save marketing settings to site_settings
      const { data, error } = await supabase
        .from('site_settings')
        .upsert({
          id: 1,
          ...marketingPayload
        })
        .select();

      if (error) throw error;

      console.log("Saved successfully:", data);
      toast.success("Settings saved successfully!");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
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
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <Settings className="w-6 h-6 text-purple-600 dark:text-amber-400" />
            System Configuration
          </h1>
          <p className="text-slate-500 dark:text-purple-300/60 mt-1 font-bold">Manage global deposit methods, support links, and platform stats.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 p-6 sm:p-8">
          
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
              className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
