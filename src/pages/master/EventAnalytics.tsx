import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, Lock, Store, TrendingDown, Undo2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export const EventAnalytics: React.FC = () => {
    const { events = [], historicalLogs, role } = useAppContext();
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [expandedCaseta, setExpandedCaseta] = useState<string | null>(null);

    const eventStats = useMemo(() => {
        const groupedEvents: Record<string, { days: Set<string>, types: Set<string>, casetas: Set<string> }> = {};
        const ordersOnly = events.filter(e => e.type === 'ORDER');

        ordersOnly.forEach(evt => {
            const parts = evt.title.split(' - Caseta: ');
            const feriaName = parts[0];
            const casetaName = parts.length > 1 ? parts[1] : null;

            if (!groupedEvents[feriaName]) {
                groupedEvents[feriaName] = { days: new Set(), types: new Set(), casetas: new Set() };
            }
            groupedEvents[feriaName].days.add(evt.date);
            groupedEvents[feriaName].types.add(evt.type);
            if (casetaName) groupedEvents[feriaName].casetas.add(casetaName);
        });

        return Object.entries(groupedEvents).map(([title, data]) => {
            let totalExpenses = 0;
            let totalDevoluciones = 0;
            let itemsCount = 0;

            const dailyStats: Record<string, {
                date: string,
                gastos: number,
                devoluciones: number,
                devolucionesUnits: number,
                casetas: Record<string, {
                    name: string,
                    gastos: number,
                    devoluciones: number,
                    devolucionesUnits: number,
                    items: {
                        name: string,
                        consumed: number,
                        leftover: number,
                        price: number
                    }[]
                }>
            }> = {};

            const casetaTotals: Record<string, {
                name: string,
                gastos: number,
                devoluciones: number,
                items: Record<string, { name: string, consumed: number, leftover: number, price: number }>
            }> = {};

            Array.from(data.days).sort().forEach(d => {
                dailyStats[d] = { date: d, gastos: 0, devoluciones: 0, devolucionesUnits: 0, casetas: {} };
            });

            historicalLogs.forEach(log => {
                if (data.days.has(log.date)) {
                    const logParts = (log.eventTitle || '').split(' - Caseta: ');
                    const logFeria = logParts[0];
                    const logCaseta = logParts.length > 1 ? logParts[1] : 'S/N';

                    if (logFeria === title || !log.eventTitle) {
                        if (!dailyStats[log.date].casetas[logCaseta]) {
                            dailyStats[log.date].casetas[logCaseta] = {
                                name: logCaseta,
                                gastos: 0,
                                devoluciones: 0,
                                devolucionesUnits: 0,
                                items: []
                            };
                        }

                        if (!casetaTotals[logCaseta]) {
                            casetaTotals[logCaseta] = {
                                name: logCaseta,
                                gastos: 0,
                                devoluciones: 0,
                                items: {}
                            };
                        }

                        log.items.forEach(item => {
                            itemsCount++;
                            const gastoReal = item.consumed * item.product.price;
                            totalExpenses += gastoReal;
                            dailyStats[log.date].gastos += gastoReal;
                            dailyStats[log.date].casetas[logCaseta].gastos += gastoReal;
                            casetaTotals[logCaseta].gastos += gastoReal;

                            const sobrante = Math.max(0, item.prepared - item.consumed);
                            
                            dailyStats[log.date].casetas[logCaseta].items.push({
                                name: item.product.name,
                                consumed: item.consumed,
                                leftover: sobrante,
                                price: item.product.price
                            });

                            if (!casetaTotals[logCaseta].items[item.product.name]) {
                                casetaTotals[logCaseta].items[item.product.name] = {
                                    name: item.product.name,
                                    consumed: 0,
                                    leftover: 0,
                                    price: item.product.price
                                };
                            }
                            casetaTotals[logCaseta].items[item.product.name].consumed += item.consumed;
                            casetaTotals[logCaseta].items[item.product.name].leftover += sobrante;

                            if (sobrante > 0) {
                                const devVal = sobrante * item.product.price;
                                totalDevoluciones += devVal;
                                dailyStats[log.date].devoluciones += devVal;
                                dailyStats[log.date].devolucionesUnits += sobrante;
                                
                                dailyStats[log.date].casetas[logCaseta].devoluciones += devVal;
                                dailyStats[log.date].casetas[logCaseta].devolucionesUnits += sobrante;
                                casetaTotals[logCaseta].devoluciones += devVal;
                            }
                        });
                    }
                }
            });

            const hasEvent = data.types.has('EVENT');
            const hasOrder = data.types.has('ORDER');
            let displayTypeDesc = 'FERIA / EVENTO';
            if (hasEvent && hasOrder) displayTypeDesc = 'FERIA + PEDIDO';
            else if (hasOrder && !hasEvent) displayTypeDesc = 'PEDIDO AGRUPADO';

            return {
                title,
                typeDesc: displayTypeDesc,
                daysCount: data.days.size,
                casetasCount: data.casetas.size,
                casetasList: Array.from(data.casetas),
                firstDate: Array.from(data.days).sort()[0] || '9999-12-31',
                totalExpenses,
                totalDevoluciones,
                itemsCount,
                dailyBreakdown: Object.values(dailyStats)
                    .filter(d => d.gastos > 0 || d.devoluciones > 0)
                    .map(d => ({
                        ...d,
                        casetas: Object.values(d.casetas)
                    })),
                casetaBreakdown: Object.values(casetaTotals).map(c => ({
                    ...c,
                    items: Object.values(c.items).filter(it => it.consumed > 0 || it.leftover > 0)
                }))
            };
        }).sort((a, b) => a.firstDate.localeCompare(b.firstDate));
    }, [events, historicalLogs]);

    const handleEventExpand = (title: string) => {
        setExpandedEvent(expandedEvent === title ? null : title);
        setExpandedDate(null);
        setExpandedCaseta(null);
    };

    const handleDateExpand = (eventTitle: string, date: string) => {
        const id = `${eventTitle}-${date}`;
        setExpandedDate(expandedDate === id ? null : id);
        setExpandedCaseta(null);
    };

    const ordersOnly = events.filter(e => e.type === 'ORDER');
    if (ordersOnly.length === 0) {
        return (
            <div className="card animate-fade-in">
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <CalendarDays size={20} strokeWidth={2} />
                    </div>
                    <p className="text-text-muted mb-0">Aún no se han registrado Pedidos operacionales en el Punto de Venta para analizar.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="grid gap-6">
                {eventStats.map((stat, i) => {
                    const isExpanded = expandedEvent === stat.title;

                    return (
                        <div
                            key={i}
                            className={`card relative overflow-hidden transition-all duration-300 cursor-pointer ${isExpanded ? 'border-accent-blue shadow-lg ring-1 ring-accent-blue/50' : 'hover:border-accent-blue/50 group'}`}
                            onClick={() => handleEventExpand(stat.title)}
                        >
                            <div className="flex justify-between items-start gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <span className="badge badge-blue gap-1.5">
                                            <CalendarDays size={12} strokeWidth={2.4} />
                                            {stat.typeDesc}
                                        </span>
                                        <span className="text-xs text-text-muted">{stat.daysCount} días configurados</span>
                                    </div>
                                    <h3 className="text-2xl font-bold line-clamp-2">{stat.title}</h3>
                                    {stat.casetasCount > 0 && (
                                        <div className="flex items-center gap-1.5 text-sm text-accent-blue/80 font-medium mt-1">
                                            <Store size={14} strokeWidth={2.2} className="shrink-0" />
                                            <span>Casetas: {stat.casetasList.join(', ')}</span>
                                        </div>
                                    )}
                                    <p className="text-text-muted text-sm mt-1">
                                        {stat.itemsCount > 0 ? 'Haz clic para ver el desglose diario' : 'Aún no hay registros realizados para estas fechas'}
                                    </p>
                                </div>

                                {stat.itemsCount > 0 && (
                                    <div className="bg-bg-elevated/60 p-3 rounded-xl border border-accent-blue/20 text-right shrink-0">
                                        <div className="flex items-center justify-end gap-1.5 text-xs text-text-muted uppercase tracking-wider mb-1">
                                            <TrendingDown size={14} strokeWidth={2.2} className="text-accent-blue" />
                                            Devoluciones
                                        </div>
                                        <div className="text-2xl font-bold text-accent-blue num">{stat.totalDevoluciones.toLocaleString('es-ES')} €</div>
                                    </div>
                                )}
                            </div>

                            {/* Summary cards — only Costos and Devoluciones */}
                            {stat.itemsCount > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-white/5 pt-4 text-center">
                                    <div className="bg-bg-elevated/30 p-3 rounded-lg">
                                        <div className="text-xs text-text-muted mb-1">Costo Mercancía Consumida</div>
                                        <div className="text-lg font-bold text-accent-red num">{stat.totalExpenses.toLocaleString('es-ES')} €</div>
                                    </div>
                                    <div className="bg-bg-elevated/30 p-3 rounded-lg">
                                        <div className="text-xs text-text-muted mb-1">Total Devoluciones (valor)</div>
                                        <div className="text-lg font-bold text-accent-blue num">{stat.totalDevoluciones.toLocaleString('es-ES')} €</div>
                                    </div>
                                </div>
                            )}

                            {stat.itemsCount === 0 && (
                                <div className="text-center p-4 bg-bg-elevated/30 rounded-lg border-dashed border border-white/10 text-text-muted text-sm mt-4">
                                    No se encontraron jornadas finalizadas para este evento. Asegúrate de cerrar y auditar la jornada diaria en el calendario histórico.
                                </div>
                            )}

                            {/* DAILY BREAKDOWN (expandable) */}
                            {isExpanded && stat.itemsCount > 0 && role === 'MASTER' && (
                                <div className="mt-6 pt-6 border-t border-white/10 animate-fade-in cursor-default" onClick={e => e.stopPropagation()}>
                                    <h4 className="text-lg font-bold mb-4 flex items-center gap-3">
                                        <span className="icon-chip icon-chip-blue">
                                            <CalendarDays size={16} strokeWidth={2.2} />
                                        </span>
                                        <span>Desglose por Día</span>
                                    </h4>
                                    <div className="table-wrap">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Fecha / Caseta / Producto</th>
                                                    <th className="text-right">Utilizado</th>
                                                    <th className="text-right">Sobrante</th>
                                                    <th className="text-right">Monto (€)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stat.dailyBreakdown.map(day => {
                                                    const isDayExpanded = expandedDate === `${stat.title}-${day.date}`;
                                                    
                                                    return (
                                                        <React.Fragment key={day.date}>
                                                            <tr
                                                                className={`cursor-pointer ${isDayExpanded ? 'bg-accent-blue/10' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDateExpand(stat.title, day.date);
                                                                }}
                                                            >
                                                                <td className="font-bold text-accent-blue">
                                                                    <div className="flex items-center gap-2">
                                                                        {isDayExpanded ? <ChevronDown size={14} strokeWidth={2.4} /> : <ChevronRight size={14} strokeWidth={2.4} />}
                                                                        {day.date}
                                                                    </div>
                                                                </td>
                                                                <td className="text-right text-text-muted italic">Ver casetas</td>
                                                                <td className="text-right text-accent-blue font-bold num">{day.devoluciones > 0 ? day.devoluciones.toLocaleString('es-ES') + ' €' : '-'}</td>
                                                                <td className="text-right font-bold num">{day.gastos.toLocaleString('es-ES')} €</td>
                                                            </tr>
                                                            {isDayExpanded && day.casetas.map(caseta => {
                                                                const casetaId = `${stat.title}-${day.date}-${caseta.name}`;
                                                                const isCasetaExpanded = expandedCaseta === casetaId;
                                                                const hasItems = caseta.items.length > 0;
                                                                
                                                                return (
                                                                    <React.Fragment key={caseta.name}>
                                                                        <tr
                                                                            className={`animate-fade-in cursor-pointer ${isCasetaExpanded ? 'bg-white/10' : 'bg-black/20'}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (hasItems) setExpandedCaseta(isCasetaExpanded ? null : casetaId);
                                                                            }}
                                                                        >
                                                                            <td className="px-8 py-2 text-text-muted font-medium">
                                                                                <div className="flex items-center gap-2">
                                                                                    {hasItems && (isCasetaExpanded ? <ChevronDown size={13} strokeWidth={2.4} /> : <ChevronRight size={13} strokeWidth={2.4} />)}
                                                                                    <Store size={13} strokeWidth={2.2} className="shrink-0" />
                                                                                    {caseta.name}
                                                                                </div>
                                                                            </td>
                                                                            <td className="py-2 text-right text-xs text-text-muted">{hasItems ? 'Ver productos' : 'Sin detalles'}</td>
                                                                            <td className="py-2 text-right text-accent-blue/70 text-xs num">{caseta.devoluciones > 0 ? caseta.devoluciones.toLocaleString('es-ES') + ' €' : '-'}</td>
                                                                            <td className="py-2 text-right text-text-muted text-xs num">{caseta.gastos.toLocaleString('es-ES')} €</td>
                                                                        </tr>
                                                                        {isCasetaExpanded && caseta.items.map((item, idx) => (
                                                                            <tr key={idx} className="animate-fade-in bg-white/[0.01] text-[11px]">
                                                                                <td className="px-12 py-1.5 text-text-muted/80">{item.name}</td>
                                                                                <td className="py-1.5 text-right num">{item.consumed > 0 ? item.consumed : '-'}</td>
                                                                                <td className="py-1.5 text-right text-accent-blue/50 num">{item.leftover > 0 ? item.leftover : '-'}</td>
                                                                                <td className="py-1.5 text-right text-text-muted/50 num">{(item.consumed * item.price).toLocaleString('es-ES')} €</td>
                                                                            </tr>
                                                                        ))}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {stat.dailyBreakdown.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="p-4 text-center text-text-muted">No hay registros diarios para mostrar.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            {stat.dailyBreakdown.length > 0 && (
                                                <tfoot>
                                                    <tr className="font-bold bg-bg-elevated/30">
                                                        <td className="px-4 py-3 border-t border-white/5">TOTALES ({stat.dailyBreakdown.length} días)</td>
                                                        <td className="px-4 py-3 text-right border-t border-white/5" colSpan={2}>Devoluciones: <span className="num">{stat.totalDevoluciones.toLocaleString('es-ES')} €</span></td>
                                                        <td className="px-4 py-3 text-right border-t border-white/5">Costo: <span className="num">{stat.totalExpenses.toLocaleString('es-ES')} €</span></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>

                                    {/* GLOBAL CASETA SUMMARY */}
                                    <div className="mt-10 pt-6 border-t border-white/10 animate-fade-in">
                                        <h4 className="text-lg font-bold mb-4 flex items-center gap-3 flex-wrap">
                                            <span className="icon-chip icon-chip-blue">
                                                <Store size={16} strokeWidth={2.2} />
                                            </span>
                                            <span>Devolución Total por Caseta</span>
                                            <span className="badge badge-blue">Resumen Feria</span>
                                        </h4>
                                        <div className="grid gap-4">
                                            {stat.casetaBreakdown.map((caseta, idx) => (
                                                <div key={idx} className="bg-bg-elevated/20 border border-white/5 rounded-xl p-4">
                                                    <div className="flex justify-between items-center gap-4 mb-3">
                                                        <h5 className="font-bold text-accent-blue mb-0 flex items-center gap-1.5">
                                                            <Store size={14} strokeWidth={2.2} className="shrink-0" />
                                                            Caseta: {caseta.name}
                                                        </h5>
                                                        <div className="text-right">
                                                            <div className="text-xs text-text-muted italic">Total Devolución</div>
                                                            <div className="font-bold num">{caseta.devoluciones.toLocaleString('es-ES')} €</div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {caseta.items.filter(it => it.leftover > 0).map((item, iidx) => (
                                                            <div key={iidx} className="bg-black/20 p-2 rounded-lg border border-white/5 flex justify-between items-center gap-2 text-xs">
                                                                <span className="text-white/70">{item.name}</span>
                                                                <span className="font-bold text-accent-blue inline-flex items-center gap-1 shrink-0">
                                                                    <Undo2 size={12} strokeWidth={2.4} />
                                                                    {item.leftover} uds
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {caseta.items.filter(it => it.leftover > 0).length === 0 && (
                                                            <div className="col-span-full py-2 text-center text-text-muted italic text-[10px]">
                                                                No hubo sobrantes registrados para esta caseta.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isExpanded && stat.itemsCount > 0 && role !== 'MASTER' && (
                                <div className="mt-6 pt-6 border-t border-white/10 animate-fade-in flex items-center justify-center gap-2 text-center text-text-muted text-sm cursor-default" onClick={e => e.stopPropagation()}>
                                    <Lock size={14} strokeWidth={2.2} className="shrink-0" />
                                    El desglose de productos por feria está reservado para Administradores.
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
