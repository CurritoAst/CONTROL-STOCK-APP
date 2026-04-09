import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey);

async function deleteOrders() {
    const { data: logs, error: logsError } = await supabase.from('daily_logs').select('*');
    if (logsError) {
        console.error('Error fetching logs:', logsError);
        return;
    }

    const idsToDelete = logs.map(l => l.id);

    console.log(`Deleting ${idsToDelete.length} logs matches user query...`);

    if (idsToDelete.length > 0) {
        // Delete log_items first to avoid foreign key constraints just in case
        const { error: itemsError } = await supabase.from('log_items').delete().in('daily_log_id', idsToDelete);
        if (itemsError) {
            console.error('Error deleting log_items:', itemsError);
        } else {
            console.log('Deleted log_items successfully.');
        }

        // Delete daily_logs
        const { error: logsDeleteError } = await supabase.from('daily_logs').delete().in('id', idsToDelete);
        if (logsDeleteError) {
            console.error('Error deleting daily_logs:', logsDeleteError);
        } else {
            console.log('Deleted daily_logs successfully.');
        }
    }

    console.log('Done.');
}

deleteOrders();
