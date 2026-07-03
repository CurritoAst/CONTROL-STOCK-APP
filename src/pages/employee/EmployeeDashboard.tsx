import React, { useState, useEffect } from 'react';
import {
    Activity,
    ArrowLeft,
    BadgeCheck,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock,
    Flag,
    FolderKanban,
    Loader2,
    Lock,
    Minus,
    Package,
    PackageOpen,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Sparkles,
    Store,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PreparationLog } from './PreparationLog';
import { ConsumptionLog } from './ConsumptionLog';
import { EmployeeCalendar } from './EmployeeCalendar';

// Purely presentational: status → badge (icon + label)
const renderStatusBadge = (status: string) => {
    switch (status) {
        case 'PENDING_PEDIDO':
            return <span className="badge badge-gray gap-1.5"><Clock size={11} strokeWidth={2.4} /> Pendiente de Aprobación</span>;
        case 'OPEN':
            return <span className="badge badge-green gap-1.5"><Activity size={11} strokeWidth={2.4} /> Aprobado — En Servicio</span>;
        case 'CLOSED':
            return <span className="badge badge-gray gap-1.5"><Lock size={11} strokeWidth={2.4} /> Finalizado</span>;
        case 'APPROVED':
            return <span className="badge badge-blue gap-1.5"><BadgeCheck size={11} strokeWidth={2.4} /> Aprobado por Master</span>;
        case 'REJECTED':
            return <span className="badge badge-red gap-1.5"><XCircle size={11} strokeWidth={2.4} /> Rechazado</span>;
        default:
            return <span className="badge badge-gray">{status}</span>;
    }
};

export const EmployeeDashboard: React.FC = () => {
    const { activeLogs, historicalLogs, deleteDailyLog, events = [], products, updatePedidoItems } = useAppContext();
    const { addToast } = useToast();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
    const [editCategory, setEditCategory] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // New states for multiple-order support
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
    const [selectedEventTitleForNew, setSelectedEventTitleForNew] = useState<string | null>(null);
    // Which caseta is currently open in the Gestionar panel
    const [selectedCaseta, setSelectedCaseta] = useState<string | null>(null);
    // Which log is currently open for sobrantes registration (inline)
    const [selectedLogForSobrantes, setSelectedLogForSobrantes] = useState<string | null>(null);
    const [showTotalReturn, setShowTotalReturn] = useState<string | null>(null);
    // Modal for selecting which caseta the extra order belongs to
    const [showExtraModal, setShowExtraModal] = useState(false);

    // Reset selection when date changes
    useEffect(() => {
        setSelectedLogId(null);
        setSelectedEventTitleForNew(null);
        setSelectedCaseta(null);
        setSelectedLogForSobrantes(null);
        setShowTotalReturn(null);
        setShowExtraModal(false);
    }, [selectedDate]);

    const allLogs = [...activeLogs, ...historicalLogs];
    const logsForDate = allLogs.filter(log => log.date === selectedDate);
    const programmedOrders = events.filter(e => e.date === selectedDate && e.type === 'ORDER');
    const availableProgrammedOrders = programmedOrders.filter(
        po => !logsForDate.some(log => log.eventTitle === po.title)
    );

    const totalOptions = logsForDate.length + availableProgrammedOrders.length;

    // Auto-select logic
    let currentLog = undefined;
    if (selectedLogId) {
        currentLog = logsForDate.find(l => l.id === selectedLogId);
    } else if (!selectedEventTitleForNew) {
        if (totalOptions === 1 && logsForDate.length === 1) {
            currentLog = logsForDate[0];
        } else if (logsForDate.length > 0 && availableProgrammedOrders.length === 0 && logsForDate.every(l => !l.eventTitle)) {
            // Auto-select the most recent "Pedido General" if that's all there is
            currentLog = logsForDate[0];
        } else if (logsForDate.length === 0 && availableProgrammedOrders.length === 0) {
            // Fallback for empty days (like original behavior)
        }
    }


    const renderPedidoContent = () => {
        // --- INLINE SOBRANTES ---
        if (selectedLogForSobrantes !== null) {
            const logForSob = allLogs.find(l => l.id === selectedLogForSobrantes);
            if (logForSob) {
                return (
                    <div className="animate-fade-in">
                        <div className="mb-4 flex items-center justify-between gap-3 bg-accent-blue/10 border border-accent-blue/20 p-4 rounded-xl">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="icon-chip icon-chip-blue"><PackageOpen size={18} strokeWidth={2.2} /></span>
                                <div className="min-w-0">
                                    <span className="text-text-muted text-sm block">Registrando sobrantes de:</span>
                                    <strong className="text-accent-blue break-words">{logForSob.eventTitle || 'Pedido General'}</strong>
                                </div>
                            </div>
                            <button className="btn btn-outline btn-sm shrink-0" onClick={() => setSelectedLogForSobrantes(null)}><ArrowLeft size={14} strokeWidth={2.4} /> Volver</button>
                        </div>
                        <ConsumptionLog currentLog={logForSob} onClose={() => setSelectedLogForSobrantes(null)} />
                    </div>
                );
            }
        }

        // --- DEVOLUCIÓN TOTAL ---
        if (showTotalReturn !== null) {
            // Collect all dates that belong to this feria (EVENT-type events with this title)
            // showTotalReturn represents the specific base caseta title, e.g., "Pedido Feria de Prueba - Caseta: A"
            // Wait, how do we know the feriadates? We can find the feria associated by looking at the event title.
            // Let's assume we pass { feriaName: string, casetaBase: string } to showTotalReturn
            const parsedToken = JSON.parse(showTotalReturn);
            const { feriaName, casetaBase } = parsedToken;

            const feriaDates = new Set(
                events
                    .filter(e => e.type === 'EVENT' && e.title === feriaName)
                    .map(e => e.date)
            );
            // Get all logs from those feria dates for THIS specific caseta
            const feriaLogs = allLogs.filter(l =>
                feriaDates.has(l.date) &&
                l.eventTitle &&
                l.eventTitle.replace(/\s*\(Extra \d+\)$/, '') === casetaBase &&
                (l.status === 'OPEN' || l.status === 'APPROVED' || l.status === 'CLOSED')
            );
            return (
                <div className="animate-fade-in">
                    <div className="mb-4 flex items-center justify-between gap-3 bg-accent-blue/10 border border-accent-blue/20 p-4 rounded-xl">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="icon-chip icon-chip-blue"><Flag size={18} strokeWidth={2.2} /></span>
                            <div className="min-w-0">
                                <span className="text-text-muted text-sm block">Cierre Total de:</span>
                                <strong className="text-accent-blue break-words">{casetaBase}</strong>
                            </div>
                        </div>
                        <button className="btn btn-outline btn-sm shrink-0" onClick={() => setShowTotalReturn(null)}><ArrowLeft size={14} strokeWidth={2.4} /> Volver</button>
                    </div>
                    <ConsumptionLog aggregatedLogs={feriaLogs} onClose={() => setShowTotalReturn(null)} />
                </div>
            );
        }

        // --- EDIT MODE ---
        if (isEditingOrder && currentLog && currentLog.status === 'PENDING_PEDIDO') {
            return (
                <div className="card animate-fade-in">
                    <div className="flex justify-between items-center gap-3 mb-6">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="icon-chip icon-chip-blue"><Pencil size={18} strokeWidth={2.2} /></span>
                            <div className="min-w-0">
                                <h2 className="text-2xl font-bold">Editar Pedido</h2>
                                <p className="text-text-muted text-sm mt-1 break-words">{currentLog.eventTitle || 'Pedido General'} — {selectedDate}</p>
                            </div>
                        </div>
                        <button className="btn btn-outline btn-sm shrink-0" onClick={() => setIsEditingOrder(false)}><X size={14} strokeWidth={2.4} /> Cancelar</button>
                    </div>
                    <div className="animate-fade-in flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/20 p-4 rounded-lg border border-white/10">
                            <span className="text-sm font-medium text-text-muted">Filtrar por Sección:</span>
                            <select
                                className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full sm:w-auto"
                                value={editCategory || "General"}
                                onChange={(e) => setEditCategory(e.target.value === "General" ? "" : e.target.value)}
                            >
                                <option value="General">Todas las Categorías</option>
                                {Array.from(new Set(products.map(p => p.category || 'General'))).sort().filter(c => c !== "General").map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                            {products
                                .filter(p => !editCategory || p.category === editCategory)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(product => {
                                    const currentItem = currentLog.items.find(i => i.product.id === product.id);
                                    const qty = editQuantities[product.id] ?? (currentItem?.prepared || 0);

                                    const reservedByOthers = (product.reserved || 0) - (currentItem?.prepared || 0);
                                    const availableStock = product.stock + (currentItem?.prepared || 0) - reservedByOthers;
                                    const isOutOfStock = availableStock <= 0;

                                    return (
                                        <div key={product.id} className={`p-4 border rounded-lg transition-colors flex flex-col justify-between gap-3 ${isOutOfStock ? 'opacity-60 border-accent-red/20' : qty > 0 ? 'border-accent-blue/40 bg-accent-blue/5' : 'border-white/10 bg-bg-primary/50'}`}>
                                            <div>
                                                <div className="font-bold text-lg mb-1 truncate" title={product.name}>{product.name}</div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="badge badge-gray">{product.category || 'General'}</span>
                                                    <span className={`badge ${availableStock > 0 ? 'badge-green' : 'bg-accent-red/20 text-accent-red'}`}>
                                                        Stock: {availableStock}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        aria-label={`Quitar una unidad de ${product.name}`}
                                                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                                                        onClick={() => setEditQuantities(prev => ({ ...prev, [product.id]: Math.max(0, qty - 1) }))}
                                                    ><Minus size={16} strokeWidth={2.4} /></button>
                                                    <span className={`text-xl font-bold w-10 text-center num ${qty > 0 ? 'text-accent-blue' : 'text-text-muted'}`}>{qty}</span>
                                                    <button
                                                        aria-label={`Añadir una unidad de ${product.name}`}
                                                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-accent-blue/40 text-white flex items-center justify-center transition-colors"
                                                        onClick={() => {
                                                            if (!isOutOfStock) {
                                                                setEditQuantities(prev => ({ ...prev, [product.id]: Math.min(availableStock, qty + 1) }));
                                                            }
                                                        }}
                                                        disabled={isOutOfStock}
                                                    ><Plus size={16} strokeWidth={2.4} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                    <button
                        className="btn btn-primary w-full py-4 text-lg mt-6"
                        onClick={async () => {
                            if (isSaving) return;
                            const itemsToUpdate = products
                                .filter(p => (editQuantities[p.id] ?? currentLog.items.find(i => i.product.id === p.id)?.prepared ?? 0) > 0)
                                .map(p => ({
                                    product: p,
                                    prepared: editQuantities[p.id] ?? (currentLog.items.find(i => i.product.id === p.id)?.prepared ?? 0)
                                }));
                            if (itemsToUpdate.length === 0) { addToast('El pedido debe tener al menos un producto.', 'error'); return; }

                            setIsSaving(true);
                            try {
                                await updatePedidoItems(currentLog.id, itemsToUpdate);
                                addToast('Pedido actualizado correctamente', 'success');
                                setIsEditingOrder(false);
                            } catch (e) {
                                console.error(e);
                                addToast('Error al actualizar el pedido', 'error');
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.2} />}
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            );
        }

        // --- NEW PEDIDO FORM (inline, when creating a new one) ---
        if (selectedEventTitleForNew !== null) {
            return (
                <div className="animate-fade-in">
                    <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-accent-blue/10 border border-accent-blue/20 p-4 rounded-xl gap-3">
                        <div className="w-full flex items-center gap-3 min-w-0">
                            <span className="icon-chip icon-chip-blue"><ClipboardList size={18} strokeWidth={2.2} /></span>
                            <div className="min-w-0">
                                <span className="text-text-muted text-sm block mb-1">Preparando nuevo pedido para:</span>
                                <strong className="text-lg text-accent-blue break-words">{selectedEventTitleForNew || 'Pedido del Día'}</strong>
                            </div>
                        </div>
                        <button
                            className="btn btn-outline btn-sm w-full sm:w-auto shrink-0"
                            onClick={() => {
                                setSelectedEventTitleForNew(null);
                                // If we came from a caseta panel, go back to it
                            }}
                        ><ArrowLeft size={14} strokeWidth={2.4} /> Volver a Gestionar</button>
                    </div>
                    <PreparationLog
                        selectedDate={selectedDate}
                        eventTitle={selectedEventTitleForNew !== '' ? selectedEventTitleForNew : undefined}
                        onLogCreated={() => { setSelectedEventTitleForNew(null); setSelectedCaseta(null); }}
                    />
                </div>
            );
        }

        // --- CASETA GESTIONAR PANEL ---
        if (selectedCaseta !== null) {
            const casetaLogs = logsForDate.filter(l => l.eventTitle === selectedCaseta);
            const extraCount = casetaLogs.filter(l => l.eventTitle?.includes('Extra')).length;
            return (
                <div className="animate-fade-in">
                    <div className="card mb-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="icon-chip icon-chip-blue"><FolderKanban size={18} strokeWidth={2.2} /></span>
                                <div className="min-w-0">
                                    <h2 className="text-2xl font-bold mb-0.5">Gestionar</h2>
                                    <p className="text-accent-blue font-semibold break-words">{selectedCaseta}</p>
                                </div>
                            </div>
                            <button className="btn btn-outline btn-sm shrink-0" onClick={() => setSelectedCaseta(null)}><ArrowLeft size={14} strokeWidth={2.4} /> Volver</button>
                        </div>
                    </div>

                    {casetaLogs.length > 0 && (
                        <div className="mb-4">
                            <h3 className="section-label mb-3 px-1">Pedidos de esta Caseta</h3>
                            <div className="flex flex-col gap-3">
                                {casetaLogs.map(log => (
                                    <div key={log.id} className="card p-4 border border-white/10">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <div className="font-bold">{log.eventTitle}</div>
                                                <div className="mt-1.5">{renderStatusBadge(log.status)}</div>
                                            </div>
                                            <div className="flex gap-2 flex-wrap sm:shrink-0">
                                                {log.status === 'PENDING_PEDIDO' && (
                                                    <button className="btn btn-outline btn-sm" onClick={() => {
                                                        const initQ: Record<string, number> = {};
                                                        log.items.forEach(i => { initQ[i.product.id] = i.prepared; });
                                                        setEditQuantities(initQ);
                                                        setSelectedLogId(log.id);
                                                        setIsEditingOrder(true);
                                                    }}><Pencil size={14} strokeWidth={2.4} /> Editar</button>
                                                )}
                                                {(log.status === 'OPEN' || log.status === 'CLOSED' || log.status === 'APPROVED') && (
                                                    <button
                                                        className={`btn btn-outline btn-sm ${log.status === 'APPROVED' ? 'border-accent-green/40 text-accent-green hover:bg-accent-green/10' : ''}`}
                                                        onClick={() => setSelectedLogForSobrantes(log.id)}
                                                        title={log.status === 'APPROVED' ? 'Ajustar sobrantes en un pedido ya aprobado' : 'Registrar sobrantes'}
                                                    >
                                                        <Package size={14} strokeWidth={2.4} /> {log.status === 'APPROVED' ? 'Ajustar Sobrantes' : 'Sobrantes'}
                                                    </button>
                                                )}
                                                {log.status === 'REJECTED' && (
                                                    <button className="btn btn-outline btn-sm border-accent-red text-accent-red" onClick={() => deleteDailyLog(log.id)}><Trash2 size={14} strokeWidth={2.4} /> Descartar</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <button
                            className="btn btn-primary py-4 text-base w-full"
                            onClick={() => setSelectedEventTitleForNew(selectedCaseta)}
                        >
                            <ClipboardList size={18} strokeWidth={2.2} /> Realizar Pedido
                        </button>
                        <button
                            className="btn btn-outline py-4 text-base w-full"
                            onClick={() => setSelectedEventTitleForNew(`${selectedCaseta} (Extra ${extraCount + 1})`)}
                        >
                            <Plus size={18} strokeWidth={2.2} /> Realizar Pedido Extra
                        </button>
                    </div>
                </div>
            );
        }

        // --- GESTIONAR PANEL (always shown by default) ---

        // --- NEW LOGIC: COMPLETION STATE ---
        const allLogsFinished = logsForDate.length > 0 && logsForDate.every(l => l.status === 'CLOSED' || l.status === 'APPROVED');
        const allProgrammedStarted = availableProgrammedOrders.length === 0;
        const isWorkdayFinished = allLogsFinished && allProgrammedStarted;

        // --- NEW LOGIC: FINAL DAY OF FERIA ---
        // Find if selectedDate is the VERY LAST DAY of any EVENT (feria)
        const feriasEnEsteDia = events.filter(e => e.date === selectedDate && e.type === 'EVENT');
        let isFinalDay = false;
        let feriaNameFinalDay = '';

        if (feriasEnEsteDia.length > 0) {
            for (const feria of feriasEnEsteDia) {
                // Get all days for this feria
                const allDaysForFeria = events
                    .filter(e => e.type === 'EVENT' && e.title === feria.title)
                    .map(e => e.date)
                    .sort();

                const lastDay = allDaysForFeria[allDaysForFeria.length - 1];
                if (lastDay === selectedDate) {
                    isFinalDay = true;
                    feriaNameFinalDay = feria.title;
                    break;
                }
            }
        }

        // Across the whole feria: are there still OPEN logs (i.e. casetas that
        // haven't done their total close yet)? If so, we must NOT show the
        // "feria finalizada" screen — the user still needs the cierre buttons.
        let feriaHasOpenLogs = false;
        if (isFinalDay) {
            const feriaDays = new Set(
                events.filter(e => e.type === 'EVENT' && e.title === feriaNameFinalDay).map(e => e.date)
            );
            feriaHasOpenLogs = allLogs.some(l =>
                feriaDays.has(l.date) &&
                l.eventTitle &&
                l.eventTitle.includes(feriaNameFinalDay) &&
                l.status === 'OPEN'
            );
        }

        // 1. Completion State: Last Day of Feria Finished
        if (isFinalDay && isWorkdayFinished && !feriaHasOpenLogs) {
            return (
                <div className="animate-fade-in text-center py-12 px-6">
                    <div className="mb-6 flex flex-col items-center">
                        <span className="w-16 h-16 rounded-2xl bg-accent-blue/15 border border-accent-blue/25 text-accent-blue flex items-center justify-center mb-4">
                            <Sparkles size={32} strokeWidth={2} />
                        </span>
                        <h2 className="text-3xl font-bold text-accent-blue mb-2">¡Feria Finalizada con Éxito!</h2>
                        <p className="text-text-muted text-lg">{feriaNameFinalDay}</p>
                    </div>
                    <div className="card bg-accent-blue/5 border-accent-blue/20 max-w-md mx-auto p-6">
                        <p className="text-sm mb-4">
                            Has completado todos los pedidos y sobrantes para el último día de esta feria.
                        </p>
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                                <span className="text-xs text-text-muted">Pedidos realizados hoy:</span>
                                <span className="font-bold num">{logsForDate.length}</span>
                            </div>
                            <div className="p-3 rounded-lg bg-accent-blue/10 text-accent-blue font-bold text-sm flex items-center justify-center gap-2">
                                <CheckCircle2 size={16} strokeWidth={2.4} className="shrink-0" /> Todo el stock ha sido devuelto al inventario central.
                            </div>
                        </div>
                    </div>
                    <p className="mt-8 text-text-muted text-sm italic">"Buen trabajo, equipo."</p>
                    <div className="flex justify-center mt-6">
                        <button
                            className="btn btn-outline btn-sm bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/30 text-accent-blue"
                            onClick={() => setShowExtraModal(true)}
                        >
                            <Plus size={14} strokeWidth={2.4} /> Añadir Pedido Extra / Olvidado
                        </button>
                    </div>
                </div>
            );
        }

        // 2. Completion State: Regular Workday Finished
        if (isWorkdayFinished) {
            return (
                <div className="animate-fade-in text-center py-12">
                    <div className="mb-4 flex flex-col items-center">
                        <span className="empty-state-icon text-accent-green bg-accent-green/10 border-accent-green/25">
                            <CheckCircle2 size={24} strokeWidth={2.2} />
                        </span>
                        <h2 className="text-2xl font-bold text-text-muted">Jornada Completada</h2>
                        <p className="text-sm text-text-muted mt-1">Todos los pedidos para el {selectedDate} han sido cerrados.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-center mt-8 gap-3">
                        <button
                            className="btn btn-outline text-sm"
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                        ><CalendarDays size={14} strokeWidth={2.4} /> Ir al día de hoy</button>
                        <button
                            className="btn btn-outline text-sm bg-accent-blue/10 hover:bg-accent-blue/20 border border-accent-blue/30 text-accent-blue"
                            onClick={() => setShowExtraModal(true)}
                        >
                            <Plus size={14} strokeWidth={2.4} /> Añadir Pedido Extra
                        </button>
                    </div>
                </div>
            );
        }

        // 3. Default Gestionar Panel

        // Find all base casetas for the feria — gathered across ALL feria days
        // (not just the final one) plus any programmed casetas, so a caseta
        // can still be closed even if it has no order on the final day.
        let baseCasetas: string[] = [];
        const feriaDatesSet = new Set<string>();
        if (isFinalDay) {
            events
                .filter(e => e.type === 'EVENT' && e.title === feriaNameFinalDay)
                .forEach(e => feriaDatesSet.add(e.date));

            const fromLogs = allLogs
                .filter(l => feriaDatesSet.has(l.date) && l.eventTitle && l.eventTitle.includes(feriaNameFinalDay))
                .map(l => l.eventTitle!.replace(/\s*\(Extra \d+\)$/, ''));
            const fromProgrammed = events
                .filter(e => e.type === 'ORDER' && feriaDatesSet.has(e.date) && e.title.includes(feriaNameFinalDay))
                .map(e => e.title.replace(/\s*\(Extra \d+\)$/, ''));

            baseCasetas = Array.from(new Set([...fromLogs, ...fromProgrammed]));
            // If there are no specific casetas, just use the generic one
            if (baseCasetas.length === 0) {
                baseCasetas = [`Pedido ${feriaNameFinalDay}`];
            }
        }

        return (
            <div className="animate-fade-in">
                {/* Final day banner */}
                {isFinalDay && (
                    <div className="mb-4 flex flex-col items-start gap-3 bg-accent-blue/10 border border-accent-blue/30 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <span className="icon-chip icon-chip-blue"><Flag size={18} strokeWidth={2.2} /></span>
                            <div>
                                <div className="font-bold text-accent-blue">Último día de feria</div>
                                <div className="text-sm text-text-muted">{feriaNameFinalDay}</div>
                            </div>
                        </div>
                        <div className="w-full mt-2 flex flex-col gap-2">
                            {baseCasetas.map(casetaBase => {
                                // Look at ALL feria-date logs for this caseta, not just today.
                                const casetaLogsAll = allLogs.filter(l =>
                                    feriaDatesSet.has(l.date) &&
                                    l.eventTitle &&
                                    l.eventTitle.replace(/\s*\(Extra \d+\)$/, '') === casetaBase
                                );
                                const hasAnyLogs = casetaLogsAll.length > 0;
                                // "Closed" = no log still in OPEN status. APPROVED is still a
                                // valid target for retroactive sobrante adjustment, so we keep
                                // the button enabled and just change the label.
                                const allDone = hasAnyLogs && casetaLogsAll.every(l => l.status === 'CLOSED' || l.status === 'APPROVED');

                                return (
                                    <button
                                        key={casetaBase}
                                        className={`btn flex items-center justify-between gap-2 shrink-0 w-full p-3 ${!hasAnyLogs ? 'bg-white/5 border-white/10 text-text-muted opacity-60' : allDone ? 'bg-accent-green/10 border-accent-green/30 text-accent-green hover:bg-accent-green/20' : 'btn-primary'}`}
                                        onClick={() => setShowTotalReturn(JSON.stringify({ feriaName: feriaNameFinalDay, casetaBase }))}
                                        disabled={!hasAnyLogs}
                                        title={!hasAnyLogs ? 'Esta caseta no tiene ningún pedido en la feria' : allDone ? 'Ya cerrada — pulsa para ajustar sobrantes' : ''}
                                    >
                                        <span className="font-semibold inline-flex items-center gap-2">
                                            {!hasAnyLogs ? (
                                                '— Sin pedidos'
                                            ) : allDone ? (
                                                <><RotateCcw size={15} strokeWidth={2.4} /> Ajustar Cierre</>
                                            ) : (
                                                <><Flag size={15} strokeWidth={2.4} /> Cierre Total</>
                                            )}
                                        </span>
                                        <span className="text-sm opacity-90 truncate max-w-[60%] text-right">{casetaBase}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="card mb-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <span className="icon-chip icon-chip-blue"><FolderKanban size={18} strokeWidth={2.2} /></span>
                            <div>
                                <h2 className="text-2xl font-bold mb-1">Gestionar</h2>
                                <p className="text-text-muted text-sm">
                                    Pedidos del día <strong>{selectedDate}</strong>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Existing orders for the day */}
                {logsForDate.length > 0 && (
                    <div className="mb-4">
                        <h3 className="section-label mb-3 px-1">Pedidos Activos</h3>
                        <div className="flex flex-col gap-3">
                            {logsForDate.map(log => (
                                <div key={log.id} className="card p-4 border border-white/10">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="font-bold text-lg">{log.eventTitle || 'Pedido General'}</div>
                                            <div className="mt-1.5">{renderStatusBadge(log.status)}</div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap sm:shrink-0">
                                            {log.status === 'PENDING_PEDIDO' && (
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => {
                                                        const initQ: Record<string, number> = {};
                                                        log.items.forEach(i => { initQ[i.product.id] = i.prepared; });
                                                        setEditQuantities(initQ);
                                                        setSelectedLogId(log.id);
                                                        setIsEditingOrder(true);
                                                    }}
                                                >
                                                    <Pencil size={14} strokeWidth={2.4} /> Editar
                                                </button>
                                            )}
                                            {(log.status === 'OPEN' || log.status === 'CLOSED' || log.status === 'APPROVED') && (
                                                <button
                                                    className={`btn btn-outline btn-sm ${log.status === 'APPROVED' ? 'border-accent-green/40 text-accent-green hover:bg-accent-green/10' : ''}`}
                                                    onClick={() => setSelectedLogForSobrantes(log.id)}
                                                    title={log.status === 'APPROVED' ? 'Ajustar sobrantes en un pedido ya aprobado' : 'Registrar sobrantes'}
                                                >
                                                    <Package size={14} strokeWidth={2.4} /> {log.status === 'APPROVED' ? 'Ajustar Sobrantes' : 'Sobrantes'}
                                                </button>
                                            )}
                                            {log.status === 'REJECTED' && (
                                                <button
                                                    className="btn btn-outline btn-sm border-accent-red text-accent-red"
                                                    onClick={() => { deleteDailyLog(log.id); }}
                                                >
                                                    <Trash2 size={14} strokeWidth={2.4} /> Descartar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Programmed casetas pending init */}
                {availableProgrammedOrders.length > 0 && (() => {
                    const groupedProgrammedOrders = availableProgrammedOrders.reduce((acc, po) => {
                        let group = "Generales";
                        let display = po.title;
                        if (po.title.startsWith('Pedido ')) {
                            const text = po.title.substring(7);
                            if (text.includes(' - Caseta: ')) {
                                const parts = text.split(' - Caseta: ');
                                group = parts[0];
                                display = parts[1];
                            } else {
                                group = text;
                                display = 'Caseta Principal';
                            }
                        } else if (po.title.includes(' - Caseta: ')) {
                            const parts = po.title.split(' - Caseta: ');
                            group = parts[0];
                            display = parts[1];
                        }
                        if (!acc[group]) acc[group] = [];
                        acc[group].push({ ...po, displayName: display });
                        return acc;
                    }, {} as Record<string, (typeof availableProgrammedOrders[0] & { displayName: string })[]>);

                    return (
                        <div className="mb-4">
                            <h3 className="section-label mb-3 px-1">Casetas Programadas sin Iniciar</h3>
                            <div className="flex flex-col gap-4">
                                {Object.entries(groupedProgrammedOrders).map(([groupName, pos]) => (
                                    <div key={groupName} className="flex flex-col gap-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-accent-blue/80 px-1">{groupName}</h4>
                                        {pos.map(po => (
                                            <button
                                                key={po.id}
                                                onClick={() => setSelectedCaseta(po.title)}
                                                className="p-3 border border-dashed border-accent-green/40 bg-accent-green/5 rounded-xl hover:bg-accent-green/10 flex justify-between items-center group transition-colors text-left"
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-bold text-accent-green truncate">{po.displayName}</div>
                                                    <div className="text-xs text-text-muted mt-0.5">Caseta programada</div>
                                                </div>
                                                <div className="text-accent-green text-xs font-bold shrink-0 bg-accent-green/10 px-3 py-1.5 rounded-md inline-flex items-center gap-1">
                                                    Gestionar <ChevronRight size={13} strokeWidth={2.4} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* Action buttons — only if not finished */}
                {!isWorkdayFinished && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <button
                            className="btn btn-primary py-4 text-base w-full"
                            onClick={() => setSelectedEventTitleForNew('')}
                        >
                            <ClipboardList size={18} strokeWidth={2.2} /> Realizar Pedido
                        </button>
                        <button
                            className="btn btn-outline py-4 text-base w-full"
                            onClick={() => setShowExtraModal(true)}
                        >
                            <Plus size={18} strokeWidth={2.2} /> Realizar Pedido Extra
                        </button>
                    </div>
                )}
            </div>
        );

    };

    // --- CASETA SELECTION MODAL FOR EXTRA ORDER ---
    const renderExtraModal = () => {
        if (!showExtraModal) return null;

        // Collect all unique caseta names from programmed orders for this day
        const programmedCasetas = programmedOrders.map(po => po.title);
        // Also include casetas that already have logs started
        const activeCasetas = Array.from(new Set(
            logsForDate
                .filter(l => l.eventTitle)
                .map(l => {
                    // strip existing Extra suffixes to get base caseta name
                    const base = l.eventTitle!.replace(/\s*\(Extra \d+\)$/, '');
                    return base;
                })
        ));
        // Merge and deduplicate
        const allCasetas = Array.from(new Set([...programmedCasetas, ...activeCasetas]));

        const handleSelectCaseta = (casetaName: string | null) => {
            setShowExtraModal(false);
            if (casetaName === null) {
                // General extra (no caseta)
                const extraCount = logsForDate.filter(l => l.eventTitle?.startsWith('Pedido Extra')).length;
                setSelectedEventTitleForNew(`Pedido Extra ${extraCount + 1}`);
            } else {
                const extraCount = logsForDate.filter(
                    l => l.eventTitle?.startsWith(casetaName) && l.eventTitle?.includes('Extra')
                ).length;
                setSelectedEventTitleForNew(`${casetaName} (Extra ${extraCount + 1})`);
            }
        };

        return (
            <div className="modal-overlay" onClick={() => setShowExtraModal(false)}>
                {/* Modal */}
                <div
                    className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-bg-primary border border-white/10 rounded-2xl shadow-2xl shadow-black/60"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="icon-chip icon-chip-blue"><Plus size={18} strokeWidth={2.2} /></span>
                                <div>
                                    <h2 className="text-xl font-bold">Pedido Extra</h2>
                                    <p className="text-text-muted text-sm mt-0.5">¿Para qué caseta es este pedido?</p>
                                </div>
                            </div>
                            <button
                                aria-label="Cerrar"
                                className="text-text-muted hover:text-white transition-colors p-1 shrink-0"
                                onClick={() => setShowExtraModal(false)}
                            ><X size={18} strokeWidth={2.4} /></button>
                        </div>
                    </div>

                    {/* Caseta list */}
                    <div className="p-4 flex flex-col gap-4 max-h-72 overflow-y-auto w-full">
                        {allCasetas.length > 0 ? (() => {
                            const groupedCasetas = allCasetas.reduce((acc, caseta) => {
                                let group = "Generales";
                                let display = caseta;
                                if (caseta.startsWith('Pedido ')) {
                                    const text = caseta.substring(7);
                                    if (text.includes(' - Caseta: ')) {
                                        const parts = text.split(' - Caseta: ');
                                        group = parts[0];
                                        display = parts[1];
                                    } else {
                                        group = text;
                                        display = 'Caseta Principal';
                                    }
                                } else if (caseta.includes(' - Caseta: ')) {
                                    const parts = caseta.split(' - Caseta: ');
                                    group = parts[0];
                                    display = parts[1];
                                }
                                if (!acc[group]) acc[group] = [];
                                acc[group].push({ fullTitle: caseta, displayName: display });
                                return acc;
                            }, {} as Record<string, { fullTitle: string, displayName: string }[]>);

                            return Object.entries(groupedCasetas).map(([groupName, casetasEnGrupo]) => (
                                <div key={groupName} className="flex flex-col gap-2">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-accent-blue/80 px-1">{groupName}</h4>
                                    {casetasEnGrupo.map(c => {
                                        const existingExtras = logsForDate.filter(
                                            l => l.eventTitle?.startsWith(c.fullTitle) && l.eventTitle?.includes('Extra')
                                        ).length;
                                        return (
                                            <button
                                                key={c.fullTitle}
                                                className="w-full text-left p-3 rounded-xl border border-white/10 bg-bg-elevated/40 hover:bg-accent-blue/10 hover:border-accent-blue/40 transition-all flex items-center justify-between group"
                                                onClick={() => handleSelectCaseta(c.fullTitle)}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="font-semibold text-white group-hover:text-accent-blue transition-colors truncate">{c.displayName}</div>
                                                    {existingExtras > 0 && (
                                                        <div className="text-xs text-text-muted mt-0.5">{existingExtras} extra{existingExtras > 1 ? 's' : ''} ya realizados</div>
                                                    )}
                                                </div>
                                                <span className="text-accent-blue text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap inline-flex items-center gap-1">Seleccionar <ChevronRight size={14} strokeWidth={2.4} /></span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ));
                        })() : (
                            <div className="empty-state py-6">
                                <span className="empty-state-icon"><Store size={20} strokeWidth={2} /></span>
                                <p className="text-sm">No hay casetas programadas para este día.</p>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="px-4 pb-4">
                        <div className="flex items-center gap-3 my-2">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-xs text-text-muted uppercase tracking-wider">o bien</span>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>
                        <button
                            className="w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 text-text-muted hover:text-white transition-all text-sm inline-flex items-center justify-center gap-2"
                            onClick={() => handleSelectCaseta(null)}
                        >
                            <Package size={16} strokeWidth={2.2} className="shrink-0" /> Pedido Extra General (sin caseta específica)
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className="w-full">
            <EmployeeCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
            />
            {renderPedidoContent()}
            {renderExtraModal()}
        </div>
    );
};
