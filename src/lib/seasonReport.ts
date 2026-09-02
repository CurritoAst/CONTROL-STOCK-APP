import { DailyLog, Product } from '../types';

/**
 * Cálculo del informe de temporada.
 *
 * Vive aparte a propósito: el Excel y el PDF consumen EXACTAMENTE este mismo
 * resultado, así que es imposible que los dos informes digan cifras distintas.
 *
 * Sólo se cuentan los pedidos CERRADOS (APPROVED): en un pedido aún en curso el
 * consumido todavía es 0, así que contarlo diría que "sobró todo" y falsearía
 * el informe. Los pedidos abiertos se devuelven aparte para poder avisar.
 */

// ─── Parseo de títulos (mismo formato que Pedidos / Calendario / Financiero) ──
//   EVENT: '<Feria>'   ORDER/log: 'Pedido <Feria> - Caseta: <Caseta>' (+ ' (Extra N)')
const CASETA_SEP = ' - Caseta: ';
const EXTRA_SUFFIX = /\s*\(Extra\s+\d+\)\s*$/i;

export const feriaOf = (eventTitle?: string): string => {
    if (!eventTitle) return 'Pedido General';
    return eventTitle.replace(/^Pedido /, '').split(CASETA_SEP)[0].replace(EXTRA_SUFFIX, '').trim() || 'Pedido General';
};

export const casetaOf = (eventTitle?: string): string => {
    if (!eventTitle) return '—';
    const idx = eventTitle.indexOf(CASETA_SEP);
    if (idx === -1) return '—';
    return eventTitle.slice(idx + CASETA_SEP.length).replace(EXTRA_SUFFIX, '').trim() || '—';
};

// Un pedido "Extra" es el mismo servicio: se agrupa con su caseta base.
export const isExtra = (eventTitle?: string) => !!eventTitle && EXTRA_SUFFIX.test(eventTitle);

export interface SeasonExportOptions {
    from?: string;   // 'YYYY-MM-DD' inclusive
    to?: string;     // 'YYYY-MM-DD' inclusive
    feria?: string;  // nombre exacto de feria, o vacío = todas
}

export interface ProductRow {
    productId: string;
    name: string;
    category: string;
    price: number;
    prepared: number;
    consumed: number;
}

export interface FeriaRow {
    name: string;
    dias: number;
    pedidos: number;
    prepared: number;
    consumed: number;
    cost: number;
}

export interface FeriaProductRow extends ProductRow {
    feria: string;
    caseta: string;
}

export interface SeasonReport {
    opts: SeasonExportOptions;
    periodoLabel: string;
    /** Pedidos cerrados incluidos, ordenados por fecha. */
    logs: DailyLog[];
    /** Pedidos sin cerrar dentro del periodo (excluidos del informe: sólo aviso). */
    openInRange: DailyLog[];
    products: Product[];
    productRows: ProductRow[];
    feriaRows: FeriaRow[];
    feriaProductRows: FeriaProductRow[];
    totals: {
        prepared: number;
        consumed: number;
        sobrante: number;
        costConsumed: number;
        valueSobrante: number;
        aprovechado: number; // 0..1
    };
    /** Rango real de fechas con datos, ya formateado dd/mm/aaaa. */
    firstDate: string | null;
    lastDate: string | null;
}

export const pct = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
export const dmy = (iso: string) => iso.split('-').reverse().join('/');

export function buildSeasonReport(
    closedLogs: DailyLog[],
    openLogs: DailyLog[],
    products: Product[],
    opts: SeasonExportOptions = {}
): SeasonReport {
    const { from, to, feria } = opts;

    const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
    const matches = (l: DailyLog) => inRange(l.date) && (!feria || feriaOf(l.eventTitle) === feria);

    const logs = closedLogs.filter(matches).sort((a, b) => a.date.localeCompare(b.date));
    const openInRange = openLogs.filter(l => matches(l) && l.status !== 'REJECTED');

    const byProduct = new Map<string, ProductRow>();
    const byFeria = new Map<string, { prepared: number; consumed: number; cost: number; dates: Set<string>; pedidos: number }>();
    const byFeriaProduct = new Map<string, FeriaProductRow>();

    for (const log of logs) {
        const f = feriaOf(log.eventTitle);
        const c = casetaOf(log.eventTitle);

        const fAgg = byFeria.get(f) ?? { prepared: 0, consumed: 0, cost: 0, dates: new Set<string>(), pedidos: 0 };
        fAgg.dates.add(log.date);
        fAgg.pedidos += 1;

        for (const it of log.items) {
            const { product: p, prepared, consumed } = it;
            const category = p.category || 'General';

            const pr = byProduct.get(p.id)
                ?? { productId: p.id, name: p.name.trim(), category, price: p.price, prepared: 0, consumed: 0 };
            pr.prepared += prepared;
            pr.consumed += consumed;
            byProduct.set(p.id, pr);

            const key = `${f}||${c}||${p.id}`;
            const fp = byFeriaProduct.get(key)
                ?? { feria: f, caseta: c, productId: p.id, name: p.name.trim(), category, price: p.price, prepared: 0, consumed: 0 };
            fp.prepared += prepared;
            fp.consumed += consumed;
            byFeriaProduct.set(key, fp);

            fAgg.prepared += prepared;
            fAgg.consumed += consumed;
            fAgg.cost += consumed * p.price;
        }
        byFeria.set(f, fAgg);
    }

    const productRows = Array.from(byProduct.values()).sort(
        (a, b) => a.category.localeCompare(b.category, 'es') || a.name.localeCompare(b.name, 'es')
    );

    const feriaRows: FeriaRow[] = Array.from(byFeria.entries())
        .map(([name, f]) => ({ name, dias: f.dates.size, pedidos: f.pedidos, prepared: f.prepared, consumed: f.consumed, cost: f.cost }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    const feriaProductRows = Array.from(byFeriaProduct.values()).sort(
        (a, b) => a.feria.localeCompare(b.feria, 'es') || a.caseta.localeCompare(b.caseta, 'es') || a.name.localeCompare(b.name, 'es')
    );

    const prepared = productRows.reduce((s, r) => s + r.prepared, 0);
    const consumed = productRows.reduce((s, r) => s + r.consumed, 0);
    const costConsumed = productRows.reduce((s, r) => s + r.consumed * r.price, 0);
    const valueSobrante = productRows.reduce((s, r) => s + (r.prepared - r.consumed) * r.price, 0);

    const dates = logs.map(l => l.date).sort();

    const periodoLabel = from || to
        ? `${from ? dmy(from) : 'inicio'} — ${to ? dmy(to) : 'hoy'}`
        : 'Toda la temporada';

    return {
        opts,
        periodoLabel,
        logs,
        openInRange,
        products,
        productRows,
        feriaRows,
        feriaProductRows,
        totals: {
            prepared,
            consumed,
            sobrante: prepared - consumed,
            costConsumed,
            valueSobrante,
            aprovechado: pct(consumed, prepared),
        },
        firstDate: dates.length ? dates[0] : null,
        lastDate: dates.length ? dates[dates.length - 1] : null,
    };
}

/** Nombre de archivo común a Excel y PDF. */
export function reportFileName(report: SeasonReport, ext: 'xlsx' | 'pdf'): string {
    const stamp = new Date().toISOString().slice(0, 10);
    const f = report.opts.feria;
    const slug = f ? `-${f.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40)}` : '';
    return `Informe-temporada${slug}-${stamp}.${ext}`;
}

/** Dispara la descarga de un blob ya generado. */
export function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
