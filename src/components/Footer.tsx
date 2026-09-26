import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function Footer() {
  const [links, setLinks] = useState({
    help_center_url: '',
    contact_support_url: ''
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        let localData = null;
        try {
          const localSS = localStorage.getItem('iz_site_settings');
          if (localSS) {
            localData = JSON.parse(localSS);
          }
        } catch (e) {}

        const { data, error } = await supabase
          .from('site_settings')
          .select('help_center_url, contact_support_url')
          .eq('id', 1)
          .maybeSingle();
        
        const finalData = data || localData;
        
        if (finalData) {
          setLinks({
            help_center_url: finalData.help_center_url || '',
            contact_support_url: finalData.contact_support_url || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch footer settings:', err);
      }
    }
    fetchSettings();
  }, []);

  return (
    <footer className="bg-slate-900 text-slate-300 dark:bg-[#080412] dark:text-purple-200/70 pt-16 pb-8 border-t border-slate-800 dark:border-purple-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
        <div>
          <span className="text-2xl font-black tracking-tight text-white block mb-4">
            Income<span className="text-amber-400">Zone</span>
          </span>
          <p className="text-sm font-medium text-slate-400 dark:text-purple-300/60 max-w-xs leading-relaxed">
            The premier global micro-task platform empowering digital workers and providing targeted campaign reach.
          </p>
        </div>

        <div>
          <h4 className="text-white font-black mb-4 tracking-wide uppercase text-xs">Quick Links</h4>
          <ul className="space-y-2.5 text-sm font-bold">
            <li><Link to="/login" className="hover:text-amber-400 transition-colors">Login to Account</Link></li>
            <li><Link to="/signup" className="hover:text-amber-400 transition-colors">Register Free</Link></li>
            <li><Link to="/#how-it-works" className="hover:text-amber-400 transition-colors">How It Works</Link></li>
            <li><Link to="/#live-stats" className="hover:text-amber-400 transition-colors">Real-Time Stats</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-black mb-4 tracking-wide uppercase text-xs">Legal & Terms</h4>
          <ul className="space-y-2.5 text-sm font-bold">
            <li><Link to="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</Link></li>
            <li><Link to="/refund" className="hover:text-amber-400 transition-colors">Refund Policy</Link></li>
            <li><Link to="/rules" className="hover:text-amber-400 transition-colors">Community Rules</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-black mb-4 tracking-wide uppercase text-xs">Support</h4>
          <ul className="space-y-2.5 text-sm font-bold">
            <li>
              <a 
                href={links.help_center_url || '#'} 
                target={links.help_center_url ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="hover:text-amber-400 transition-colors"
              >
                Help Center
              </a>
            </li>
            <li>
              <a 
                href={links.contact_support_url || '#'} 
                target={links.contact_support_url ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="hover:text-amber-400 transition-colors"
              >
                Contact Support
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-slate-800 dark:border-purple-900/40 flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-slate-500 dark:text-purple-400/50 gap-4">
        <p>© {new Date().getFullYear()} IncomeZone. All rights reserved.</p>
      </div>
    </footer>
  );
}
