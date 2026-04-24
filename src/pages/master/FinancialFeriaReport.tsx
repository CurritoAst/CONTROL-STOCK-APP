import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { sendViaGmail } from '../../lib/gmailSend';
import { Product } from '../../types';

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

const buildCategoryRows = (items: any[], showMarkupColumns = false) => {
    const byCategory: Record<string, any[]> = {};
    items.forEach(item => {
        const cat = item.product.category || 'Sin categoría';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });
    return Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([cat, catItems]) => {
            const colspan = showMarkupColumns ? 7 : 6;
            const headerRow = `<tr class="cat-header"><td colspan="${colspan}">${cat}</td></tr>`;
            const itemRows = catItems.map((item: any) => {
                const sobrante = Math.max(0, item.prepared - item.consumed);
                const cost = item.consumed * item.product.price;

                let pricingCells = `<td class="right">${item.product.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>`;
                if (showMarkupColumns && item.product.originalPrice !== undefined) {
                    pricingCells = `
                        <td class="right" style="color: #888; font-size: 14px;">${item.product.originalPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                        <td class="right bold" style="color: #1d4ed8;">${item.product.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    `;
                }

                return `<tr>
                    <td class="indent"><strong>${item.product.name}</strong></td>
                    <td class="center">${item.prepared}</td>
                    <td class="center">${item.consumed}</td>
                    <td class="center sobrante">${sobrante}</td>
                    ${pricingCells}
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
    let invoiceTotalExpense = 0;
    let invoiceTotalLoss = 0;

    const markedUpItems = day.items.map((item: any) => {
        const sobrante = Math.max(0, item.prepared - item.consumed);
        const originalPrice = item.product.price;
        const markupPrice = originalPrice * 1.05;

        invoiceTotalExpense += item.consumed * markupPrice;
        invoiceTotalLoss += sobrante * markupPrice;

        return {
            ...item,
            product: { ...item.product, price: markupPrice, originalPrice: originalPrice }
        };
    });

    const rows = buildCategoryRows(markedUpItems, true);
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
      <th class="right">Base/ud</th>
      <th class="right">+5%/ud</th>
      <th class="right">Coste Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="total-box total-coste">
      <div class="total-label">Consumo Total</div>
      <div class="total-amount">${invoiceTotalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
    </div>
    <div class="total-box total-merma">
      <div class="total-label">Merma Total</div>
      <div class="total-amount">${invoiceTotalLoss.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
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
                const markupPrice = item.product.price * 1.05;
                merged[id] = { product: { ...item.product, price: markupPrice, originalPrice: item.product.price }, prepared: 0, consumed: 0 };
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
    const rows = buildCategoryRows(allItems, true);

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
      <th class="right">Base/ud</th>
      <th class="right">+5%/ud</th>
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

type EditRow = { product: Product; prepared: number; consumed: number };

export const FinancialFeriaReport: React.FC = () => {
    const { historicalLogs, products, editHistoricalLog } = useAppContext();
    const { addToast } = useToast();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [expandedDay, setExpandedDay] = useState<string | null>(null);
    const [sendingEmail, setSendingEmail] = useState<string | null>(null);
    const [editing, setEditing] = useState<{ logId: string; date: string; title: string } | null>(null);
    const [editRows, setEditRows] = useState<EditRow[]>([]);
    const [editSearch, setEditSearch] = useState('');
    const [addProductId, setAddProductId] = useState('');
    const [addPrepared, setAddPrepared] = useState('');
    const [addConsumed, setAddConsumed] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const openEditor = (logId: string, date: string, title: string) => {
        const log = historicalLogs.find(l => l.id === logId);
        if (!log) { addToast('No se encontró el pedido', 'error'); return; }
        setEditing({ logId, date, title });
        setEditRows(log.items.map(i => ({ product: i.product, prepared: i.prepared, consumed: i.consumed })));
        setEditSearch('');
        setAddProductId('');
        setAddPrepared('');
        setAddConsumed('');
    };

    const closeEditor = () => {
        setEditing(null);
        setEditRows([]);
    };

    const handleAddProduct = () => {
        const prod = products.find(p => p.id === addProductId);
        if (!prod) { addToast('Selecciona un producto', 'error'); return; }
        if (editRows.some(r => r.product.id === prod.id)) {
            addToast(`${prod.name} ya está en el pedido. Edítalo arriba.`, 'error');
            return;
        }
        const prep = parseInt(addPrepared, 10) || 0;
        const cons = parseInt(addConsumed, 10) || 0;
        if (prep <= 0) { addToast('El preparado debe ser mayor que 0', 'error'); return; }
        if (cons > prep) { addToast('Consumido no puede ser mayor que preparado', 'error'); return; }
        setEditRows(rows => [...rows, { product: prod, prepared: prep, consumed: cons }]);
        setAddProductId('');
        setAddPrepared('');
        setAddConsumed('');
    };

    const handleSaveEdit = async () => {
        if (!editing) return;
        const validRows = editRows.filter(r => r.prepared > 0);
        if (validRows.length === 0) { addToast('El pedido debe tener al menos un producto', 'error'); return; }
        setIsSavingEdit(true);
        try {
            await editHistoricalLog(editing.logId, validRows);
            addToast('Pedido actualizado correctamente', 'success');
            closeEditor();
        } catch (e: any) {
            addToast('Error al guardar: ' + (e.message || 'inténtalo de nuevo'), 'error');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const availableToAdd = useMemo(() => {
        const usedIds = new Set(editRows.map(r => r.product.id));
        return products.filter(p => !usedIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
    }, [products, editRows]);

    const filteredEditRows = editSearch.trim() === ''
        ? editRows
        : editRows.filter(r => r.product.name.toLowerCase().includes(editSearch.trim().toLowerCase()));

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

        const uniqueTitles = Array.from(new Set(historicalLogs.map(log => log.eventTitle || 'Pedido General')));

        uniqueTitles.forEach(title => {
            let expense = 0;
            let loss = 0;
            let preparedEur = 0;
            const productTotals: Record<string, any> = {};
            const dailyBreakdown: Record<string, any> = {};

            const logs = historicalLogs.filter(log => (log.eventTitle || 'Pedido General') === title);

            logs.forEach(log => {
                if (!dailyBreakdown[log.date]) {
                    dailyBreakdown[log.date] = { date: log.date, expense: 0, loss: 0, items: [], logIds: [] };
                }
                if (!dailyBreakdown[log.date].logIds.includes(log.id)) {
                    dailyBreakdown[log.date].logIds.push(log.id);
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

    const groupedTitles = sortedTitles.reduce((acc, title) => {
        let group = "Generales";
        let display = title;
        if (title.startsWith('Pedido ')) {
            const text = title.substring(7);
            if (text.includes(' - Caseta: ')) {
                const parts = text.split(' - Caseta: ');
                group = parts[0];
                display = parts[1];
            } else {
                group = text;
                display = 'Caseta Principal';
            }
        } else if (title.includes(' - Caseta: ')) {
            const parts = title.split(' - Caseta: ');
            group = parts[0];
            display = parts[1];
        } else if (/^Feria\s+de\s+/i.test(title)) {
            // Admin created orders titled directly "Feria de X" without caseta
            group = title;
            display = 'Caseta Principal';
        }
        if (!acc[group]) acc[group] = [];
        acc[group].push({ title, display });
        return acc;
    }, {} as Record<string, { title: string, display: string }[]>);

    return (
        <>
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
                            {Object.entries(groupedTitles).map(([groupName, items]) => (
                                <optgroup key={groupName} label={groupName}>
                                    {items.map(item => (
                                        <option key={item.title} value={item.title}>{item.display}</option>
                                    ))}
                                </optgroup>
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
                                                            <div className="flex gap-2 justify-end flex-wrap">
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
                                                                {day.logIds.length === 1 ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openEditor(day.logIds[0], day.date, selectedOrder.title); }}
                                                                        className="text-[11px] px-3 py-1 rounded border border-accent-green/40 text-accent-green hover:bg-accent-green/10 transition-all font-bold"
                                                                    >
                                                                        ✏️ Editar
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-[10px] px-2 py-1 text-text-muted italic" title="Hay múltiples pedidos en este día; edítalos individualmente desde Pedidos Diarios">
                                                                        {day.logIds.length} pedidos
                                                                    </span>
                                                                )}
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

        {/* ─── Edit Historical Log Modal ─── */}
        {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
                <div className="bg-bg-elevated border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="section-label mb-1">Editar pedido cerrado</div>
                            <h3 className="text-xl font-bold truncate" title={editing.title}>{editing.title}</h3>
                            <p className="text-sm text-text-muted mt-0.5">Día de servicio: <strong className="text-white">{editing.date}</strong></p>
                        </div>
                        <button
                            className="text-text-muted hover:text-white transition-colors p-1 text-lg shrink-0"
                            onClick={closeEditor}
                            disabled={isSavingEdit}
                            title="Cerrar"
                        >✕</button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">
                        <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-3 text-xs text-text-secondary">
                            <span className="text-accent-blue font-bold">ℹ️</span>{' '}
                            Sólo el consumido afecta al stock en pedidos cerrados. Si cambias el preparado, solo modificas la factura.
                        </div>

                        {/* Search over existing items */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar producto del pedido..."
                                value={editSearch}
                                onChange={e => setEditSearch(e.target.value)}
                                className="w-full bg-bg-primary/50 border border-white/20 rounded-lg p-3 pl-10 text-white outline-none focus:border-accent-blue placeholder:text-text-muted text-sm"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
                            {editSearch && (
                                <button
                                    onClick={() => setEditSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white text-sm"
                                >✕</button>
                            )}
                        </div>

                        {/* Existing items */}
                        <div>
                            <div className="section-label mb-2">Productos del pedido ({editRows.length})</div>
                            <div className="flex flex-col gap-2">
                                {filteredEditRows.length === 0 && (
                                    <div className="text-sm text-text-muted italic text-center py-6">
                                        {editSearch ? `No hay coincidencias con "${editSearch}".` : 'El pedido no tiene productos.'}
                                    </div>
                                )}
                                {filteredEditRows.map(row => {
                                    const rowIdx = editRows.findIndex(r => r.product.id === row.product.id);
                                    return (
                                        <div key={row.product.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-black/30 border border-white/5 rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold truncate" title={row.product.name}>{row.product.name}</div>
                                                <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{row.product.category || 'General'}</div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <label className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold uppercase text-text-muted tracking-wider mb-0.5">Preparado</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={row.prepared}
                                                        onChange={e => {
                                                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                                            setEditRows(rows => rows.map((r, i) => i === rowIdx ? { ...r, prepared: val } : r));
                                                        }}
                                                        className="w-20 text-center text-sm font-bold p-1.5 rounded border border-white/10 bg-bg-primary/60 outline-none focus:border-accent-blue"
                                                    />
                                                </label>
                                                <label className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold uppercase text-accent-blue tracking-wider mb-0.5">Consumido</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={row.prepared}
                                                        value={row.consumed}
                                                        onChange={e => {
                                                            const val = Math.max(0, Math.min(row.prepared, parseInt(e.target.value, 10) || 0));
                                                            setEditRows(rows => rows.map((r, i) => i === rowIdx ? { ...r, consumed: val } : r));
                                                        }}
                                                        className="w-20 text-center text-sm font-bold p-1.5 rounded border border-accent-blue/40 bg-accent-blue/10 text-accent-blue outline-none focus:border-accent-blue"
                                                    />
                                                </label>
                                                <div className="text-center">
                                                    <span className="text-[9px] font-bold uppercase text-accent-red tracking-wider block">Sobrante</span>
                                                    <span className="text-sm font-bold text-accent-red">{Math.max(0, row.prepared - row.consumed)}</span>
                                                </div>
                                                <button
                                                    onClick={() => setEditRows(rows => rows.filter((_, i) => i !== rowIdx))}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red hover:bg-accent-red/20 text-sm"
                                                    title="Quitar"
                                                >🗑</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Add new product */}
                        <div className="border-t border-white/5 pt-5">
                            <div className="section-label mb-2">Añadir producto al pedido</div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <select
                                    value={addProductId}
                                    onChange={e => setAddProductId(e.target.value)}
                                    className="flex-1 bg-bg-primary/50 border border-white/20 rounded-lg p-2.5 text-white outline-none focus:border-accent-blue text-sm"
                                >
                                    <option value="">-- Selecciona producto --</option>
                                    {availableToAdd.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.category || 'General'})</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    min="0"
                                    value={addPrepared}
                                    onChange={e => setAddPrepared(e.target.value)}
                                    placeholder="Prep."
                                    className="w-20 sm:w-24 bg-bg-primary/50 border border-white/20 rounded-lg p-2.5 text-white text-center text-sm outline-none focus:border-accent-blue"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    value={addConsumed}
                                    onChange={e => setAddConsumed(e.target.value)}
                                    placeholder="Cons."
                                    className="w-20 sm:w-24 bg-bg-primary/50 border border-accent-blue/40 rounded-lg p-2.5 text-accent-blue text-center text-sm outline-none focus:border-accent-blue"
                                />
                                <button
                                    onClick={handleAddProduct}
                                    disabled={!addProductId || !addPrepared}
                                    className="btn btn-outline border-accent-green/40 text-accent-green hover:bg-accent-green/10 shrink-0 disabled:opacity-50 text-xs py-2.5"
                                >
                                    + Añadir
                                </button>
                            </div>
                            <p className="text-[10px] text-text-muted mt-2">Al añadir un producto se descontará del stock por la cantidad consumida.</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/10 flex gap-3">
                        <button
                            className="btn btn-outline flex-1"
                            onClick={closeEditor}
                            disabled={isSavingEdit}
                        >
                            Cancelar
                        </button>
                        <button
                            className="btn btn-primary flex-1 disabled:opacity-50"
                            onClick={handleSaveEdit}
                            disabled={isSavingEdit}
                        >
                            {isSavingEdit ? '⏳ Guardando...' : '💾 Guardar Cambios'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
