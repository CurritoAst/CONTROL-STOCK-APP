import type { Workbook, Worksheet, Fill } from 'exceljs';
import { DailyLog, Product } from '../types';

/**
 * Informe de temporada en Excel.
 *
 * Objetivo: al terminar el periodo de ferias, poder sacar TODO el movimiento de
 * almacén — lo enviado, lo consumido y lo sobrante — por producto, por feria y
 * día a día. Las unidades son el dato principal; el dinero va como columna
 * secundaria.
 *
 * Sólo se cuentan los pedidos CERRADOS (APPROVED): en un pedido aún en curso el
 * consumido todavía es 0, así que contarlo diría que "sobró todo" y falsearía
 * el informe. Los pedidos abiertos se avisan en la hoja Resumen.
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
const isExtra = (eventTitle?: string) => !!eventTitle && EXTRA_SUFFIX.test(eventTitle);

export interface SeasonExportOptions {
    from?: string;   // 'YYYY-MM-DD' inclusive
    to?: string;     // 'YYYY-MM-DD' inclusive
    feria?: string;  // nombre exacto de feria, o vacío = todas
}

interface Row {
    productId: string;
    name: string;
    category: string;
    price: number;
    prepared: number;
    consumed: number;
}

// ─── Estilos ─────────────────────────────────────────────────────────────────
const HEADER_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const TOTAL_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
const UNITS_FMT = '#,##0';
const EUR_FMT = '#,##0.00 "€"';
const PCT_FMT = '0%';

type ColDef = { header: string; key: string; width: number; fmt?: string };

const addSheet = (wb: Workbook, name: string, cols: ColDef[]) => {
    const ws = wb.addWorksheet(name, {
        views: [{ state: 'frozen', ySplit: 1 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width }));
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    head.fill = HEADER_FILL;
    head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    head.height = 26;
    cols.forEach((c, i) => { if (c.fmt) ws.getColumn(i + 1).numFmt = c.fmt; });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
};

const addTotalRow = (ws: Worksheet, values: any[]) => {
    const row = ws.addRow(values);
    row.font = { bold: true };
    row.fill = TOTAL_FILL;
    row.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
    return row;
};

const pct = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

/**
 * Construye y descarga el Excel de temporada.
 * `closedLogs` = historicalLogs (APPROVED). `openLogs` = activeLogs (para el aviso).
 */
export async function downloadSeasonExcel(
    closedLogs: DailyLog[],
    openLogs: DailyLog[],
    products: Product[],
    opts: SeasonExportOptions = {}
): Promise<{ pedidos: number; productos: number }> {
    const { from, to, feria } = opts;

    const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
    const logs = closedLogs
        .filter(l => inRange(l.date))
        .filter(l => !feria || feriaOf(l.eventTitle) === feria)
        .sort((a, b) => a.date.localeCompare(b.date));

    const openInRange = openLogs
        .filter(l => inRange(l.date))
        .filter(l => !feria || feriaOf(l.eventTitle) === feria)
        .filter(l => l.status !== 'REJECTED');

    // Carga diferida: exceljs pesa ~850 kB y solo hace falta al pulsar el boton,
    // asi que no debe entrar en el bundle inicial del Panel.
    const mod: any = await import('exceljs');
    const ExcelJSRuntime = mod.default ?? mod;
    const wb: Workbook = new ExcelJSRuntime.Workbook();
    wb.creator = 'DukeControl';
    wb.created = new Date();

    // ── Acumuladores ─────────────────────────────────────────────────────────
    const byProduct = new Map<string, Row>();
    const byFeria = new Map<string, { prepared: number; consumed: number; cost: number; dates: Set<string>; pedidos: number }>();
    const byFeriaProduct = new Map<string, Row & { feria: string; caseta: string }>();

    for (const log of logs) {
        const f = feriaOf(log.eventTitle);
        const c = casetaOf(log.eventTitle);

        const fAgg = byFeria.get(f) ?? { prepared: 0, consumed: 0, cost: 0, dates: new Set<string>(), pedidos: 0 };
        fAgg.dates.add(log.date);
        fAgg.pedidos += 1;

        for (const it of log.items) {
            const { product: p, prepared, consumed } = it;

            const pr = byProduct.get(p.id) ?? { productId: p.id, name: p.name, category: p.category || 'General', price: p.price, prepared: 0, consumed: 0 };
            pr.prepared += prepared;
            pr.consumed += consumed;
            byProduct.set(p.id, pr);

            const fpKey = `${f}||${c}||${p.id}`;
            const fp = byFeriaProduct.get(fpKey) ?? { feria: f, caseta: c, productId: p.id, name: p.name, category: p.category || 'General', price: p.price, prepared: 0, consumed: 0 };
            fp.prepared += prepared;
            fp.consumed += consumed;
            byFeriaProduct.set(fpKey, fp);

            fAgg.prepared += prepared;
            fAgg.consumed += consumed;
            fAgg.cost += consumed * p.price;
        }
        byFeria.set(f, fAgg);
    }

    const productRows = Array.from(byProduct.values()).sort(
        (a, b) => a.category.localeCompare(b.category, 'es') || a.name.localeCompare(b.name, 'es')
    );

    const totPrep = productRows.reduce((s, r) => s + r.prepared, 0);
    const totCons = productRows.reduce((s, r) => s + r.consumed, 0);
    const totSob = totPrep - totCons;
    const totCostCons = productRows.reduce((s, r) => s + r.consumed * r.price, 0);
    const totValSob = productRows.reduce((s, r) => s + (r.prepared - r.consumed) * r.price, 0);

    // ── Hoja 1: Resumen ──────────────────────────────────────────────────────
    {
        const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
        ws.columns = [{ width: 34 }, { width: 20 }, { width: 46 }];

        const title = ws.addRow(['Informe de temporada — DukeControl']);
        title.font = { bold: true, size: 16 };
        ws.addRow([]);

        const periodo = from || to
            ? `${from ? from.split('-').reverse().join('/') : 'inicio'} → ${to ? to.split('-').reverse().join('/') : 'hoy'}`
            : 'Toda la temporada';

        const meta: [string, any, string?][] = [
            ['Periodo', periodo],
            ['Feria', feria || 'Todas'],
            ['Generado', new Date().toLocaleString('es-ES')],
            ['Pedidos cerrados incluidos', logs.length],
            ['Ferias distintas', byFeria.size],
            ['Productos con movimiento', productRows.length],
        ];
        meta.forEach(([k, v]) => {
            const r = ws.addRow([k, v]);
            r.getCell(1).font = { bold: true };
        });

        ws.addRow([]);
        const h = ws.addRow(['TOTALES DE ALMACÉN', 'Unidades', 'Importe']);
        h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        h.fill = HEADER_FILL;

        const rows: [string, number, number | null][] = [
            ['Enviado al servicio', totPrep, null],
            ['Consumido (gastado)', totCons, totCostCons],
            ['Sobrante (devuelto)', totSob, totValSob],
        ];
        rows.forEach(([k, u, e]) => {
            const r = ws.addRow([k, u, e ?? '']);
            r.getCell(1).font = { bold: true };
            r.getCell(2).numFmt = UNITS_FMT;
            if (e !== null) r.getCell(3).numFmt = EUR_FMT;
        });

        const aprov = ws.addRow(['% aprovechado (consumido / enviado)', pct(totCons, totPrep), '']);
        aprov.getCell(1).font = { bold: true };
        aprov.getCell(2).numFmt = PCT_FMT;

        if (openInRange.length > 0) {
            ws.addRow([]);
            const warn = ws.addRow([
                '⚠️ AVISO',
                openInRange.length,
                'pedidos SIN cerrar en este periodo. No se incluyen porque aún no tienen sobrantes registrados. Ciérralos y vuelve a exportar para que el informe esté completo.',
            ]);
            warn.font = { bold: true, color: { argb: 'FF991B1B' } };
            warn.getCell(3).alignment = { wrapText: true };
            warn.height = 32;
        }
    }

    // ── Hoja 2: Por Producto (la principal) ──────────────────────────────────
    {
        const ws = addSheet(wb, 'Por Producto', [
            { header: 'Producto', key: 'n', width: 40 },
            { header: 'Categoría', key: 'c', width: 22 },
            { header: 'Enviado', key: 'p', width: 11, fmt: UNITS_FMT },
            { header: 'Consumido', key: 'co', width: 12, fmt: UNITS_FMT },
            { header: 'Sobrante', key: 's', width: 11, fmt: UNITS_FMT },
            { header: '% aprovechado', key: 'a', width: 14, fmt: PCT_FMT },
            { header: 'Precio ud.', key: 'pr', width: 12, fmt: EUR_FMT },
            { header: 'Coste consumido', key: 'cc', width: 16, fmt: EUR_FMT },
            { header: 'Valor sobrante', key: 'vs', width: 15, fmt: EUR_FMT },
        ]);
        for (const r of productRows) {
            const sob = r.prepared - r.consumed;
            ws.addRow([r.name.trim(), r.category, r.prepared, r.consumed, sob, pct(r.consumed, r.prepared), r.price, r.consumed * r.price, sob * r.price]);
        }
        addTotalRow(ws, ['TOTAL', '', totPrep, totCons, totSob, pct(totCons, totPrep), '', totCostCons, totValSob]);
    }

    // ── Hoja 3: Por Feria (totales) ──────────────────────────────────────────
    {
        const ws = addSheet(wb, 'Por Feria', [
            { header: 'Feria', key: 'f', width: 38 },
            { header: 'Días', key: 'd', width: 8, fmt: UNITS_FMT },
            { header: 'Pedidos', key: 'pe', width: 10, fmt: UNITS_FMT },
            { header: 'Enviado', key: 'p', width: 11, fmt: UNITS_FMT },
            { header: 'Consumido', key: 'co', width: 12, fmt: UNITS_FMT },
            { header: 'Sobrante', key: 's', width: 11, fmt: UNITS_FMT },
            { header: '% aprovechado', key: 'a', width: 14, fmt: PCT_FMT },
            { header: 'Coste consumido', key: 'cc', width: 16, fmt: EUR_FMT },
        ]);
        const feriaRows = Array.from(byFeria.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
        for (const [name, f] of feriaRows) {
            const sob = f.prepared - f.consumed;
            ws.addRow([name, f.dates.size, f.pedidos, f.prepared, f.consumed, sob, pct(f.consumed, f.prepared), f.cost]);
        }
        addTotalRow(ws, ['TOTAL', '', logs.length, totPrep, totCons, totSob, pct(totCons, totPrep), totCostCons]);
    }

    // ── Hoja 4: Feria × Caseta × Producto ────────────────────────────────────
    {
        const ws = addSheet(wb, 'Feria x Producto', [
            { header: 'Feria', key: 'f', width: 30 },
            { header: 'Caseta', key: 'ca', width: 22 },
            { header: 'Producto', key: 'n', width: 38 },
            { header: 'Categoría', key: 'c', width: 20 },
            { header: 'Enviado', key: 'p', width: 11, fmt: UNITS_FMT },
            { header: 'Consumido', key: 'co', width: 12, fmt: UNITS_FMT },
            { header: 'Sobrante', key: 's', width: 11, fmt: UNITS_FMT },
            { header: 'Coste consumido', key: 'cc', width: 16, fmt: EUR_FMT },
        ]);
        const rows = Array.from(byFeriaProduct.values()).sort(
            (a, b) => a.feria.localeCompare(b.feria, 'es') || a.caseta.localeCompare(b.caseta, 'es') || a.name.localeCompare(b.name, 'es')
        );
        for (const r of rows) {
            ws.addRow([r.feria, r.caseta, r.name.trim(), r.category, r.prepared, r.consumed, r.prepared - r.consumed, r.consumed * r.price]);
        }
    }

    // ── Hoja 5: Detalle por día ──────────────────────────────────────────────
    {
        const ws = addSheet(wb, 'Detalle diario', [
            { header: 'Fecha', key: 'd', width: 12 },
            { header: 'Feria', key: 'f', width: 28 },
            { header: 'Caseta', key: 'ca', width: 20 },
            { header: 'Extra', key: 'e', width: 8 },
            { header: 'Producto', key: 'n', width: 36 },
            { header: 'Categoría', key: 'c', width: 18 },
            { header: 'Enviado', key: 'p', width: 11, fmt: UNITS_FMT },
            { header: 'Consumido', key: 'co', width: 12, fmt: UNITS_FMT },
            { header: 'Sobrante', key: 's', width: 11, fmt: UNITS_FMT },
            { header: 'Precio ud.', key: 'pr', width: 11, fmt: EUR_FMT },
            { header: 'Coste consumido', key: 'cc', width: 16, fmt: EUR_FMT },
        ]);
        for (const log of logs) {
            const f = feriaOf(log.eventTitle);
            const c = casetaOf(log.eventTitle);
            const ex = isExtra(log.eventTitle) ? 'Sí' : '';
            const items = [...log.items].sort((a, b) => a.product.name.localeCompare(b.product.name, 'es'));
            for (const it of items) {
                ws.addRow([
                    log.date.split('-').reverse().join('/'),
                    f, c, ex,
                    it.product.name.trim(),
                    it.product.category || 'General',
                    it.prepared, it.consumed, it.prepared - it.consumed,
                    it.product.price, it.consumed * it.product.price,
                ]);
            }
        }
    }

    // ── Hoja 6: Stock actual del almacén ─────────────────────────────────────
    {
        const ws = addSheet(wb, 'Stock Almacen', [
            { header: 'Producto', key: 'n', width: 40 },
            { header: 'Categoría', key: 'c', width: 22 },
            { header: 'Stock actual', key: 's', width: 13, fmt: UNITS_FMT },
            { header: 'Precio ud.', key: 'pr', width: 12, fmt: EUR_FMT },
            { header: 'Valor en almacén', key: 'v', width: 17, fmt: EUR_FMT },
        ]);
        const sorted = [...products].sort(
            (a, b) => (a.category || 'General').localeCompare(b.category || 'General', 'es') || a.name.localeCompare(b.name, 'es')
        );
        for (const p of sorted) {
            ws.addRow([p.name.trim(), p.category || 'General', p.stock, p.price, p.stock * p.price]);
        }
        const totStock = sorted.reduce((s, p) => s + p.stock, 0);
        const totValor = sorted.reduce((s, p) => s + p.stock * p.price, 0);
        addTotalRow(ws, ['TOTAL', '', totStock, '', totValor]);
    }

    // ── Descarga ─────────────────────────────────────────────────────────────
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = feria ? `-${feria.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40)}` : '';
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe-temporada${slug}-${stamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return { pedidos: logs.length, productos: productRows.length };
}
