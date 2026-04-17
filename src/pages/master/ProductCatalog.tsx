import React, { useState, useMemo, useCallback, memo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types';

const LOW_STOCK = 5;

// ─── Product row memoized — only re-renders when its own data or quickEdit changes ───
const ProductRow = memo(({
    product,
    isQuickEditing,
    quickEditVal,
    onQuickEditStart,
    onQuickEditChange,
    onQuickEditSave,
    onQuickEditCancel,
    onEdit,
    onDelete,
}: {
    product: Product;
    isQuickEditing: boolean;
    quickEditVal: string;
    onQuickEditStart: () => void;
    onQuickEditChange: (val: string) => void;
    onQuickEditSave: () => void;
    onQuickEditCancel: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) => {
    const isLow = product.stock > 0 && product.stock <= LOW_STOCK;
    const isZero = product.stock === 0;

    return (
        <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl gap-4 transition-all group shadow-lg
                ${isZero ? 'border-accent-red/30 bg-accent-red/5 hover:border-accent-red/50' :
                  isLow ? 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50' :
                  'border-white/5 bg-black/40 hover:border-white/10 hover:bg-black/60'}`}
        >
            <div className="flex-1">
                <div className={`font-black text-lg tracking-tight mb-1 group-hover:text-accent-blue transition-colors ${isZero ? 'text-accent-red/80' : isLow ? 'text-yellow-400' : ''}`}>
                    {product.name}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-gray text-[9px]">{product.category}</span>

                    {isQuickEditing ? (
                        <input
                            autoFocus
                            type="number"
                            min="0"
                            className="w-20 text-center text-xs font-bold p-1 rounded border border-accent-blue bg-accent-blue/10 text-accent-blue outline-none"
                            value={quickEditVal}
                            onChange={e => onQuickEditChange(e.target.value)}
                            onBlur={onQuickEditSave}
                            onKeyDown={e => {
                                if (e.key === 'Enter') onQuickEditSave();
                                if (e.key === 'Escape') onQuickEditCancel();
                            }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span
                            className={`badge cursor-pointer select-none text-[9px] transition-opacity hover:opacity-70 ${
                                isZero ? 'badge-red' :
                                isLow ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                'badge-green'
                            }`}
                            title="Clic para editar stock"
                            onClick={e => { e.stopPropagation(); onQuickEditStart(); }}
                        >
                            {isZero ? '❌ ' : isLow ? '⚠️ ' : ''}STOCK: {product.stock} ✏️
                        </span>
                    )}

                    {product.reserved ? (
                        <span className={`badge ${product.stock - product.reserved > 0 ? 'badge-blue' : 'badge-red'} text-[9px]`}>
                            LIBRE: {product.stock - product.reserved}
                        </span>
                    ) : null}
                </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                <div className="text-right">
                    <div className="text-2xl font-black italic tracking-tighter">
                        {product.price.toLocaleString('es-ES')} <span className="text-xs text-text-muted not-italic">€</span>
                    </div>
                    <div className="text-[9px] font-black uppercase text-accent-blue tracking-widest">P. Unitario</div>
                </div>
                <div className="flex gap-2">
                    <button className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-lg transition-all" title="Editar" onClick={onEdit}>✏️</button>
                    <button className="w-10 h-10 flex items-center justify-center bg-accent-red/10 border border-accent-red/20 rounded-xl hover:bg-accent-red/20 text-lg transition-all" title="Eliminar" onClick={onDelete}>🗑️</button>
                </div>
            </div>
        </div>
    );
});

export const ProductCatalog: React.FC = () => {
    const { products, categories, addCategory, removeCategory, addProduct, updateProduct, deleteProduct } = useAppContext();
    const { addToast } = useToast();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Product>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('General');
    const [itemToDelete, setItemToDelete] = useState<{ id?: string, type: 'product' | 'category', name: string } | null>(null);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'stock_asc' | 'stock_desc'>('name');
    const [quickEdit, setQuickEdit] = useState<{ id: string; val: string } | null>(null);
    const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);

    const allCategories = useMemo(() => Array.from(new Set([
        'General',
        ...(categories || []).filter(c => c !== 'General'),
        ...products.map(p => p.category || 'General').filter(c => c !== 'General')
    ])), [categories, products]);

    const isEditing = editingId === 'new' || editingId !== null;

    const { lowStockProducts, zeroStockProducts } = useMemo(() => ({
        lowStockProducts: products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK),
        zeroStockProducts: products.filter(p => p.stock === 0),
    }), [products]);

    const saveQuickStock = useCallback(async (product: Product, val: string) => {
        setQuickEdit(null);
        const newStock = Math.max(0, parseInt(val, 10) || 0);
        if (newStock !== product.stock) {
            await updateProduct({ ...product, stock: newStock });
            addToast(`${product.name}: stock ${product.stock} → ${newStock}`, 'success');
        }
    }, [updateProduct, addToast]);

    const handleEdit = useCallback((product: Product) => {
        setEditingId(product.id);
        setFormData(product);
    }, []);

    const handeNew = useCallback(() => {
        setEditingId('new');
        setFormData({ name: '', price: 0, category: 'General', stock: 0 });
    }, []);

    const handleSave = useCallback(() => {
        if (!formData.name || formData.price === undefined) {
            addToast("Nombre y precio son obligatorios", "error");
            return;
        }
        if (editingId === 'new') {
            addProduct({ id: `p${Date.now()}`, name: formData.name, price: Number(formData.price), category: formData.category || 'General', stock: Number(formData.stock) || 0 });
            addToast("Producto creado correctamente", "success");
        } else {
            updateProduct(formData as Product);
            addToast("Producto actualizado", "success");
        }
        setEditingId(null);
    }, [formData, editingId, addProduct, updateProduct, addToast]);

    const handleDelete = useCallback((id: string) => {
        const product = products.find(p => p.id === id);
        if (product) setItemToDelete({ id, type: 'product', name: product.name });
    }, [products]);

    const groupedByCategory = useMemo(() => {
        const filtered = products.filter(p =>
            (selectedCategory === 'General' || (p.category || 'General') === selectedCategory) &&
            (search === '' || p.name.toLowerCase().includes(search.toLowerCase())) &&
            (!showOnlyLowStock || p.stock <= LOW_STOCK)
        );

        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'stock_asc') return a.stock - b.stock;
            if (sortBy === 'stock_desc') return b.stock - a.stock;
            return a.name.localeCompare(b.name);
        });

        return sorted.reduce((acc, product) => {
            const cat = product.category || 'General';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(product);
            return acc;
        }, {} as Record<string, Product[]>);
    }, [products, selectedCategory, search, showOnlyLowStock, sortBy]);

    const confirmDelete = useCallback(async () => {
        if (!itemToDelete) return;
        if (itemToDelete.type === 'product' && itemToDelete.id) {
            await deleteProduct(itemToDelete.id);
            addToast("Producto eliminado correctamente", "info");
        } else if (itemToDelete.type === 'category') {
            await removeCategory(itemToDelete.name);
            setSelectedCategory('General');
            addToast("Sección eliminada de forma permanente", "info");
        }
        setItemToDelete(null);
    }, [itemToDelete, deleteProduct, removeCategory, addToast]);

    if (isEditing) {
        return (
            <div className="card max-w-lg mx-auto">
                <h3 className="text-xl mb-4 font-bold">{editingId === 'new' ? 'Nuevo Producto' : 'Editar Producto'}</h3>
                <div className="input-group">
                    <label>Nombre del Producto</label>
                    <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Entrecot" />
                </div>
                <div className="input-group">
                    <label>Precio / Coste Unitario (€)</label>
                    <input type="number" min="0" step="0.01" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
                </div>
                <div className="input-group mb-6">
                    <label>Categoría</label>
                    <select value={formData.category || 'General'} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue">
                        {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div className="input-group mb-6">
                    <label>Stock Total (Almacén)</label>
                    <input type="number" min="0" value={formData.stock === undefined ? '' : formData.stock} onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })} />
                </div>
                <div className="flex gap-md">
                    <button className="btn btn-outline w-full" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button className="btn btn-success w-full" onClick={handleSave}>Guardar</button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="card">
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <h2 className="text-2xl mb-1">Catálogo de Productos y Costes</h2>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full sm:w-56 placeholder:text-text-muted"
                        />
                        <div className="flex flex-wrap w-full sm:w-auto gap-2 items-center">
                            <select
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                                className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full sm:w-auto"
                            >
                                {allCategories.map(cat => <option key={cat} value={cat}>{cat === 'General' ? 'Todas (General)' : cat}</option>)}
                            </select>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                                className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue text-sm"
                                title="Ordenar por"
                            >
                                <option value="name">A–Z</option>
                                <option value="stock_asc">Stock ↑</option>
                                <option value="stock_desc">Stock ↓</option>
                            </select>
                            <button className="btn btn-outline" title="Añadir nueva sección" onClick={() => { setNewCategoryName(''); setIsAddingCategory(true); }}>+</button>
                            {selectedCategory !== 'General' &&
                                <button className="btn btn-outline text-accent-red border-accent-red/50 hover:bg-accent-red/10" title="Eliminar esta sección" onClick={() => setItemToDelete({ type: 'category', name: selectedCategory })}>🗑️</button>
                            }
                            <button className="btn btn-primary whitespace-nowrap" onClick={handeNew}>+ Añadir</button>
                        </div>
                    </div>
                </div>

                {/* Alertas de stock */}
                {(lowStockProducts.length > 0 || zeroStockProducts.length > 0) && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <p className="font-bold text-yellow-400 mb-1">Alerta de Stock</p>
                                <div className="flex flex-wrap gap-3 text-sm">
                                    {zeroStockProducts.length > 0 && (
                                        <span className="text-accent-red font-semibold">{zeroStockProducts.length} sin stock</span>
                                    )}
                                    {lowStockProducts.length > 0 && (
                                        <span className="text-yellow-400">{lowStockProducts.length} con stock crítico (≤{LOW_STOCK})</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowOnlyLowStock(s => !s)}
                            className={`btn text-sm shrink-0 ${showOnlyLowStock ? 'btn-primary' : 'btn-outline border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10'}`}
                        >
                            {showOnlyLowStock ? 'Ver todos' : 'Ver críticos'}
                        </button>
                    </div>
                )}

                {/* Product list */}
                <div className="space-y-12">
                    {Object.entries(groupedByCategory).map(([category, items]) => (
                        <div key={category}>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex items-baseline gap-2 whitespace-nowrap">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent-blue leading-none">{category}</h3>
                                    <span className="text-[10px] text-text-muted leading-none">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="h-px w-full bg-gradient-to-r from-accent-blue/40 to-transparent"></div>
                            </div>
                            <div className="grid gap-3">
                                {items.map(product => (
                                    <ProductRow
                                        key={product.id}
                                        product={product}
                                        isQuickEditing={quickEdit?.id === product.id}
                                        quickEditVal={quickEdit?.id === product.id ? quickEdit.val : ''}
                                        onQuickEditStart={() => setQuickEdit({ id: product.id, val: String(product.stock) })}
                                        onQuickEditChange={val => setQuickEdit({ id: product.id, val })}
                                        onQuickEditSave={() => quickEdit && saveQuickStock(product, quickEdit.val)}
                                        onQuickEditCancel={() => setQuickEdit(null)}
                                        onEdit={() => handleEdit(product)}
                                        onDelete={() => handleDelete(product.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                    {Object.keys(groupedByCategory).length === 0 && (
                        <div className="text-center py-10 text-text-muted">No hay productos que coincidan con los filtros.</div>
                    )}
                </div>
            </div>

            {/* Delete confirm modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-bg-primary p-6 rounded-lg border border-white/10 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-accent-red">Confirmar eliminación</h3>
                        <p className="mb-6 text-white/90 leading-relaxed">
                            {itemToDelete.type === 'product'
                                ? `¿Estás seguro de que deseas eliminar el producto "${itemToDelete.name}"? Esta acción no se puede deshacer.`
                                : `¿Estás seguro de que deseas eliminar la sección "${itemToDelete.name}"? Todos los productos pasarán a "General".`}
                        </p>
                        <div className="flex gap-4 justify-end">
                            <button className="btn btn-outline" onClick={() => setItemToDelete(null)}>Cancelar</button>
                            <button className="btn btn-success bg-accent-red border-accent-red text-white hover:bg-accent-red/80" onClick={confirmDelete}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add category modal */}
            {isAddingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-bg-primary p-6 rounded-lg border border-white/10 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-accent-blue">Añadir nueva sección</h3>
                        <div className="input-group mb-6">
                            <input
                                type="text"
                                autoFocus
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        if (newCategoryName.trim()) { addCategory(newCategoryName.trim()); addToast("Sección añadida", "success"); setIsAddingCategory(false); setSelectedCategory(newCategoryName.trim()); }
                                        else addToast("El nombre no puede estar vacío", "error");
                                    }
                                }}
                                placeholder="Ej. Congelados..."
                                className="w-full bg-black/30 border border-white/20 rounded p-3 text-white outline-none focus:border-accent-blue"
                            />
                        </div>
                        <div className="flex gap-4 justify-end">
                            <button className="btn btn-outline" onClick={() => setIsAddingCategory(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={() => {
                                if (newCategoryName.trim()) { addCategory(newCategoryName.trim()); addToast("Sección añadida", "success"); setIsAddingCategory(false); setSelectedCategory(newCategoryName.trim()); }
                                else addToast("El nombre no puede estar vacío", "error");
                            }}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
