// Supabase Edge Function: send-print-email-raw
// Acepta HTML ya generado y lo envía a la impresora Brother via Gmail SMTP
// Usado por FinancialFeriaReport y SaulDashboard para facturas de admin/visor
// Sin OAuth popup → funciona desde cualquier dispositivo

const CORSHEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

const PRINTER_EMAIL = '11974454020@print.brother.com';

async function sendSmtp(from: string, password: string, to: string, subject: string, html: string): Promise<void> {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    async function readResponse(conn: Deno.Conn): Promise<string> {
        const buf = new Uint8Array(8192);
        let full = '';
        while (true) {
            const n = await conn.read(buf);
            if (!n) break;
            full += dec.decode(buf.subarray(0, n));
            if (full.split('\r\n').find((l: string) => l.match(/^\d{3} /))) break;
            if (full.endsWith('\r\n')) break;
        }
        console.log('SMTP ←', full.trim().substring(0, 80));
        return full;
    }

    async function send(conn: Deno.Conn, cmd: string): Promise<string> {
        console.log('SMTP →', cmd.length < 60 ? cmd : cmd.substring(0, 40) + '...');
        await conn.write(enc.encode(cmd + '\r\n'));
        return readResponse(conn);
    }

    const plain = await Deno.connect({ hostname: 'smtp.gmail.com', port: 587 });
    await readResponse(plain);
    await send(plain, 'EHLO macario-edge');
    const startTlsResp = await send(plain, 'STARTTLS');
    if (!startTlsResp.includes('220')) throw new Error(`STARTTLS failed: ${startTlsResp}`);

    const tls = await Deno.startTls(plain, { hostname: 'smtp.gmail.com' });
    await send(tls, 'EHLO macario-edge');
    await send(tls, 'AUTH LOGIN');
    await send(tls, btoa(from));
    const passResp = await send(tls, btoa(password));
    if (!passResp.includes('235')) throw new Error(`SMTP auth failed: ${passResp.trim()}`);

    await send(tls, `MAIL FROM:<${from}>`);
    await send(tls, `RCPT TO:<${to}>`);
    await send(tls, 'DATA');

    const boundary = `mp_${Date.now()}`;
    const body = [
        `From: Macario App <${from}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        `Factura Macario: ${subject}`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        '',
        html,
        '',
        `--${boundary}--`,
        '',
        '.',
    ].join('\r\n');

    await send(tls, body);
    await send(tls, 'QUIT');
    tls.close();
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORSHEADERS });
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORSHEADERS });

    try {
        const { html, filename } = await req.json();
        if (!html) return new Response(JSON.stringify({ error: 'Falta html' }), { status: 400, headers: CORSHEADERS });

        const gmailUser = Deno.env.get('GMAIL_FROM_EMAIL');
        const appPass = Deno.env.get('GMAIL_APP_PASSWORD');
        if (!gmailUser || !appPass) throw new Error('Faltan GMAIL_FROM_EMAIL o GMAIL_APP_PASSWORD en los secrets');

        const subject = filename?.replace('.html', '') || 'Factura-Macario';
        await sendSmtp(gmailUser, appPass, PRINTER_EMAIL, subject, html);

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORSHEADERS });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error send-print-email-raw:', msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORSHEADERS });
    }
});
