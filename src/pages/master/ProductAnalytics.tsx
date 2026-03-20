import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export const ProductAnalytics: React.FC = () => {
    const { products, historicalLogs } = useAppContext();
    const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

    // Calculate analytics dataset
    // Calculate analytics dataset and group by category
    const groupedAnalytics = useMemo(() => {
        const stats = products.map(product => {
            let totalPrepared = 0;
            let totalConsumed = 0;
            let costGenerated = 0;

            historicalLogs.forEach(log => {
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
    }, [products, historicalLogs]);

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
                    <div>
                        <h2 className="text-2xl mb-2">📈 Análisis de Trazabilidad por Producto</h2>
                        <p className="text-text-secondary">Consulta el histórico acumulado de preparación, desgaste y pérdidas físicas por sección.</p>
                    </div>
                    <div className="w-full sm:w-auto">
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full sm:w-64"
                        >
                            <option value="Todas">Todas las secciones</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                {filteredCategories.map(category => (
                    <div key={category} className="animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                            <h3 className="text-xl font-bold text-accent-blue whitespace-nowrap">{category}</h3>
                            <div className="h-[1px] w-full bg-white/10" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
                            {groupedAnalytics[category].sort((a, b) => b.costGenerated - a.costGenerated).map(stat => (
                                <div key={stat.id} className="card relative overflow-hidden group hover:border-accent-blue/50 transition-colors bg-bg-elevated/30">
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div>
                                            <h4 className="text-lg font-bold mb-1 line-clamp-2" title={stat.name}>{stat.name}</h4>
                                            <span className="text-[10px] uppercase tracking-wider text-text-muted">{stat.category}</span>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Costo Total</div>
                                            <div className="text-xl font-bold text-accent-red">{stat.costGenerated.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 text-center border-t border-white/5 pt-4 relative z-10">
                                        <div>
                                            <div className="text-[10px] text-text-muted uppercase mb-1">Preparado</div>
                                            <div className="text-base font-bold">{stat.totalPrepared}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-text-muted uppercase mb-1">Consumido</div>
                                            <div className="text-base font-bold text-accent-blue">{stat.totalConsumed}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-text-muted uppercase mb-1">Sobrantes</div>
                                            <div className={`text-base font-bold ${Number(stat.wastagePercent) > 30 ? 'text-accent-red' : 'text-accent-green'}`}>
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
                    <div className="card text-center py-10">
                        <p className="text-text-muted">No hay productos en el catálogo para registrar analíticas.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
