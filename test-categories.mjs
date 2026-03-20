import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
  const { data, error } = await supabase.from('products').select('*');
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  if (data.length > 0) {
      console.log('First product before:', data[0].name, 'Category:', data[0].category);
      const testCat = data[0].category;
      
      const { data: updated, error: updateError } = await supabase.from('products')
        .update({ category: 'General' })
        .eq('category', testCat)
        .select();
        
      console.log('Update return:', updated);
      console.log('Update error:', updateError);
  } else {
      console.log('No products found in DB to test.');
  }
}

checkProducts();
