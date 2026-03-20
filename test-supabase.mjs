import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log('Testing products table...');
    const { data, error } = await supabase.from('products').select('*').limit(1);
    if (error) {
        console.error('Error fetching products:', error);
    } else {
        console.log('Products fetched successfully:', data);
    }

    console.log('Testing daily_logs table...');
    const { data: d2, error: e2 } = await supabase.from('daily_logs').select('*').limit(1);
    if (e2) {
        console.error('Error fetching daily_logs:', e2);
    } else {
        console.log('Daily logs fetched successfully:', d2);
    }
}

test();
