import React, { useState } from 'react';
import { FinancialFeriaReport } from './FinancialFeriaReport';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import type { DailyLog } from '../../types';
import { fetchAll } from '../../lib/supabaseClient';
import { downloadSeasonExcel, feriaOf } from '../../lib/exportSeason';
import {
    BarChart3,
    CalendarDays,
    ClipboardList,
    Store,
    DatabaseBackup,
    AlertTriangle,
    CheckCircle2,
    Euro,
    Package,
    PackageOpen,
    ArrowRight,
    Trash2,
    Download,
    Loader2,
    FileSpreadsheet,
} from 'lucide-react';

export const Dashboard: React.FC<{ onGoToPedidos: () => void }> = ({ onGoToPedidos }) => {
    const { historicalLogs, activeLogs, products, deleteDailyLog } = useAppContext();
    const { addToast } = useToast();
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportFrom, setExportFrom] = useState('');
    const [exportTo, setExportTo] = useState('');
    const [exportFeria, setExportFeria] = useState('');
    const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

    // deleteDailyLog refunds stock itself: for an OPEN pedido it adds back every
    // item's `prepared` before deleting the row. Legacy PENDING_PEDIDO was never
    // discounted and CLOSED keeps its consumed units (they were consumed).
    const handleDeleteLog = async (log: DailyLog) => {
        if (deletingLogId) return;
        const isOpen = log.status === 'OPEN';
        const refundUnits = isOpen ? log.items.reduce((sum, i) => sum + (i.prepared || 0), 0) : 0;
        const consumedUnits = log.status === 'CLOSED' ? log.items.reduce((sum, i) => sum + (i.consumed || 0), 0) : 0;
        const confirmMsg = isOpen
            ? `¿Borrar este pedido?\n\nLas ${refundUnits} unidades descontadas volverán al almacén.`
            : log.status === 'CLOSED'
                ? `¿Borrar este pedido cerrado?\n\nLas ${consumedUnits} unidades consumidas NO vuelven al almacén (ya se consumieron). Si las cantidades están mal, ajusta los sobrantes desde PEDIDOS antes de borrar.`
                : '¿Borrar este pedido?';
        if (!window.confirm(confirmMsg)) return;
        setDeletingLogId(log.id);
        try {
            await deleteDailyLog(log.id);
            addToast(refundUnits > 0 ? `Pedido borrado. ${refundUnits} unidades devueltas al almacén.` : 'Pedido borrado', 'success');
        } catch (err) {
            console.error(err);
            addToast('Error al borrar el pedido', 'error');
        } finally {
            setDeletingLogId(null);
        }
    };

    // Ferias que aparecen en pedidos ya cerrados: son las unicas exportables.
    const feriasDisponibles = React.useMemo(() => {
        const set = new Set<string>();
        historicalLogs.forEach(l => set.add(feriaOf(l.eventTitle)));
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    }, [historicalLogs]);

    // Rango completo de la temporada, para los placeholders de las fechas.
    const rangoTemporada = React.useMemo(() => {
        if (historicalLogs.length === 0) return null;
        const dates = historicalLogs.map(l => l.date).sort();
        return { first: dates[0], last: dates[dates.length - 1] };
    }, [historicalLogs]);

    const handleExportSeason = async () => {
        if (isExporting) return;
        if (historicalLogs.length === 0) {
            addToast('Todavia no hay pedidos cerrados que exportar.', 'error');
            return;
        }
        if (exportFrom && exportTo && exportFrom > exportTo) {
            addToast('La fecha "Desde" no puede ser posterior a "Hasta".', 'error');
            return;
        }
        setIsExporting(true);
        try {
            const { pedidos, productos } = await downloadSeasonExcel(
                historicalLogs,
                activeLogs,
                products,
                { from: exportFrom || undefined, to: exportTo || undefined, feria: exportFeria || undefined }
            );
            if (pedidos === 0) {
                addToast('No hay pedidos cerrados en ese periodo. Revisa las fechas o la feria.', 'error');
            } else {
                addToast(`Excel descargado: ${pedidos} pedidos y ${productos} productos.`, 'success');
            }
        } catch (e: any) {
            console.error('Error exportando la temporada:', e);
            addToast('Error al generar el Excel: ' + (e?.message || 'intentalo de nuevo'), 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const downloadBackup = async () => {
        setIsBackingUp(true);
        try {
            const [products, events, daily_logs, log_items] = await Promise.all([
                fetchAll('products'),
                fetchAll('events'),
                fetchAll('daily_logs'),
                fetchAll('log_items'),
            ]);

            const backup = {
                fecha: new Date().toISOString(),
                products,
                events,
                daily_logs,
                log_items,
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const fecha = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
            a.href = url;
            a.download = `backup-macario-${fecha}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setIsBackingUp(false);
        }
    };

    // Basic Finances Calculation
    const totalExpenses = historicalLogs.reduce((acc, log) => {
        const dailyCost = log.items.reduce((sum, item) => {
            // cost based on how much was consumed
            return sum + (item.consumed * item.product.price);
        }, 0);
        return acc + dailyCost;
    }, 0);

    // OPEN (y legacy PENDING_PEDIDO) = en curso, faltan sobrantes. CLOSED (legacy) = cerrado sin ajustar.
    const openCount = activeLogs.filter(log => log.status === 'OPEN' || log.status === 'PENDING_PEDIDO').length;
    const closedCount = activeLogs.filter(log => log.status === 'CLOSED').length;
    const activeCount = openCount + closedCount;

    return (
        <div className="animate-fade-in w-full">
                <div className="animate-fade-in">
                    {/* ─── Page Header ─── */}
                    <div className="page-header">
                        <div>
                            <div className="section-label mb-2">Panel de control</div>
                            <h1 className="page-title">Panel Financiero</h1>
                            <p className="page-subtitle capitalize">
                                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                                <span className="status-dot status-dot-live" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary">En vivo</span>
                            </div>
                            {activeCount > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-red/10 border border-accent-red/30">
                                    <span className="status-dot status-dot-alert" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-red">{activeCount} pendiente{activeCount !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {activeCount > 0 && (
                        <div className="bg-accent-red/10 border border-accent-red/30 rounded-2xl p-5 mb-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="icon-chip icon-chip-red">
                                        <AlertTriangle size={18} strokeWidth={2.2} />
                                    </div>
                                    <div>
                                        <h4 className="font-black uppercase tracking-wider text-accent-red text-sm mb-1.5">
                                            Pedidos esperando tu acción
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {openCount > 0 && (
                                                <span className="badge badge-purple gap-1.5">
                                                    <ClipboardList size={12} strokeWidth={2.4} />
                                                    {openCount} en curso — faltan sobrantes
                                                </span>
                                            )}
                                            {closedCount > 0 && (
                                                <span className="badge badge-green gap-1.5">
                                                    <CheckCircle2 size={12} strokeWidth={2.4} />
                                                    {closedCount} cerrado{closedCount !== 1 ? 's' : ''} sin ajustar
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                                            Un pedido entra en el análisis financiero cuando registras sus sobrantes.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onGoToPedidos}
                                    className="btn btn-primary whitespace-nowrap shrink-0"
                                >
                                    <ClipboardList size={16} strokeWidth={2.2} />
                                    Ir a Pedidos
                                    <ArrowRight size={16} strokeWidth={2.2} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── Stat Cards ─── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                        <div className="stat-card">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <div className="section-label mb-2">Gasto Histórico</div>
                                    <div className="text-[10px] text-text-muted">Coste total acumulado</div>
                                </div>
                                <div className="icon-chip icon-chip-red">
                                    <Euro size={18} strokeWidth={2.2} />
                                </div>
                            </div>
                            <div className="text-3xl font-black text-accent-red tracking-tight">
                                {totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                <span className="text-lg text-accent-red/70 ml-1 font-bold">€</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <div className="section-label mb-2">Servicios Registrados</div>
                                    <div className="text-[10px] text-text-muted">Cierres completados</div>
                                </div>
                                <div className="icon-chip icon-chip-blue">
                                    <BarChart3 size={18} strokeWidth={2.2} />
                                </div>
                            </div>
                            <div className="text-3xl font-black text-text-primary tracking-tight">
                                {historicalLogs.length}
                                <span className="text-base text-text-muted ml-2 font-bold">servicios</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <div className="section-label mb-2">Pedidos Activos</div>
                                    <div className="text-[10px] text-text-muted">Faltan sobrantes</div>
                                </div>
                                <div className="icon-chip icon-chip-green">
                                    <Package size={18} strokeWidth={2.2} />
                                </div>
                            </div>
                            <div className="text-3xl font-black text-accent-green tracking-tight">
                                {activeCount}
                                <span className="text-base text-accent-green/70 ml-2 font-bold">activos</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="text-xl mb-6 flex items-center gap-3">
                            <span className="icon-chip icon-chip-blue">
                                <Package size={18} strokeWidth={2.2} />
                            </span>
                            <span>Pedidos en curso</span>
                        </h3>
                        {activeCount === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">
                                    <PackageOpen size={22} strokeWidth={2} />
                                </div>
                                <p className="text-text-muted uppercase tracking-widest text-xs font-bold">No hay pedidos en curso en este momento</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {activeLogs
                                    .filter(l => ['PENDING_PEDIDO', 'OPEN', 'CLOSED'].includes(l.status))
                                    .map(log => {
                                        const isClosed = log.status === 'CLOSED';

                                        // Calculate cost based on status:
                                        // If CLOSED, we know consumed. If OPEN (or legacy PENDING_PEDIDO), we only know prepared (estimated cost).
                                        const dayCost = log.items.reduce((sum, i) => {
                                            const qty = isClosed ? i.consumed : i.prepared;
                                            return sum + (qty * i.product.price);
                                        }, 0);

                                        return (
                                            <div key={log.id} className="group p-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-xl transition-all flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-bold flex items-center gap-2">
                                                        <CalendarDays size={15} strokeWidth={2.2} className="text-accent-blue shrink-0" />
                                                        {log.date}
                                                        <span className={`badge ${isClosed ? 'badge-green' : 'badge-purple'}`}>
                                                            {isClosed ? 'Cerrado' : 'En curso'}
                                                        </span>
                                                    </div>
                                                    {log.eventTitle && (
                                                        <div className="text-xs font-bold text-text-muted uppercase tracking-tight line-clamp-1 flex items-center gap-1.5">
                                                            <Store size={12} strokeWidth={2.2} className="shrink-0" />
                                                            {log.eventTitle.replace(' - Caseta:', '')}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest">
                                                        {log.items.length} productos registrados
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className={`text-lg font-black group-hover:scale-105 transition-transform origin-right ${isClosed ? 'text-accent-red' : 'text-accent-blue/80'}`}>
                                                            {dayCost.toLocaleString('es-ES')} €
                                                        </div>
                                                        <div className="text-[9px] font-bold text-text-muted/40 uppercase">
                                                            {isClosed ? 'Gasto final' : 'Gasto estimado'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn btn-outline border-accent-red/30 text-accent-red hover:bg-accent-red/10 p-2 rounded-full transition-all md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleDeleteLog(log);
                                                        }}
                                                        disabled={deletingLogId === log.id}
                                                        title="Borrar pedido"
                                                        aria-label="Borrar pedido"
                                                    >
                                                        {deletingLogId === log.id
                                                            ? <Loader2 size={16} className="animate-spin" />
                                                            : <Trash2 size={16} strokeWidth={2.2} />}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>

                    <FinancialFeriaReport />

                    {/* ─── Informe de temporada (Excel) ─── */}
                    <div className="card mt-6">
                        <div className="flex items-start gap-3 mb-5">
                            <div className="icon-chip icon-chip-green shrink-0">
                                <FileSpreadsheet size={18} strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold leading-tight mb-1">Informe de Temporada (Excel)</h4>
                                <p className="text-sm text-text-muted mb-0">
                                    Todo el movimiento de almacen: lo enviado, lo consumido y lo sobrante, por producto,
                                    por feria y dia a dia. Deja las fechas en blanco para sacar la temporada completa.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                            <div className="input-group mb-0">
                                <label htmlFor="exp-desde">Desde</label>
                                <input
                                    id="exp-desde"
                                    type="date"
                                    value={exportFrom}
                                    max={exportTo || undefined}
                                    onChange={e => setExportFrom(e.target.value)}
                                />
                            </div>
                            <div className="input-group mb-0">
                                <label htmlFor="exp-hasta">Hasta</label>
                                <input
                                    id="exp-hasta"
                                    type="date"
                                    value={exportTo}
                                    min={exportFrom || undefined}
                                    onChange={e => setExportTo(e.target.value)}
                                />
                            </div>
                            <div className="input-group mb-0">
                                <label htmlFor="exp-feria">Feria</label>
                                <select id="exp-feria" value={exportFeria} onChange={e => setExportFeria(e.target.value)}>
                                    <option value="">Todas las ferias</option>
                                    {feriasDisponibles.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-[11px] text-text-muted mb-0 leading-relaxed">
                                {rangoTemporada
                                    ? <>Hay datos cerrados del <strong>{rangoTemporada.first.split('-').reverse().join('/')}</strong> al <strong>{rangoTemporada.last.split('-').reverse().join('/')}</strong>. </>
                                    : <>Aun no hay pedidos cerrados. </>}
                                Solo se incluyen pedidos ya cerrados (con sobrantes registrados).
                            </p>
                            <button
                                className="btn btn-success whitespace-nowrap w-full sm:w-auto shrink-0 disabled:opacity-50"
                                onClick={handleExportSeason}
                                disabled={isExporting || historicalLogs.length === 0}
                            >
                                {isExporting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet size={16} strokeWidth={2.2} />
                                        Descargar Excel
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="card mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="icon-chip icon-chip-gray">
                                <DatabaseBackup size={18} strokeWidth={2.2} />
                            </div>
                            <div>
                                <h4 className="font-bold leading-tight mb-1">Copia de Seguridad</h4>
                                <p className="text-sm text-text-muted">Descarga todos los datos (productos, stock, pedidos, eventos) a tu dispositivo.</p>
                            </div>
                        </div>
                        <button
                            className="btn btn-outline whitespace-nowrap w-full sm:w-auto shrink-0 disabled:opacity-50"
                            onClick={downloadBackup}
                            disabled={isBackingUp}
                        >
                            {isBackingUp ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Descargando...
                                </>
                            ) : (
                                <>
                                    <Download size={16} strokeWidth={2.2} />
                                    Descargar Backup
                                </>
                            )}
                        </button>
                    </div>
                </div>
        </div>
    );
};
