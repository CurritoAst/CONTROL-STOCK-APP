// Test script: test-push.mjs
// Run with: node test-push.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testPush() {
    console.log('1. Checking push_subscriptions table...');
    const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('*');

    if (error) {
        console.error('ERROR fetching subs:', error);
        return;
    }

    console.log(`Found ${subs?.length ?? 0} subscriptions:`);
    subs?.forEach((s, i) => {
        const sub = typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
        console.log(`  [${i}] role=${s.user_role}, endpoint=${sub?.endpoint?.substring(0, 60)}...`);
        console.log(`       has keys: ${!!sub?.keys}, p256dh: ${sub?.keys?.p256dh?.length ?? 0} chars, auth: ${sub?.keys?.auth?.length ?? 0} chars`);
    });

    if (!subs?.length) {
        console.error('No subscriptions found! The device subscription was not saved properly.');
        return;
    }

    console.log('\n2. Invoking send-web-push edge function...');
    const { data, error: fnError } = await supabase.functions.invoke('send-web-push', {
        body: { title: '🧪 Test desde Node.js', message: 'Notificacion de prueba enviada directamente desde el servidor local.', target_role: 'MASTER' }
    });

    if (fnError) {
        console.error('ERROR invoking function:', fnError);
    } else {
        console.log('Function responded:', data);
    }
}

testPush().catch(console.error);
