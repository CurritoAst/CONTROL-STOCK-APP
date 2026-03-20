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

async function selectiveCleanup() {
    console.log('Fetching events and logs...');
    
    // 1. Fetch all events to know which logs to keep
    const { data: events, error: eventsError } = await supabase.from('events').select('*');
    if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return;
    }

    // Identify POS (EVENT) and Forecasts (ORDER)
    const keeperEvents = events.filter(e => e.type === 'EVENT' || e.type === 'ORDER');
    const keeperPairs = new Set(keeperEvents.map(e => `${e.date}|${e.title}`));

    console.log(`Found ${keeperEvents.length} keeper events.`);

    // 2. Fetch all logs
    const { data: logs, error: logsError } = await supabase.from('daily_logs').select('*');
    if (logsError) {
        console.error('Error fetching logs:', logsError);
        return;
    }

    const logsToDelete = [];
    const logsToReset = [];

    for (const log of logs) {
        const titleParts = log.id.split('---').slice(1);
        const eventTitle = titleParts.length > 0 ? titleParts.join('---') : null;
        
        const isKeeper = keeperPairs.has(`${log.date}|${eventTitle}`);

        if (isKeeper) {
            logsToReset.push(log.id);
        } else {
            logsToDelete.push(log.id);
        }
    }

    console.log(`Identified ${logsToDelete.length} logs to delete and ${logsToReset.length} logs to reset.`);

    // 3. Delete non-keeper logs
    if (logsToDelete.length > 0) {
        console.log('Deleting logs...');
        // We delete from log_items first if cascade isn't guaranteed (though standard RLS usually handles this)
        const { error: itemsDeleteError } = await supabase
            .from('log_items')
            .delete()
            .in('daily_log_id', logsToDelete);
        
        if (itemsDeleteError) console.error('Error deleting log items:', itemsDeleteError);

        const { error: logsDeleteError } = await supabase
            .from('daily_logs')
            .delete()
            .in('id', logsToDelete);
        
        if (logsDeleteError) console.error('Error deleting daily logs:', logsDeleteError);
        else console.log('Logs deleted successfully.');
    }

    // 4. Reset keeper log quantities to 0
    if (logsToReset.length > 0) {
        console.log('Resetting quantities for keepers...');
        const { error: resetError } = await supabase
            .from('log_items')
            .update({ prepared: 0, consumed: 0 })
            .in('daily_log_id', logsToReset);
        
        if (resetError) console.error('Error resetting log items:', resetError);
        else console.log('Keeper quantities reset to 0.');
    }

    console.log('Selective cleanup finished.');
}

selectiveCleanup();
