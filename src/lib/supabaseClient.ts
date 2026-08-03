import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
}

// --- Escudo de Peticiones (Rate Limiter) ---
// Evita ataques de denegación de servicio en el frontend o bucles infinitos accidentales.
// Limite: 50 peticiones cada 10 segundos por cliente.
const REQUEST_LIMIT = 500;
const TIME_WINDOW = 10000;
let requestTimes: number[] = [];

// Custom fetch interceptor
const secureFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const now = Date.now();
    // Limpiar peticiones antiguas
    requestTimes = requestTimes.filter(time => now - time < TIME_WINDOW);
    
    // Si superamos el límite, bloqueamos la petición
    if (requestTimes.length >= REQUEST_LIMIT) {
        console.error("⛔ ALERTA DE SEGURIDAD (ESCUDO MACARIO): Demasiadas peticiones detectadas. Bloqueando posible ataque de bucle infinito/DoS para proteger la base de datos.");
        // Lanzamos un error que el frontend capturará o ignorará si es spam
        throw new Error("Rate limit exceeded. Escudo activado protector de peticiones en bucle.");
    }
    
    // Registrar la petición actual
    requestTimes.push(now);
    
    // Proceder con la petición normal usando el fetch del navegador
    return window.fetch(input, init);
};

// Se instancia el cliente de Supabase usando nuestro fetch seguro
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        fetch: secureFetch
    }
});

/**
 * Walks a table in 1000-row pages until exhausted.
 *
 * Supabase REST silently caps responses at 1000 rows by default. Any code path
 * that does `supabase.from(table).select('*')` and then assumes it has every
 * row is a latent data-truncation bug. Use this helper instead.
 *
 * Optional filters can be applied via the `customise` callback.
 */
export async function fetchAll<T = any>(
    table: string,
    options: {
        select?: string;
        orderBy?: { column: string; ascending?: boolean };
        customise?: (q: any) => any; // allow .eq(...).in(...) etc
    } = {}
): Promise<T[]> {
    const PAGE = 1000;
    const all: T[] = [];
    for (let from = 0; ; from += PAGE) {
        let q = supabase.from(table).select(options.select || '*');
        // Paginating without a stable ORDER BY lets Postgres return rows in any
        // order per page, which can duplicate or drop rows across page
        // boundaries once a table exceeds PAGE rows. Default to ordering by id.
        if (options.orderBy) {
            q = q.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false });
        } else {
            q = q.order('id', { ascending: true });
        }
        if (options.customise) q = options.customise(q);
        q = q.range(from, from + PAGE - 1);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as unknown as T[]));
        if (data.length < PAGE) break;
    }
    return all;
}

/**
 * Applies many stock changes in O(1) requests instead of 2 per product.
 *
 * Reads the affected products fresh from the DB (avoids stale-state races),
 * applies each delta clamped at zero, and writes everything back with a single
 * upsert per 100-product chunk. Sequential per-product select+update loops
 * take 30-90s on mobile connections for large pedidos and leave half-saved
 * stock when the user gives up mid-save; this makes the same operation 2
 * requests.
 *
 * Returns the number of products actually updated.
 */
export async function applyStockDeltas(deltas: Record<string, number>): Promise<number> {
    const ids = Object.keys(deltas).filter(id => deltas[id] !== 0);
    if (ids.length === 0) return 0;

    let updated = 0;
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { data: rows, error } = await supabase.from('products').select('*').in('id', chunk);
        if (error) throw error;
        const patched = (rows ?? []).map((r: any) => ({ ...r, stock: Math.max(0, (r.stock ?? 0) + deltas[r.id]) }));
        if (patched.length > 0) {
            const { error: upErr } = await supabase.from('products').upsert(patched);
            if (upErr) throw upErr;
            updated += patched.length;
        }
    }
    return updated;
}

