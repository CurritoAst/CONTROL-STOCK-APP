import React, { useMemo, useState } from 'react';
import { Bell, BellRing, ChevronDown, ChevronUp, Loader2, LogOut, Mail, Printer, ReceiptText, Send } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { sendViaGmail } from '../../lib/gmailSend';

const INVOICE_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 48px; color: #111; font-size: 17px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #111; padding-bottom: 24px; margin-bottom: 32px; }
  .brand { font-size: 38px; font-weight: 900; letter-spacing: -0.5px; }
  .brand span { color: #e05c00; }
  .meta { text-align: right; }
  .meta .label { font-size: 13px; text-transform: uppercase; color: #888; font-weight: 700; }
  .meta .value { font-size: 20px; font-weight: 700; }
  .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 700; margin-bottom: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px; }
  .info-box { background: #f7f7f7; border-radius: 8px; padding: 20px 24px; }
  .info-box .val { font-size: 20px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
  thead th { background: #111; color: #fff; padding: 14px 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  tbody td { padding: 14px 16px; border-bottom: 1px solid #eee; font-size: 17px; }
  tbody tr:last-child td { border-bottom: none; }
  .cat-header td { background: #f0f0f0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #444; padding: 12px 16px; border-bottom: 2px solid #ddd; }
  .indent { padding-left: 28px !important; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .sobrante { color: #dc2626; font-weight: 700; }
  .totals { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .total-box { border-radius: 12px; padding: 24px 28px; }
  .total-coste { background: #eff6ff; border: 2px solid #3b82f6; }
  .total-merma { background: #fff5f5; border: 2px solid #ef4444; }
  .total-label { font-size: 14px; text-transform: uppercase; color: #666; font-weight: 700; margin-bottom: 8px; }
  .total-coste .total-amount { font-size: 42px; font-weight: 900; color: #1d4ed8; }
  .total-merma .total-amount { font-size: 42px; font-weight: 900; color: #dc2626; }
  .footer { margin-top: 50px; text-align: center; font-size: 14px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
  @media print { body { padding: 24px; } @page { margin: 12mm; } }
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
        <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Pedidos y Ferias</h1>
                    <p className="page-subtitle">Consulta e imprime las facturas por día o el total del evento</p>
                </div>
                <button onClick={() => setRole(null)} className="btn btn-outline btn-sm shrink-0">
                    <LogOut size={14} strokeWidth={2.2} />
                    Cerrar sesión
                </button>
            </div>

            {/* Banner notificaciones */}
            <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-6 border ${isPushEnabled ? 'bg-accent-green/10 border-accent-green/30' : 'bg-bg-elevated/40 border-white/10'}`}>
                <div className="flex items-center gap-3">
                    <span className={`icon-chip ${isPushEnabled ? 'icon-chip-green' : 'icon-chip-gray'}`}>
                        {isPushEnabled ? <BellRing size={18} strokeWidth={2.2} /> : <Bell size={18} strokeWidth={2.2} />}
                    </span>
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
                            className="btn btn-outline btn-sm whitespace-nowrap"
                        >
                            <Send size={14} strokeWidth={2.2} />
                            Enviar prueba
                        </button>
                    )}
                    {!isPushEnabled && (
                        <button
                            onClick={handleEnableNotifications}
                            className="btn btn-primary btn-sm whitespace-nowrap"
                        >
                            Activar
                        </button>
                    )}
                </div>
            </div>

            {orders.length === 0 && (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon">
                            <ReceiptText size={20} strokeWidth={2} />
                        </div>
                        <p>No hay pedidos registrados todavía.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {orders.map(order => (
                    <div key={order.title} className="card p-0 overflow-hidden">
                        {/* Cabecera del pedido/feria */}
                        <button
                            className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-bg-elevated/30 transition-colors text-left"
                            onClick={() => setExpandedOrder(expandedOrder === order.title ? null : order.title)}
                            aria-expanded={expandedOrder === order.title}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="icon-chip icon-chip-blue">
                                    <ReceiptText size={18} strokeWidth={2.2} />
                                </span>
                                <div className="min-w-0">
                                    <div className="font-bold text-base truncate">{order.title}</div>
                                    <div className="text-text-muted text-sm mt-0.5">
                                        {order.days.length} {order.days.length === 1 ? 'día' : 'días'}
                                        {' · '}
                                        {order.days[order.days.length - 1]?.date}
                                    </div>
                                </div>
                            </div>
                            <span className="text-text-muted shrink-0">
                                {expandedOrder === order.title
                                    ? <ChevronUp size={18} strokeWidth={2.2} />
                                    : <ChevronDown size={18} strokeWidth={2.2} />}
                            </span>
                        </button>

                        {expandedOrder === order.title && (
                            <div className="border-t border-white/5 animate-fade-in">
                                {/* Facturas diarias */}
                                <div className="overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th className="text-right">Coste</th>
                                                <th className="text-right">Merma</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.days.map(day => (
                                                <tr key={day.date}>
                                                    <td className="font-semibold whitespace-nowrap">{day.date}</td>
                                                    <td className="num text-right text-accent-blue font-semibold whitespace-nowrap">{day.expense.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                                                    <td className="num text-right text-accent-red font-semibold whitespace-nowrap">{day.loss.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                                                    <td>
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => printDayInvoice(day, order.title)}
                                                                className="btn btn-outline btn-sm whitespace-nowrap"
                                                            >
                                                                <Printer size={14} strokeWidth={2.2} />
                                                                Factura del día
                                                            </button>
                                                            <button
                                                                disabled={!!sendingEmail}
                                                                onClick={() => handleEmail(() => printDayInvoice(day, order.title, true), day.date)}
                                                                className="btn btn-outline btn-sm whitespace-nowrap"
                                                            >
                                                                {sendingEmail === day.date
                                                                    ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                                                                    : <><Mail size={14} strokeWidth={2.2} /> Email</>}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Factura total del evento */}
                                <div className="px-5 py-4 bg-bg-elevated/20 flex flex-wrap items-center justify-between gap-3 border-t border-white/5">
                                    <div>
                                        <div className="font-bold text-sm">Factura Total</div>
                                        <div className="text-text-muted text-xs mt-0.5">
                                            Resumen acumulado de todos los días ·{' '}
                                            <span className="num text-accent-blue font-semibold">
                                                {order.days.reduce((s, d) => s + d.expense, 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => printOrderTotalInvoice(order)}
                                            className="btn btn-primary btn-sm whitespace-nowrap"
                                        >
                                            <Printer size={14} strokeWidth={2.2} />
                                            Factura total
                                        </button>
                                        <button
                                            disabled={!!sendingEmail}
                                            onClick={() => handleEmail(() => printOrderTotalInvoice(order, true), `total-${order.title}`)}
                                            className="btn btn-outline btn-sm whitespace-nowrap"
                                        >
                                            {sendingEmail === `total-${order.title}`
                                                ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                                                : <><Mail size={14} strokeWidth={2.2} /> Email</>}
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
