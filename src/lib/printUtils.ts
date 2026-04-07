// printUtils.ts
// Utilidades de impresión para Proyecto Macario
// El email se envía DESDE EL SERVIDOR (Supabase Edge Function) para funcionar en móvil sin popups OAuth.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const ORDER_PRINT_STYLES = `
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
  @media print { body { padding: 16px; } @page { margin: 10mm; } }
`;

/**
 * Envía el pedido al servidor (Supabase Edge Function) para que lo mande
 * por email a la impresora Brother. Funciona en todos los dispositivos sin popups.
 */
export const sendOrderToprinter = async (log: { date: string; eventTitle?: string; items: any[] }): Promise<void> => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-print-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
            date: log.date,
            eventTitle: log.eventTitle,
            items: log.items.filter(i => i.prepared > 0).map(i => ({
                product: { name: i.product.name, category: i.product.category || 'Sin categoría', price: i.product.price || 0 },
                prepared: i.prepared,
            })),
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Error al enviar el pedido a la impresora');
    }
};

/**
 * Abre una ventana de impresión local en el navegador (solo PC/escritorio).
 * En móvil no hace nada para evitar crashes.
 */
export const printRawOrder = (log: { date: string; eventTitle?: string; items: any[] }, email = false): Promise<void> => {
    if (email) {
        return sendOrderToprinter(log);
    }

    // Impresión local solo en escritorio
    const byCategory: Record<string, typeof log.items> = {};
    log.items.filter(i => i.prepared > 0).forEach(item => {
        const cat = item.product.category || 'Sin categoría';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    const sections = Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([cat, items]) => `
            <div class="cat-title">${cat}</div>
            <table>
                ${items.map(item => `
                    <tr class="item-row">
                        <td style="font-weight:600">${item.product.name}</td>
                        <td class="qty">${item.prepared}</td>
                    </tr>
                `).join('')}
            </table>
        `).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Pedido - ${log.eventTitle || 'Pedido'} - ${log.date}</title>
<style>${ORDER_PRINT_STYLES}</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">MACARIO<span>.</span></div>
      <div style="color:#555;margin-top:4px;font-size:13px;">Hoja de Pedido</div>
    </div>
    <div class="meta">
      <div class="label">Fecha del servicio</div>
      <div class="value">${log.date}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="lbl">Evento / Pedido</div>
      <div class="val">${log.eventTitle || 'Pedido General'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Total productos</div>
      <div class="val">${log.items.filter(i => i.prepared > 0).length} referencias</div>
    </div>
  </div>
  ${sections}
  <div class="footer">Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
    return Promise.resolve();
};
