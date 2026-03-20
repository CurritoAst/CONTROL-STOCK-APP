import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCascade() {
    console.log('Inserting test product...');
    const prodId = 'test_cascade_prod_' + Date.now();
    await supabase.from('products').insert({
        id: prodId,
        name: 'Test Cascade Product',
        price: 1,
        category: 'General',
        stock: 0
    });

    console.log('Inserting test daily_log...');
    const logId = 'test_cascade_log_' + Date.now();
    await supabase.from('daily_logs').insert({
        id: logId,
        date: '2026-01-01',
        status: 'OPEN'
    });

    console.log('Inserting test log_item...');
    await supabase.from('log_items').insert({
        daily_log_id: logId,
        product_id: prodId,
        prepared: 10,
        consumed: 5
    });

    console.log('Attempting to delete the product...');
    const { error: delErr } = await supabase.from('products').delete().eq('id', prodId);
    
    if (delErr) {
        console.log('DELETE failed (Constraint probably exists, NO CASCADE):', delErr);
    } else {
        console.log('DELETE succeeded! Checking if log_item still exists...');
        const { data: items } = await supabase.from('log_items').select('*').eq('daily_log_id', logId);
        if (items && items.length > 0) {
            console.log('log_item STILL EXISTS. It did NOT cascade (maybe ON DELETE SET NULL?). Item:', items[0]);
        } else {
            console.log('log_item WAS DELETED. IT CASCADED! WARNING!');
        }
    }
    
    // Cleanup
    await supabase.from('log_items').delete().eq('daily_log_id', logId);
    await supabase.from('daily_logs').delete().eq('id', logId);
    await supabase.from('products').delete().eq('id', prodId);
}

testCascade();
