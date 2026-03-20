import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInsert() {
      console.log('Testing INSERT');
      const { data: inData, error: inErr } = await supabase.from('products').insert({
          id: 'test_insert_' + Date.now(),
          name: 'Test Product',
          price: 1,
          category: 'General',
          stock: 0
      }).select();
      console.log('Insert result:', inData, inErr);
      
      if (inData && inData.length > 0) {
          console.log('Testing DELETE');
          const { error: delErr } = await supabase.from('products').delete().eq('id', inData[0].id);
           console.log('Delete error:', delErr);
      }
}
checkInsert();
