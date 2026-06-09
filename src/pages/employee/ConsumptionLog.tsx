import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { DailyLog, InventoryItem, Product } from '../../types';
import { supabase } from '../../lib/supabaseClient';

export const ConsumptionLog: React.FC<{ 
    currentLog?: DailyLog, 
    aggregatedLogs?: DailyLog[],
    onClose?: () => void 
}> = ({ currentLog, aggregatedLogs, onClose }) => {
    const { logConsumption, products } = useAppContext();
    const { addToast } = useToast();

    // sobrantes[productId] = units leftover (to return to warehouse)
    const [sobrantes, setSobrantes] = useState<Record<string, number>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');

    // Products added on the fly (not part of the original pedido).
    type AddedRow = { product: Product; prepared: number; sobrante: number };
    const [addedItems, setAddedItems] = useState<AddedRow[]>([]);
    const [addOpen, setAddOpen] = useState(false);
    const [addProductId, setAddProductId] = useState('');
    const [addPrepared, setAddPrepared] = useState('');
    const [addSobrante, setAddSobrante] = useState('');
    const [addSearch, setAddSearch] = useState('');

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
                    aggregated[item.product.id].consumed += item.consumed;
                }
            });
        });
        return Object.values(aggregated);
    }, [currentLog, aggregatedLogs]);

    // Pre-populate inputs with existing sobrantes so re-opening Sobrantes on a
    // CLOSED/APPROVED log shows what was recorded last time instead of
    // silently wiping it on save.
    const sobrantesInitialised = React.useRef(false);
    React.useEffect(() => {
        if (sobrantesInitialised.current || items.length === 0) return;
        const initial: Record<string, number> = {};
        items.forEach(it => {
            const left = Math.max(0, it.prepared - it.consumed);
            if (left > 0) initial[it.product.id] = left;
        });
        if (Object.keys(initial).length > 0) setSobrantes(initial);
        sobrantesInitialised.current = true;
    }, [items]);

    const displayDate = currentLog?.date || (aggregatedLogs && aggregatedLogs.length > 0 ? aggregatedLogs[0].date : '');
    const displayTitle = currentLog?.eventTitle || (aggregatedLogs && aggregatedLogs.length > 0 ? aggregatedLogs[0].eventTitle : '');

    const existingProductIds = useMemo(() =>
        new Set([...items.map(it => it.product.id), ...addedItems.map(a => a.product.id)]),
        [items, addedItems]
    );

    const availableToAdd = useMemo(() => {
        const q = addSearch.trim().toLowerCase();
        return products
            .filter(p => !existingProductIds.has(p.id))
            .filter(p => q === '' || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products, existingProductIds, addSearch]);

    const handleAddRow = () => {
        const prod = products.find(p => p.id === addProductId);
        if (!prod) { addToast('Selecciona un producto', 'error'); return; }
        const prep = parseInt(addPrepared, 10) || 0;
        const sob = parseInt(addSobrante, 10) || 0;
        if (prep <= 0) { addToast('El preparado debe ser mayor que 0', 'error'); return; }
        if (sob > prep) { addToast('Sobrante no puede ser mayor que preparado', 'error'); return; }
        setAddedItems(arr => [...arr, { product: prod, prepared: prep, sobrante: sob }]);
        setAddProductId('');
        setAddPrepared('');
        setAddSobrante('');
        setAddSearch('');
    };

    const removeAddedRow = (productId: string) => {
        setAddedItems(arr => arr.filter(a => a.product.id !== productId));
    };

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

            // Insert any newly-added products before recording consumption so
            // they're already part of currentLog when refreshData fires.
            const targetLogId = currentLog?.id ?? aggregatedLogs?.[aggregatedLogs.length - 1].id;
            if (addedItems.length > 0 && targetLogId) {
                const rows = addedItems.map(it => ({
                    daily_log_id: targetLogId,
                    product_id: it.product.id,
                    prepared: it.prepared,
                    consumed: Math.max(0, it.prepared - it.sobrante),
                }));
                const { error: insErr } = await supabase.from('log_items').insert(rows);
                if (insErr) throw insErr;

                // Stock: for newly-added retroactive products subtract the full
                // prepared (consumido + sobrante out, no return), matching the
                // editHistoricalLog new-product semantics.
                for (const it of addedItems) {
                    if (it.prepared <= 0) continue;
                    const { data: fresh } = await supabase.from('products')
                        .select('stock').eq('id', it.product.id).single();
                    const cur = fresh?.stock ?? it.product.stock;
                    await supabase.from('products')
                        .update({ stock: Math.max(0, cur - it.prepared) })
                        .eq('id', it.product.id);
                }
            }

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

            {/* Newly added (not in the original pedido) */}
            {addedItems.length > 0 && (
                <div className="mb-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-green mb-2">Productos añadidos al pedido ({addedItems.length})</div>
                    <div className="flex flex-col gap-2">
                        {addedItems.map((row, idx) => (
                            <div key={row.product.id} className="flex items-center justify-between p-3 border border-accent-green/30 rounded-lg bg-accent-green/5 gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold leading-tight truncate flex items-center gap-2">
                                        {row.product.name}
                                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green">NUEVO</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                                        <span>Prep: <strong className="text-white">{row.prepared}</strong></span>
                                        <span>·</span>
                                        <span>Consumido: <strong className="text-accent-blue">{Math.max(0, row.prepared - row.sobrante)}</strong></span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <label className="flex flex-col items-center">
                                        <span className="text-[8px] uppercase text-accent-red font-bold">Sobrante</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max={row.prepared}
                                            value={row.sobrante}
                                            onChange={e => {
                                                const v = Math.max(0, Math.min(row.prepared, parseInt(e.target.value, 10) || 0));
                                                setAddedItems(arr => arr.map((r, i) => i === idx ? { ...r, sobrante: v } : r));
                                            }}
                                            className="w-14 text-center text-sm font-bold p-1 rounded border border-accent-red/40 bg-accent-red/10 text-accent-red outline-none"
                                        />
                                    </label>
                                    <button
                                        onClick={() => removeAddedRow(row.product.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red hover:bg-accent-red/20"
                                        title="Quitar"
                                    >🗑</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Toggle: add product not originally in the pedido */}
            <div className="mb-4">
                <button
                    onClick={() => setAddOpen(o => !o)}
                    className="text-xs font-bold text-accent-green hover:text-accent-green/80 transition-colors"
                >
                    {addOpen ? '− Cerrar' : '+ Añadir producto que no estaba en el pedido'}
                </button>
                {addOpen && (
                    <div className="mt-2 p-3 bg-accent-green/5 border border-accent-green/20 rounded-xl space-y-2">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar producto del catálogo..."
                                value={addSearch}
                                onChange={e => setAddSearch(e.target.value)}
                                className="w-full bg-bg-primary/50 border border-white/20 rounded-lg p-2 pl-9 text-white outline-none focus:border-accent-green text-sm placeholder:text-text-muted"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                value={addProductId}
                                onChange={e => setAddProductId(e.target.value)}
                                className="flex-1 bg-bg-primary/50 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-accent-green text-sm"
                            >
                                <option value="">-- Selecciona producto ({availableToAdd.length}) --</option>
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
                                className="w-20 sm:w-24 bg-bg-primary/50 border border-white/20 rounded-lg p-2 text-white text-center text-sm outline-none focus:border-accent-green"
                            />
                            <input
                                type="number"
                                min="0"
                                value={addSobrante}
                                onChange={e => setAddSobrante(e.target.value)}
                                placeholder="Sobr."
                                className="w-20 sm:w-24 bg-bg-primary/50 border border-accent-red/40 rounded-lg p-2 text-accent-red text-center text-sm outline-none focus:border-accent-green"
                            />
                            <button
                                onClick={handleAddRow}
                                disabled={!addProductId || !addPrepared}
                                className="btn btn-outline border-accent-green/40 text-accent-green hover:bg-accent-green/10 disabled:opacity-50 text-xs px-3"
                            >+ Añadir</button>
                        </div>
                        <p className="text-[10px] text-text-muted">Se descontará el preparado completo del stock al guardar (el sobrante queda fuera del almacén).</p>
                    </div>
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
