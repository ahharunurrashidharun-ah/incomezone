console.log(await supabase.from('users').select('*').limit(3));
