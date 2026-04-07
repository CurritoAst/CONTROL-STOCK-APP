// Supabase Edge Function: send-print-email
// Gmail SMTP via Deno native TCP + TLS + App Password
// Sin dependencias externas → funcionamiento garantizado en Supabase Edge Functions

const CORSHEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

const PRINTER_EMAIL = '11974454020@print.brother.com';

function buildOrderHtml(date: string, eventTitle: string | undefined, items: Array<{ product: { name: string; category?: string; price?: number }; prepared: number }>): string {
    const activeItems = items.filter(i => i.prepared > 0);

    // Group by category
    const byCategory: Record<string, typeof activeItems> = {};
    activeItems.forEach(item => {
        const cat = item.product.category || 'Sin categoria';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    // Total cost
    const totalCost = activeItems.reduce((sum, i) => sum + (i.prepared * (i.product.price || 0)), 0);
    const gen = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    const rows = Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([cat, catItems]) => `
            <tr><td colspan="4" style="background:#f0f0f0;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#444;padding:6px 12px;border-top:1px solid #ddd;border-bottom:1px solid #ddd;">${cat}</td></tr>
            ${catItems.map(item => {
                const price = item.product.price || 0;
                const cost = item.prepared * price;
                return `<tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:600">${item.product.name}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:18px;font-weight:900;color:#1d4ed8">${item.prepared}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#555">${price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:700">${cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                </tr>`;
            }).join('')}
        `).join('');

    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Pedido - ${eventTitle || 'General'} - ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  .brand span { color: #e05c00; }
  .subtitle { font-size: 11px; color: #777; margin-top: 2px; }
  .meta-right { text-align: right; }
  .meta-right .event-title { font-size: 16px; font-weight: 700; }
  .meta-right .event-type { font-size: 10px; text-transform: uppercase; color: #888; }
  .meta-right .date-range { font-size: 13px; color: #333; margin-top: 4px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .info-box { background: #f7f7f7; border-radius: 6px; padding: 10px 14px; }
  .info-box .lbl { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; letter-spacing: 0.5px; }
  .info-box .val { font-size: 14px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #111; color: #fff; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  thead th:not(:first-child) { text-align: center; }
  thead th:last-child { text-align: right; }
  .total-row { border-top: 2px solid #111; }
  .total-row td { padding: 12px; font-weight: 900; font-size: 15px; }
  .total-box { margin-top: 20px; display: flex; justify-content: flex-end; }
  .total-value { background: #1d4ed8; color: white; padding: 12px 24px; border-radius: 8px; text-align: center; }
  .total-value .tlbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
  .total-value .tnum { font-size: 22px; font-weight: 900; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">MACARIO<span>.</span></div>
      <div class="subtitle">Hoja de Pedido</div>
    </div>
    <div class="meta-right">
      <div class="event-type">Evento / Pedido</div>
      <div class="event-title">${eventTitle || 'Pedido General'}</div>
      <div class="date-range">${date}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box"><div class="lbl">Total Productos</div><div class="val">${activeItems.length} ref.</div></div>
    <div class="info-box"><div class="lbl">Total Unidades</div><div class="val">${activeItems.reduce((s, i) => s + i.prepared, 0)} uds.</div></div>
    <div class="info-box"><div class="lbl">Coste Estimado</div><div class="val">${totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:45%">Producto</th>
        <th style="width:15%;text-align:center">Cantidad</th>
        <th style="width:20%;text-align:right">Precio/Ud</th>
        <th style="width:20%;text-align:right">Coste Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;color:#555;font-size:12px">TOTAL DEL PEDIDO:</td>
        <td style="text-align:right;color:#1d4ed8;font-size:16px">${totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">Generado el ${gen} · Macario App</div>
</body></html>`;
}


async function sendSmtp(from: string, password: string, to: string, subject: string, html: string): Promise<void> {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    // Buffer reader that accumulates until CRLF
    async function readResponse(conn: Deno.Conn): Promise<string> {
        const buf = new Uint8Array(8192);
        let full = '';
        while (true) {
            const n = await conn.read(buf);
            if (!n) break;
            full += dec.decode(buf.subarray(0, n));
            // SMTP multi-line responses end when a line starts with "XYZ " (no dash)
            const lines = full.split('\r\n');
            const last = lines.find(l => l.match(/^\d{3} /));
            if (last) break;
            if (full.endsWith('\r\n')) break;
        }
        console.log('SMTP ←', full.trim());
        return full;
    }

    async function send(conn: Deno.Conn, cmd: string): Promise<string> {
        console.log('SMTP →', cmd.startsWith('AUTH') || cmd.length < 60 ? cmd : cmd.substring(0, 40) + '...');
        await conn.write(enc.encode(cmd + '\r\n'));
        return readResponse(conn);
    }

    // 1. Plain TCP connection to port 587
    const plain = await Deno.connect({ hostname: 'smtp.gmail.com', port: 587 });
    await readResponse(plain); // 220 greeting

    // 2. EHLO
    await send(plain, 'EHLO macario-edge');

    // 3. STARTTLS
    const startTlsResp = await send(plain, 'STARTTLS');
    if (!startTlsResp.includes('220')) throw new Error(`STARTTLS failed: ${startTlsResp}`);

    // 4. Upgrade connection to TLS
    const tls = await Deno.startTls(plain, { hostname: 'smtp.gmail.com' });

    // 5. Re-EHLO over TLS
    await send(tls, 'EHLO macario-edge');

    // 6. AUTH LOGIN
    await send(tls, 'AUTH LOGIN');
    const userResp = await send(tls, btoa(from));
    const passResp = await send(tls, btoa(password));

    if (!passResp.includes('235')) {
        throw new Error(`SMTP auth failed: ${passResp.trim()}`);
    }

    // 7. Send email
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
        `Pedido Macario: ${subject}`,
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
        const { date, eventTitle, items } = await req.json();

        if (!date || !Array.isArray(items)) {
            return new Response(JSON.stringify({ error: 'Faltan date o items' }), { status: 400, headers: CORSHEADERS });
        }

        const gmailUser = Deno.env.get('GMAIL_FROM_EMAIL');
        const appPass = Deno.env.get('GMAIL_APP_PASSWORD');
        if (!gmailUser || !appPass) throw new Error('Faltan GMAIL_FROM_EMAIL o GMAIL_APP_PASSWORD');

        const subject = `Pedido-${eventTitle || 'General'}-${date}`;
        const html = buildOrderHtml(date, eventTitle, items);

        await sendSmtp(gmailUser, appPass, PRINTER_EMAIL, subject, html);

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORSHEADERS });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Error send-print-email:', msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500, headers: CORSHEADERS });
    }
});
