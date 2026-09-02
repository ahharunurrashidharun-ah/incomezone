const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/AdminSettingsPage.tsx', 'utf8');

code = code.replace(/const \{ data, error \} = await supabase\s*\.from\('site_settings'\)\s*\.select\('\*'\)\s*\.eq\('id', 1\)\s*\.single\(\);/, `
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
`);

code = code.replace(/if \(data\) \{\s*setSiteSettings\(\{/, `if (data || paymentData) {
          setSiteSettings({
            bkash_enabled: paymentData?.bkash?.enabled ?? paymentData?.bkash_enabled ?? true,
            bkash_number: paymentData?.bkash?.number ?? paymentData?.bkash_number ?? '',
            nagad_enabled: paymentData?.nagad?.enabled ?? paymentData?.nagad_enabled ?? true,
            nagad_number: paymentData?.nagad?.number ?? paymentData?.nagad_number ?? '',
            rocket_enabled: paymentData?.rocket?.enabled ?? paymentData?.rocket_enabled ?? true,
            rocket_number: paymentData?.rocket?.number ?? paymentData?.rocket_number ?? '',`);

code = code.replace(/const \{ error \} = await supabase\s*\.from\('site_settings'\)\s*\.upsert\(\{\s*id: 1,\s*\.\.\.siteSettings\s*\}\);/, `
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
      await supabase
        .from('settings')
        .upsert({
          key: 'deposit_methods',
          value: paymentPayload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }).catch(() => {});

      // Save marketing settings to site_settings
      const { error } = await supabase
        .from('site_settings')
        .upsert({
          id: 1,
          ...marketingPayload
        });
`);

fs.writeFileSync('src/pages/admin/AdminSettingsPage.tsx', code);
