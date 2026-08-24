import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Role, Product, DailyLog, InventoryItem, EventType, BackupSnapshot, BackupTrigger } from '../types';
import { supabase, fetchAll, applyStockDeltas } from '../lib/supabaseClient';
import { useToast } from './ToastContext';

interface AppContextType extends AppState {
    setRole: (role: Role) => void;
    addCategory: (category: string) => void;
    removeCategory: (category: string) => Promise<void>;
    addProduct: (product: Product) => Promise<void>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    openDailyLog: (date: string, initialItems: InventoryItem[], eventTitle?: string) => Promise<void>;
    deleteDailyLog: (id: string) => Promise<void>;
    logConsumption: (id: string, items: InventoryItem[], opts?: { skipBackup?: boolean }) => Promise<void>;
    addEvent: (event: EventType) => Promise<void>;
    addEvents: (events: EventType[]) => Promise<void>;
    removeEvent: (id: string) => Promise<void>;
    removeEvents: (ids: string[]) => Promise<void>;
    refreshData: () => Promise<void>;
    updatePedidoItems: (logId: string, items: { product: Product, prepared: number }[]) => Promise<void>;
    editHistoricalLog: (logId: string, items: { product: Product, prepared: number, consumed: number }[]) => Promise<void>;
    editOrderTotal: (eventTitle: string, items: { product: Product, prepared: number, consumed: number }[]) => Promise<void>;
    duplicateDailyLog: (sourceLogId: string, newDate: string) => Promise<void>;
    assignExtraToFeria: (logId: string, feriaName: string, casetaName?: string) => Promise<void>;
    createBackup: (label: string, triggerType?: BackupTrigger, description?: string) => Promise<BackupSnapshot | null>;
}

const defaultCategories = ['Artículos de limpieza', 'Precocinados', 'Bebidas', 'General'];

const getInitialState = (): AppState => {
    // Role still in local storage to keep session
    // Only the admin profile exists now; any legacy stored role forces a re-login.
    const role: Role = localStorage.getItem('dukeControlRole') === 'MASTER' ? 'MASTER' : null;
    const savedCategories = localStorage.getItem('macarioCategories');
    let categories: string[] = savedCategories ? JSON.parse(savedCategories) : defaultCategories;

    const deprecatedCategories = ['Carnes', 'Mariscos'];
    if (categories.some(c => deprecatedCategories.includes(c))) {
        categories = categories.filter(c => !deprecatedCategories.includes(c));
        localStorage.setItem('macarioCategories', JSON.stringify(categories));
    }

    return {
        role,
        products: [],
        categories,
        events: [],
        activeLogs: [],
        historicalLogs: []
    };
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(getInitialState);
    const { addToast } = useToast();

    const setRole = (role: Role) => {
        setState(s => ({ ...s, role }));
        if (role) localStorage.setItem('dukeControlRole', role);
        else localStorage.removeItem('dukeControlRole');
    };

    const addCategory = (category: string) => {
        setState(s => {
            if (s.categories?.includes(category)) return s;
            const newCats = [...(s.categories || []), category];
            localStorage.setItem('macarioCategories', JSON.stringify(newCats));
            return { ...s, categories: newCats };
        });
    };

    const removeCategory = async (category: string) => {
        setState(s => {
            const newCats = (s.categories || []).filter(c => c !== category);
            localStorage.setItem('macarioCategories', JSON.stringify(newCats));
            return { ...s, categories: newCats };
        });

        // Fetch products that currently have this category
        const { data: affectedProducts } = await supabase
            .from('products')
            .select('*')
            .eq('category', category);

        if (affectedProducts && affectedProducts.length > 0) {
            // Update their category locally to 'General' to bypass bulk update policies
            const updatedProducts = affectedProducts.map(p => ({
                ...p,
                category: 'General'
            }));

            // Use UPSERT to save changes
            const { error } = await supabase.from('products').upsert(updatedProducts);
            if (error) {
                addToast("Error al reasignar productos de la sección eliminada", "error");
                console.error(error);
            }
        }

        await refreshProducts();
    };

    const refreshProducts = async () => {
        try {
            const data = await fetchAll<Product>('products');
            setState(s => ({ ...s, products: data }));
            return data;
        } catch (error) {
            console.error("Error fetching products:", error);
            return;
        }
    };

    const refreshLogs = async (currentProducts: Product[]) => {
        let logsData: any[] = [];
        let itemsData: any[] = [];
        try {
            logsData = await fetchAll<any>('daily_logs', { orderBy: { column: 'date', ascending: false } });
        } catch (e) { console.error('Error fetching logs:', e); return false; }
        try {
            itemsData = await fetchAll<any>('log_items');
        } catch (e) { console.error('Error fetching log items:', e); return false; }

        const parsedLogs: DailyLog[] = logsData.map(log => {
            const items = itemsData
                .filter(item => item.daily_log_id === log.id)
                .map(item => {
                    const product = currentProducts.find(p => p.id === item.product_id);
                    return product ? { product, prepared: item.prepared, consumed: item.consumed } : null;
                })
                .filter((i): i is InventoryItem => i !== null);
            const titleParts = log.id.split('---').slice(1);
            const eventTitle = titleParts.length > 0 ? titleParts.join('---') : undefined;

            return {
                id: log.id,
                date: log.date,
                status: log.status,
                items,
                eventTitle
            };
        });

        const activeLogs = parsedLogs.filter(l => l.status !== 'APPROVED');
        const historicalLogs = parsedLogs.filter(l => l.status === 'APPROVED');
        const pendingLogs = parsedLogs.filter(l => l.status === 'PENDING_PEDIDO');

        const productsWithReserved = currentProducts.map(p => {
            const reserved = pendingLogs.reduce((acc, log) => {
                const item = log.items.find(i => i.product.id === p.id);
                return acc + (item ? item.prepared : 0);
            }, 0);
            return { ...p, reserved };
        });

        setState(s => ({
            ...s,
            products: productsWithReserved,
            activeLogs,
            historicalLogs
        }));
        return true;
    };

    // Surface backend failures instead of silently rendering empty screens
    // (an unreachable Supabase looked exactly like "no hay pedidos").
    const markDb = (ok: boolean) => {
        setState(s => (!!s.dbUnreachable === !ok) ? s : { ...s, dbUnreachable: !ok });
    };

    const refreshData = async () => {
        const prods = await refreshProducts();
        if (!prods) { markDb(false); return; }
        const okLogs = await refreshLogs(prods);

        // Refresh Events
        let okEvents = true;
        try {
            const eventsData = await fetchAll<EventType>('events');
            setState(s => ({ ...s, events: eventsData }));
        } catch (eventsError) {
            okEvents = false;
            console.error("Error fetching events:", eventsError);
        }
        markDb(okLogs && okEvents);
    };

    useEffect(() => {
        refreshData();


        let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
        const debouncedRefresh = () => {
            if (refreshTimeout) clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => refreshData(), 600);
        };

        const channel = supabase.channel('schema-db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, () => {
                debouncedRefresh();
            })
            .subscribe();

        // Auto-refresh interval (every 30 seconds)
        const refreshInterval = setInterval(() => {
            refreshData();
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(refreshInterval);
            if (refreshTimeout) clearTimeout(refreshTimeout);
        };
    }, []);

    // Effect to update PWA App Badge on iOS/Android
    useEffect(() => {
        if ('setAppBadge' in navigator && navigator.setAppBadge && navigator.clearAppBadge) {
            if (state.role === 'MASTER') {
                // Same set as the Layout badge: pedidos still waiting for sobrantes.
                const pendingCount = state.activeLogs.filter(
                    l => l.status !== 'APPROVED' && l.status !== 'REJECTED'
                ).length;

                if (pendingCount > 0) {
                    navigator.setAppBadge(pendingCount).catch(console.error);
                } else {
                    navigator.clearAppBadge().catch(console.error);
                }
            } else {
                navigator.clearAppBadge().catch(console.error);
            }
        }
    }, [state.activeLogs, state.historicalLogs, state.role]);

    const addProduct = async (product: Product) => {
        const { error } = await supabase.from('products').insert({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            stock: product.stock
        });
        if (error) { addToast("Error al guardar en Supabase", "error"); throw error; }
        await refreshProducts();
    };

    const updateProduct = async (product: Product) => {
        const { error } = await supabase.from('products').upsert({
            id: product.id,
            name: product.name,
            price: product.price,
            category: product.category,
            stock: product.stock
        });
        if (error) { addToast("Error al guardar en Supabase", "error"); throw error; }
        await refreshProducts();
    };

    const deleteProduct = async (id: string) => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) { addToast("Error eliminando en Supabase", "error"); throw error; }
        await refreshProducts();
    };

    const openDailyLog = async (date: string, initialItems: InventoryItem[], eventTitle?: string) => {
        const timestamp = Date.now();
        const safeTitle = eventTitle ? eventTitle.replace(/---/g, '-') : '';
        const logId = eventTitle ? `log-${timestamp}---${safeTitle}` : `log-${timestamp}`;
        // Single-admin flow: a pedido is created directly as OPEN (no separate
        // approval step) and its quantities are discounted from stock right away.
        const { error: logError } = await supabase.from('daily_logs').insert({
            id: logId,
            date,
            status: 'OPEN'
        });
        if (logError) { addToast("Error creando pedido", "error"); throw logError; }

        if (initialItems.length > 0) {
            const itemsToInsert = initialItems.map(item => ({
                daily_log_id: logId,
                product_id: item.product.id,
                prepared: item.prepared,
                consumed: 0
            }));
            const { error: itemsError } = await supabase.from('log_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
        }

        // Discount stock in one batched write (fresh DB values, clamped at 0).
        // If that write fails, remove the just-created pedido so we never leave
        // an OPEN pedido whose units were not actually discounted (closing it
        // later would refund units that were never taken).
        const openDeltas: Record<string, number> = {};
        for (const item of initialItems) {
            openDeltas[item.product.id] = (openDeltas[item.product.id] ?? 0) - item.prepared;
        }
        try {
            await applyStockDeltas(openDeltas);
        } catch (stockErr) {
            console.error('Stock discount failed, rolling back pedido', stockErr);
            await supabase.from('log_items').delete().eq('daily_log_id', logId);
            await supabase.from('daily_logs').delete().eq('id', logId);
            addToast("No se pudo descontar el stock. El pedido no se ha creado.", "error");
            throw stockErr;
        }

        await refreshData();
    };

    const deleteDailyLog = async (id: string) => {
        const log = state.activeLogs.find(l => l.id === id) || state.historicalLogs.find(l => l.id === id);
        await createBackup('Antes de borrar pedido', 'auto-delete', `${log?.date || ''} ${log?.eventTitle || id}`.trim());

        // Stock held by this pedido:
        //  - OPEN: every `prepared` unit was discounted at creation and nothing
        //    has been refunded yet -> give it all back.
        //  - CLOSED/APPROVED: only the consumed units remain discounted and
        //    they physically left the warehouse -> nothing to refund.
        //  - legacy PENDING/REJECTED: never touched stock.
        const refund: Record<string, number> = {};
        if (log && log.status === 'OPEN') {
            for (const item of log.items) {
                refund[item.product.id] = (refund[item.product.id] ?? 0) + item.prepared;
            }
        }
        const hasRefund = Object.values(refund).some(v => v !== 0);
        if (hasRefund) await applyStockDeltas(refund);

        const { error } = await supabase.from('daily_logs').delete().eq('id', id);
        if (error) {
            // Compensate: the pedido still exists, so take the refund back.
            if (hasRefund) {
                const undo: Record<string, number> = {};
                for (const [pid, v] of Object.entries(refund)) undo[pid] = -v;
                try { await applyStockDeltas(undo); } catch (e) { console.error('Refund rollback failed', e); }
            }
            throw error;
        }
        await refreshData();
    };

    const logConsumption = async (id: string, itemsWithConsumption: InventoryItem[], opts?: { skipBackup?: boolean }) => {
        const currentLog = state.activeLogs.find(l => l.id === id) || state.historicalLogs.find(l => l.id === id);
        if (!currentLog) throw new Error("Log not found");

        const oldStatus = currentLog.status;

        // Single-admin flow: registering sobrantes closes the pedido for good.
        // Whatever the previous status (OPEN first close, CLOSED/APPROVED
        // re-adjustment, legacy PENDING/REJECTED), it ends APPROVED so it shows
        // up in the financial panel immediately. Stock maths below still branch
        // on the OLD status, which is what determines what was already
        // discounted/refunded.
        if (!opts?.skipBackup) {
            await createBackup('Antes de cerrar pedido (sobrantes)', 'auto-approve', `${currentLog.date} ${currentLog.eventTitle || ''}`.trim());
        }
        const targetStatus = 'APPROVED';
        const { error: logError } = await supabase.from('daily_logs').update({ status: targetStatus }).eq('id', id);
        if (logError) throw logError;

        // Batched save: one read of the log's item row-ids, one upsert with all
        // the new consumed values, and one batched stock write. The previous
        // per-item sequential loop issued ~3 requests per product (a 90-item
        // pedido = ~270 round-trips), which on feria mobile connections took
        // minutes and left half-saved stock when users gave up mid-save.
        const { data: dbItems, error: itemsFetchError } = await supabase
            .from('log_items')
            .select('id, product_id')
            .eq('daily_log_id', id);
        if (itemsFetchError) throw itemsFetchError;
        const rowIdByProduct = new Map((dbItems ?? []).map((r: any) => [r.product_id, r.id]));

        const rowsToUpsert: any[] = [];
        const stockDeltas: Record<string, number> = {};

        for (const item of itemsWithConsumption) {
            const oldItem = currentLog.items.find(i => i.product.id === item.product.id);
            const oldConsumed = oldItem?.consumed || 0;

            // Only rows that already exist in the DB get their consumed updated
            // (same semantics as the previous keyed .update(), which no-ops on
            // missing rows).
            const rowId = rowIdByProduct.get(item.product.id);
            if (rowId) {
                rowsToUpsert.push({
                    id: rowId,
                    daily_log_id: id,
                    product_id: item.product.id,
                    consumed: item.consumed
                });
            }

            let stockAdjustment = 0;

            if (oldStatus === 'CLOSED' || oldStatus === 'APPROVED') {
                // Sobrante already returned to warehouse at first close. Only the
                // delta in consumed moves stock now (less consumed -> more back).
                stockAdjustment = oldConsumed - item.consumed;
            } else if (oldStatus === 'OPEN') {
                // First close: stock was discounted by 'prepared' at open time.
                // Refund the leftover (prepared - consumed) to warehouse.
                stockAdjustment = item.prepared - item.consumed;
            } else {
                // PENDING_PEDIDO / REJECTED: stock not yet discounted; deduct what
                // was actually consumed.
                stockAdjustment = -item.consumed;
            }

            if (stockAdjustment !== 0) {
                stockDeltas[item.product.id] = (stockDeltas[item.product.id] ?? 0) + stockAdjustment;
            }
        }

        if (rowsToUpsert.length > 0) {
            const { error: upsertError } = await supabase.from('log_items').upsert(rowsToUpsert);
            if (upsertError) throw upsertError;
        }
        await applyStockDeltas(stockDeltas);
        await refreshData();
    };

    const updatePedidoItems = async (logId: string, itemsToUpdate: { product: Product, prepared: number }[]) => {
        const currentLog = state.activeLogs.find(l => l.id === logId) || state.historicalLogs.find(l => l.id === logId);
        const isAlreadyDiscounted = currentLog?.status === 'OPEN' || currentLog?.status === 'CLOSED' || currentLog?.status === 'APPROVED';

        if (isAlreadyDiscounted) {
            // Batched: accumulate every delta and write once (2 requests total).
            // Reads fresh stock from DB instead of the possibly-stale state copy.
            const deltas: Record<string, number> = {};

            for (const newItem of itemsToUpdate) {
                const oldItem = currentLog.items.find(i => i.product.id === newItem.product.id);
                const oldQuantity = oldItem ? oldItem.prepared : 0;
                const difference = newItem.prepared - oldQuantity;
                if (difference !== 0) {
                    deltas[newItem.product.id] = (deltas[newItem.product.id] ?? 0) - difference;
                }
            }

            for (const oldItem of currentLog.items) {
                const stillExists = itemsToUpdate.find(i => i.product.id === oldItem.product.id);
                if (!stillExists && oldItem.prepared > 0) {
                    deltas[oldItem.product.id] = (deltas[oldItem.product.id] ?? 0) + oldItem.prepared;
                }
            }

            await applyStockDeltas(deltas);
        }

        // First delete all existing items for this log
        const { error: deleteError } = await supabase.from('log_items').delete().eq('daily_log_id', logId);
        if (deleteError) {
            addToast("Error al limpiar pedido antiguo", "error");
            throw deleteError;
        }

        // Insert new items
        if (itemsToUpdate.length > 0) {
            const itemsToInsert = itemsToUpdate.map(item => ({
                daily_log_id: logId,
                product_id: item.product.id,
                prepared: item.prepared,
                consumed: 0
            }));
            const { error: itemsError } = await supabase.from('log_items').insert(itemsToInsert);
            if (itemsError) {
                addToast("Error al actualizar pedido", "error");
                throw itemsError;
            }
        }

        await refreshData();
        addToast("Pedido actualizado correctamente", "success");
    };

    const addEvent = async (event: EventType) => {
        await addEvents([event]);
    };

    // Bulk insert: a 6-day feria with 3 casetas is 24 rows -> 1 request.
    const addEvents = async (eventsToAdd: EventType[]) => {
        if (eventsToAdd.length === 0) return;
        const rows = eventsToAdd.map(e => ({
            id: e.id,
            date: e.date,
            title: e.title,
            description: e.description ?? '',
            type: e.type
        }));
        const { error } = await supabase.from('events').insert(rows);
        if (error) {
            addToast("Error al guardar en el calendario", "error");
            console.error(error);
            throw error;
        }
        await refreshData();
    };

    const editHistoricalLog = async (
        logId: string,
        newItems: { product: Product, prepared: number, consumed: number }[]
    ): Promise<void> => {
        const currentLog = state.historicalLogs.find(l => l.id === logId) || state.activeLogs.find(l => l.id === logId);
        if (!currentLog) throw new Error('Pedido no encontrado');
        await createBackup('Antes de editar pedido cerrado', 'auto-edit-historical', `${currentLog.date} ${currentLog.eventTitle || ''}`.trim());

        for (const item of newItems) {
            if (item.consumed > item.prepared) {
                throw new Error(`"${item.product.name}": el consumido no puede ser mayor que el preparado`);
            }
            if (item.prepared < 0 || item.consumed < 0) {
                throw new Error(`"${item.product.name}": los valores no pueden ser negativos`);
            }
        }

        // Stock logic for APPROVED/CLOSED logs:
        // - EXISTING items: stock already reflects -consumed (leftover was returned
        //   at close). Use consumed delta.
        // - NEW items added retroactively: subtract the FULL prepared (consumed +
        //   sobrante) since the sobrante hasn't been returned to the warehouse.
        // Batched: accumulate every stock delta and write once (2 requests).
        const editDeltas: Record<string, number> = {};

        for (const newItem of newItems) {
            const oldItem = currentLog.items.find(i => i.product.id === newItem.product.id);
            let stockDelta = 0;

            if (oldItem) {
                stockDelta = -(newItem.consumed - oldItem.consumed);
            } else if (newItem.prepared > 0) {
                stockDelta = -newItem.prepared;
            }

            if (stockDelta !== 0) {
                editDeltas[newItem.product.id] = (editDeltas[newItem.product.id] ?? 0) + stockDelta;
            }
        }

        // Removed items: refund their consumed units back to stock
        for (const oldItem of currentLog.items) {
            const stillExists = newItems.find(i => i.product.id === oldItem.product.id);
            if (!stillExists && oldItem.consumed > 0) {
                editDeltas[oldItem.product.id] = (editDeltas[oldItem.product.id] ?? 0) + oldItem.consumed;
            }
        }

        await applyStockDeltas(editDeltas);

        const { error: deleteError } = await supabase.from('log_items').delete().eq('daily_log_id', logId);
        if (deleteError) throw deleteError;

        if (newItems.length > 0) {
            const itemsToInsert = newItems.map(item => ({
                daily_log_id: logId,
                product_id: item.product.id,
                prepared: item.prepared,
                consumed: item.consumed
            }));
            const { error: itemsError } = await supabase.from('log_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;
        }

        await refreshData();
    };

    const editOrderTotal = async (
        eventTitle: string,
        newItems: { product: Product, prepared: number, consumed: number }[]
    ): Promise<void> => {
        await createBackup('Antes de editar total del evento', 'auto-edit-total', eventTitle);
        const normalizedTitle = eventTitle === 'Pedido General' ? '' : eventTitle;
        // Aggregate by base title (strip ' (Extra N)') so editing the merged
        // 'Caballo' total considers main + every extra under it.
        const stripExtra = (t: string) => t.replace(/\s*\(Extra\s+\d+\)\s*$/i, '');
        const orderLogs = state.historicalLogs
            .filter(l => stripExtra(l.eventTitle || 'Pedido General') === eventTitle)
            .sort((a, b) => a.date.localeCompare(b.date));

        if (orderLogs.length === 0) throw new Error('Pedido no encontrado');
        const lastLog = orderLogs[orderLogs.length - 1];

        for (const item of newItems) {
            if (item.consumed > item.prepared) throw new Error(`"${item.product.name}": consumido > preparado`);
            if (item.prepared < 0 || item.consumed < 0) throw new Error(`"${item.product.name}": valores negativos`);
        }

        // Build a working copy of every log's items so we can spread changes
        // across multiple days when the user reduces a product below the
        // capacity of any single day.
        type WorkingItem = { product: Product; prepared: number; consumed: number };
        const working: { id: string; date: string; items: Map<string, WorkingItem> }[] = orderLogs.map(log => ({
            id: log.id,
            date: log.date,
            items: new Map(log.items.map(it => [it.product.id, { product: it.product, prepared: it.prepared, consumed: it.consumed }])),
        }));

        const oldTotals: Record<string, { prepared: number; consumed: number }> = {};
        orderLogs.forEach(log => {
            log.items.forEach(it => {
                if (!oldTotals[it.product.id]) oldTotals[it.product.id] = { prepared: 0, consumed: 0 };
                oldTotals[it.product.id].prepared += it.prepared;
                oldTotals[it.product.id].consumed += it.consumed;
            });
        });

        const stockAdjustments: { productId: string; delta: number; product: Product }[] = [];

        for (const ni of newItems) {
            const existedBefore = !!oldTotals[ni.product.id];
            const old = oldTotals[ni.product.id] || { prepared: 0, consumed: 0 };
            let dPrep = ni.prepared - old.prepared;
            let dCons = ni.consumed - old.consumed;

            // Apply additions to the last log; spread reductions backwards
            // across days from latest to earliest, taking what's available.
            for (let i = working.length - 1; i >= 0 && (dPrep !== 0 || dCons !== 0); i--) {
                const log = working[i];
                const it = log.items.get(ni.product.id) || { product: ni.product, prepared: 0, consumed: 0 };

                // Prepared: positive deltas only land on the last log; negative
                // deltas can be absorbed by any log up to its prepared amount.
                if (dPrep > 0 && i === working.length - 1) {
                    it.prepared += dPrep;
                    dPrep = 0;
                } else if (dPrep < 0) {
                    const reduce = Math.min(-dPrep, it.prepared);
                    it.prepared -= reduce;
                    dPrep += reduce;
                }

                // Consumed: same rule. After both, ensure consumed <= prepared.
                if (dCons > 0 && i === working.length - 1) {
                    it.consumed += dCons;
                    dCons = 0;
                } else if (dCons < 0) {
                    const reduce = Math.min(-dCons, it.consumed);
                    it.consumed -= reduce;
                    dCons += reduce;
                }
                if (it.consumed > it.prepared) {
                    const fix = it.consumed - it.prepared;
                    it.consumed -= fix;
                    dCons += fix;
                }

                if (it.prepared === 0 && it.consumed === 0) log.items.delete(ni.product.id);
                else log.items.set(ni.product.id, it);
            }

            if (dPrep < 0 || dCons < 0) {
                throw new Error(`"${ni.product.name}": la reducción solicitada supera lo registrado en el evento.`);
            }
            if (dPrep > 0 || dCons > 0) {
                throw new Error(`"${ni.product.name}": no se pudo aplicar el aumento en el último día.`);
            }

            if (existedBefore) {
                const finalCons = ni.consumed - old.consumed;
                if (finalCons !== 0) stockAdjustments.push({ productId: ni.product.id, delta: -finalCons, product: ni.product });
            } else if (ni.prepared > 0) {
                stockAdjustments.push({ productId: ni.product.id, delta: -ni.prepared, product: ni.product });
            }
        }

        // Removed products: drop them from every log and refund consumed.
        for (const oldId of Object.keys(oldTotals)) {
            const stillExists = newItems.find(ni => ni.product.id === oldId);
            if (!stillExists) {
                const old = oldTotals[oldId];
                if (old.consumed > 0) {
                    const prod = orderLogs.flatMap(l => l.items).find(i => i.product.id === oldId)?.product;
                    if (prod) stockAdjustments.push({ productId: oldId, delta: old.consumed, product: prod });
                }
                for (const log of working) log.items.delete(oldId);
            }
        }

        // Batched: one read + one write for every adjustment (2 requests).
        const totalDeltas: Record<string, number> = {};
        for (const adj of stockAdjustments) {
            totalDeltas[adj.productId] = (totalDeltas[adj.productId] ?? 0) + adj.delta;
        }
        await applyStockDeltas(totalDeltas);

        // Persist every changed log: wipe and re-insert its items.
        for (const log of working) {
            const original = orderLogs.find(l => l.id === log.id);
            const originalItems = new Map(original!.items.map(it => [it.product.id, it]));
            const changed = log.items.size !== originalItems.size
                || Array.from(log.items.values()).some(it => {
                    const o = originalItems.get(it.product.id);
                    return !o || o.prepared !== it.prepared || o.consumed !== it.consumed;
                });
            if (!changed) continue;

            const { error: delErr } = await supabase.from('log_items').delete().eq('daily_log_id', log.id);
            if (delErr) throw delErr;

            const itemsToInsert = Array.from(log.items.values()).map(it => ({
                daily_log_id: log.id,
                product_id: it.product.id,
                prepared: it.prepared,
                consumed: it.consumed,
            }));
            if (itemsToInsert.length > 0) {
                const { error: insErr } = await supabase.from('log_items').insert(itemsToInsert);
                if (insErr) throw insErr;
            }
        }

        void normalizedTitle;
        void lastLog;
        await refreshData();
    };

    // ─── Backups storage in localStorage ─────────────────────────────────
    // Each backup row stored as `macario_backup_<id>` with the full payload.
    // Index of all backup ids stored at `macario_backups_index`.
    // Cap at 30 most recent to avoid quota issues (~3MB total).
    const BACKUP_KEY_PREFIX = 'macario_backup_';
    const BACKUP_INDEX_KEY = 'macario_backups_index';
    const BACKUP_MAX = 30;

    const readBackupIndex = (): string[] => {
        try {
            const raw = localStorage.getItem(BACKUP_INDEX_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    };

    const writeBackupIndex = (ids: string[]) => {
        localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(ids));
    };

    const createBackup = async (
        label: string,
        triggerType: BackupTrigger = 'manual',
        description?: string
    ): Promise<BackupSnapshot | null> => {
        try {
            const [products, events, daily_logs, log_items] = await Promise.all([
                fetchAll('products'),
                fetchAll('events'),
                fetchAll('daily_logs'),
                fetchAll('log_items'),
            ]);
            const payload = {
                fecha: new Date().toISOString(),
                products,
                events,
                daily_logs,
                log_items,
            };
            const serialized = JSON.stringify(payload);
            const sizeBytes = serialized.length;
            const id = `bkp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const row = {
                id,
                created_at: payload.fecha,
                label: label || null,
                trigger_type: triggerType,
                description: description || null,
                payload,
                products_count: payload.products.length,
                events_count: payload.events.length,
                daily_logs_count: payload.daily_logs.length,
                log_items_count: payload.log_items.length,
                size_bytes: sizeBytes,
            };

            try {
                localStorage.setItem(BACKUP_KEY_PREFIX + id, JSON.stringify(row));
            } catch (storageErr) {
                console.warn('Local storage quota exceeded, evicting oldest backup');
                const idx = readBackupIndex();
                if (idx.length > 0) {
                    const oldestId = idx[idx.length - 1];
                    localStorage.removeItem(BACKUP_KEY_PREFIX + oldestId);
                    writeBackupIndex(idx.slice(0, -1));
                    localStorage.setItem(BACKUP_KEY_PREFIX + id, JSON.stringify(row));
                } else {
                    throw storageErr;
                }
            }

            const idx = readBackupIndex();
            const newIdx = [id, ...idx].slice(0, BACKUP_MAX);
            // Evict any ids dropped from the cap
            for (const dropped of idx.slice(BACKUP_MAX - 1)) {
                if (!newIdx.includes(dropped)) localStorage.removeItem(BACKUP_KEY_PREFIX + dropped);
            }
            writeBackupIndex(newIdx);

            return { ...row, payload: undefined } as BackupSnapshot;
        } catch (e: any) {
            console.warn('Backup snapshot failed:', e?.message || e);
            return null;
        }
    };

    const assignExtraToFeria = async (logId: string, feriaName: string, casetaName?: string): Promise<void> => {
        const trimmedFeria = feriaName.trim();
        if (!trimmedFeria) throw new Error('Selecciona una feria');
        const trimmedCaseta = (casetaName || '').trim();

        const log = state.activeLogs.find(l => l.id === logId) || state.historicalLogs.find(l => l.id === logId);
        if (!log) throw new Error('Pedido no encontrado');

        const summary = trimmedCaseta ? `${log.date} → ${trimmedFeria} / ${trimmedCaseta}` : `${log.date} → ${trimmedFeria}`;
        await createBackup('Antes de asignar extra a feria', 'auto-edit-historical', summary);

        const allLogs = [...state.activeLogs, ...state.historicalLogs];

        // Build the destination title:
        //  - With caseta: "Pedido <Feria> - Caseta: <Caseta> (Extra N)"
        //    matches existing extras-within-caseta naming pattern.
        //  - Without caseta: "<Feria> - Caseta: Extra N"
        //    treats feria as a virtual caseta-less group.
        let newTitle: string;
        if (trimmedCaseta) {
            const baseTitle = `Pedido ${trimmedFeria} - Caseta: ${trimmedCaseta}`;
            const extraPattern = new RegExp(`^${baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(Extra (\\d+)\\)$`);
            let maxN = 0;
            for (const l of allLogs) {
                const m = l.eventTitle?.match(extraPattern);
                if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
            }
            newTitle = `${baseTitle} (Extra ${maxN + 1})`;
        } else {
            const prefix = `${trimmedFeria} - Caseta: Extra `;
            let maxN = 0;
            for (const l of allLogs) {
                if (l.eventTitle?.startsWith(prefix)) {
                    const m = l.eventTitle.match(/Extra (\d+)$/);
                    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
                }
            }
            newTitle = `${trimmedFeria} - Caseta: Extra ${maxN + 1}`;
        }
        const newLogId = `log-${Date.now()}---${newTitle}`;

        // 1. Insert new log row (so log_items FK target exists)
        const { error: insertErr } = await supabase
            .from('daily_logs')
            .insert({ id: newLogId, date: log.date, status: log.status });
        if (insertErr) throw insertErr;

        // 2. Re-point every log_item from old log id to new
        const { error: updateErr } = await supabase
            .from('log_items')
            .update({ daily_log_id: newLogId })
            .eq('daily_log_id', logId);
        if (updateErr) {
            // rollback the inserted log so we don't leave an orphan
            await supabase.from('daily_logs').delete().eq('id', newLogId);
            throw updateErr;
        }

        // 3. Delete old log row
        const { error: delErr } = await supabase.from('daily_logs').delete().eq('id', logId);
        if (delErr) throw delErr;

        await refreshData();
    };

    const duplicateDailyLog = async (sourceLogId: string, newDate: string): Promise<void> => {
        const sourceLog = state.activeLogs.find(l => l.id === sourceLogId)
            || state.historicalLogs.find(l => l.id === sourceLogId);
        if (!sourceLog) throw new Error('Pedido origen no encontrado');

        const items: InventoryItem[] = sourceLog.items
            .filter(i => i.prepared > 0)
            .map(i => ({
                product: i.product,
                prepared: i.prepared,
                consumed: 0
            }));

        if (items.length === 0) throw new Error('El pedido origen no tiene productos');
        await openDailyLog(newDate, items, sourceLog.eventTitle);
    };

    const removeEvent = async (id: string) => {
        await removeEvents([id]);
    };

    // Bulk delete: removing a whole feria (all days x all casetas) is 1 request.
    const removeEvents = async (ids: string[]) => {
        if (ids.length === 0) return;
        const { error } = await supabase.from('events').delete().in('id', ids);
        if (error) {
            addToast("Error al eliminar del calendario", "error");
            console.error(error);
            throw error;
        }
        await refreshData();
    };

    return (
        <AppContext.Provider value={{
            ...state,
            setRole,
            addCategory,
            removeCategory,
            addProduct,
            updateProduct,
            deleteProduct,
            openDailyLog,
            deleteDailyLog,
            logConsumption,
            addEvent,
            addEvents,
            removeEvent,
            removeEvents,
            refreshData,
            updatePedidoItems,
            editHistoricalLog,
            editOrderTotal,
            duplicateDailyLog,
            assignExtraToFeria,
            createBackup
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
