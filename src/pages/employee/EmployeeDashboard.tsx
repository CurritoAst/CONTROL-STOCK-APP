import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PreparationLog } from './PreparationLog';
import { ConsumptionLog } from './ConsumptionLog';
import { EmployeeCalendar } from './EmployeeCalendar';

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
                        <div className="mb-4 flex items-center justify-between bg-accent-blue/10 border border-accent-blue/20 p-4 rounded-lg">
                            <div>
                                <span className="text-text-muted text-sm block">Registrando sobrantes de:</span>
                                <strong className="text-accent-blue">{logForSob.eventTitle || 'Pedido General'}</strong>
                            </div>
                            <button className="btn btn-outline text-sm shrink-0" onClick={() => setSelectedLogForSobrantes(null)}>← Volver</button>
                        </div>
                        <ConsumptionLog currentLog={logForSob} onClose={() => setSelectedLogForSobrantes(null)} />
                    </div>
                );
            }
        }

        // --- DEVOLUCIÓN TOTAL ---
        if (showTotalReturn !== null) {
            // Collect all dates that belong to this feria (EVENT-type events with this title)
            const feriaDates = new Set(
                events
                    .filter(e => e.type === 'EVENT' && e.title === showTotalReturn)
                    .map(e => e.date)
            );
            // Get all logs from those feria dates that are in a closeable state
            const feriaLogs = allLogs.filter(l =>
                feriaDates.has(l.date) &&
                (l.status === 'OPEN' || l.status === 'APPROVED' || l.status === 'CLOSED')
            );
            return (
                <div className="animate-fade-in">
                    <div className="mb-4 flex items-center justify-between bg-accent-blue/10 border border-accent-blue/20 p-4 rounded-lg">
                        <div>
                            <span className="text-text-muted text-sm block">Finalizando Feria:</span>
                            <strong className="text-accent-blue">{showTotalReturn}</strong>
                        </div>
                        <button className="btn btn-outline text-sm shrink-0" onClick={() => setShowTotalReturn(null)}>← Volver</button>
                    </div>
                    <ConsumptionLog aggregatedLogs={feriaLogs} onClose={() => setShowTotalReturn(null)} />
                </div>
            );
        }

        // --- EDIT MODE ---
        if (isEditingOrder && currentLog && currentLog.status === 'PENDING_PEDIDO') {
            return (
                <div className="card animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">✏️ Editar Pedido</h2>
                            <p className="text-text-muted text-sm mt-1">{currentLog.eventTitle || 'Pedido General'} — {selectedDate}</p>
                        </div>
                        <button className="btn btn-outline text-sm" onClick={() => setIsEditingOrder(false)}>Cancelar</button>
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
                                .sort((a,b) => a.name.localeCompare(b.name))
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
                                                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold"
                                                        onClick={() => setEditQuantities(prev => ({ ...prev, [product.id]: Math.max(0, qty - 1) }))}
                                                    >-</button>
                                                    <span className={`text-xl font-bold w-10 text-center ${qty > 0 ? 'text-accent-blue' : 'text-text-muted'}`}>{qty}</span>
                                                    <button 
                                                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-accent-blue/40 text-white flex items-center justify-center font-bold"
                                                        onClick={() => {
                                                            if (!isOutOfStock) {
                                                                setEditQuantities(prev => ({ ...prev, [product.id]: Math.min(availableStock, qty + 1) }));
                                                            }
                                                        }}
                                                        disabled={isOutOfStock}
                                                    >+</button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                    <button
                        className="btn btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
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
                        {isSaving ? <span className="animate-spin text-lg">⏳</span> : null}
                        {isSaving ? 'Guardando...' : '💾 Guardar Cambios'}
                    </button>
                </div>
            );
        }

        // --- NEW PEDIDO FORM (inline, when creating a new one) ---
        if (selectedEventTitleForNew !== null) {
            return (
                <div className="animate-fade-in">
                    <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-accent-blue/10 border border-accent-blue/20 p-4 rounded-lg gap-3">
                        <div className="w-full">
                            <span className="text-text-muted text-sm block mb-1">Preparando nuevo pedido para:</span>
                            <strong className="text-lg text-accent-blue break-words">{selectedEventTitleForNew || 'Pedido del Día'}</strong>
                        </div>
                        <button
                            className="btn btn-outline text-sm w-full sm:w-auto shrink-0"
                            onClick={() => {
                                setSelectedEventTitleForNew(null);
                                // If we came from a caseta panel, go back to it
                            }}
                        >← Volver a Gestionar</button>
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
            const statusLabel: Record<string, string> = {
                PENDING_PEDIDO: '⏳ Pendiente de Aprobación',
                OPEN: '🟢 Aprobado — En Servicio',
                CLOSED: '🔒 Finalizado',
                APPROVED: '✅ Aprobado por Master',
                REJECTED: '❌ Rechazado',
            };
            const extraCount = casetaLogs.filter(l => l.eventTitle?.includes('Extra')).length;
            return (
                <div className="animate-fade-in">
                    <div className="card mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold mb-0.5">🗂 Gestionar</h2>
                                <p className="text-accent-blue font-semibold">{selectedCaseta}</p>
                            </div>
                            <button className="btn btn-outline text-sm shrink-0" onClick={() => setSelectedCaseta(null)}>← Volver</button>
                        </div>
                    </div>

                    {casetaLogs.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 px-1">Pedidos de esta Caseta</h3>
                            <div className="flex flex-col gap-3">
                                {casetaLogs.map(log => (
                                    <div key={log.id} className="card p-4 border border-white/10">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <div className="font-bold">{log.eventTitle}</div>
                                                <div className="text-sm text-text-muted mt-0.5">{statusLabel[log.status] || log.status}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                {log.status === 'PENDING_PEDIDO' && (
                                                    <button className="btn btn-outline text-sm" onClick={() => {
                                                        const initQ: Record<string, number> = {};
                                                        log.items.forEach(i => { initQ[i.product.id] = i.prepared; });
                                                        setEditQuantities(initQ);
                                                        setSelectedLogId(log.id);
                                                        setIsEditingOrder(true);
                                                    }}>✏️ Editar</button>
                                                )}
                                                {log.status === 'OPEN' && (
                                                    <button className="btn btn-outline text-sm" onClick={() => setSelectedLogForSobrantes(log.id)}>📦 Sobrantes</button>
                                                )}
                                                {log.status === 'REJECTED' && (
                                                    <button className="btn btn-outline border-accent-red text-accent-red text-sm" onClick={() => deleteDailyLog(log.id)}>🗑 Descartar</button>
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
                            📋 Realizar Pedido
                        </button>
                        <button
                            className="btn btn-outline py-4 text-base w-full"
                            onClick={() => setSelectedEventTitleForNew(`${selectedCaseta} (Extra ${extraCount + 1})`)}
                        >
                            ➕ Realizar Pedido Extra
                        </button>
                    </div>
                </div>
            );
        }

        // --- GESTIONAR PANEL (always shown by default) ---
        const statusLabel: Record<string, string> = {
            PENDING_PEDIDO: '⏳ Pendiente de Aprobación',
            OPEN: '🟢 Aprobado — En Servicio',
            CLOSED: '🔒 Finalizado',
            APPROVED: '✅ Aprobado por Master',
            REJECTED: '❌ Rechazado',
        };

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

        // 1. Completion State: Last Day of Feria Finished
        if (isFinalDay && isWorkdayFinished) {
            return (
                <div className="animate-fade-in text-center py-12 px-6">
                    <div className="mb-6">
                        <span className="text-7xl block mb-4 animate-bounce">🎊</span>
                        <h2 className="text-3xl font-bold text-accent-blue mb-2">¡Feria Finalizada con Éxito!</h2>
                        <p className="text-text-muted text-lg">{feriaNameFinalDay}</p>
                    </div>
                    <div className="card bg-accent-blue/5 border-accent-blue/20 max-w-md mx-auto p-6">
                        <p className="text-sm mb-4">
                            Has completado todos los pedidos y sobrantes para el último día de esta feria.
                        </p>
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center bg-black/20 p-3 rounded border border-white/5">
                                <span className="text-xs text-text-muted">Pedidos realizados hoy:</span>
                                <span className="font-bold">{logsForDate.length}</span>
                            </div>
                            <div className="p-3 rounded bg-accent-blue/10 text-accent-blue font-bold text-sm">
                                ✅ Todo el stock ha sido devuelto al inventario central.
                            </div>
                        </div>
                    </div>
                    <p className="mt-8 text-text-muted text-sm italic">"Buen trabajo, equipo."</p>
                </div>
            );
        }

        // 2. Completion State: Regular Workday Finished
        if (isWorkdayFinished) {
            return (
                <div className="animate-fade-in text-center py-12">
                    <div className="mb-4">
                        <span className="text-5xl block mb-2">✅</span>
                        <h2 className="text-2xl font-bold text-text-muted">Jornada Completada</h2>
                        <p className="text-sm text-text-muted mt-1">Todos los pedidos para el {selectedDate} han sido cerrados.</p>
                    </div>
                    <div className="flex justify-center mt-6">
                        <button 
                            className="btn btn-outline text-xs"
                            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                        >Ir al día de hoy</button>
                    </div>
                </div>
            );
        }

        // 3. Default Gestionar Panel
        return (
            <div className="animate-fade-in">
                {/* Final day banner */}
                {isFinalDay && (
                    <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-accent-blue/10 border border-accent-blue/30 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🎪</span>
                            <div>
                                <div className="font-bold text-accent-blue">Último día de feria</div>
                                <div className="text-sm text-text-muted">{feriaNameFinalDay}</div>
                            </div>
                        </div>
                        <button
                            className="btn btn-primary flex items-center gap-2 shrink-0 w-full sm:w-auto"
                            onClick={() => setShowTotalReturn(feriaNameFinalDay)}
                        >
                            🏁 Cierre Total de Feria
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="card mb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold mb-1">🗂 Gestionar</h2>
                            <p className="text-text-muted text-sm">
                                Pedidos del día <strong>{selectedDate}</strong>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Existing orders for the day */}
                {logsForDate.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 px-1">Pedidos Activos</h3>
                        <div className="flex flex-col gap-3">
                            {logsForDate.map(log => (
                                <div key={log.id} className="card p-4 border border-white/10">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <div className="font-bold text-lg">{log.eventTitle || 'Pedido General'}</div>
                                            <div className="text-sm text-text-muted mt-0.5">{statusLabel[log.status] || log.status}</div>
                                        </div>
                                        <div className="flex gap-2 flex-wrap sm:shrink-0">
                                            {log.status === 'PENDING_PEDIDO' && (
                                                <button
                                                    className="btn btn-outline text-sm"
                                                    onClick={() => {
                                                        const initQ: Record<string, number> = {};
                                                        log.items.forEach(i => { initQ[i.product.id] = i.prepared; });
                                                        setEditQuantities(initQ);
                                                        setSelectedLogId(log.id);
                                                        setIsEditingOrder(true);
                                                    }}
                                                >
                                                    ✏️ Editar
                                                </button>
                                            )}
                                            {log.status === 'OPEN' && (
                                                <button className="btn btn-outline text-sm" onClick={() => setSelectedLogForSobrantes(log.id)}>
                                                    📦 Sobrantes
                                                </button>
                                            )}
                                            {log.status === 'REJECTED' && (
                                                <button
                                                    className="btn btn-outline border-accent-red text-accent-red text-sm"
                                                    onClick={() => { deleteDailyLog(log.id); }}
                                                >
                                                    🗑 Descartar
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
                {availableProgrammedOrders.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3 px-1">Casetas Programadas sin Iniciar</h3>
                        <div className="flex flex-col gap-3">
                            {availableProgrammedOrders.map(po => (
                                <button
                                    key={po.id}
                                    onClick={() => setSelectedCaseta(po.title)}
                                    className="p-4 border border-dashed border-accent-green/40 bg-accent-green/5 rounded-lg hover:bg-accent-green/10 flex justify-between items-center group transition-colors text-left"
                                >
                                    <div>
                                        <div className="font-bold text-accent-green">{po.title}</div>
                                        <div className="text-sm text-text-muted mt-0.5">Caseta programada por el Master</div>
                                    </div>
                                    <div className="text-accent-green text-sm font-bold shrink-0 bg-accent-green/10 px-3 py-1.5 rounded-md">
                                        Gestionar →
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action buttons — only if not finished */}
                {!isWorkdayFinished && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <button
                            className="btn btn-primary py-4 text-base w-full"
                            onClick={() => setSelectedEventTitleForNew('')}
                        >
                            📋 Realizar Pedido
                        </button>
                        <button
                            className="btn btn-outline py-4 text-base w-full"
                            onClick={() => setShowExtraModal(true)}
                        >
                            ➕ Realizar Pedido Extra
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowExtraModal(false)}>
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                {/* Modal */}
                <div
                    className="relative z-10 w-full max-w-md bg-bg-primary border border-white/10 rounded-2xl shadow-2xl shadow-black/60 animate-fade-in"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold">➕ Pedido Extra</h2>
                                <p className="text-text-muted text-sm mt-0.5">¿Para qué caseta es este pedido?</p>
                            </div>
                            <button
                                className="text-text-muted hover:text-white transition-colors p-1"
                                onClick={() => setShowExtraModal(false)}
                            >✕</button>
                        </div>
                    </div>

                    {/* Caseta list */}
                    <div className="p-4 flex flex-col gap-2 max-h-72 overflow-y-auto">
                        {allCasetas.length > 0 ? (
                            allCasetas.map(caseta => {
                                const existingExtras = logsForDate.filter(
                                    l => l.eventTitle?.startsWith(caseta) && l.eventTitle?.includes('Extra')
                                ).length;
                                return (
                                    <button
                                        key={caseta}
                                        className="w-full text-left p-4 rounded-xl border border-white/10 bg-bg-elevated/40 hover:bg-accent-blue/10 hover:border-accent-blue/40 transition-all flex items-center justify-between group"
                                        onClick={() => handleSelectCaseta(caseta)}
                                    >
                                        <div>
                                            <div className="font-semibold text-white group-hover:text-accent-blue transition-colors">{caseta}</div>
                                            {existingExtras > 0 && (
                                                <div className="text-xs text-text-muted mt-0.5">{existingExtras} extra{existingExtras > 1 ? 's' : ''} ya realizados</div>
                                            )}
                                        </div>
                                        <span className="text-accent-blue text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">Seleccionar →</span>
                                    </button>
                                );
                            })
                        ) : (
                            <p className="text-text-muted text-sm text-center py-4">No hay casetas programadas para este día.</p>
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
                            className="w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 text-text-muted hover:text-white transition-all text-sm"
                            onClick={() => handleSelectCaseta(null)}
                        >
                            📦 Pedido Extra General (sin caseta específica)
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
