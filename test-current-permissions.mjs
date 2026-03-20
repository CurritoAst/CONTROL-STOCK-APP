import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCurrent() {
    console.log('Finding a product to test...');
    const { data: prods } = await supabase.from('products').select('*').limit(1);
    
    if (prods && prods.length > 0) {
        const p = prods[0];
        console.log('Testing UPDATE on ID:', p.id);
        const { error: uErr } = await supabase.from('products').update({
            stock: (p.stock || 0) + 1
        }).eq('id', p.id);
        
        if (uErr) {
            console.error('UPDATE ERROR:', uErr.message, uErr.code);
        } else {
            console.log('UPDATE SUCCESS');
        }

        console.log('Testing UPSERT on ID:', p.id);
        const { error: upsError } = await supabase.from('products').upsert({
            ...p,
            stock: (p.stock || 0) + 2
        });

        if (upsError) {
             console.error('UPSERT ERROR:', upsError.message, upsError.code);
        } else {
             console.log('UPSERT SUCCESS');
        }
    }
}
testCurrent();
