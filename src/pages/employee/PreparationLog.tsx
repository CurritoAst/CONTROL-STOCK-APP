import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { InventoryItem } from '../../types';
import { printRawOrder } from '../../lib/printUtils';

export const PreparationLog: React.FC<{ selectedDate: string, eventTitle?: string, onLogCreated?: () => void }> = ({ selectedDate, eventTitle, onLogCreated }) => {
    const { products, openDailyLog } = useAppContext();
    const { addToast } = useToast();

    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('General');
    const [isSaving, setIsSaving] = useState(false);

    const LOW_STOCK = 5;

    const allCategories = ['General', ...Array.from(new Set(products.map(p => p.category || 'General').filter(c => c !== 'General')))];
    const filteredProducts = products.filter(p => selectedCategory === 'General' || (p.category || 'General') === selectedCategory);

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
            
            // Generate the invoice of the gross order
            const mockLog = { date: selectedDate, eventTitle, items };
            
            // 1. Send via Email (which sends to the Brother Printer)
            try {
                await printRawOrder(mockLog, true);
            } catch (printErr: any) {
                console.error("Error enviando factura por email:", printErr);
                addToast("Hubo un error enviando la factura por email.", "error");
            }

            addToast(`Pedido para ${selectedDate} enviado a cocina e impresoras notificadas`, 'success');
            if (onLogCreated) onLogCreated();
        } catch (error) {
            console.error("Error creating log:", error);
            addToast('Error al enviar el pedido', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="card mb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-bold mb-0.5">🍽️ Pedido del Día</h2>
                        <p className="text-text-muted text-sm">
                            {eventTitle ? <span className="text-accent-blue font-semibold">{eventTitle}</span> : 'Pedido General'} &mdash; <strong>{selectedDate}</strong>
                        </p>
                    </div>
                    {/* Category filter — same as master catalog */}
                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full sm:w-auto"
                    >
                        {allCategories.map(cat => (
                            <option key={cat} value={cat}>{cat === 'General' ? 'Todas las Categorías' : cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Low stock / out of stock warnings */}
            {(lowStockCount > 0 || outOfStockCount > 0) && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    {outOfStockCount > 0 && (
                        <div className="flex-1 bg-accent-red/10 border border-accent-red/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                            <span className="text-lg">❌</span>
                            <span className="text-accent-red font-semibold">{outOfStockCount} producto{outOfStockCount !== 1 ? 's' : ''} sin stock</span>
                        </div>
                    )}
                    {lowStockCount > 0 && (
                        <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                            <span className="text-lg">⚠️</span>
                            <span className="text-yellow-400 font-semibold">{lowStockCount} producto{lowStockCount !== 1 ? 's' : ''} con stock crítico (≤{LOW_STOCK})</span>
                        </div>
                    )}
                </div>
            )}

            {/* Products — same row layout as master catalog */}
            <div className="card mb-4">
                <div className="space-y-1">
                    {filteredProducts.length === 0 && (
                        <p className="text-text-muted text-center py-8">No hay productos en esta categoría.</p>
                    )}
                    {filteredProducts.map((product, idx) => {
                        const availableStock = product.stock - (product.reserved || 0);
                        const isOutOfStock = availableStock <= 0;
                        const isLowStock = !isOutOfStock && availableStock <= LOW_STOCK;
                        const qty = quantities[product.id] || 0;
                        return (
                            <div
                                key={product.id}
                                className={`flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4 transition-colors
                                    ${idx < filteredProducts.length - 1 ? 'mb-2' : ''}
                                    ${isOutOfStock ? 'border-accent-red/20 bg-bg-primary/20 opacity-60' : qty > 0 ? 'border-accent-blue/40 bg-accent-blue/5' : isLowStock ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-white/10 bg-bg-primary/50'}`}
                            >
                                {/* Product info */}
                                <div>
                                    <div className={`font-bold text-lg mb-1 ${isOutOfStock ? 'text-accent-red/70' : ''}`}>{product.name}</div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="badge badge-gray">{product.category || 'General'}</span>
                                        <span className={`badge ${isOutOfStock ? 'bg-accent-red/20 text-accent-red' : isLowStock ? 'bg-yellow-500/20 text-yellow-400' : 'badge-green'}`}>
                                            {isLowStock && '⚠️ '}Disp: {availableStock}
                                        </span>
                                        {qty > 0 && <span className="badge badge-blue">Pedido: {qty}</span>}
                                    </div>
                                </div>

                                {/* Quantity control */}
                                {isOutOfStock ? (
                                    <div className="text-sm text-accent-red/80 font-semibold shrink-0">❌ Sin stock</div>
                                ) : (
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-lg flex items-center justify-center transition-colors"
                                            onClick={() => setQuantities(prev => ({ ...prev, [product.id]: Math.max(0, (prev[product.id] || 0) - 1) }))}
                                        >−</button>
                                        <input
                                            type="number"
                                            min="0"
                                            max={availableStock}
                                            className={`w-16 text-center text-xl font-bold py-1.5 rounded border bg-bg-elevated/30 outline-none focus:border-accent-blue transition-colors ${qty > 0 ? 'border-accent-blue text-accent-blue' : 'border-white/10 text-text-muted'}`}
                                            value={qty === 0 ? '' : qty}
                                            placeholder="0"
                                            onChange={e => {
                                                const val = parseInt(e.target.value, 10);
                                                setQuantities(prev => ({ ...prev, [product.id]: isNaN(val) ? 0 : Math.max(0, Math.min(val, availableStock)) }));
                                            }}
                                        />
                                        <button
                                            className="w-9 h-9 rounded-full bg-white/10 hover:bg-accent-blue/40 text-white font-bold text-lg flex items-center justify-center transition-colors"
                                            onClick={() => setQuantities(prev => ({ ...prev, [product.id]: Math.min(availableStock, (prev[product.id] || 0) + 1) }))}
                                        >+</button>
                                    </div>
                                )}
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
                            : <><span className="text-white font-bold">{selectedItems.length}</span> producto{selectedItems.length !== 1 ? 's' : ''}, <span className="text-white font-bold">{totalUnits}</span> unidades en total.</>
                        }
                    </div>
                    <button
                        className="btn btn-primary py-3 px-6 text-base w-full sm:w-auto flex items-center justify-center gap-2"
                        onClick={handleStartDay}
                        disabled={selectedItems.length === 0 || isSaving}
                    >
                        {isSaving ? <span className="animate-spin text-lg">⏳</span> : null}
                        {isSaving ? 'Enviando...' : '🚀 Enviar Pedido'}
                    </button>
                </div>
            </div>
        </div>
    );
};
