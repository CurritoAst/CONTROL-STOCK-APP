import React, { useState, useMemo, useCallback, memo } from 'react';
import { Search, Plus, Pencil, Trash2, Package, PackageOpen, AlertTriangle, XCircle, Save, Tags } from 'lucide-react';
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
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4 transition-all group
                ${isZero ? 'border-accent-red/30 bg-accent-red/5 hover:border-accent-red/50' :
                  isLow ? 'border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50' :
                  'border-white/5 bg-black/40 hover:border-white/10 hover:bg-black/60'}`}
        >
            <div className="flex-1 min-w-0">
                <div className={`font-semibold tracking-tight mb-1.5 group-hover:text-accent-blue transition-colors ${isZero ? 'text-accent-red/80' : isLow ? 'text-yellow-400' : 'text-text-primary'}`}>
                    {product.name}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-gray text-[9px]">{product.category}</span>

                    {isQuickEditing ? (
                        <input
                            autoFocus
                            type="number"
                            min="0"
                            aria-label="Editar stock"
                            className="w-20 text-center text-xs font-bold num p-1 rounded border border-accent-blue bg-accent-blue/10 text-accent-blue outline-none"
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
                            className={`badge gap-1 cursor-pointer select-none text-[9px] transition-opacity hover:opacity-70 ${
                                isZero ? 'badge-red' :
                                isLow ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                'badge-green'
                            }`}
                            title="Clic para editar stock"
                            onClick={e => { e.stopPropagation(); onQuickEditStart(); }}
                        >
                            {isZero ? <XCircle size={11} strokeWidth={2.4} /> : isLow ? <AlertTriangle size={11} strokeWidth={2.4} /> : null}
                            STOCK: {product.stock}
                            <Pencil size={10} strokeWidth={2.4} />
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
                    <div className="text-xl font-bold tracking-tight num">
                        {product.price.toLocaleString('es-ES')} <span className="text-xs font-normal text-text-muted">€</span>
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">P. Unitario</div>
                </div>
                <div className="flex gap-2">
                    <button className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors" title="Editar" aria-label="Editar" onClick={onEdit}><Pencil size={16} strokeWidth={2.2} /></button>
                    <button className="w-10 h-10 flex items-center justify-center bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red hover:bg-accent-red/20 transition-colors" title="Eliminar" aria-label="Eliminar" onClick={onDelete}><Trash2 size={16} strokeWidth={2.2} /></button>
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
            <div className="card max-w-lg mx-auto animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                    <div className="icon-chip icon-chip-blue"><Package size={18} strokeWidth={2.2} /></div>
                    <h3 className="text-xl font-bold mb-0">{editingId === 'new' ? 'Nuevo Producto' : 'Editar Producto'}</h3>
                </div>
                <div className="input-group">
                    <label>Nombre del Producto</label>
                    <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Entrecot" />
                </div>
                <div className="input-group">
                    <label>Precio / Coste Unitario (€)</label>
                    <input type="number" min="0" step="0.01" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
                </div>
                <div className="input-group">
                    <label>Categoría</label>
                    <select value={formData.category || 'General'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                        {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
                <div className="input-group mb-6">
                    <label>Stock Total (Almacén)</label>
                    <input type="number" min="0" value={formData.stock === undefined ? '' : formData.stock} onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })} />
                </div>
                <div className="flex gap-3 pt-2">
                    <button className="btn btn-outline w-full" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button className="btn btn-success w-full" onClick={handleSave}><Save size={16} strokeWidth={2.2} /> Guardar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="page-header">
                <div>
                    <div className="section-label mb-2">Inventario</div>
                    <h1 className="page-title">Catálogo de Productos y Costes</h1>
                    <p className="page-subtitle">{products.length} producto{products.length !== 1 ? 's' : ''} · {allCategories.length} categoría{allCategories.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto sm:items-center">
                    <div className="relative w-full sm:w-64">
                        <Search size={16} strokeWidth={2.2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 placeholder:text-text-muted"
                        />
                    </div>
                    <div className="flex gap-2 items-center">
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as typeof sortBy)}
                            className="w-full sm:w-auto text-sm"
                            title="Ordenar por"
                        >
                            <option value="name">A–Z</option>
                            <option value="stock_asc">Stock ↑</option>
                            <option value="stock_desc">Stock ↓</option>
                        </select>
                        <button className="btn btn-primary whitespace-nowrap shrink-0" onClick={handeNew}><Plus size={16} strokeWidth={2.4} /> Añadir</button>
                    </div>
                </div>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
                {allCategories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            selectedCategory === cat
                                ? 'bg-accent-blue text-white border-accent-blue shadow-lg shadow-accent-blue/20'
                                : 'bg-white/5 text-text-secondary border-white/10 hover:bg-white/10 hover:text-text-primary'
                        }`}
                    >
                        {cat === 'General' ? 'Todas (General)' : cat}
                    </button>
                ))}
                <button
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors"
                    title="Añadir nueva sección"
                    aria-label="Añadir nueva sección"
                    onClick={() => { setNewCategoryName(''); setIsAddingCategory(true); }}
                ><Plus size={14} strokeWidth={2.4} /></button>
                {selectedCategory !== 'General' &&
                    <button
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-accent-red/10 border border-accent-red/20 text-accent-red hover:bg-accent-red/20 transition-colors"
                        title="Eliminar esta sección"
                        aria-label="Eliminar esta sección"
                        onClick={() => setItemToDelete({ type: 'category', name: selectedCategory })}
                    ><Trash2 size={14} strokeWidth={2.2} /></button>
                }
            </div>

            <div className="card">

                {/* Alertas de stock */}
                {(lowStockProducts.length > 0 || zeroStockProducts.length > 0) && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <div className="icon-chip bg-yellow-500/15 border-yellow-500/25 text-yellow-400"><AlertTriangle size={18} strokeWidth={2.2} /></div>
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
                            className={`btn btn-sm shrink-0 ${showOnlyLowStock ? 'btn-primary' : 'btn-outline border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10'}`}
                        >
                            {showOnlyLowStock ? 'Ver todos' : 'Ver críticos'}
                        </button>
                    </div>
                )}

                {/* Product list */}
                <div className="space-y-8">
                    {Object.entries(groupedByCategory).map(([category, items]) => (
                        <div key={category}>
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex items-baseline gap-2 whitespace-nowrap">
                                    <h3 className="section-label !text-accent-blue leading-none mb-0">{category}</h3>
                                    <span className="text-[10px] text-text-muted leading-none">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="divider-gradient flex-1"></div>
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
                        <div className="empty-state">
                            <div className="empty-state-icon"><PackageOpen size={22} strokeWidth={2} /></div>
                            <p className="mb-0">No hay productos que coincidan con los filtros.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete confirm modal */}
            {itemToDelete && (
                <div className="modal-overlay">
                    <div className="modal-panel max-w-md">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="icon-chip icon-chip-red"><AlertTriangle size={18} strokeWidth={2.2} /></div>
                            <h3 className="text-xl font-bold mb-0 text-accent-red">Confirmar eliminación</h3>
                        </div>
                        <p className="mb-6 text-text-secondary leading-relaxed">
                            {itemToDelete.type === 'product'
                                ? `¿Estás seguro de que deseas eliminar el producto "${itemToDelete.name}"? Esta acción no se puede deshacer.`
                                : `¿Estás seguro de que deseas eliminar la sección "${itemToDelete.name}"? Todos los productos pasarán a "General".`}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button className="btn btn-outline" onClick={() => setItemToDelete(null)}>Cancelar</button>
                            <button className="btn btn-danger" onClick={confirmDelete}><Trash2 size={16} strokeWidth={2.2} /> Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add category modal */}
            {isAddingCategory && (
                <div className="modal-overlay">
                    <div className="modal-panel max-w-md">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="icon-chip icon-chip-blue"><Tags size={18} strokeWidth={2.2} /></div>
                            <h3 className="text-xl font-bold mb-0 text-accent-blue">Añadir nueva sección</h3>
                        </div>
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
                                className="w-full placeholder:text-text-muted"
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button className="btn btn-outline" onClick={() => setIsAddingCategory(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={() => {
                                if (newCategoryName.trim()) { addCategory(newCategoryName.trim()); addToast("Sección añadida", "success"); setIsAddingCategory(false); setSelectedCategory(newCategoryName.trim()); }
                                else addToast("El nombre no puede estar vacío", "error");
                            }}><Save size={16} strokeWidth={2.2} /> Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
