import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Product } from '../../types';

export const ProductCatalog: React.FC = () => {
    const { products, categories, addCategory, removeCategory, addProduct, updateProduct, deleteProduct } = useAppContext();
    const { addToast } = useToast();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Product>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('General');
    const [itemToDelete, setItemToDelete] = useState<{ id?: string, type: 'product' | 'category', name: string } | null>(null);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Combinamos las declaradas globalmente y las que puedan existir en productos antiguos
    const allCategories = Array.from(new Set([
        'General', // General siempre debe estar primero y ser la opción por defecto para ver todo
        ...(categories || []).filter(c => c !== 'General'),
        ...products.map(p => p.category || 'General').filter(c => c !== 'General')
    ]));

    const isEditing = editingId === 'new' || editingId !== null;

    const handleEdit = (product: Product) => {
        setEditingId(product.id);
        setFormData(product);
    };

    const handeNew = () => {
        setEditingId('new');
        setFormData({ name: '', price: 0, category: 'General', stock: 0 });
    };

    const handleSave = () => {
        if (!formData.name || formData.price === undefined) {
            addToast("Nombre y precio son obligatorios", "error");
            return;
        }

        if (editingId === 'new') {
            addProduct({
                id: `p${Date.now()}`,
                name: formData.name,
                price: Number(formData.price),
                category: formData.category || 'General',
                stock: Number(formData.stock) || 0
            });
            addToast("Producto creado correctamente", "success");
        } else {
            updateProduct(formData as Product);
            addToast("Producto actualizado", "success");
        }

        setEditingId(null);
    };

    const handleDelete = (id: string) => {
        const product = products.find(p => p.id === id);
        if (product) {
            setItemToDelete({ id, type: 'product', name: product.name });
        }
    };

    if (isEditing) {
        return (
            <div className="card max-w-lg mx-auto">
                <h3 className="text-xl mb-4 font-bold">{editingId === 'new' ? 'Nuevo Producto' : 'Editar Producto'}</h3>

                <div className="input-group">
                    <label>Nombre del Producto</label>
                    <input
                        type="text"
                        value={formData.name || ''}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej. Entrecot"
                    />
                </div>

                <div className="input-group">
                    <label>Precio / Coste Unitario (€)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.price || ''}
                        onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                    />
                </div>

                <div className="input-group mb-6">
                    <label>Categoría</label>
                    <select
                        value={formData.category || 'General'}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue"
                    >
                        {allCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div className="input-group mb-6">
                    <label>Stock Total (Almacén)</label>
                    <input
                        type="number"
                        min="0"
                        value={formData.stock === undefined ? '' : formData.stock}
                        onChange={e => setFormData({ ...formData, stock: Number(e.target.value) })}
                    />
                </div>

                <div className="flex gap-md">
                    <button className="btn btn-outline w-full" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button className="btn btn-success w-full" onClick={handleSave}>Guardar</button>
                </div>
            </div>
        );
    }

    const filteredProducts = products.filter(p => selectedCategory === 'General' || (p.category || 'General') === selectedCategory);

    const handleAddCategoryClick = () => {
        setNewCategoryName('');
        setIsAddingCategory(true);
    };

    const confirmAddCategory = () => {
        if (newCategoryName.trim()) {
            addCategory(newCategoryName.trim());
            addToast("Sección añadida a la lista", "success");
            setIsAddingCategory(false);
            setSelectedCategory(newCategoryName.trim());
        } else {
            addToast("El nombre no puede estar vacío", "error");
        }
    };

    const handleDeleteCategory = () => {
        if (selectedCategory === 'General') return;
        setItemToDelete({ type: 'category', name: selectedCategory });
    };

    const confirmDelete = async () => {
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
    };

    return (
        <>
            <div className="card">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                    <h2 className="text-2xl mb-1">Catálogo de Productos y Costes</h2>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
                        <div className="flex w-full sm:w-auto gap-2">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full sm:w-auto"
                            >
                                {allCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat === 'General' ? 'Todas (General)' : cat}</option>
                                ))}
                            </select>
                            <button className="btn btn-outline" title="Añadir nueva sección" onClick={handleAddCategoryClick}>+</button>
                            {selectedCategory !== 'General' &&
                                <button className="btn btn-outline text-accent-red border-accent-red/50 hover:bg-accent-red/10" title="Eliminar esta sección" onClick={handleDeleteCategory}>🗑️</button>
                            }
                        </div>
                        <button className="btn btn-primary w-full sm:w-auto whitespace-nowrap" onClick={handeNew}>+ Añadir Producto</button>
                    </div>
                </div>

                <div className="space-y-12">
                    {Object.entries(
                        filteredProducts.reduce((acc, product) => {
                            const cat = product.category || 'General';
                            if (!acc[cat]) acc[cat] = [];
                            acc[cat].push(product);
                            return acc;
                        }, {} as Record<string, Product[]>)
                    ).map(([category, items]) => (
                        <div key={category} className="animate-fade-in">
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-accent-blue whitespace-nowrap">{category}</h3>
                                <div className="h-px w-full bg-gradient-to-r from-accent-blue/40 to-transparent"></div>
                            </div>
                            <div className="grid gap-3">
                                {items.map(product => (
                                    <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl gap-4 hover:border-white/10 transition-all hover:bg-black/60 group shadow-lg">
                                        <div className="flex-1">
                                            <div className="font-black text-lg tracking-tight mb-1 group-hover:text-accent-blue transition-colors">{product.name}</div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="badge badge-gray text-[9px]">{product.category}</span>
                                                <span className={`badge ${product.stock > 0 ? 'badge-green' : 'badge-red'} text-[9px]`}>
                                                    STOCK: {product.stock}
                                                </span>
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
                                                <button className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-lg transition-all" title="Editar" onClick={() => handleEdit(product)}>✏️</button>
                                                <button className="w-10 h-10 flex items-center justify-center bg-accent-red/10 border border-accent-red/20 rounded-xl hover:bg-accent-red/20 text-lg transition-all" title="Eliminar" onClick={() => handleDelete(product.id)}>🗑️</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {itemToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-bg-primary p-6 rounded-lg border border-white/10 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-accent-red">Confirmar eliminación</h3>
                        <p className="mb-6 text-white/90 leading-relaxed">
                            {itemToDelete.type === 'product'
                                ? `¿Estás seguro de que deseas eliminar el producto "${itemToDelete.name}"? Esta acción no se puede deshacer.`
                                : `¿Estás seguro de que deseas eliminar la sección "${itemToDelete.name}"? Todos los productos que formaban parte de esta sección pasarán a ser etiquetados como "General".`}
                        </p>
                        <div className="flex gap-4 justify-end">
                            <button className="btn btn-outline" onClick={() => setItemToDelete(null)}>Cancelar</button>
                            <button className="btn btn-success bg-accent-red border-accent-red text-white hover:bg-accent-red/80" onClick={confirmDelete}>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAddingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-bg-primary p-6 rounded-lg border border-white/10 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-accent-blue">Añadir nueva sección</h3>
                        <p className="mb-4 text-white/80 text-sm">
                            Introduce el nombre de la nueva categoría para organizar tus productos.
                        </p>
                        <div className="input-group mb-6">
                            <input
                                type="text"
                                autoFocus
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && confirmAddCategory()}
                                placeholder="Ej. Congelados..."
                                className="w-full bg-black/30 border border-white/20 rounded p-3 text-white outline-none focus:border-accent-blue"
                            />
                        </div>
                        <div className="flex gap-4 justify-end">
                            <button className="btn btn-outline" onClick={() => setIsAddingCategory(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={confirmAddCategory}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
