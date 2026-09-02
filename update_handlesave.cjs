const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminSettingsPage.tsx', 'utf8');

const replacement = `  const handleSave = async (e: React.FormEvent) => {
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
  };`;

code = code.replace(/const handleSave = async \(e: React\.FormEvent\) => \{[\s\S]*?\} finally \{\s*setSaving\(false\);\s*\}\s*\};/, replacement);
fs.writeFileSync('src/pages/admin/AdminSettingsPage.tsx', code);
