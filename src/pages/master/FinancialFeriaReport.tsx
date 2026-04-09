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


const downloadDayInvoice = (day: any, orderTitle: string, email = false) => {
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

const downloadOrderTotalInvoice = (order: any, email = false) => {
    const merged: Record<string, any> = {};
    let invoiceTotalExpense = 0;
    let invoiceTotalLoss = 0;

    order.dailyBreakdown.forEach((day: any) => {
        day.items.forEach((item: any) => {
            const id = item.product.id;
            if (!merged[id]) {
                const markupPrice = item.product.price * 1.25;
                merged[id] = { product: { ...item.product, price: markupPrice }, prepared: 0, consumed: 0 };
            }
            merged[id].prepared += item.prepared;
            merged[id].consumed += item.consumed;
        });
    });

    const allItems = Object.values(merged);
    allItems.forEach((i: any) => {
        const sobrante = Math.max(0, i.prepared - i.consumed);
        invoiceTotalExpense += i.consumed * i.product.price;
        invoiceTotalLoss += sobrante * i.product.price;
    });

    const dateRange = order.dailyBreakdown.length > 1
        ? `${order.dailyBreakdown[0].date} → ${order.dailyBreakdown[order.dailyBreakdown.length - 1].date}`
        : order.dailyBreakdown[0]?.date || '';
    const rows = buildCategoryRows(allItems);

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Factura Total – ${order.title}</title>
<style>${INVOICE_STYLES}</style></head>
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
      <div class="val">${order.dailyBreakdown.length} ${order.dailyBreakdown.length === 1 ? 'día' : 'días'}</div>
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
      <div class="total-amount">${invoiceTotalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
    </div>
    <div class="total-box total-merma">
      <div class="total-label">Merma Total del Evento</div>
      <div class="total-amount">${invoiceTotalLoss.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
    </div>
  </div>
  <div class="footer">Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <script>window.onload = function() { window.print(); }</script>
</body></html>`;
    return email ? sendViaGmail(html, `Factura-Total-${order.title}.html`) : Promise.resolve(openInvoice(html));
};

export const FinancialFeriaReport: React.FC = () => {
    const { historicalLogs } = useAppContext();
    const { addToast } = useToast();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
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

    const orderStats = useMemo(() => {
        const stats: Record<string, any> = {};

        const isGenericFeria = (title: string) => {
            const genericNames = [
                'Feria de Guadalcacín', 'Feria de Jerez', 'Feria de Tarifa',
                'Feria de paterna', 'Feria de torrecera', 'Feria de San Fernando',
                'Feria de Algeciras', 'Feria de Chipiona'
            ];
            return genericNames.some(name => title === name) || (title.startsWith('Feria de') && !title.includes(' - Caseta: '));
        };

        const uniqueTitles = Array.from(new Set(historicalLogs.map(log => log.eventTitle || 'Pedido General')))
            .filter(title => !isGenericFeria(title));

        uniqueTitles.forEach(title => {
            let expense = 0;
            let loss = 0;
            let preparedEur = 0;
            const productTotals: Record<string, any> = {};
            const dailyBreakdown: Record<string, any> = {};

            const logs = historicalLogs.filter(log => (log.eventTitle || 'Pedido General') === title);

            logs.forEach(log => {
                if (!dailyBreakdown[log.date]) {
                    dailyBreakdown[log.date] = { date: log.date, expense: 0, loss: 0, items: [] };
                }

                log.items.forEach(item => {
                    const sobrante = Math.max(0, item.prepared - item.consumed);
                    const cost = item.consumed * item.product.price;
                    const lossEur = sobrante * item.product.price;
                    const prepVal = item.prepared * item.product.price;

                    expense += cost;
                    loss += lossEur;
                    preparedEur += prepVal;

                    if (!productTotals[item.product.id]) {
                        productTotals[item.product.id] = { name: item.product.name, consumed: 0, loss: 0, cost: 0 };
                    }
                    productTotals[item.product.id].consumed += item.consumed;
                    productTotals[item.product.id].loss += sobrante;
                    productTotals[item.product.id].cost += cost;

                    dailyBreakdown[log.date].expense += cost;
                    dailyBreakdown[log.date].loss += lossEur;
                    dailyBreakdown[log.date].items.push(item);
                });
            });

            stats[title] = {
                title,
                expense,
                loss,
                efficiency: preparedEur > 0 ? Math.round((expense / preparedEur) * 100) : 0,
                productTotals: Object.values(productTotals).sort((a: any, b: any) => b.cost - a.cost),
                dailyBreakdown: Object.values(dailyBreakdown).sort((a: any, b: any) => a.date.localeCompare(b.date)),
            };
        });

        return stats;
    }, [historicalLogs]);

    const selectedOrder = orderStats[selectedOrderId];
    const sortedTitles = Object.keys(orderStats).sort();

    return (
        <div className="animate-fade-in space-y-8 mt-6">
            <div className="card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl mb-1">📊 Análisis Financiero Histórico</h2>
                        <p className="text-text-secondary text-sm">Gestiona y consulta el desglose económico de ferias y pedidos anteriores.</p>
                    </div>
                    <div className="w-full sm:w-80">
                        <select
                            className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full font-bold"
                            value={selectedOrderId}
                            onChange={(e) => { setSelectedOrderId(e.target.value); setExpandedDay(null); }}
                        >
                            <option value="">-- Seleccionar Pedido --</option>
                            {sortedTitles.map(title => (
                                <option key={title} value={title}>{title}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {selectedOrder ? (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-bg-elevated/30 p-4 rounded border border-white/10">
                        <h3 className="text-xl font-bold text-accent-blue">🏠 {selectedOrder.title}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="card text-center bg-bg-elevated/20">
                            <div className="text-[10px] uppercase text-text-muted mb-1 font-bold">Consumo Total</div>
                            <div className="text-3xl font-bold text-accent-blue">{selectedOrder.expense.toLocaleString('es-ES')} €</div>
                        </div>
                        <div className="card text-center bg-bg-elevated/20">
                            <div className="text-[10px] uppercase text-text-muted mb-1 font-bold">Merma Total</div>
                            <div className="text-3xl font-bold text-accent-red">{selectedOrder.loss.toLocaleString('es-ES')} €</div>
                        </div>
                        <div className="card text-center bg-bg-elevated/20">
                            <div className="text-[10px] uppercase text-text-muted mb-1 font-bold">Eficiencia</div>
                            <div className="text-3xl font-bold text-accent-green">{selectedOrder.efficiency}%</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-sm font-bold uppercase text-text-muted mb-4 border-l-2 border-accent-blue pl-3">Desglose por Producto</h4>
                            <div className="bg-bg-elevated/20 border border-white/5 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-white/5 text-text-muted uppercase">
                                        <tr>
                                            <th className="p-3">Producto</th>
                                            <th className="p-3 text-center">Consumo</th>
                                            <th className="p-3 text-center">Merma</th>
                                            <th className="p-3 text-right">Coste (€)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {selectedOrder.productTotals.map((prod: any) => (
                                            <tr key={prod.name} className="hover:bg-white/5">
                                                <td className="p-3 font-bold">{prod.name}</td>
                                                <td className="p-3 text-center">{prod.consumed}</td>
                                                <td className="p-3 text-center text-accent-red">{prod.loss}</td>
                                                <td className="p-3 text-right font-bold">{prod.cost.toLocaleString('es-ES')} €</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-bold uppercase text-text-muted border-l-2 border-accent-red pl-3">Facturas por Día</h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => downloadOrderTotalInvoice(selectedOrder)}
                                        className="text-[11px] px-3 py-1.5 rounded border border-accent-green/40 text-accent-green hover:bg-accent-green/10 transition-all font-bold"
                                    >
                                        🖨️ Imprimir Total
                                    </button>
                                    <button
                                        disabled={!!sendingEmail}
                                        onClick={() => handleEmail(() => downloadOrderTotalInvoice(selectedOrder, true), 'total')}
                                        className="text-[11px] px-3 py-1.5 rounded border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-all font-bold disabled:opacity-50"
                                    >
                                        {sendingEmail === 'total' ? '⏳ Enviando...' : '✉️ Email'}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-bg-elevated/20 border border-white/5 rounded-lg overflow-x-auto">
                                <table className="w-full text-left text-xs min-w-[500px]">
                                    <thead className="bg-white/5 text-text-muted uppercase">
                                        <tr>
                                            <th className="p-3">Día</th>
                                            <th className="p-3">Consumo</th>
                                            <th className="p-3 text-center">Merma</th>
                                            <th className="p-3 text-right">Imprimir</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {selectedOrder.dailyBreakdown.map((day: any) => {
                                            const isOpen = expandedDay === day.date;
                                            return (
                                                <React.Fragment key={day.date}>
                                                    <tr
                                                        className="hover:bg-white/5 cursor-pointer select-none"
                                                        onClick={() => setExpandedDay(isOpen ? null : day.date)}
                                                    >
                                                        <td className="p-3 font-bold tracking-tight text-accent-blue">
                                                            <span className="mr-1 text-text-muted">{isOpen ? '▾' : '▸'}</span>
                                                            {day.date}
                                                        </td>
                                                        <td className="p-3 font-bold">{day.expense.toLocaleString('es-ES')} €</td>
                                                        <td className="p-3 text-center text-accent-red font-bold">{day.loss.toLocaleString('es-ES')} €</td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); downloadDayInvoice(day, selectedOrder.title); }}
                                                                    className="text-[11px] px-3 py-1 rounded border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10 transition-all font-bold"
                                                                >
                                                                    🖨️ Imprimir
                                                                </button>
                                                                <button
                                                                    disabled={!!sendingEmail}
                                                                    onClick={(e) => { e.stopPropagation(); handleEmail(() => downloadDayInvoice(day, selectedOrder.title, true), day.date); }}
                                                                    className="text-[11px] px-3 py-1 rounded border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 transition-all font-bold disabled:opacity-50"
                                                                >
                                                                    {sendingEmail === day.date ? '⏳ Enviando...' : '✉️ Email'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isOpen && (
                                                        <tr>
                                                            <td colSpan={4} className="p-0 bg-white/[0.03]">
                                                                <div className="px-4 py-3 border-t border-white/10">
                                                                    {(() => {
                                                                        const byCategory: Record<string, any[]> = {};
                                                                        day.items.forEach((item: any) => {
                                                                            const cat = item.product.category || 'Sin categoría';
                                                                            if (!byCategory[cat]) byCategory[cat] = [];
                                                                            byCategory[cat].push(item);
                                                                        });
                                                                        return Object.entries(byCategory)
                                                                            .sort(([a], [b]) => a.localeCompare(b, 'es'))
                                                                            .map(([cat, catItems]) => (
                                                                                <div key={cat} className="mb-3 last:mb-0">
                                                                                    <div className="text-[9px] uppercase font-black tracking-widest text-text-muted mb-1 pl-1">{cat}</div>
                                                                                    <table className="w-full text-xs">
                                                                                        <tbody>
                                                                                            {catItems.map((item: any) => {
                                                                                                const sobrante = Math.max(0, item.prepared - item.consumed);
                                                                                                const cost = item.consumed * item.product.price;
                                                                                                return (
                                                                                                    <tr key={item.product.id} className="border-b border-white/5 last:border-0">
                                                                                                        <td className="py-1.5 pl-2 font-medium">{item.product.name}</td>
                                                                                                        <td className="py-1.5 text-center text-text-muted">{item.prepared} prep</td>
                                                                                                        <td className="py-1.5 text-center">{item.consumed} cons</td>
                                                                                                        <td className="py-1.5 text-center text-accent-red">{sobrante} sob</td>
                                                                                                        <td className="py-1.5 text-right font-bold pr-2">{cost.toLocaleString('es-ES')} €</td>
                                                                                                    </tr>
                                                                                                );
                                                                                            })}
                                                                                        </tbody>
                                                                                    </table>
                                                                                </div>
                                                                            ));
                                                                    })()}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card py-20 text-center opacity-60 italic text-text-secondary">
                    Selecciona un pedido para visualizar el análisis financiero detallado.
                </div>
            )}
        </div>
    );
};
