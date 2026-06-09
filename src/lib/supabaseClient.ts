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
        if (options.orderBy) q = q.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false });
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

