import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    // We can't select from pg_policies without service role usually, but we can try
    const { data, error } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'products');
        
    console.log('Policies:', data);
    console.log('Error:', error);
}

checkPolicies();
