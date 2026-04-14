import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { EventType, InventoryItem } from '../../types';

// Helper to get days in month
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

// Helper to get starting day of week (0 = Sunday, 1 = Monday)
function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export const PointOfSale: React.FC = () => {
    const { events = [], activeLogs, historicalLogs, products, addEvent, removeEvent, deleteDailyLog, updatePedidoItems } = useAppContext();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isAddingEvent, setIsAddingEvent] = useState(false);
    const [newEvent, setNewEvent] = useState<Partial<EventType> & { endDate?: string, caseta?: string }>({ type: 'EVENT' });

    // State for expanding/editing orders
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
    const [isEditingOrder, setIsEditingOrder] = useState(false);
    const [editingItems, setEditingItems] = useState<{ product: any, prepared: number }[]>([]);
    const [isAddingNewCaseta, setIsAddingNewCaseta] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingFeriaName, setEditingFeriaName] = useState<string | null>(null);

    // Compute existing Ferias and their Casetas
    const feriasConfig = useMemo(() => {
        const config: Record<string, Set<string>> = {};

        const processTitle = (fullTitle: string) => {
            const parts = fullTitle.split(' - Caseta: ');
            const feriaName = parts[0];
            const casetaName = parts.length > 1 ? parts[1] : null;

            if (!config[feriaName]) {
                config[feriaName] = new Set();
            }
            // Strip any (Extra) tags for grouping if they exist
            const cleanCaseta = casetaName?.split(' (Extra')[0];
            if (cleanCaseta) {
                config[feriaName].add(cleanCaseta.trim());
            }
        };

        const feriasOnly = events.filter((e: EventType) => e.type === 'EVENT');
        feriasOnly.forEach((evt: EventType) => processTitle(evt.title));

        const finalConfig: Record<string, string[]> = {};
        for (const [feria, casetasSet] of Object.entries(config)) {
            finalConfig[feria] = Array.from(casetasSet).sort();
        }
        return finalConfig;
    }, [events, historicalLogs]);

    const displayableEvents = useMemo(() => {
        const combined: EventType[] = [...events];

        // Find orphan logs (logs that have no matching event in `events`)
        const allLogs = [...activeLogs, ...historicalLogs];

        allLogs.forEach(log => {
            // If the log has an eventTitle, check if there's an event on that date with that title
            // If it doesn't have an eventTitle, it's definitely an orphan (basic daily order)
            const hasMatchingEvent = log.eventTitle
                ? combined.some(e => e.date === log.date && e.title === log.eventTitle)
                : false;

            if (!hasMatchingEvent) {
                // Determine a fallback title
                const fallbackTitle = log.eventTitle || 'Pedido Básico';

                // Add it as a virtual event
                combined.push({
                    id: `virtual-${log.id}`,
                    date: log.date,
                    title: fallbackTitle,
                    description: 'Pedido registrado sin evento en el calendario.',
                    type: 'ORDER'
                });
            }
        });

        return combined;
    }, [events, activeLogs, historicalLogs]);

    // Group all feria entries (EVENT and ORDER) by base feria name to enable day editing
    const feriaGroups = useMemo(() => {
        const groups: Record<string, { dates: string[], eventTitles: string[] }> = {};
        events.forEach((evt: EventType) => {
            // Strip "Pedido " prefix (ORDER-type) then strip caseta suffix
            const baseName = evt.title.replace(/^Pedido /, '').split(' - Caseta: ')[0].trim();
            if (!groups[baseName]) groups[baseName] = { dates: [], eventTitles: [] };
            if (!groups[baseName].dates.includes(evt.date)) groups[baseName].dates.push(evt.date);
            if (!groups[baseName].eventTitles.includes(evt.title)) groups[baseName].eventTitles.push(evt.title);
        });
        for (const g of Object.values(groups)) g.dates.sort();
        return groups;
    }, [events]);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    let startingDay = getFirstDayOfMonth(year, month) - 1;
    if (startingDay === -1) startingDay = 6;

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const handleSaveEvent = async () => {
        if (!newEvent.title || !newEvent.date || isSaving) return;
        setIsSaving(true);
        try {
            let datesToAdd = [newEvent.date];

            if (newEvent.endDate) {
                const start = new Date(newEvent.date);
                const end = new Date(newEvent.endDate);

                if (end > start) {
                    datesToAdd = [];
                    let current = new Date(start);
                    while (current <= end) {
                        const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
                        datesToAdd.push(dateStr);
                        current.setDate(current.getDate() + 1);
                    }
                }
            }

            const baseTitle = newEvent.caseta
                ? `${newEvent.title!.trim()} - Caseta: ${newEvent.caseta.trim()}`
                : newEvent.title!.trim();

            const combinedTitle = newEvent.type === 'ORDER' ? `Pedido ${baseTitle}` : baseTitle;

            const newEventsArray = datesToAdd.map((d, idx) => ({
                id: `evt-${Date.now()}-${idx}`,
                date: d,
                title: combinedTitle,
                description: newEvent.description || '',
                type: newEvent.type as 'EVENT' | 'ORDER'
            }));

            for (const e of newEventsArray) {
                await addEvent(e);
            }

            setIsAddingEvent(false);
            setNewEvent({ type: 'EVENT' });
        } catch (error) {
            console.error("Error saving event:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteEvent = async (evt: EventType) => {
        if (!window.confirm("¿Eliminar este evento/pedido?")) return;

        // Case 1: Virtual event (orphan log shown as event) — only delete the log
        if (evt.id.startsWith('virtual-')) {
            const realLogId = evt.id.replace('virtual-', '');
            await deleteDailyLog(realLogId);
            return;
        }

        // Case 2: Real ORDER event — delete the calendar entry AND the associated log (if any)
        if (evt.type === 'ORDER') {
            // Find any active or historical log matching this event
            const allLogs = [...activeLogs, ...historicalLogs];
            const associatedLog = allLogs.find(
                l => l.date === evt.date && l.eventTitle === evt.title
            );
            if (associatedLog) {
                await deleteDailyLog(associatedLog.id);
            }
            await removeEvent(evt.id);
            return;
        }

        // Case 3: Regular calendar EVENT — just remove it
        await removeEvent(evt.id);
    };

    const handleExpandEvent = (evt: EventType) => {
        if (expandedEventId === evt.id) {
            setExpandedEventId(null);
            setIsEditingOrder(false);
        } else {
            setExpandedEventId(evt.id);
            setIsEditingOrder(false);
        }
    };

    const getLogForEvent = (evt: EventType) => {
        // Handle virtual events from orphan logs
        if (evt.id.startsWith('virtual-')) {
            const realId = evt.id.replace('virtual-', '');
            return activeLogs.find(l => l.id === realId) || historicalLogs.find(l => l.id === realId);
        }

        // Try active logs first, then historical logs
        const log = activeLogs.find(l => l.date === evt.date && l.eventTitle === evt.title) ||
            historicalLogs.find(l => l.date === evt.date && l.eventTitle === evt.title);
        return log;
    };

    const startEditingOrder = (evt: EventType) => {
        const log = getLogForEvent(evt);
        if (log) {
            const logItemsMap = new Map(log.items.map(i => [i.product.id, i.prepared]));
            // Initialize editing items with all general products, defaulting to 0 if not present in the log
            const initialEdits = products
                .filter(p => p.category !== 'General')
                .map(p => ({
                    product: p,
                    prepared: logItemsMap.get(p.id) || 0
                }));
            setEditingItems(initialEdits);
            setIsEditingOrder(true);
        }
    };

    const handleUpdateQuantity = (productId: string, newQuantity: number) => {
        setEditingItems(prev => prev.map(item =>
            item.product.id === productId ? { ...item, prepared: Math.max(0, newQuantity) } : item
        ));
    };

    const handleAddDayToFeria = async (feriaName: string) => {
        if (isSaving) return;
        const group = feriaGroups[feriaName];
        if (!group || group.dates.length === 0) return;
        setIsSaving(true);
        try {
            const lastDate = group.dates[group.dates.length - 1];
            const [y, m, d] = lastDate.split('-').map(Number);
            const nextDateObj = new Date(y, m - 1, d);
            nextDateObj.setDate(nextDateObj.getDate() + 1);
            const nextDateStr = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth() + 1).padStart(2, '0')}-${String(nextDateObj.getDate()).padStart(2, '0')}`;
            const uniqueTitles = Array.from(new Set(
                events
                    .filter((e: EventType) => e.date === lastDate && e.title.replace(/^Pedido /, '').split(' - Caseta: ')[0].trim() === feriaName)
                    .map((e: EventType) => e.title)
            ));
            for (let i = 0; i < uniqueTitles.length; i++) {
                await addEvent({ id: `evt-${Date.now()}-${i}`, date: nextDateStr, title: uniqueTitles[i], type: 'EVENT', description: '' });
            }
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const handleRemoveDayFromFeria = async (feriaName: string) => {
        const group = feriaGroups[feriaName];
        if (!group || group.dates.length <= 1) return;
        const lastDate = group.dates[group.dates.length - 1];
        if (!window.confirm(`¿Quitar el día ${lastDate} de la feria "${feriaName}"?`)) return;
        if (isSaving) return;
        setIsSaving(true);
        try {
            const lastDayEvents = events.filter(
                (e: EventType) => e.date === lastDate && e.title.replace(/^Pedido /, '').split(' - Caseta: ')[0].trim() === feriaName
            );
            for (const evt of lastDayEvents) await removeEvent(evt.id);
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const saveOrderChanges = async (evt: EventType) => {
        const log = getLogForEvent(evt);
        if (log && editingItems.length > 0 && !isSaving) {
            setIsSaving(true);
            try {
                // filter out 0 quantities if needed or let them stay
                const validItems = editingItems.filter(item => item.prepared > 0);
                await updatePedidoItems(log.id, validItems);
                setIsEditingOrder(false);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const renderOrderDetails = (evt: EventType) => {
        const log = getLogForEvent(evt);

        if (!log) {
            return (
                <div className="mt-4 p-4 bg-black/20 rounded-md border border-white/5 text-center text-text-muted text-sm">
                    No se ha iniciado un pedido para este evento aún. (El empleado debe hacerlo desde su panel).
                </div>
            );
        }

        if (isEditingOrder) {
            return (
                <div className="mt-4 p-4 bg-black/20 rounded-md border border-accent-blue/30 animate-fade-in">
                    <h4 className="font-bold mb-3 text-accent-blue border-b border-white/10 pb-2">Editando Cantidades del Pedido</h4>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {editingItems.map(item => (
                            <div key={item.product.id} className="flex flex-col bg-bg-elevated p-3 rounded border border-white/5">
                                <span className="text-sm font-medium mb-2 truncate" title={item.product.name}>{item.product.name}</span>
                                <div className="flex justify-between items-center mt-auto">
                                    <button className="btn btn-outline px-3 py-1 text-lg hover:bg-white/10" onClick={() => handleUpdateQuantity(item.product.id, item.prepared - 1)}>-</button>
                                    <span className="text-lg font-bold w-12 text-center text-accent-blue">{item.prepared}</span>
                                    <button className="btn btn-outline px-3 py-1 text-lg hover:bg-white/10" onClick={() => handleUpdateQuantity(item.product.id, item.prepared + 1)}>+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-4 mt-6 pt-4 border-t border-white/10">
                        <button className="btn btn-outline flex-1" onClick={() => setIsEditingOrder(false)} disabled={isSaving}>Cancelar</button>
                        <button className="btn btn-primary flex-1 shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2" onClick={() => saveOrderChanges(evt)} disabled={isSaving}>
                            {isSaving ? <span className="animate-spin text-lg">⏳</span> : null}
                            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="mt-4 p-4 bg-black/20 rounded-md border border-white/5 animate-fade-in">
                <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                    <h4 className="font-bold text-sm text-text-muted">Desglose del Pedido</h4>
                    <span className="badge bg-white/10 text-xs text-center border border-white/20 px-2 py-1 rounded">
                        {log.status === 'PENDING_PEDIDO' ? 'Pendiente' :
                            log.status === 'OPEN' ? 'En cruso' :
                                log.status === 'CLOSED' ? 'Día Cerrado' :
                                    log.status === 'APPROVED' ? 'Histórico Auditado' : log.status}
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
                    {log.items.map((item: InventoryItem) => (
                        <div key={item.product.id} className="bg-bg-elevated p-2 rounded text-center border border-white/5">
                            <div className="text-xs text-text-muted truncate" title={item.product.name}>{item.product.name}</div>
                            <div className="font-bold text-accent-blue">{item.prepared}</div>
                        </div>
                    ))}
                    {log.items.length === 0 && (
                        <div className="col-span-full text-center text-sm text-text-muted py-2 bg-black/20 rounded-md">Sin productos solicitados.</div>
                    )}
                </div>

                <div className="flex justify-end mt-2">
                    <button
                        className="btn btn-outline border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 text-sm py-1"
                        onClick={() => startEditingOrder(evt)}
                    >
                        ✏️ Editar Formato Real
                    </button>
                </div>
            </div>
        );
    };

    const renderCalendar = () => {
        const days = [];

        for (let i = 0; i < startingDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = displayableEvents.filter(e => e.date === dateStr);
            const isSelected = selectedDate === dateStr;

            days.push(
                <button
                    key={day}
                    onClick={() => {
                        setSelectedDate(dateStr);
                        setNewEvent({ ...newEvent, date: dateStr });
                    }}
                    className={`p-2 min-h-[80px] border border-white/5 rounded-md flex flex-col items-start justify-start transition-all relative ${isSelected ? 'bg-accent-blue/20 border-accent-blue shadow-lg' : 'bg-bg-elevated/30 hover:bg-bg-elevated cursor-pointer'
                        }`}
                >
                    <span className="text-sm font-bold mb-1 opacity-80">{day}</span>
                    <div className="flex flex-col gap-1 w-full overflow-hidden">
                        {dayEvents.slice(0, 3).map(e => (
                            <div key={e.id} className={`text-[10px] truncate px-1 rounded-sm w-full text-left ${e.type === 'EVENT' ? 'bg-accent-blue/30 text-accent-blue' : 'bg-accent-green/30 text-accent-green'}`}>
                                {e.title}
                            </div>
                        ))}
                        {dayEvents.length > 3 && (
                            <div className="text-[10px] text-text-muted text-center w-full">+{dayEvents.length - 3} más</div>
                        )}
                    </div>
                </button>
            );
        }

        return days;
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    const selectedDayEvents = selectedDate ? displayableEvents.filter(e => e.date === selectedDate) : [];

    return (
        <div className="animate-fade-in w-full space-y-6">
            <div className="card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl mb-1">🏪 Punto de Venta y Calendario</h2>
                        <p className="text-text-muted">Planifica ferias, eventos especiales y previsión de pedidos.</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => {
                        setNewEvent({ ...newEvent, type: 'EVENT', date: selectedDate || `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}` })
                        setIsAddingEvent(true);
                    }}>
                        + Nuevo Evento/Pedido
                    </button>
                </div>

                <div className="flex justify-between items-center mb-4 bg-bg-elevated/30 p-2 rounded-md">
                    <button className="btn btn-outline px-4 py-2" onClick={prevMonth}>&larr; Ant</button>
                    <h3 className="text-xl font-bold">{monthNames[month]} {year}</h3>
                    <button className="btn btn-outline px-4 py-2" onClick={nextMonth}>Sig &rarr;</button>
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2 text-center text-text-muted font-bold text-sm uppercase">
                    <div>Lun</div>
                    <div>Mar</div>
                    <div>Mié</div>
                    <div>Jue</div>
                    <div>Vie</div>
                    <div>Sáb</div>
                    <div>Dom</div>
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-2">
                    {renderCalendar()}
                </div>
            </div>

            {selectedDate && (
                <div className="card animate-fade-in border-t-4 border-t-accent-blue">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Agenda para el día: {selectedDate}</h3>
                    </div>

                    {selectedDayEvents.length === 0 ? (
                        <p className="text-text-muted text-center py-8 bg-black/20 rounded-lg">No hay eventos o pedidos programados para este día.</p>
                    ) : (
                        <div className="grid gap-3">
                            {(() => {
                                const shownFeriaEditors = new Set<string>();
                                return selectedDayEvents.map(evt => {
                                    const feriaName = evt.title.replace(/^Pedido /, '').split(' - Caseta: ')[0].trim();
                                    const group = feriaGroups[feriaName];
                                    const showEditor = group && !shownFeriaEditors.has(feriaName);
                                    if (showEditor) shownFeriaEditors.add(feriaName);
                                    const isEditingDays = editingFeriaName === feriaName;

                                    return (
                                        <div key={evt.id} className="bg-bg-elevated p-4 rounded-lg border border-white/5 flex flex-col gap-2">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded transition-colors" onClick={() => handleExpandEvent(evt)}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`badge ${evt.type === 'EVENT' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-accent-green/20 text-accent-green'}`}>
                                                            {evt.type === 'EVENT' ? '📅 Evento (Feria/Fiesta)' : '📦 Previsión Pedido'}
                                                        </span>
                                                        <span className="font-bold text-lg">{evt.title}</span>
                                                    </div>
                                                    {evt.description && <p className="text-text-muted text-sm mt-2">{evt.description}</p>}
                                                </div>
                                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                                    <span className="text-text-muted text-sm shrink-0">
                                                        {expandedEventId === evt.id ? '↑ Ocultar' : '↓ Ver Detalles'}
                                                    </span>
                                                    <button
                                                        className="btn btn-outline text-accent-red border-accent-red/30 hover:bg-accent-red/20 shrink-0 ml-auto sm:ml-2"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteEvent(evt); }}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>

                                            {showEditor && (
                                                <div className="border-t border-white/10 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                    <div className="text-sm text-text-muted flex items-center gap-2 flex-wrap">
                                                        <span>📅 {group.dates[0] === group.dates[group.dates.length - 1] ? group.dates[0] : `${group.dates[0]} → ${group.dates[group.dates.length - 1]}`}</span>
                                                        <span className="badge badge-blue">{group.dates.length} {group.dates.length === 1 ? 'día' : 'días'}</span>
                                                    </div>
                                                    {isEditingDays ? (
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <button
                                                                className="btn btn-outline border-accent-red/30 text-accent-red hover:bg-accent-red/10 text-sm py-1 px-3 disabled:opacity-40"
                                                                onClick={() => handleRemoveDayFromFeria(feriaName)}
                                                                disabled={isSaving || group.dates.length <= 1}
                                                                title={group.dates.length <= 1 ? 'No se puede quitar el único día' : `Quitar el día ${group.dates[group.dates.length - 1]}`}
                                                            >
                                                                − 1 Día
                                                            </button>
                                                            <button
                                                                className="btn btn-outline border-accent-green/30 text-accent-green hover:bg-accent-green/10 text-sm py-1 px-3 disabled:opacity-40"
                                                                onClick={() => handleAddDayToFeria(feriaName)}
                                                                disabled={isSaving}
                                                            >
                                                                + 1 Día
                                                            </button>
                                                            <button
                                                                className="btn btn-outline text-sm py-1 px-3"
                                                                onClick={() => setEditingFeriaName(null)}
                                                            >
                                                                ✓ Listo
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            className="btn btn-outline text-sm py-1 px-3"
                                                            onClick={() => setEditingFeriaName(feriaName)}
                                                        >
                                                            ✏️ Editar días
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {expandedEventId === evt.id && renderOrderDetails(evt)}
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    )}
                </div>
            )}

            {isAddingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-bg-primary p-6 rounded-lg border border-white/10 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Añadir al calendario</h3>

                        <div className="space-y-4 mb-6">
                            <div className="input-group">
                                <label className="mb-3 block">Tipo de entrada</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        className={`py-3 px-2 rounded-lg border transition-all flex flex-col items-center gap-2 ${newEvent.type === 'EVENT' ? 'bg-accent-blue/20 border-accent-blue text-white ring-1 ring-accent-blue' : 'bg-black/20 border-white/10 text-text-muted hover:border-white/30'}`}
                                        onClick={() => setNewEvent({ ...newEvent, type: 'EVENT' })}
                                    >
                                        <span className="text-xl">📅</span>
                                        <span className="text-xs font-bold uppercase tracking-wider">Evento / Feria</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`py-3 px-2 rounded-lg border transition-all flex flex-col items-center gap-2 ${newEvent.type === 'ORDER' ? 'bg-accent-green/20 border-accent-green text-white ring-1 ring-accent-green' : 'bg-black/20 border-white/10 text-text-muted hover:border-white/30'}`}
                                        onClick={() => setNewEvent({ ...newEvent, type: 'ORDER' })}
                                    >
                                        <span className="text-xl">🏕️</span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-center">Crear Pedido y Caseta</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="input-group flex-1">
                                    <label>Desde el día</label>
                                    <input
                                        type="date"
                                        className="w-full bg-black/30 border border-white/20 rounded p-2 text-white outline-none"
                                        value={newEvent.date || ''}
                                        onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                                    />
                                </div>
                                <div className="input-group flex-1">
                                    <label>Hasta el día (Opcional)</label>
                                    <input
                                        type="date"
                                        className="w-full bg-black/30 border border-white/20 rounded p-2 text-white outline-none"
                                        value={newEvent.endDate || ''}
                                        min={newEvent.date}
                                        onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="input-group flex-1">
                                    <label>Feria / Evento</label>
                                    <input
                                        type="text"
                                        list="ferias-list"
                                        className="w-full bg-black/30 border border-white/20 rounded p-2 text-white outline-none"
                                        value={newEvent.title || ''}
                                        onChange={e => {
                                            setNewEvent({ ...newEvent, title: e.target.value, caseta: '' });
                                            setIsAddingNewCaseta(false); // Reset to dropdown if feria changes and exists
                                        }}
                                        placeholder="Ej. Feria de Jerez"
                                    />
                                    <datalist id="ferias-list">
                                        {Object.keys(feriasConfig).map(feria => (
                                            <option key={feria} value={feria} />
                                        ))}
                                    </datalist>
                                </div>
                                {newEvent.type === 'ORDER' && (
                                    <div className="input-group flex-1">
                                        <label>Caseta / Pedido (Opcional)</label>
                                        {(feriasConfig[newEvent.title || '']?.length > 0 && !isAddingNewCaseta) ? (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex gap-2">
                                                    <select
                                                        className="w-full bg-black/30 border border-white/20 rounded p-2 text-white outline-none"
                                                        value={newEvent.caseta || ''}
                                                        onChange={e => setNewEvent({ ...newEvent, caseta: e.target.value })}
                                                    >
                                                        <option value="">Selecciona caseta o pedido...</option>
                                                        {feriasConfig[newEvent.title as string].map(c => (
                                                            <option key={c} value={c}>{c}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        className="btn btn-outline px-3 transition-colors hover:text-white"
                                                        onClick={() => { setIsAddingNewCaseta(true); setNewEvent({ ...newEvent, caseta: '' }); }}
                                                        title="Añadir Nuevo Pedido / Caseta a esta Feria"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-text-muted mt-1">Casetas exclusivas vinculadas a esta Feria.</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-black/30 border border-white/20 rounded p-2 text-white outline-none border-dashed border-accent-blue/50"
                                                        value={newEvent.caseta || ''}
                                                        onChange={e => setNewEvent({ ...newEvent, caseta: e.target.value })}
                                                        placeholder="Ej. La Viga"
                                                    />
                                                    {feriasConfig[newEvent.title || '']?.length > 0 && (
                                                        <button
                                                            className="btn btn-outline px-3 transition-colors hover:text-white"
                                                            onClick={() => { setIsAddingNewCaseta(false); setNewEvent({ ...newEvent, caseta: '' }); }}
                                                            title="Volver a seleccionar caseta existente"
                                                        >
                                                            ↺
                                                        </button>
                                                    )}
                                                </div>
                                                {feriasConfig[newEvent.title || '']?.length > 0 && isAddingNewCaseta && (
                                                    <p className="text-[10px] text-accent-blue/80 mt-1">Creando una nueva caseta para esta Feria.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="input-group">
                                <label>Descripción / Notas (Opcional)</label>
                                <textarea
                                    className="w-full bg-black/30 border border-white/20 rounded p-2 text-white outline-none min-h-[80px]"
                                    value={newEvent.description || ''}
                                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                                    placeholder="Detalles sobre lo que se necesita preparar..."
                                />
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-4 justify-end">
                            <button className="btn btn-outline w-full sm:w-auto" onClick={() => setIsAddingEvent(false)} disabled={isSaving}>Cancelar</button>
                            <button className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2" onClick={handleSaveEvent} disabled={!newEvent.title || !newEvent.date || isSaving}>
                                {isSaving ? <span className="animate-spin text-lg">⏳</span> : null}
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
