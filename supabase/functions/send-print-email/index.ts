// Supabase Edge Function: send-print-email
// Envía el pedido al email de la impresora Brother vía Gmail SMTP
// Usa App Password de Gmail (sin OAuth popup) → funciona en todos los dispositivos
// Deploy: npx supabase functions deploy send-print-email

import { SmtpClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CORSHEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

const PRINTER_EMAIL = '11974454020@print.brother.com';

function buildOrderHtml(date: string, eventTitle: string | undefined, items: Array<{ product: { name: string; category?: string }; prepared: number }>): string {
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

    const totalItems = items.filter(i => i.prepared > 0).length;
    const generatedDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Pedido - ${eventTitle || 'General'} - ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; padding: 40px; color: #111; font-size: 13px; }
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #111; padding-bottom: 18px; margin-bottom: 24px; }
  .brand { font-size: 26px; font-weight: 900; }
  .brand span { color: #e05c00; }
  .meta { text-align: right; font-size: 13px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
  .info-box { background: #f7f7f7; border-radius: 8px; padding: 12px 16px; }
  .info-box .lbl { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; }
  .info-box .val { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .cat-title { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #444; background: #f0f0f0; padding: 6px 12px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; margin: 10px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  .item-row td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  .qty { font-size: 20px; font-weight: 900; color: #1d4ed8; text-align: right; width: 60px; }
  .footer { margin-top: 36px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
</style></head>
<body>
  <div class="header">
    <div><div class="brand">MACARIO<span>.</span></div><div style="color:#555;margin-top:4px;">Hoja de Pedido</div></div>
    <div class="meta"><strong>Fecha del servicio</strong><br>${date}</div>
  </div>
  <div class="info-grid">
    <div class="info-box"><div class="lbl">Evento / Pedido</div><div class="val">${eventTitle || 'Pedido General'}</div></div>
    <div class="info-box"><div class="lbl">Total productos</div><div class="val">${totalItems} referencias</div></div>
  </div>
  ${sections}
  <div class="footer">Generado el ${generatedDate}</div>
</body></html>`;
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

        const gmailUser = Deno.env.get('GMAIL_FROM_EMAIL');
        const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD');

        if (!gmailUser || !gmailPass) {
            throw new Error('Faltan variables de entorno: GMAIL_FROM_EMAIL y GMAIL_APP_PASSWORD');
        }

        const html = buildOrderHtml(date, eventTitle, items);
        const subject = `Pedido-${eventTitle || 'General'}-${date}`;

        // Conexión SMTP con Gmail
        const client = new SmtpClient();
        await client.connectTLS({
            hostname: 'smtp.gmail.com',
            port: 465,
            username: gmailUser,
            password: gmailPass,
        });

        await client.send({
            from: gmailUser,
            to: PRINTER_EMAIL,
            subject,
            content: 'Pedido enviado desde Macario App. Ver fichero adjunto para imprimir.',
            html,
        });

        await client.close();

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
