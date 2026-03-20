import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export const UsageReport: React.FC = () => {
    const { events = [], historicalLogs } = useAppContext();
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

    // Grouping analytics by Event Title (no prices)
    const eventStats = useMemo(() => {
        const groupedEvents: Record<string, { days: Set<string>, casetas: Set<string> }> = {};
        const ordersOnly = events.filter(e => e.type === 'ORDER');

        ordersOnly.forEach(evt => {
            const parts = evt.title.split(' - Caseta: ');
            const feriaName = parts[0];
            const casetaName = parts.length > 1 ? parts[1] : null;

            if (!groupedEvents[feriaName]) {
                groupedEvents[feriaName] = { days: new Set(), casetas: new Set() };
            }
            groupedEvents[feriaName].days.add(evt.date);
            if (casetaName) {
                groupedEvents[feriaName].casetas.add(casetaName);
            }
        });

        return Object.entries(groupedEvents).map(([title, data]) => {
            let totalConsumedItems = 0;
            let totalReturnedItems = 0;
            const productTotals: Record<string, { name: string, consumed: number, returned: number }> = {};

            const dailyStats: Record<string, {
                date: string,
                products: Record<string, { name: string, consumed: number, returned: number }>
            }> = {};

            const daysArray = Array.from(data.days).sort();

            daysArray.forEach(d => {
                dailyStats[d] = { date: d, products: {} };
            });

            historicalLogs.forEach(log => {
                if (data.days.has(log.date)) {
                    log.items.forEach(item => {
                        const sobrante = item.prepared - item.consumed;

                        totalConsumedItems += item.consumed;
                        totalReturnedItems += sobrante;

                        if (!productTotals[item.product.id]) {
                            productTotals[item.product.id] = { name: item.product.name, consumed: 0, returned: 0 };
                        }
                        productTotals[item.product.id].consumed += item.consumed;
                        productTotals[item.product.id].returned += sobrante;

                        if (!dailyStats[log.date].products[item.product.id]) {
                            dailyStats[log.date].products[item.product.id] = {
                                name: item.product.name,
                                consumed: 0,
                                returned: 0
                            };
                        }

                        dailyStats[log.date].products[item.product.id].consumed += item.consumed;
                        dailyStats[log.date].products[item.product.id].returned += sobrante;
                    });
                }
            });

            const hasAnyLogs = totalConsumedItems > 0 || totalReturnedItems > 0;

            return {
                title,
                daysCount: data.days.size,
                casetasCount: data.casetas.size,
                casetasList: Array.from(data.casetas),
                totalConsumedItems,
                totalReturnedItems,
                hasAnyLogs,
                productTotals: Object.values(productTotals).sort((a, b) => b.consumed - a.consumed),
                dailyBreakdown: Object.values(dailyStats).filter(d => Object.keys(d.products).length > 0)
            };
        }).sort((a, b) => b.totalConsumedItems - a.totalConsumedItems); // Sort by highest usage
    }, [events, historicalLogs]);

    const ordersOnly = events.filter(e => e.type === 'ORDER');
    if (ordersOnly.length === 0) {
        return (
            <div className="card text-center py-10 animate-fade-in">
                <p className="text-text-muted">Aún no hay pedidos registrados.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <h2 className="text-2xl font-bold mb-4">📦 Reporte de Uso de Productos</h2>
            <p className="text-text-muted mb-6">Desglose de cantidades consumidas y devueltas por evento.</p>

            <div className="grid gap-6">
                {eventStats.map((stat, i) => {
                    const isExpanded = expandedEvent === stat.title;

                    return (
                        <div
                            key={i}
                            className={`card relative overflow-hidden transition-all duration-300 cursor-pointer ${isExpanded ? 'border-accent-blue shadow-lg ring-1 ring-accent-blue/50' : 'hover:border-accent-blue/50 group'}`}
                            onClick={() => setExpandedEvent(isExpanded ? null : stat.title)}
                        >
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="badge bg-accent-blue/20 text-accent-blue">
                                            📅 {stat.daysCount} días
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-bold line-clamp-2">{stat.title}</h3>
                                    {stat.casetasCount > 0 && (
                                        <div className="text-sm text-accent-blue/80 font-medium mt-1">
                                            🏘️ Casetas: {stat.casetasList.join(', ')}
                                        </div>
                                    )}
                                    <p className="text-text-muted text-sm mt-1">{stat.hasAnyLogs ? 'Haz clic para ver el desglose por producto y día' : 'Aún no hay uso registrado para estas fechas'}</p>
                                </div>

                                {stat.hasAnyLogs && (
                                    <div className="flex gap-2 sm:flex-col sm:text-right w-full sm:w-auto mt-4 sm:mt-0">
                                        <div className="bg-bg-elevated p-3 rounded-lg border border-accent-blue/20 flex-1 sm:flex-none">
                                            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Gastado</div>
                                            <div className="text-xl font-bold text-accent-blue">{stat.totalConsumedItems} uds.</div>
                                        </div>
                                        <div className="bg-bg-elevated p-3 rounded-lg border border-accent-red/20 flex-1 sm:flex-none">
                                            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Devuelto</div>
                                            <div className="text-xl font-bold text-accent-red">{stat.totalReturnedItems} uds.</div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* DESGLOSE DIARIO (EXPANDIBLE) */}
                            {isExpanded && stat.hasAnyLogs && (
                                <div className="mt-6 pt-6 border-t border-white/10 animate-fade-in cursor-default" onClick={e => e.stopPropagation()}>

                                    {/* TOTALES POR PRODUCTO */}
                                    <div className="mb-8">
                                        <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <span>📊 Total del Evento por Producto</span>
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            {stat.productTotals.map(prod => (
                                                <div key={prod.name} className="flex flex-col bg-bg-elevated p-3 rounded-lg border border-white/5 shadow-sm">
                                                    <span className="font-bold text-sm mb-2 truncate" title={prod.name}>{prod.name}</span>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-accent-blue font-medium">Gastado: {prod.consumed}</span>
                                                        <span className="text-accent-red font-medium">Devuelto: {prod.returned}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* DESGLOSE POR DÍA */}
                                    <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <span>📅 Desglose por Día y Producto</span>
                                    </h4>

                                    <div className="space-y-6">
                                        {stat.dailyBreakdown.map(day => (
                                            <div key={day.date} className="bg-black/20 p-4 rounded-lg border border-white/5">
                                                <h5 className="font-bold text-accent-blue mb-3 border-b border-white/10 pb-2">{day.date}</h5>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {Object.values(day.products).map(prod => (
                                                        <div key={prod.name} className="flex justify-between items-center bg-bg-elevated/50 p-2 rounded">
                                                            <span className="text-sm font-medium mr-2 truncate" title={prod.name}>{prod.name}</span>
                                                            <div className="flex gap-2 shrink-0">
                                                                <span className="badge bg-accent-blue/10 text-accent-blue text-xs" title="Consumido">
                                                                    Gast: {prod.consumed}
                                                                </span>
                                                                {prod.returned > 0 && (
                                                                    <span className="badge bg-accent-red/10 text-accent-red text-xs" title="Devuelto / Sobrante">
                                                                        Dev: {prod.returned}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
