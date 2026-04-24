import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { DailyLog, InventoryItem } from '../../types';

export const ConsumptionLog: React.FC<{ 
    currentLog?: DailyLog, 
    aggregatedLogs?: DailyLog[],
    onClose?: () => void 
}> = ({ currentLog, aggregatedLogs, onClose }) => {
    const { logConsumption } = useAppContext();
    const { addToast } = useToast();

    // sobrantes[productId] = units leftover (to return to warehouse)
    const [sobrantes, setSobrantes] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');

    if (!currentLog && (!aggregatedLogs || aggregatedLogs.length === 0)) return null;

    // Aggregate items if multiple logs are provided
    const items = React.useMemo(() => {
        if (currentLog) return currentLog.items;
        
        const aggregated: Record<string, InventoryItem> = {};
        aggregatedLogs?.forEach(log => {
            log.items.forEach(item => {
                if (!aggregated[item.product.id]) {
                    aggregated[item.product.id] = { ...item };
                } else {
                    aggregated[item.product.id].prepared += item.prepared;
                }
            });
        });
        return Object.values(aggregated);
    }, [currentLog, aggregatedLogs]);

    const displayDate = currentLog?.date || (aggregatedLogs && aggregatedLogs.length > 0 ? aggregatedLogs[0].date : '');
    const displayTitle = currentLog?.eventTitle || (aggregatedLogs && aggregatedLogs.length > 0 ? aggregatedLogs[0].eventTitle : '');

    const handleChange = (productId: string, value: string, maxPrepared: number) => {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed) || value === '') {
            setSobrantes(prev => { const n = { ...prev }; delete n[productId]; return n; });
            return;
        }
        setSobrantes(prev => ({ ...prev, [productId]: Math.max(0, Math.min(parsed, maxPrepared)) }));
    };

    const handleEndDay = async () => {
        const confirmMsg = aggregatedLogs 
            ? `¿Seguro que deseas realizar la DEVOLUCIÓN TOTAL? Esto cerrará ${aggregatedLogs.length} pedidos de esta feria.`
            : '¿Seguro que deseas finalizar el servicio? Esto guardará los sobrantes.';
            
        if (!window.confirm(confirmMsg)) return;
        if (isSaving) return;

        setIsSaving(true);
        try {
            const itemsWithConsumption: InventoryItem[] = items.map(item => {
                const leftover = sobrantes[item.product.id] ?? 0;
                return {
                    ...item,
                    consumed: Math.max(0, item.prepared - leftover)
                };
            });

            if (currentLog) {
                await logConsumption(currentLog.id, itemsWithConsumption);
            } else if (aggregatedLogs) {
                // To distribute consumption accurately without rounding errors:
                // For each product, we track how much consumption has been assigned so far.
                const productConsumptionAssigned: Record<string, number> = {};

                for (let i = 0; i < aggregatedLogs.length; i++) {
                    const log = aggregatedLogs[i];
                    const isLast = i === aggregatedLogs.length - 1;
                    
                    const logItems: InventoryItem[] = log.items.map(item => {
                        const totalItem = items.find(it => it.product.id === item.product.id)!;
                        const totalConsumed = Math.max(0, totalItem.prepared - (sobrantes[item.product.id] ?? 0));
                        
                        let assigned = 0;
                        if (isLast) {
                            // Last log takes the remainder
                            assigned = totalConsumed - (productConsumptionAssigned[item.product.id] ?? 0);
                        } else {
                            // Others take a proportional share rounded
                            assigned = Math.round((totalConsumed * item.prepared) / totalItem.prepared);
                        }
                        
                        productConsumptionAssigned[item.product.id] = (productConsumptionAssigned[item.product.id] ?? 0) + assigned;
                        return { ...item, consumed: Math.max(0, assigned) };
                    });
                    
                    await logConsumption(log.id, logItems);
                }
            }
            
            addToast('Devolución total completada con éxito', 'success');
            if (onClose) onClose();
        } catch (error) {
            console.error("Error finalizing return:", error);
            addToast('Error al guardar la devolución', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const totalSobrantes = items.reduce((sum, item) => sum + (sobrantes[item.product.id] ?? 0), 0);

    const visibleItems = search.trim() === ''
        ? items
        : items.filter(item => item.product.name.toLowerCase().includes(search.trim().toLowerCase()));

    return (
        <div className="card">
            <div className="flex justify-between items-start mb-6 gap-3">
                <div>
                    <h2 className="text-2xl font-bold mb-1">{aggregatedLogs ? '🏁 Devolución Total' : '📦 Productos Sobrantes'}</h2>
                    <p className="text-text-muted text-sm">
                        {aggregatedLogs 
                            ? `Indica el stock TOTAL sobrante tras finalizar la feria ${displayTitle}.` 
                            : 'Indica cuántas unidades han sobrado de cada producto para devolverlas al almacén.'}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="badge badge-green shrink-0">{displayDate}</span>
                    {aggregatedLogs && <span className="badge badge-blue">Suma de {aggregatedLogs.length} pedidos</span>}
                </div>
            </div>

            {aggregatedLogs && (
                <div className="bg-accent-blue/10 border border-accent-blue/20 p-4 rounded-lg mb-6 text-sm">
                    <p className="flex items-center gap-2">
                        <span className="text-lg">ℹ️</span>
                        Se han acumulado todos los productos enviados durante los {aggregatedLogs.length} días de feria para realizar un cierre global.
                    </p>
                </div>
            )}

            {/* Product search */}
            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-bg-primary/50 border border-white/20 rounded-lg p-3 pl-10 text-white outline-none focus:border-accent-blue placeholder:text-text-muted"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white text-sm"
                        title="Limpiar búsqueda"
                    >✕</button>
                )}
            </div>

            <div className="flex flex-col gap-3 mb-6">
                {visibleItems.length === 0 && (
                    <p className="text-text-muted text-center py-6 text-sm">
                        No hay productos que coincidan con "{search}".
                    </p>
                )}
                {visibleItems.map(item => {
                    const leftover = sobrantes[item.product.id] ?? 0;
                    return (
                        <div key={item.product.id} className="flex items-center justify-between p-4 border border-white/10 rounded-lg bg-bg-primary/50 gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-lg leading-tight truncate">{item.product.name}</div>
                                <span className="badge badge-blue mt-1">Total Enviado: {item.prepared}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-lg flex items-center justify-center transition-colors"
                                    onClick={() => setSobrantes(prev => ({ ...prev, [item.product.id]: Math.max(0, (prev[item.product.id] ?? 0) - 1) }))}
                                >−</button>
                                <input
                                    type="number"
                                    min="0"
                                    max={item.prepared}
                                    className={`w-16 text-center text-xl font-bold py-1.5 rounded border bg-bg-elevated/30 outline-none focus:border-accent-blue transition-colors ${leftover > 0 ? 'border-accent-blue text-accent-blue' : 'border-white/10 text-text-muted'}`}
                                    value={sobrantes[item.product.id] === undefined ? '' : leftover}
                                    placeholder="0"
                                    onChange={e => handleChange(item.product.id, e.target.value, item.prepared)}
                                />
                                <button
                                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-accent-blue/40 text-white font-bold text-lg flex items-center justify-center transition-colors"
                                    onClick={() => setSobrantes(prev => ({ ...prev, [item.product.id]: Math.min(item.prepared, (prev[item.product.id] ?? 0) + 1) }))}
                                >+</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between mb-4 text-sm text-text-muted">
                <span>Total unidades a devolver:</span>
                <span className="font-bold text-accent-blue text-base">{totalSobrantes}</span>
            </div>

            <button 
                className={`btn w-full py-4 text-lg shadow-lg flex items-center justify-center gap-2 ${aggregatedLogs ? 'btn-primary shadow-accent-blue/20' : 'btn-danger shadow-accent-red/20'}`} 
                onClick={handleEndDay}
                disabled={isSaving}
            >
                {isSaving ? <span className="animate-spin text-lg">⏳</span> : null}
                {isSaving 
                    ? 'Procesando...' 
                    : aggregatedLogs 
                        ? '🏁 Finalizar Feria y Devolver Todo' 
                        : '🔒 Enviar Sobrantes y Finalizar'}
            </button>
        </div>
    );
};
