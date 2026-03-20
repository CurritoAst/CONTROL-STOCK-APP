import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSingleUpdate() {
    const { data: prods } = await supabase.from('products').select('*').limit(1);
    
    if (prods && prods.length > 0) {
        const product = prods[0];
        console.log('Original Product:', product);
        
        console.log('Attempting UPDATE...');
        const newCat = product.category === 'General' ? 'TestCat1' : 'General';
        
        const { data, error, count } = await supabase.from('products').update({
            category: newCat
        }).eq('id', product.id).select();
        
        console.log('Update return:', data, error, count);
        
        // check if it actually changed
        const { data: verif } = await supabase.from('products').select('*').eq('id', product.id);
        console.log('Verification:', verif);
    }
}
testSingleUpdate();
