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

async function clearData() {
    console.log('Clearing log_items...');
    // Delete all records by matching id not null or some other trick
    const { error: e1 } = await supabase.from('log_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e1) console.error('Error clearing log_items:', e1);

    console.log('Clearing daily_logs...');
    const { error: e2 } = await supabase.from('daily_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e2) console.error('Error clearing daily_logs:', e2);

    console.log('Data cleared successfully.');
}

clearData();
