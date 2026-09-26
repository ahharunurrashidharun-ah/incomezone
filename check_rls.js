import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY); // Note: Anon key
async function check() {
  const { data, error } = await supabase
                .from('users')
                .select('id, display_id')
                .in('id', ['23f344cb-a5cd-403e-99e6-cb7b8eeea6b6']);
  console.log(data, error);
}
check();
