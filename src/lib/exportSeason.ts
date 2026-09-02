import type { Workbook, Worksheet, Fill } from 'exceljs';
import {
    SeasonReport,
    casetaOf,
    dmy,
    feriaOf,
    isExtra,
    pct,
    reportFileName,
    triggerDownload,
} from './seasonReport';

/**
 * Informe de temporada en Excel (6 hojas).
 *
 * Todos los números salen de `buildSeasonReport()` — ver seasonReport.ts — que
 * es la misma fuente que usa el PDF, así que ambos informes siempre coinciden.
 */

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

export async function downloadSeasonExcel(report: SeasonReport): Promise<void> {
    const { logs, openInRange, products, productRows, feriaRows, feriaProductRows, totals, periodoLabel, opts } = report;

    // Carga diferida: exceljs pesa ~940 kB y sólo hace falta al pulsar el botón,
    // así que no debe entrar en el bundle inicial del Panel.
    const mod: any = await import('exceljs');
    const ExcelJSRuntime = mod.default ?? mod;
    const wb: Workbook = new ExcelJSRuntime.Workbook();
    wb.creator = 'DukeControl';
    wb.created = new Date();

    // ── Hoja 1: Resumen ──────────────────────────────────────────────────────
    {
        const ws = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
        ws.columns = [{ width: 34 }, { width: 20 }, { width: 46 }];

        const title = ws.addRow(['Informe de temporada — DukeControl']);
        title.font = { bold: true, size: 16 };
        ws.addRow([]);

        const meta: [string, any][] = [
            ['Periodo', periodoLabel],
            ['Feria', opts.feria || 'Todas'],
            ['Generado', new Date().toLocaleString('es-ES')],
            ['Pedidos cerrados incluidos', logs.length],
            ['Ferias distintas', feriaRows.length],
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
            ['Enviado al servicio', totals.prepared, null],
            ['Consumido (gastado)', totals.consumed, totals.costConsumed],
            ['Sobrante (devuelto)', totals.sobrante, totals.valueSobrante],
        ];
        rows.forEach(([k, u, e]) => {
            const r = ws.addRow([k, u, e ?? '']);
            r.getCell(1).font = { bold: true };
            r.getCell(2).numFmt = UNITS_FMT;
            if (e !== null) r.getCell(3).numFmt = EUR_FMT;
        });

        const aprov = ws.addRow(['% aprovechado (consumido / enviado)', totals.aprovechado, '']);
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
            ws.addRow([r.name, r.category, r.prepared, r.consumed, sob, pct(r.consumed, r.prepared), r.price, r.consumed * r.price, sob * r.price]);
        }
        addTotalRow(ws, ['TOTAL', '', totals.prepared, totals.consumed, totals.sobrante, totals.aprovechado, '', totals.costConsumed, totals.valueSobrante]);
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
        for (const f of feriaRows) {
            ws.addRow([f.name, f.dias, f.pedidos, f.prepared, f.consumed, f.prepared - f.consumed, pct(f.consumed, f.prepared), f.cost]);
        }
        addTotalRow(ws, ['TOTAL', '', logs.length, totals.prepared, totals.consumed, totals.sobrante, totals.aprovechado, totals.costConsumed]);
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
        for (const r of feriaProductRows) {
            ws.addRow([r.feria, r.caseta, r.name, r.category, r.prepared, r.consumed, r.prepared - r.consumed, r.consumed * r.price]);
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
                    dmy(log.date), f, c, ex,
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
        addTotalRow(ws, [
            'TOTAL', '',
            sorted.reduce((s, p) => s + p.stock, 0),
            '',
            sorted.reduce((s, p) => s + p.stock * p.price, 0),
        ]);
    }

    const buf = await wb.xlsx.writeBuffer();
    triggerDownload(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        reportFileName(report, 'xlsx')
    );
}
