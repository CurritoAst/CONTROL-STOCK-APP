import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';

const downloadDayInvoice = (day: any, orderTitle: string) => {
    const rows = day.items.map((item: any) => {
        const sobrante = Math.max(0, item.prepared - item.consumed);
        const cost = item.consumed * item.product.price;
        return `<tr>
            <td><strong>${item.product.name}</strong></td>
            <td class="center">${item.prepared}</td>
            <td class="center">${item.consumed}</td>
            <td class="center sobrante">${sobrante}</td>
            <td class="right">${item.product.price.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
            <td class="right bold">${cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${orderTitle} – ${day.date}</title>
<style>
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
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MACARIO<span>.</span></div>
      <div style="color:#555; margin-top:4px;">Factura Diaria de Pedido</div>
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
    <thead>
      <tr>
        <th>Producto</th>
        <th class="center">Preparado</th>
        <th class="center">Consumido</th>
        <th class="center">Sobrante</th>
        <th class="right">Precio/ud</th>
        <th class="right">Coste</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
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

  <div class="footer">
    Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
};

export const FinancialFeriaReport: React.FC = () => {
    const { historicalLogs } = useAppContext();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');

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
                            onChange={(e) => setSelectedOrderId(e.target.value)}
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
                            <h4 className="text-sm font-bold uppercase text-text-muted mb-4 border-l-2 border-accent-red pl-3">Facturas por Día</h4>
                            <div className="bg-bg-elevated/20 border border-white/5 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-white/5 text-text-muted uppercase">
                                        <tr>
                                            <th className="p-3">Día</th>
                                            <th className="p-3">Consumo</th>
                                            <th className="p-3 text-center">Merma</th>
                                            <th className="p-3 text-right">Descargar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {selectedOrder.dailyBreakdown.map((day: any) => (
                                            <tr key={day.date} className="hover:bg-white/5">
                                                <td className="p-3 font-bold tracking-tight text-accent-blue">{day.date}</td>
                                                <td className="p-3 font-bold">{day.expense.toLocaleString('es-ES')} €</td>
                                                <td className="p-3 text-center text-accent-red font-bold">{day.loss.toLocaleString('es-ES')} €</td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => downloadDayInvoice(day, selectedOrder.title)}
                                                        className="text-[11px] px-3 py-1 rounded border border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10 transition-all font-bold"
                                                    >
                                                        📄 Factura
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
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
