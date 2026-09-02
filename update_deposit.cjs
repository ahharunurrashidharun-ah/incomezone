const fs = require('fs');

function updatePage(file) {
  let code = fs.readFileSync(file, 'utf8');

  code = code.replace(/const \{ data, error \} = await supabase\s*\.from\('site_settings'\)\s*\.select\('\*'\)\s*\.eq\('id', 1\)\s*\.single\(\);/, `
      // Try to get payment methods from settings table
      let { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'deposit_methods')
        .maybeSingle();
        
      if (data && data.value) {
        data = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        // Normalize nested JSON format if it exists
        if (data.bkash && typeof data.bkash === 'object') {
          data = {
            bkash_enabled: data.bkash.enabled,
            bkash_number: data.bkash.number,
            nagad_enabled: data.nagad.enabled,
            nagad_number: data.nagad.number,
            rocket_enabled: data.rocket.enabled,
            rocket_number: data.rocket.number,
          };
        }
      } else {
        data = null;
      }
`);

  code = code.replace(/const str = localStorage.getItem\('iz_site_settings'\);/, `const str = localStorage.getItem('iz_payment_methods');`);
  
  fs.writeFileSync(file, code);
}

updatePage('src/pages/DepositPage.tsx');
updatePage('src/pages/WithdrawPage.tsx');
