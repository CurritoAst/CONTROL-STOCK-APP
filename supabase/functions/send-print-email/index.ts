// Supabase Edge Function: send-print-email
// Envía el pedido como HTML directamente al email de la impresora Brother
// usando Gmail SMTP con cuenta de servicio (sin OAuth popup en el cliente)
// Deploy: npx supabase functions deploy send-print-email

const CORSHEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

const PRINTER_EMAIL = '11974454020@print.brother.com';

// Construye el HTML del pedido
function buildOrderHtml(date: string, eventTitle: string | undefined, items: Array<{ product: { name: string; category?: string }; prepared: number }>) {
    const byCategory: Record<string, typeof items> = {};
    items.filter(i => i.prepared > 0).forEach(item => {
        const cat = item.product.category || 'Sin categoría';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    const sections = Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([cat, catItems]) => `
            <div class="cat-title">${cat}</div>
            <table>
                ${catItems.map(item => `
                    <tr class="item-row">
                        <td style="font-weight:600">${item.product.name}</td>
                        <td class="qty">${item.prepared}</td>
                    </tr>
                `).join('')}
            </table>
        `).join('');

    const styles = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 18px; margin-bottom: 24px; }
        .brand { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
        .brand span { color: #e05c00; }
        .meta { text-align: right; }
        .meta .label { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; }
        .meta .value { font-size: 15px; font-weight: 700; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
        .info-box { background: #f7f7f7; border-radius: 8px; padding: 12px 16px; }
        .info-box .lbl { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; }
        .info-box .val { font-size: 15px; font-weight: 700; margin-top: 2px; }
        .cat-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #444; background: #f0f0f0; padding: 6px 12px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; margin: 10px 0 0; }
        table { width: 100%; border-collapse: collapse; }
        .item-row td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        .item-row:last-child td { border-bottom: none; }
        .qty { font-size: 20px; font-weight: 900; color: #1d4ed8; text-align: right; width: 60px; }
        .footer { margin-top: 36px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
    `;

    const totalItems = items.filter(i => i.prepared > 0).length;
    const generatedDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Pedido - ${eventTitle || 'General'} - ${date}</title>
<style>${styles}</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">MACARIO<span>.</span></div>
      <div style="color:#555;margin-top:4px;font-size:13px;">Hoja de Pedido</div>
    </div>
    <div class="meta">
      <div class="label">Fecha del servicio</div>
      <div class="value">${date}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="lbl">Evento / Pedido</div>
      <div class="val">${eventTitle || 'Pedido General'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Total productos</div>
      <div class="val">${totalItems} referencias</div>
    </div>
  </div>
  ${sections}
  <div class="footer">Generado el ${generatedDate}</div>
</body></html>`;
}

// Envía email via Gmail API usando refresh token de la cuenta de servicio
async function sendViaGmailApi(html: string, subject: string): Promise<void> {
    const gmailRefreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
    const gmailClientId = Deno.env.get('GMAIL_CLIENT_ID');
    const gmailClientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const gmailFromEmail = Deno.env.get('GMAIL_FROM_EMAIL');

    if (!gmailRefreshToken || !gmailClientId || !gmailClientSecret || !gmailFromEmail) {
        throw new Error('Faltan variables de entorno de Gmail (GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_FROM_EMAIL)');
    }

    // 1. Obtener access token usando refresh token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: gmailClientId,
            client_secret: gmailClientSecret,
            refresh_token: gmailRefreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Error obteniendo access token: ${err}`);
    }

    const { access_token } = await tokenRes.json();

    // 2. Construir el MIME del email con adjunto HTML
    const boundary = 'macario_print_boundary_' + Date.now();
    const htmlB64 = btoa(unescape(encodeURIComponent(html)));

    const mime = [
        `From: Macario App <${gmailFromEmail}>`,
        `To: ${PRINTER_EMAIL}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        'Pedido enviado desde Macario App. Ver fichero adjunto para imprimir.',
        '',
        `--${boundary}`,
        `Content-Type: text/html; name="${subject}.html"`,
        `Content-Disposition: attachment; filename="${subject}.html"`,
        'Content-Transfer-Encoding: base64',
        '',
        htmlB64,
        `--${boundary}--`,
    ].join('\r\n');

    // 3. Codificar en base64url y enviar
    const rawB64 = btoa(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const sendRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawB64 }),
    });

    if (!sendRes.ok) {
        const err = await sendRes.json();
        throw new Error(err.error?.message || 'Error al enviar email via Gmail API');
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORSHEADERS });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORSHEADERS });
    }

    try {
        const { date, eventTitle, items } = await req.json();

        if (!date || !items || !Array.isArray(items)) {
            return new Response(JSON.stringify({ error: 'Faltan datos: date, items requeridos' }), { status: 400, headers: CORSHEADERS });
        }

        const html = buildOrderHtml(date, eventTitle, items);
        const subject = `Pedido-${eventTitle || 'General'}-${date}`;

        await sendViaGmailApi(html, subject);

        return new Response(JSON.stringify({ success: true, message: 'Email enviado a la impresora' }), {
            status: 200,
            headers: CORSHEADERS,
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Error en send-print-email:', message);
        return new Response(JSON.stringify({ error: message }), { status: 500, headers: CORSHEADERS });
    }
});
