import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { InventoryItem } from '../../types';
import { ClipboardCheck, Search, X, Loader2, Minus, Plus, AlertTriangle, XCircle, Ban, PackageOpen, ClipboardList } from 'lucide-react';

export const PreparationLog: React.FC<{ selectedDate: string, eventTitle?: string, onLogCreated?: () => void }> = ({ selectedDate, eventTitle, onLogCreated }) => {
    const { products, openDailyLog } = useAppContext();
    const { addToast } = useToast();

    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('General');
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState('');

    const LOW_STOCK = 5;

    const allCategories = ['General', ...Array.from(new Set(products.map(p => p.category || 'General').filter(c => c !== 'General')))];
    const filteredProducts = products.filter(p =>
        (selectedCategory === 'General' || (p.category || 'General') === selectedCategory) &&
        (search.trim() === '' || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    );

    const lowStockCount = products.filter(p => {
        const avail = p.stock - (p.reserved || 0);
        return avail > 0 && avail <= LOW_STOCK;
    }).length;
    const outOfStockCount = products.filter(p => (p.stock - (p.reserved || 0)) <= 0).length;

    const selectedItems = products.filter(p => (quantities[p.id] || 0) > 0);
    const totalUnits = selectedItems.reduce((sum, p) => sum + (quantities[p.id] || 0), 0);

    const handleStartDay = async () => {
        if (isSaving) return;
        const items: InventoryItem[] = selectedItems.map(p => ({
            product: p,
            prepared: quantities[p.id],
            consumed: 0
        }));
        if (items.length === 0) { addToast('Debes añadir al menos un producto al pedido.', 'error'); return; }
        
        setIsSaving(true);
        try {
            await openDailyLog(selectedDate, items, eventTitle);

            addToast('Pedido creado. El stock se ha descontado del almacén.', 'success');
            if (onLogCreated) onLogCreated();
        } catch (error) {
            console.error("Error creating log:", error);
            addToast('Error al crear el pedido', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="card mb-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="icon-chip icon-chip-blue mt-0.5">
                            <ClipboardList size={18} strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-2xl font-bold mb-0.5">Nuevo Pedido</h2>
                            <p className="text-text-muted text-sm">
                                {eventTitle ? <span className="text-accent-blue font-semibold">{eventTitle}</span> : 'Pedido General'} &mdash; <strong>{selectedDate}</strong>
                            </p>
                            <p className="text-xs text-text-muted mt-1">Al crearlo, las unidades se descuentan del almacén al instante.</p>
                        </div>
                    </div>
                    {/* Search + Category filter */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full sm:w-56 bg-bg-primary/50 border border-white/20 rounded-lg p-2 pl-9 text-white outline-none focus:border-accent-blue placeholder:text-text-muted"
                            />
                            <Search size={16} strokeWidth={2.2} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors px-1"
                                    title="Limpiar búsqueda"
                                    aria-label="Limpiar búsqueda"
                                ><X size={16} strokeWidth={2.2} /></button>
                            )}
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="bg-bg-primary/50 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-accent-blue w-full sm:w-auto"
                        >
                            {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat === 'General' ? 'Todas las Categorías' : cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Low stock / out of stock warnings */}
            {(lowStockCount > 0 || outOfStockCount > 0) && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    {outOfStockCount > 0 && (
                        <div className="flex-1 bg-accent-red/10 border border-accent-red/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                            <XCircle size={18} strokeWidth={2.2} className="text-accent-red shrink-0" />
                            <span className="text-accent-red font-semibold">{outOfStockCount} producto{outOfStockCount !== 1 ? 's' : ''} sin stock</span>
                        </div>
                    )}
                    {lowStockCount > 0 && (
                        <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                            <AlertTriangle size={18} strokeWidth={2.2} className="text-yellow-400 shrink-0" />
                            <span className="text-yellow-400 font-semibold">{lowStockCount} producto{lowStockCount !== 1 ? 's' : ''} con stock crítico (≤{LOW_STOCK})</span>
                        </div>
                    )}
                </div>
            )}

            {/* Products — tabular list, same look as ConsumptionLog */}
            <div className="card mb-4">
                {/* Table header — visible only on sm+ */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 pb-2 mb-1 border-b border-white/10 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                    <div className="col-span-7">Producto</div>
                    <div className="col-span-5 text-center">Pedido</div>
                </div>

                <div className="flex flex-col divide-y divide-white/5">
                    {filteredProducts.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                {search.trim() !== '' ? <Search size={20} strokeWidth={2} /> : <PackageOpen size={20} strokeWidth={2} />}
                            </div>
                            <p className="text-sm">
                                {search.trim() !== ''
                                    ? `No hay productos que coincidan con "${search}".`
                                    : 'No hay productos en esta categoría.'}
                            </p>
                        </div>
                    )}
                    {filteredProducts.map(product => {
                        const availableStock = product.stock - (product.reserved || 0);
                        const isOutOfStock = availableStock <= 0;
                        const isLowStock = !isOutOfStock && availableStock <= LOW_STOCK;
                        const qty = quantities[product.id] || 0;
                        return (
                            <div
                                key={product.id}
                                className={`grid grid-cols-12 items-center gap-3 px-4 py-3 transition-colors ${isOutOfStock ? 'opacity-60' : qty > 0 ? 'bg-accent-blue/5' : 'hover:bg-white/5'}`}
                            >
                                {/* Product info */}
                                <div className="col-span-12 sm:col-span-7 min-w-0">
                                    <div className={`font-semibold truncate ${isOutOfStock ? 'text-accent-red/70' : 'text-white'}`} title={product.name}>{product.name}</div>
                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                        <span className="badge badge-gray">{product.category || 'General'}</span>
                                        <span className={`badge ${isOutOfStock ? 'bg-accent-red/20 text-accent-red' : isLowStock ? 'bg-yellow-500/20 text-yellow-400' : 'badge-green'}`}>
                                            {isLowStock && <AlertTriangle size={11} strokeWidth={2.4} className="inline shrink-0 mr-1 -mt-0.5" />}Disp: {availableStock}
                                        </span>
                                        {qty > 0 && <span className="badge badge-blue">Pedido: {qty}</span>}
                                    </div>
                                </div>

                                {/* Quantity control */}
                                <div className="col-span-12 sm:col-span-5 flex items-center justify-center">
                                    {isOutOfStock ? (
                                        <div className="text-sm text-accent-red/80 font-semibold shrink-0 flex items-center gap-1.5">
                                            <Ban size={14} strokeWidth={2.4} /> Sin stock
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                aria-label="Restar"
                                                className="w-9 h-9 rounded-md border border-white/10 bg-bg-elevated/40 hover:bg-white/10 text-text-muted hover:text-white flex items-center justify-center transition-colors"
                                                onClick={() => setQuantities(prev => ({ ...prev, [product.id]: Math.max(0, (prev[product.id] || 0) - 1) }))}
                                            ><Minus size={16} strokeWidth={2.4} /></button>
                                            <input
                                                type="number"
                                                min="0"
                                                max={availableStock}
                                                className={`w-16 px-0 text-center font-mono tabular-nums text-lg py-1.5 rounded-md border bg-bg-elevated/40 outline-none focus:border-accent-blue transition-colors ${qty > 0 ? 'border-accent-blue text-accent-blue' : 'border-white/10 text-text-muted'}`}
                                                value={qty === 0 ? '' : qty}
                                                placeholder="0"
                                                onChange={e => {
                                                    const val = parseInt(e.target.value, 10);
                                                    setQuantities(prev => ({ ...prev, [product.id]: isNaN(val) ? 0 : Math.max(0, Math.min(val, availableStock)) }));
                                                }}
                                            />
                                            <button
                                                aria-label="Sumar"
                                                className="w-9 h-9 rounded-md border border-white/10 bg-bg-elevated/40 hover:bg-accent-blue/30 text-text-muted hover:text-white flex items-center justify-center transition-colors"
                                                onClick={() => setQuantities(prev => ({ ...prev, [product.id]: Math.min(availableStock, (prev[product.id] || 0) + 1) }))}
                                            ><Plus size={16} strokeWidth={2.4} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary + Submit */}
            <div className="card border border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-sm text-text-muted">
                        {selectedItems.length === 0
                            ? 'No has seleccionado ningún producto.'
                            : <><span className="font-mono tabular-nums text-white font-bold">{selectedItems.length}</span> producto{selectedItems.length !== 1 ? 's' : ''}, <span className="font-mono tabular-nums text-white font-bold">{totalUnits}</span> unidades en total.</>
                        }
                    </div>
                    <button
                        className="btn btn-primary py-3 px-6 text-base w-full sm:w-auto flex items-center justify-center gap-2"
                        onClick={handleStartDay}
                        disabled={selectedItems.length === 0 || isSaving}
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} strokeWidth={2.2} />}
                        {isSaving ? 'Creando...' : 'Crear pedido'}
                    </button>
                </div>
            </div>
        </div>
    );
};
