// Supabase Edge Function: send-web-push
// Deploy with: npx supabase functions deploy send-web-push
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_MAILTO = Deno.env.get('VAPID_MAILTO') || 'mailto:admin@proyecto-macario.vercel.app';

// Configure the web-push module
webpush.setVapidDetails(
    VAPID_MAILTO,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        };
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const body = await req.json();
        const { title, message, target_role } = body;

        // Get all subscriptions for the given role
        const { data: subs, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_role', target_role || 'MASTER');

        if (error) {
            console.error('Error fetching subscriptions:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        if (!subs || subs.length === 0) {
            console.log('No subscriptions found for role:', target_role);
            return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        const payload = JSON.stringify({
            title: title || 'Notificación',
            body: message || ''
        });

        // Use npm:web-push to send the real requests
        const results = await Promise.allSettled(
            subs.map(async (sub) => {
                const subscriptionObj = typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription;
                return webpush.sendNotification(subscriptionObj, payload);
            })
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');

        console.log(`Sent push to ${succeeded}/${subs.length} subscriptions`);
        if (failed.length > 0) {
            console.log(`Failed pushes:`, failed);
        }

        return new Response(JSON.stringify({ sent: succeeded, total: subs.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });

    } catch (err) {
        console.error('Edge function error:', err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
});
