import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (data && data.length > 0) {
      const p = data[0];
      console.log('Testing UPSERT on', p.id);
      const { data: upData, error: upErr } = await supabase.from('products').upsert({
          ...p,
          name: p.name + ' (test)'
      }).select();
      console.log('Upsert result:', upData, upErr);
      
      // Revert upsert
      await supabase.from('products').upsert(p);
  }
}
checkProducts();
