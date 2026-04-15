import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, Role, Product, DailyLog, InventoryItem, EventType } from '../types';
import { supabase } from '../lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { useToast } from './ToastContext';

interface AppContextType extends AppState {
    setRole: (role: Role) => void;
    addCategory: (category: string) => void;
    removeCategory: (category: string) => Promise<void>;
    addProduct: (product: Product) => Promise<void>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;
    openDailyLog: (date: string, initialItems: InventoryItem[], eventTitle?: string) => Promise<void>;
    approvePedido: (id: string) => Promise<void>;
    rejectPedido: (id: string) => Promise<void>;
    deleteDailyLog: (id: string) => Promise<void>;
    logConsumption: (id: string, items: InventoryItem[]) => Promise<void>;
    approveDailyLog: (id: string) => Promise<void>;
    addEvent: (event: EventType) => Promise<void>;
    removeEvent: (id: string) => Promise<void>;
    refreshData: () => Promise<void>;
    updatePedidoItems: (logId: string, items: { product: Product, prepared: number }[]) => Promise<void>;
    isPushEnabled: boolean;
    requestPushPermission: () => Promise<boolean>;
}

const defaultCategories = ['Artículos de limpieza', 'Precocinados', 'Bebidas', 'General'];

const urlB64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const getInitialState = (): AppState => {
    // Role still in local storage to keep session
    const role = localStorage.getItem('dukeControlRole') as Role || null;
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
        const { data, error } = await supabase.from('products').select('*');
        if (error) { console.error("Error fetching products:", error); return; }
        setState(s => ({ ...s, products: data as Product[] }));
        return data as Product[];
    };

    const refreshLogs = async (currentProducts: Product[]) => {
        const { data: logsData, error: logsError } = await supabase.from('daily_logs').select('*').order('date', { ascending: false });
        if (logsError) { console.error("Error fetching logs:", logsError); return; }

        const { data: itemsData, error: itemsError } = await supabase.from('log_items').select('*');
        if (itemsError) { console.error("Error fetching log items:", itemsError); return; }

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
    };

    const refreshData = async () => {
        const prods = await refreshProducts();
        if (prods) await refreshLogs(prods);

        // Refresh Events
        const { data: eventsData, error: eventsError } = await supabase.from('events').select('*');
        if (eventsError) {
            console.error("Error fetching events:", eventsError);
        } else {
            setState(s => ({ ...s, events: eventsData as EventType[] }));
        }
    };

    const [isPushEnabled, setIsPushEnabled] = useState(false);

    // Expose this so UI can call it on user click
    const requestPushPermission = async () => {
        const VAPID_PUBLIC_KEY = 'BOm8-2sqpNvLphDwDp2Vw2vUjiO5ksWSOmosp7syQjye7_PE_YojzXDOMLyZCOxgL7MGPPHPsX5gH709PnGEglg';

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            addToast("Tu navegador no soporta notificaciones", "error");
            return false;
        }

        try {
            // First register service worker if not already registered
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

            // Clean up old subscriptions to prevent key mismatch errors
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
            }

            // Ask for permission explicitly
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setIsPushEnabled(false);
                return false;
            }

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            // Save subscription to Supabase
            const role = localStorage.getItem('dukeControlRole') || 'EMPLOYEE';
            const subJson = subscription.toJSON();
            await supabase.from('push_subscriptions').upsert({
                endpoint: subJson.endpoint,
                user_role: role,
                subscription: subJson
            }, { onConflict: 'endpoint' });

            setIsPushEnabled(true);
            addToast("Notificaciones activadas", "success");
            return true;

        } catch (e: any) {
            console.error('Push subscribe failed:', e);
            addToast(`Error al activar notificaciones: ${e.message || 'Desconocido'}`, "error");
            return false;
        }
    };

    useEffect(() => {
        refreshData();

        // Check if we already have permission on mount, without asking again
        if ('Notification' in window && Notification.permission === 'granted') {
            setIsPushEnabled(true);
            // We could optionally re-subscribe here quietly, but let's keep it simple
            // and assume it's still alive.
        }

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
                const pendingCount = [...state.activeLogs, ...state.historicalLogs].filter(
                    l => l.status === 'PENDING_PEDIDO' || l.status === 'CLOSED'
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
        const { error: logError } = await supabase.from('daily_logs').insert({
            id: logId,
            date,
            status: 'PENDING_PEDIDO'
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

        // Notify masters via push notification - called from employee's device
        // so it fires even when the master app is closed
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
            await sb.functions.invoke('send-web-push', {
                body: {
                    title: '📦 Nuevo Pedido Creado',
                    message: `La cocina ha enviado un pedido para el ${date}${eventTitle ? ` (${eventTitle})` : ''}. Pendiente de revisión.`,
                    target_role: 'MASTER'
                },
                headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
            });
        } catch (e) {
            console.warn('Push notification failed (non-critical):', e);
        }

        await refreshData();
    };

    const approvePedido = async (id: string) => {
        const log = state.activeLogs.find(l => l.id === id);
        if (!log) return;

        // Safety check: verify the order is still PENDING_PEDIDO in DB (prevents double-decrement)
        const { data: currentLogStatus } = await supabase.from('daily_logs').select('status').eq('id', id).single();
        if (currentLogStatus?.status !== 'PENDING_PEDIDO') return;

        // Decrease stock using CURRENT values from DB, not stale state
        for (const item of log.items) {
            const { data: freshProduct } = await supabase.from('products').select('stock').eq('id', item.product.id).single();
            const currentStock = freshProduct?.stock ?? item.product.stock;
            const newStock = Math.max(0, currentStock - item.prepared);
            await supabase.from('products').update({ stock: newStock }).eq('id', item.product.id);
        }

        const { error } = await supabase.from('daily_logs').update({ status: 'OPEN' }).eq('id', id);
        if (error) throw error;
        await refreshData();
    };

    const rejectPedido = async (id: string) => {
        const { error } = await supabase.from('daily_logs').update({ status: 'REJECTED' }).eq('id', id);
        if (error) throw error;
        await refreshData();
    };

    const deleteDailyLog = async (id: string) => {
        const { error } = await supabase.from('daily_logs').delete().eq('id', id);
        if (error) throw error;
        await refreshData();
    };

    const logConsumption = async (id: string, itemsWithConsumption: InventoryItem[]) => {
        const currentLog = state.activeLogs.find(l => l.id === id) || state.historicalLogs.find(l => l.id === id);
        if (!currentLog) throw new Error("Log not found");

        const oldStatus = currentLog.status;
        const { error: logError } = await supabase.from('daily_logs').update({ status: 'CLOSED' }).eq('id', id);
        if (logError) throw logError;

        for (const item of itemsWithConsumption) {
            const oldItem = currentLog.items.find(i => i.product.id === item.product.id);
            const oldConsumed = oldItem?.consumed || 0;

            // update consumed in DB
            await supabase.from('log_items').update({ consumed: item.consumed })
                .eq('daily_log_id', id)
                .eq('product_id', item.product.id);

            let stockAdjustment = 0;

            if (oldStatus === 'CLOSED') {
                // Already closed: only handle the delta between old and new consumption
                // If we consume LESS now, we return MORE to stock.
                stockAdjustment = oldConsumed - item.consumed;
            } else if (oldStatus === 'OPEN' || oldStatus === 'APPROVED') {
                // Stock was already discounted by 'prepared' quantity in handleSaveOrder/updatePedidoItems
                // We must refund the "leftover" (prepared - consumed)
                stockAdjustment = item.prepared - item.consumed;
            } else {
                // PENDING_PEDIDO or REJECTED: Stock was NOT discounted yet.
                // Subtract the full consumed amount.
                stockAdjustment = -item.consumed;
            }

            if (stockAdjustment !== 0) {
                const { data: freshProduct } = await supabase.from('products').select('stock').eq('id', item.product.id).single();
                const currentStock = freshProduct?.stock ?? item.product.stock;
                const newStock = Math.max(0, currentStock + stockAdjustment);
                await supabase.from('products').update({ stock: newStock }).eq('id', item.product.id);
            }
        }
        await refreshData();
    };

    const approveDailyLog = async (id: string) => {
        const log = state.activeLogs.find(l => l.id === id) || state.historicalLogs.find(l => l.id === id);
        const { error } = await supabase.from('daily_logs').update({ status: 'APPROVED' }).eq('id', id);
        if (error) throw error;

        // Usar cliente limpio (sin rate limiter) igual que el botón de prueba
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
            await sb.functions.invoke('send-web-push', {
                body: {
                    title: '📄 Nueva Factura Disponible',
                    message: `Se ha aprobado el pedido del ${log?.date || ''}${log?.eventTitle ? ` (${log.eventTitle})` : ''}. Ya puedes consultarlo e imprimirlo.`,
                    target_role: 'VIEWER'
                },
                headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
            });
        } catch (e) {
            console.warn('Push VIEWER failed (non-critical):', e);
        }

        await refreshData();
    };

    const updatePedidoItems = async (logId: string, itemsToUpdate: { product: Product, prepared: number }[]) => {
        const currentLog = state.activeLogs.find(l => l.id === logId) || state.historicalLogs.find(l => l.id === logId);
        const isAlreadyDiscounted = currentLog?.status === 'OPEN' || currentLog?.status === 'CLOSED' || currentLog?.status === 'APPROVED';

        if (isAlreadyDiscounted) {
            for (const newItem of itemsToUpdate) {
                const oldItem = currentLog.items.find(i => i.product.id === newItem.product.id);
                const oldQuantity = oldItem ? oldItem.prepared : 0;
                const difference = newItem.prepared - oldQuantity;

                if (difference !== 0) {
                    const newStock = Math.max(0, newItem.product.stock - difference);
                    await supabase.from('products').update({ stock: newStock }).eq('id', newItem.product.id);
                }
            }

            for (const oldItem of currentLog.items) {
                const stillExists = itemsToUpdate.find(i => i.product.id === oldItem.product.id);
                if (!stillExists && oldItem.prepared > 0) {
                    const newStock = oldItem.product.stock + oldItem.prepared;
                    await supabase.from('products').update({ stock: newStock }).eq('id', oldItem.product.id);
                }
            }
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
        const { error } = await supabase.from('events').insert({
            id: event.id,
            date: event.date,
            title: event.title,
            description: event.description,
            type: event.type
        });

        if (error) {
            addToast("Error al guardar el evento", "error");
            console.error(error);
        } else {
            // Send push notification when an event is successfully created
            try {
                const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
                await sb.functions.invoke('send-web-push', {
                    body: { title: '📅 Nuevo Evento Programado', message: 'Se ha añadido un nuevo evento o feria al calendario.', target_role: 'MASTER' },
                    headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
                });
            } catch (e) {
                console.warn('Push notification failed (non-critical):', e);
            }
            await refreshData();
        }
    };

    const removeEvent = async (id: string) => {
        const { error } = await supabase.from('events').delete().eq('id', id);

        if (error) {
            addToast("Error al eliminar el evento", "error");
            console.error(error);
        } else {
            await refreshData();
        }
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
            approvePedido,
            rejectPedido,
            deleteDailyLog,
            logConsumption,
            approveDailyLog,
            addEvent,
            removeEvent,
            refreshData,
            updatePedidoItems,
            isPushEnabled,
            requestPushPermission
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
