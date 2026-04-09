import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listLogs() {
    const { data: logs, error: logsError } = await supabase.from('daily_logs').select('*');
    if (logsError) {
        console.error('Error fetching logs:', logsError);
        return;
    }

    let output = `Found ${logs.length} logs:\n`;
    for (const log of logs) {
        const titleParts = log.id.split('---').slice(1);
        const eventTitle = titleParts.length > 0 ? titleParts.join('---') : 'null';
        output += `- ID: ${log.id} | Date: ${log.date} | EventTitle: ${eventTitle} | Status: ${log.status}\n`;
    }
    fs.writeFileSync('logs_output.txt', output);
    console.log('Saved to logs_output.txt');
}

listLogs();
