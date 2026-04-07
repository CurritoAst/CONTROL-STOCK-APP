import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { sendViaGmail } from '../../lib/gmailSend';

const INVOICE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 48px; color: #111; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 28px; }
  .brand { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
  .brand span { color: #e05c00; }
  .meta { text-align: right; }
  .meta .label { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; }
  .meta .value { font-size: 15px; font-weight: 700; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 700; margin-bottom: 6px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
  .info-box { background: #f7f7f7; border-radius: 8px; padding: 14px 16px; }
  .info-box .val { font-size: 15px; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
  thead th { background: #111; color: #fff; padding: 9px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #eee; }
  tbody tr:last-child td { border-bottom: none; }
  .cat-header td { background: #f0f0f0; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #444; padding: 7px 12px; border-bottom: 1px solid #ddd; }
  .indent { padding-left: 22px !important; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .sobrante { color: #dc2626; font-weight: 700; }
  .totals { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .total-box { border-radius: 8px; padding: 18px 20px; }
  .total-coste { background: #eff6ff; border: 2px solid #3b82f6; }
  .total-merma { background: #fff5f5; border: 2px solid #ef4444; }
  .total-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: 700; margin-bottom: 6px; }
  .total-coste .total-amount { font-size: 28px; font-weight: 900; color: #1d4ed8; }
  .total-merma .total-amount { font-size: 28px; font-weight: 900; color: #dc2626; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 14px; }
  @media print { body { padding: 20px; } @page { margin: 12mm; } }
`;

const buildCategoryRows = (items: any[]) => {
    const byCategory: Record<string, any[]> = {};
    items.forEach(item => {
        const cat = item.product.category || 'Sin categoría';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    return Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([cat, catItems]) => {
            const headerRow = `<tr class="cat-header"><td colspan="6">${cat}</td></tr>`;
            const itemRows = catItems.map((item: any) => {
                const sobrante = Math.max(0, item.prepared - item.consumed);
                const cost = item.consumed * item.product.price;
                return `<tr>
                    <td class="indent"><strong>${item.product.name}</strong></td>
                    <td class="center">${item.prepared}</td>
                    <td class="center">${item.consumed}</td>
                    <td class="center sobrante">${sobrante}</td>
                    <td class="right">${item.product.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td class="right bold">${cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                </tr>`;
            }).join('');
            return headerRow + itemRows;
        }).join('');
};

const openInvoice = (html: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
};


const printDayInvoice = (day: any, orderTitle: string, email = false) => {
    const rows = buildCategoryRows(day.items);
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Factura ${orderTitle} – ${day.date}</title>
<style>${INVOICE_STYLES}</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">MACARIO<span>.</span></div>
      <div style="color:#555;margin-top:4px;">Factura Diaria de Pedido</div>
    </div>
    <div class="meta">
      <div class="label">Fecha del pedido</div>
      <div class="value">${day.date}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="section-title">Evento / Pedido</div>
      <div class="val">${orderTitle}</div>
    </div>
    <div class="info-box">
      <div class="section-title">Productos registrados</div>
      <div class="val">${day.items.length}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Producto</th>
      <th class="center">Preparado</th>
      <th class="center">Consumido</th>
      <th class="center">Sobrante</th>
      <th class="right">Precio/ud</th>
      <th class="right">Coste</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="total-box total-coste">
      <div class="total-label">Consumo Total</div>
      <div class="total-amount">${day.expense.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
    </div>
    <div class="total-box total-merma">
      <div class="total-label">Merma Total</div>
      <div class="total-amount">${day.loss.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
    </div>
  </div>
  <div class="footer">Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <script>window.onload = function() { window.print(); }</script>
</body></html>`;
    return email ? sendViaGmail(html, `Factura-${orderTitle}-${day.date}.html`) : Promise.resolve(openInvoice(html));
};

const printOrderTotalInvoice = (order: { title: string; days: any[] }, email = false) => {
    // Merge all items across days by product id
    const merged: Record<string, any> = {};
    order.days.forEach(day => {
        day.items.forEach((item: any) => {
            const id = item.product.id;
            if (!merged[id]) {
                merged[id] = { product: item.product, prepared: 0, consumed: 0 };
            }
            merged[id].prepared += item.prepared;
            merged[id].consumed += item.consumed;
        });
    });

    const allItems = Object.values(merged);
    const totalExpense = order.days.reduce((s, d) => s + d.expense, 0);
    const totalLoss = order.days.reduce((s, d) => s + d.loss, 0);
    const dateRange = order.days.length > 1
        ? `${order.days[0].date} → ${order.days[order.days.length - 1].date}`
        : order.days[0]?.date || '';

    const rows = buildCategoryRows(allItems);

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Factura Total – ${order.title}</title>
<style>${INVOICE_STYLES}
  .badge { display:inline-block; background:#111; color:#fff; font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">MACARIO<span>.</span></div>
      <div style="color:#555;margin-top:4px;">Factura Total del Evento</div>
    </div>
    <div class="meta">
      <div class="label">Periodo</div>
      <div class="value">${dateRange}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="section-title">Evento / Pedido</div>
      <div class="val">${order.title}</div>
    </div>
    <div class="info-box">
      <div class="section-title">Días registrados</div>
      <div class="val">${order.days.length} ${order.days.length === 1 ? 'día' : 'días'}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Producto</th>
      <th class="center">Total Preparado</th>
      <th class="center">Total Consumido</th>
      <th class="center">Total Sobrante</th>
      <th class="right">Precio/ud</th>
      <th class="right">Coste Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="total-box total-coste">
      <div class="total-label">Consumo Total del Evento</div>
      <div class="total-amount">${totalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
    </div>
    <div class="total-box total-merma">
      <div class="total-label">Merma Total del Evento</div>
      <div class="total-amount">${totalLoss.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
    </div>
  </div>
  <div class="footer">Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <script>window.onload = function() { window.print(); }</script>
</body></html>`;
    return email ? sendViaGmail(html, `Factura-Total-${order.title}.html`) : Promise.resolve(openInvoice(html));
};

export const SaulDashboard: React.FC = () => {
    const { historicalLogs, setRole, isPushEnabled, requestPushPermission } = useAppContext();
    const { addToast } = useToast();
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [sendingEmail, setSendingEmail] = useState<string | null>(null);

    const handleEmail = async (fn: () => Promise<void>, key: string) => {
        setSendingEmail(key);
        try {
            await fn();
            addToast('PDF enviado a la impresora correctamente', 'success');
        } catch (e: any) {
            addToast('Error al enviar: ' + (e.message || 'inténtalo de nuevo'), 'error');
        } finally {
            setSendingEmail(null);
        }
    };

    const handleEnableNotifications = async () => {
        const ok = await requestPushPermission();
        if (!ok) addToast('No se pudieron activar las notificaciones', 'error');
    };

    const handleTestPush = async () => {
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const sb = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY
            );
            const result = await sb.functions.invoke('send-web-push', {
                body: { title: '📄 Nueva Factura Disponible', message: '¡Las notificaciones funcionan correctamente!', target_role: 'VIEWER' },
                headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
            });
            if (result.error) {
                addToast('Error al enviar prueba: ' + result.error.message, 'error');
            } else {
                addToast('Notificación de prueba enviada', 'success');
            }
        } catch (e: any) {
            addToast('Error: ' + e.message, 'error');
        }
    };

    const orders = useMemo(() => {
        const map: Record<string, { title: string; days: any[] }> = {};

        historicalLogs.forEach(log => {
            const title = log.eventTitle || 'Pedido General';
            if (!map[title]) map[title] = { title, days: [] };

            let expense = 0;
            let loss = 0;
            (log.items || []).forEach((item: any) => {
                const sobrante = Math.max(0, item.prepared - item.consumed);
                expense += item.consumed * item.product.price;
                loss += sobrante * item.product.price;
            });

            map[title].days.push({ date: log.date, expense, loss, items: log.items || [] });
        });

        return Object.values(map).map(o => ({
            ...o,
            days: o.days.sort((a, b) => a.date.localeCompare(b.date)),
        })).sort((a, b) => {
            const lastA = a.days[a.days.length - 1]?.date || '';
            const lastB = b.days[b.days.length - 1]?.date || '';
            return lastB.localeCompare(lastA);
        });
    }, [historicalLogs]);

    return (
        <div className="p-4 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Pedidos y Ferias</h1>
                    <p className="text-text-muted text-sm mt-1">Consulta e imprime las facturas por día o el total del evento</p>
                </div>
                <button onClick={() => setRole(null)} className="btn btn-secondary text-sm px-4 py-2">
                    Cerrar sesión
                </button>
            </div>

            {/* Banner notificaciones */}
            <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-2 border ${isPushEnabled ? 'bg-green-900/20 border-green-500/30' : 'bg-bg-elevated/40 border-white/10'}`}>
                <div className="flex items-center gap-3">
                    <span className="text-xl">{isPushEnabled ? '🔔' : '🔕'}</span>
                    <div>
                        <div className="text-sm font-bold">{isPushEnabled ? 'Notificaciones activas' : 'Notificaciones desactivadas'}</div>
                        <div className="text-xs text-text-muted">
                            {isPushEnabled
                                ? 'Recibirás un aviso cuando haya una nueva factura disponible.'
                                : 'Actívalas para saber cuándo hay nuevas facturas.'}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    {isPushEnabled && (
                        <button
                            onClick={handleTestPush}
                            className="btn btn-secondary text-xs px-3 py-2 whitespace-nowrap"
                        >
                            Enviar prueba
                        </button>
                    )}
                    {!isPushEnabled && (
                        <button
                            onClick={handleEnableNotifications}
                            className="btn btn-primary text-xs px-3 py-2 whitespace-nowrap"
                        >
                            Activar
                        </button>
                    )}
                </div>
            </div>

            {orders.length === 0 && (
                <div className="card text-center text-text-muted py-12">
                    No hay pedidos registrados todavía.
                </div>
            )}

            <div className="flex flex-col gap-3">
                {orders.map(order => (
                    <div key={order.title} className="card p-0 overflow-hidden">
                        {/* Cabecera del pedido/feria */}
                        <button
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-bg-elevated/30 transition-colors text-left"
                            onClick={() => setExpandedOrder(expandedOrder === order.title ? null : order.title)}
                        >
                            <div>
                                <div className="font-bold text-base">{order.title}</div>
                                <div className="text-text-muted text-sm mt-0.5">
                                    {order.days.length} {order.days.length === 1 ? 'día' : 'días'}
                                    {' · '}
                                    {order.days[order.days.length - 1]?.date}
                                </div>
                            </div>
                            <span className="text-text-muted text-lg ml-4">
                                {expandedOrder === order.title ? '▲' : '▼'}
                            </span>
                        </button>

                        {expandedOrder === order.title && (
                            <div className="border-t border-bg-elevated">
                                {/* Facturas diarias */}
                                <div className="divide-y divide-bg-elevated">
                                    {order.days.map(day => (
                                        <div key={day.date} className="flex items-center justify-between px-5 py-3">
                                            <div>
                                                <div className="font-semibold text-sm">{day.date}</div>
                                                <div className="text-text-muted text-xs mt-0.5">
                                                    Coste: <span className="text-blue-400 font-bold">{day.expense.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                                                    {' · '}
                                                    Merma: <span className="text-red-400 font-bold">{day.loss.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => printDayInvoice(day, order.title)}
                                                    className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
                                                >
                                                    🖨️ Factura del día
                                                </button>
                                                <button
                                                    disabled={!!sendingEmail}
                                                    onClick={() => handleEmail(() => printDayInvoice(day, order.title, true), day.date)}
                                                    className="text-xs px-3 py-2 rounded border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-all font-bold flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    {sendingEmail === day.date ? '⏳ Enviando...' : '✉️ Email'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Factura total del evento */}
                                <div className="px-5 py-3 bg-bg-elevated/20 flex items-center justify-between border-t border-bg-elevated">
                                    <div>
                                        <div className="font-bold text-sm">Factura Total</div>
                                        <div className="text-text-muted text-xs mt-0.5">
                                            Resumen acumulado de todos los días ·{' '}
                                            <span className="text-blue-400 font-bold">
                                                {order.days.reduce((s, d) => s + d.expense, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => printOrderTotalInvoice(order)}
                                            className="btn btn-primary text-xs px-3 py-2 flex items-center gap-1.5"
                                        >
                                            🖨️ Factura total
                                        </button>
                                        <button
                                            disabled={!!sendingEmail}
                                            onClick={() => handleEmail(() => printOrderTotalInvoice(order, true), `total-${order.title}`)}
                                            className="text-xs px-3 py-2 rounded border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-all font-bold flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {sendingEmail === `total-${order.title}` ? '⏳ Enviando...' : '✉️ Email'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
