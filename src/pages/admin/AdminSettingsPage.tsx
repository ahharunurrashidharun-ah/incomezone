import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Settings, Save, CheckCircle } from 'lucide-react';

export default function AdminSettingsPage() {
  const [methods, setMethods] = useState({
    bkash: { enabled: true, number: '' },
    nagad: { enabled: true, number: '' },
    rocket: { enabled: true, number: '' },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('key', 'deposit_methods')
          .maybeSingle();

        if (data && data.value) {
          setMethods(typeof data.value === 'string' ? JSON.parse(data.value) : data.value);
        } else {
          // Fallback to local storage if table is not yet created
          const local = localStorage.getItem('deposit_methods_config');
          if (local) {
            setMethods(JSON.parse(local));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      localStorage.setItem('deposit_methods_config', JSON.stringify(methods));

      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'deposit_methods',
          value: methods,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) {
        console.warn('Supabase settings table save warning (saved locally):', error.message);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
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
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
          <Settings className="w-6 h-6 text-purple-600 dark:text-amber-400" />
          System Configuration
        </h1>
        <p className="text-slate-500 dark:text-purple-300/60 mt-1 font-bold">Manage deposit methods and receiver account numbers.</p>
      </div>

      <div className="bg-white dark:bg-[#130b2c]/80 backdrop-blur-xl border border-slate-200 dark:border-purple-500/20 rounded-3xl shadow-sm dark:shadow-lg dark:shadow-purple-900/20 p-6 sm:p-8">
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* bKash */}
          <div className="pb-6 border-b border-slate-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">bKash Configuration</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={methods.bkash.enabled} onChange={(e) => setMethods({ ...methods, bkash: { ...methods.bkash, enabled: e.target.checked } })} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${methods.bkash.enabled ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500' : 'bg-slate-200 dark:bg-purple-900/50 border border-slate-300 dark:border-purple-500/30'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${methods.bkash.enabled ? 'transform translate-x-4 shadow-sm dark:shadow-lg dark:shadow-black/40' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-black text-slate-600 dark:text-purple-200">{methods.bkash.enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
            {methods.bkash.enabled && (
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Receiver Account Number</label>
                <input 
                  type="text" 
                  value={methods.bkash.number} 
                  onChange={(e) => setMethods({ ...methods, bkash: { ...methods.bkash, number: e.target.value } })} 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium" 
                  placeholder="e.g. 017XXXXXXXX" 
                />
              </div>
            )}
          </div>

          {/* Nagad */}
          <div className="pb-6 border-b border-slate-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Nagad Configuration</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={methods.nagad.enabled} onChange={(e) => setMethods({ ...methods, nagad: { ...methods.nagad, enabled: e.target.checked } })} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${methods.nagad.enabled ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500' : 'bg-slate-200 dark:bg-purple-900/50 border border-slate-300 dark:border-purple-500/30'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${methods.nagad.enabled ? 'transform translate-x-4 shadow-sm dark:shadow-lg dark:shadow-black/40' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-black text-slate-600 dark:text-purple-200">{methods.nagad.enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
            {methods.nagad.enabled && (
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Receiver Account Number</label>
                <input 
                  type="text" 
                  value={methods.nagad.number} 
                  onChange={(e) => setMethods({ ...methods, nagad: { ...methods.nagad, number: e.target.value } })} 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium" 
                  placeholder="e.g. 017XXXXXXXX" 
                />
              </div>
            )}
          </div>

          {/* Rocket */}
          <div className="pb-6 border-b border-slate-100 dark:border-purple-900/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Rocket Configuration</h3>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={methods.rocket.enabled} onChange={(e) => setMethods({ ...methods, rocket: { ...methods.rocket, enabled: e.target.checked } })} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${methods.rocket.enabled ? 'bg-purple-600 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500' : 'bg-slate-200 dark:bg-purple-900/50 border border-slate-300 dark:border-purple-500/30'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${methods.rocket.enabled ? 'transform translate-x-4 shadow-sm dark:shadow-lg dark:shadow-black/40' : ''}`}></div>
                </div>
                <span className="ml-3 text-sm font-black text-slate-600 dark:text-purple-200">{methods.rocket.enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>
            {methods.rocket.enabled && (
              <div>
                <label className="block text-sm font-black text-slate-700 dark:text-purple-200 mb-1">Receiver Account Number</label>
                <input 
                  type="text" 
                  value={methods.rocket.number} 
                  onChange={(e) => setMethods({ ...methods, rocket: { ...methods.rocket, number: e.target.value } })} 
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-[#0a0718] text-slate-900 dark:text-white border border-slate-300 dark:border-purple-500/30 rounded-xl focus:ring-2 focus:ring-purple-600 dark:focus:ring-amber-400 outline-none font-medium" 
                  placeholder="e.g. 017XXXXXXXX" 
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button 
              type="submit" 
              disabled={saving} 
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 dark:bg-gradient-to-r dark:from-amber-400 dark:to-yellow-500 dark:hover:from-amber-300 dark:hover:to-yellow-400 text-white dark:text-slate-950 font-bold rounded-xl shadow-md dark:shadow-xl dark:shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
                <CheckCircle className="w-5 h-5" />
                Saved Successfully
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
