import React, { useMemo, useState } from 'react';
import { BarChart3, Tag, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export const ProductAnalytics: React.FC = () => {
    const { products, historicalLogs } = useAppContext();
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Calculate analytics dataset
    // Calculate analytics dataset and group by category
    const groupedAnalytics = useMemo(() => {
        const filteredLogs = historicalLogs.filter(log => {
            if (dateFrom && log.date < dateFrom) return false;
            if (dateTo && log.date > dateTo) return false;
            return true;
        });

        const stats = products.map(product => {
            let totalPrepared = 0;
            let totalConsumed = 0;
            let costGenerated = 0;

            filteredLogs.forEach(log => {
                const item = log.items.find(i => i.product.id === product.id);
                if (item) {
                    totalPrepared += item.prepared;
                    totalConsumed += item.consumed;
                    costGenerated += (item.consumed * item.product.price);
                }
            });

            const totalLeftover = totalPrepared - totalConsumed;
            const wastagePercent = totalPrepared > 0 ? ((totalLeftover / totalPrepared) * 100).toFixed(1) : '0.0';

            return {
                ...product,
                totalPrepared,
                totalConsumed,
                totalLeftover,
                wastagePercent,
                costGenerated
            };
        });

        // Group by category
        return stats.reduce((acc, stat) => {
            const cat = stat.category || 'General';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(stat);
            return acc;
        }, {} as Record<string, typeof stats>);
    }, [products, historicalLogs, dateFrom, dateTo]);

    const categories = Object.keys(groupedAnalytics).sort((a, b) => {
        if (a === 'General') return -1;
        if (b === 'General') return 1;
        return a.localeCompare(b);
    });

    const filteredCategories = selectedCategory === 'Todas' 
        ? categories 
        : categories.filter(c => c === selectedCategory);

    return (
        <div className="animate-fade-in content-auto-height">
            <div className="card mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3">
                        <span className="icon-chip icon-chip-blue mt-0.5">
                            <BarChart3 size={18} strokeWidth={2.2} />
                        </span>
                        <div>
                            <h2 className="text-2xl mb-2">Análisis de Trazabilidad por Producto</h2>
                            <p className="text-text-muted text-sm mb-0">Consulta el histórico acumulado de preparación, desgaste y pérdidas físicas por sección.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="py-2 px-3 text-sm rounded-lg w-full sm:w-48"
                        >
                            <option value="Todas">Todas las secciones</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="py-2 px-3 text-sm rounded-lg w-full sm:w-auto"
                                title="Desde"
                            />
                            <span className="text-text-muted shrink-0">—</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="py-2 px-3 text-sm rounded-lg w-full sm:w-auto"
                                title="Hasta"
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    className="text-text-muted hover:text-white shrink-0 transition-colors p-1"
                                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                                    title="Limpiar fechas"
                                    aria-label="Limpiar fechas"
                                ><X size={16} strokeWidth={2.2} /></button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                {filteredCategories.map(category => (
                    <div key={category} className="animate-fade-in">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="icon-chip icon-chip-blue">
                                <Tag size={16} strokeWidth={2.2} />
                            </span>
                            <h3 className="text-lg font-bold whitespace-nowrap mb-0">{category}</h3>
                            <div className="divider-gradient flex-1" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupedAnalytics[category].sort((a, b) => b.costGenerated - a.costGenerated).map(stat => (
                                <div key={stat.id} className="card relative overflow-hidden group hover:border-accent-blue/50 transition-colors bg-bg-elevated/30">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <h4 className="text-lg font-bold mb-1 line-clamp-2" title={stat.name}>{stat.name}</h4>
                                            <span className="text-[10px] uppercase tracking-wider text-text-muted">{stat.category}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Costo Total</div>
                                            <div className="text-xl font-bold text-accent-red num">{stat.costGenerated.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center border-t border-white/5 pt-4 relative z-10">
                                        <div>
                                            <div className="text-[10px] text-text-muted uppercase mb-1">Preparado</div>
                                            <div className="text-base font-bold num">{stat.totalPrepared}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-text-muted uppercase mb-1">Consumido</div>
                                            <div className="text-base font-bold text-accent-blue num">{stat.totalConsumed}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-text-muted uppercase mb-1">Sobrantes</div>
                                            <div className={`text-base font-bold num ${Number(stat.wastagePercent) > 30 ? 'text-accent-red' : 'text-accent-green'}`}>
                                                {stat.totalLeftover} <span className="text-[10px] font-normal">({stat.wastagePercent}%)</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        className="absolute bottom-0 left-0 h-1 bg-accent-red/30 transition-all duration-500"
                                        style={{ width: `${Math.min(100, Number(stat.wastagePercent))}%` }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {categories.length === 0 && (
                    <div className="card">
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <BarChart3 size={20} strokeWidth={2} />
                            </div>
                            <p className="text-text-muted mb-0">No hay productos en el catálogo para registrar analíticas.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
