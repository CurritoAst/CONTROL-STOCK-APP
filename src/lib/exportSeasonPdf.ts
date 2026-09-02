import { SeasonReport, pct, reportFileName, triggerDownload } from './seasonReport';

/**
 * Informe de temporada en PDF.
 *
 * Documento ejecutivo: portada con los totales, desglose por producto y por
 * feria/caseta. El detalle día a día NO va aquí (son miles de líneas y haría
 * un PDF de decenas de páginas): eso vive en la hoja "Detalle diario" del
 * Excel, y la portada lo indica.
 *
 * Los números salen de `buildSeasonReport()`, igual que el Excel, así que los
 * dos informes siempre dicen exactamente lo mismo.
 */

// ─── Paleta (pensada para papel, no para la pantalla oscura) ────────────────
const DARK: [number, number, number] = [31, 41, 55];
const INDIGO: [number, number, number] = [79, 70, 229];
const GREEN: [number, number, number] = [5, 150, 105];
const AMBER: [number, number, number] = [180, 83, 9];
const RED: [number, number, number] = [185, 28, 28];
const MUTED: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [229, 231, 235];
const ZEBRA: [number, number, number] = [249, 250, 251];

const M = 14;            // margen mm
const PAGE_W = 210;      // A4 vertical
const PAGE_H = 297;
const CONTENT_W = PAGE_W - M * 2;

const units = (n: number) => Math.round(n).toLocaleString('es-ES');
const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pctTxt = (p: number) => `${Math.round(p * 100)}%`;

export async function downloadSeasonPdf(report: SeasonReport): Promise<void> {
    const { logs, openInRange, productRows, feriaRows, feriaProductRows, totals, periodoLabel, opts } = report;

    // Carga diferida: jsPDF + autotable pesan ~400 kB y sólo hacen falta al pulsar.
    const [jsPdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const JsPDF: any = (jsPdfMod as any).jsPDF ?? (jsPdfMod as any).default;
    const autoTable: any = (autoTableMod as any).default ?? autoTableMod;

    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setProperties({
        title: 'Informe de temporada — DukeControl',
        subject: `Movimiento de almacén · ${periodoLabel}`,
        creator: 'DukeControl',
    });

    // ── Portada / resumen ejecutivo ──────────────────────────────────────────
    // Banda superior
    doc.setFillColor(...DARK);
    doc.rect(0, 0, PAGE_W, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Informe de Temporada', M, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 205, 215);
    doc.text('DukeControl  ·  Control de stock de ferias', M, 28);

    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, PAGE_W - M, 20, { align: 'right' });
    doc.text(opts.feria || 'Todas las ferias', PAGE_W - M, 28, { align: 'right' });

    let y = 54;

    // Periodo
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PERIODO', M, y);
    doc.setTextColor(...DARK);
    doc.setFontSize(13);
    doc.text(periodoLabel, M, y + 7);

    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
        `${units(logs.length)} pedidos cerrados  ·  ${units(feriaRows.length)} ferias  ·  ${units(productRows.length)} productos con movimiento`,
        M, y + 13
    );

    y += 22;

    // KPIs de unidades
    const kpis: { label: string; value: string; color: [number, number, number] }[] = [
        { label: 'ENVIADO', value: units(totals.prepared), color: DARK },
        { label: 'CONSUMIDO', value: units(totals.consumed), color: GREEN },
        { label: 'SOBRANTE', value: units(totals.sobrante), color: AMBER },
        { label: 'APROVECHADO', value: pctTxt(totals.aprovechado), color: INDIGO },
    ];
    const gap = 4;
    const cardW = (CONTENT_W - gap * (kpis.length - 1)) / kpis.length;
    const cardH = 26;

    kpis.forEach((k, i) => {
        const x = M + i * (cardW + gap);
        doc.setFillColor(...ZEBRA);
        doc.setDrawColor(...LINE);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

        doc.setTextColor(...MUTED);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(k.label, x + cardW / 2, y + 7, { align: 'center' });

        doc.setTextColor(...k.color);
        doc.setFontSize(17);
        doc.text(k.value, x + cardW / 2, y + 18, { align: 'center' });

        if (k.label !== 'APROVECHADO') {
            doc.setTextColor(...MUTED);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.text('unidades', x + cardW / 2, y + 23, { align: 'center' });
        }
    });

    y += cardH + 8;

    // Importes
    const money: { label: string; value: string; color: [number, number, number] }[] = [
        { label: 'COSTE DE LO CONSUMIDO', value: eur(totals.costConsumed), color: DARK },
        { label: 'VALOR DE LO SOBRANTE (devuelto al almacén)', value: eur(totals.valueSobrante), color: AMBER },
    ];
    const mW = (CONTENT_W - gap) / 2;
    money.forEach((m, i) => {
        const x = M + i * (mW + gap);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...LINE);
        doc.roundedRect(x, y, mW, 18, 2, 2, 'FD');
        doc.setTextColor(...MUTED);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(m.label, x + 4, y + 6.5);
        doc.setTextColor(...m.color);
        doc.setFontSize(13);
        doc.text(m.value, x + 4, y + 14);
    });

    y += 26;

    // Aviso de pedidos sin cerrar
    if (openInRange.length > 0) {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(...RED);
        doc.roundedRect(M, y, CONTENT_W, 16, 2, 2, 'FD');
        doc.setTextColor(...RED);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`AVISO: ${openInRange.length} pedidos sin cerrar en este periodo`, M + 4, y + 6.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(
            'No se incluyen en el informe porque aún no tienen sobrantes registrados. Ciérralos y vuelve a exportar.',
            M + 4, y + 12
        );
        y += 22;
    }

    // Resumen por feria en la portada
    autoTable(doc, {
        startY: y,
        head: [['Feria', 'Días', 'Pedidos', 'Enviado', 'Consumido', 'Sobrante', 'Aprov.', 'Coste']],
        body: feriaRows.map(f => [
            f.name,
            units(f.dias),
            units(f.pedidos),
            units(f.prepared),
            units(f.consumed),
            units(f.prepared - f.consumed),
            pctTxt(pct(f.consumed, f.prepared)),
            eur(f.cost),
        ]),
        foot: [[
            'TOTAL', '', units(logs.length), units(totals.prepared), units(totals.consumed),
            units(totals.sobrante), pctTxt(totals.aprovechado), eur(totals.costConsumed),
        ]],
        theme: 'grid',
        showFoot: 'lastPage',
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.1 },
        headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [238, 242, 255], textColor: DARK, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: ZEBRA },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 12 },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 19 },
            4: { halign: 'right', cellWidth: 21 },
            5: { halign: 'right', cellWidth: 19 },
            6: { halign: 'right', cellWidth: 15 },
            7: { halign: 'right', cellWidth: 27 },
        },
        margin: { left: M, right: M },
    });

    // ── Detalle por producto ─────────────────────────────────────────────────
    doc.addPage();
    sectionTitle(doc, 'Desglose por producto', 'Todo lo que salió del almacén, lo que se consumió y lo que volvió.');
    autoTable(doc, {
        startY: 34,
        head: [['Producto', 'Categoría', 'Enviado', 'Consumido', 'Sobrante', 'Aprov.', 'Coste consumido']],
        body: productRows.map(r => [
            r.name,
            r.category,
            units(r.prepared),
            units(r.consumed),
            units(r.prepared - r.consumed),
            pctTxt(pct(r.consumed, r.prepared)),
            eur(r.consumed * r.price),
        ]),
        foot: [[
            'TOTAL', '', units(totals.prepared), units(totals.consumed),
            units(totals.sobrante), pctTxt(totals.aprovechado), eur(totals.costConsumed),
        ]],
        theme: 'grid',
        showFoot: 'lastPage',
        styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.1, overflow: 'linebreak' },
        headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [238, 242, 255], textColor: DARK, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: ZEBRA },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 30 },
            2: { halign: 'right', cellWidth: 18 },
            3: { halign: 'right', cellWidth: 21 },
            4: { halign: 'right', cellWidth: 19 },
            5: { halign: 'right', cellWidth: 15 },
            6: { halign: 'right', cellWidth: 28 },
        },
        margin: { left: M, right: M, top: 20 },
    });

    // ── Detalle por feria y caseta ───────────────────────────────────────────
    doc.addPage();
    sectionTitle(doc, 'Desglose por feria y caseta', 'Qué se envió y qué sobró en cada caseta de cada feria.');
    autoTable(doc, {
        startY: 34,
        head: [['Feria', 'Caseta', 'Producto', 'Enviado', 'Consumido', 'Sobrante', 'Coste']],
        body: feriaProductRows.map(r => [
            r.feria,
            r.caseta,
            r.name,
            units(r.prepared),
            units(r.consumed),
            units(r.prepared - r.consumed),
            eur(r.consumed * r.price),
        ]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.4, lineColor: LINE, lineWidth: 0.1, overflow: 'linebreak' },
        headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: ZEBRA },
        columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 24 },
            2: { cellWidth: 'auto' },
            3: { halign: 'right', cellWidth: 17 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 18 },
            6: { halign: 'right', cellWidth: 24 },
        },
        margin: { left: M, right: M, top: 20 },
    });

    // ── Pie de página en todas las hojas ─────────────────────────────────────
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text('DukeControl  ·  Informe de temporada', M, PAGE_H - 7.5);
        doc.text(periodoLabel, PAGE_W / 2, PAGE_H - 7.5, { align: 'center' });
        doc.text(`Página ${i} de ${total}`, PAGE_W - M, PAGE_H - 7.5, { align: 'right' });
    }

    // Nota sobre el detalle diario, al pie de la portada
    doc.setPage(1);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
        `El detalle día a día (${units(logs.reduce((s, l) => s + l.items.length, 0))} líneas) está en la hoja «Detalle diario» del Excel.`,
        M, PAGE_H - 16
    );

    triggerDownload(doc.output('blob'), reportFileName(report, 'pdf'));
}

function sectionTitle(doc: any, title: string, subtitle: string) {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, PAGE_W, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, M, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 205, 215);
    doc.text(subtitle, M, 17);
    doc.setTextColor(0, 0, 0);
}
