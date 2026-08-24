import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    CalendarDays,
    CalendarPlus,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Eye,
    History,
    Loader2,
    Pencil,
    Plus,
    Save,
    Store,
    Trash2,
    X,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { EventType } from '../../types';

// ─── Date helpers ────────────────────────────────────────────────────────────
// Always local time. Never toISOString().slice(...) — it shifts the day by TZ.
const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());
const parseDateStr = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const MAX_RANGE_DAYS = 366;
const datesInRange = (from: string, to: string): string[] => {
    const out: string[] = [];
    const cur = parseDateStr(from);
    const end = parseDateStr(to);
    while (cur <= end && out.length < MAX_RANGE_DAYS) {
        out.push(toDateStr(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
};
const fmtShort = (s: string) => parseDateStr(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const fmtLong = (s: string) => parseDateStr(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtRange = (dates: string[]) => {
    if (dates.length === 0) return '';
    const first = dates[0];
    const last = dates[dates.length - 1];
    const year = parseDateStr(last).getFullYear();
    return first === last ? `${fmtShort(first)} ${year}` : `${fmtShort(first)} – ${fmtShort(last)} ${year}`;
};
const diasLabel = (n: number) => `${n} día${n === 1 ? '' : 's'}`;

// ─── Title parsing (must match Pedidos.tsx / FinancialFeriaReport.tsx) ──────
// EVENT row:  title = '<FeriaName>'
// ORDER row:  title = 'Pedido <FeriaName> - Caseta: <CasetaName>' (+ ' (Extra N)' on logs)
const EXTRA_SUFFIX = /\s*\(Extra \d+\)$/;
const CASETA_SEP = ' - Caseta: ';
const feriaNameOf = (title: string) => title.replace(/^Pedido /, '').split(CASETA_SEP)[0].trim();
const casetaNameOf = (title: string): string | null => {
    const idx = title.indexOf(CASETA_SEP);
    if (idx === -1) return null;
    const c = title.slice(idx + CASETA_SEP.length).replace(EXTRA_SUFFIX, '').trim();
    return c || null;
};
const casetaTitle = (feria: string, caseta: string) => `Pedido ${feria}${CASETA_SEP}${caseta}`;

// Feria and caseta names are parsed back out of titles, so neither may contain
// the caseta separator nor end in an " (Extra N)" suffix: either would be
// mis-split by Pedidos.tsx / FinancialFeriaReport.tsx. Returns an error
// message for a (trimmed) name, or null if it is safe to use.
const EXTRA_SUFFIX_ANY_CASE = /\s*\(Extra \d+\)$/i;
const nameError = (kind: 'feria' | 'caseta', name: string): string | null => {
    if (name.includes(CASETA_SEP)) return `El nombre de la ${kind} no puede contener "${CASETA_SEP.trim()}".`;
    if (EXTRA_SUFFIX_ANY_CASE.test(name)) return `El nombre de la ${kind} no puede terminar en "(Extra N)".`;
    return null;
};

interface FeriaGroup {
    name: string;
    dates: string[];      // sorted, unique
    casetas: string[];    // unique, order of first appearance
    rows: EventType[];    // every event row belonging to this feria
    description?: string;
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const FeriaCalendar: React.FC = () => {
    const { events = [], activeLogs, historicalLogs, addEvents, removeEvents } = useAppContext();
    const { addToast } = useToast();

    const today = todayStr();

    // ── UI state ──
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [selectedFeria, setSelectedFeria] = useState<string | null>(null);
    const [showPast, setShowPast] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Detail panel state
    const [casetaInput, setCasetaInput] = useState('');
    const [editingDates, setEditingDates] = useState(false);
    const [editFrom, setEditFrom] = useState('');
    const [editTo, setEditTo] = useState('');
    const detailRef = useRef<HTMLDivElement>(null);

    // "Nueva feria" modal state
    const [showNewModal, setShowNewModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newFrom, setNewFrom] = useState(today);
    const [newTo, setNewTo] = useState(today);
    const [newCasetas, setNewCasetas] = useState<string[]>([]);
    const [newCasetaInput, setNewCasetaInput] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newError, setNewError] = useState<string | null>(null);

    // ── Derived data ──
    const feriaGroups = useMemo<FeriaGroup[]>(() => {
        const map = new Map<string, FeriaGroup>();
        for (const ev of events) {
            const name = feriaNameOf(ev.title);
            if (!name) continue;
            let g = map.get(name);
            if (!g) {
                g = { name, dates: [], casetas: [], rows: [] };
                map.set(name, g);
            }
            g.rows.push(ev);
            if (!g.dates.includes(ev.date)) g.dates.push(ev.date);
            if (ev.type === 'ORDER') {
                const c = casetaNameOf(ev.title);
                if (c && !g.casetas.includes(c)) g.casetas.push(c);
            }
            if (ev.type === 'EVENT' && ev.description && !g.description) g.description = ev.description;
        }
        const list = Array.from(map.values());
        list.forEach(g => g.dates.sort());
        return list;
    }, [events]);

    const upcomingFerias = useMemo(
        () => feriaGroups
            .filter(f => f.dates[f.dates.length - 1] >= today)
            .sort((a, b) => a.dates[0].localeCompare(b.dates[0])),
        [feriaGroups, today]
    );
    const pastFerias = useMemo(
        () => feriaGroups
            .filter(f => f.dates[f.dates.length - 1] < today)
            .sort((a, b) => b.dates[0].localeCompare(a.dates[0])),
        [feriaGroups, today]
    );

    // date -> ferias present that day (with the casetas programmed that specific day)
    const feriasByDate = useMemo(() => {
        const m = new Map<string, { feria: FeriaGroup; casetas: string[] }[]>();
        for (const f of feriaGroups) {
            for (const d of f.dates) {
                const casetas = Array.from(new Set(
                    f.rows
                        .filter(r => r.date === d && r.type === 'ORDER')
                        .map(r => casetaNameOf(r.title))
                        .filter((c): c is string => !!c)
                ));
                const arr = m.get(d) ?? [];
                arr.push({ feria: f, casetas });
                m.set(d, arr);
            }
        }
        return m;
    }, [feriaGroups]);

    // dates that have at least one pedido (green dot in the grid)
    const pedidoCountByDate = useMemo(() => {
        const m = new Map<string, number>();
        [...activeLogs, ...historicalLogs].forEach(l => m.set(l.date, (m.get(l.date) ?? 0) + 1));
        return m;
    }, [activeLogs, historicalLogs]);

    const currentFeria = selectedFeria ? feriaGroups.find(f => f.name === selectedFeria) ?? null : null;

    // Reset the detail sub-forms when switching feria; scroll the panel into view
    useEffect(() => {
        setCasetaInput('');
        setEditingDates(false);
        if (selectedFeria && detailRef.current) {
            detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedFeria]);

    // ── Actions ──
    const runSave = async (fn: () => Promise<void>, okMsg: string, failMsg: string) => {
        if (isSaving) return false;
        setIsSaving(true);
        try {
            await fn();
            addToast(okMsg, 'success');
            return true;
        } catch (e) {
            console.error(e);
            addToast(failMsg, 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    // focusDate: also move the "Ese día" panel to that day (the feria lists
    // pass the feria's first day so the day panel matches the detail; the day
    // panel itself keeps whatever day is already selected).
    const openFeria = (f: FeriaGroup, focusDate?: string) => {
        setSelectedFeria(f.name);
        setCurrentMonth(parseDateStr(focusDate ?? f.dates[0]));
        if (focusDate) setSelectedDate(focusDate);
    };

    const openNewModal = (fromDate?: string) => {
        const from = fromDate ?? selectedDate ?? today;
        setNewName('');
        setNewFrom(from);
        setNewTo(from);
        setNewCasetas([]);
        setNewCasetaInput('');
        setNewDescription('');
        setNewError(null);
        setShowNewModal(true);
    };

    const addNewCasetaChip = () => {
        const c = newCasetaInput.trim();
        if (!c) return;
        const err = nameError('caseta', c);
        if (err) { setNewError(err); return; }
        setNewError(null);
        if (!newCasetas.includes(c)) setNewCasetas(prev => [...prev, c]);
        setNewCasetaInput('');
    };

    const handleCreateFeria = async () => {
        const name = newName.trim();
        if (!name) { setNewError('El nombre de la feria es obligatorio.'); return; }
        const feriaErr = nameError('feria', name);
        if (feriaErr) { setNewError(feriaErr); return; }
        if (!newFrom || !newTo) { setNewError('Indica las fechas de inicio y fin.'); return; }
        if (newTo < newFrom) { setNewError('La fecha "Hasta" debe ser igual o posterior a "Desde".'); return; }
        const dates = datesInRange(newFrom, newTo);
        if (dates.length >= MAX_RANGE_DAYS) { setNewError('El rango de fechas es demasiado largo.'); return; }
        // Anything typed but not yet added as a chip counts too
        const casetas = [...newCasetas];
        const pending = newCasetaInput.trim();
        if (pending && !casetas.includes(pending)) casetas.push(pending);
        for (const c of casetas) {
            const casetaErr = nameError('caseta', c);
            if (casetaErr) { setNewError(`${casetaErr} ("${c}")`); return; }
        }

        const existing = feriaGroups.find(f => f.name === name);
        const ts = Date.now();
        let idx = 0;
        const rows: EventType[] = [];
        for (const date of dates) {
            const alreadyHasDay = existing?.rows.some(r => r.type === 'EVENT' && r.date === date);
            if (!alreadyHasDay) {
                rows.push({
                    id: `evt-${ts}-${idx++}`,
                    date,
                    title: name,
                    type: 'EVENT',
                    ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
                });
            }
            for (const caseta of casetas) {
                const title = casetaTitle(name, caseta);
                const alreadyHasCaseta = existing?.rows.some(r => r.type === 'ORDER' && r.date === date && r.title === title);
                if (!alreadyHasCaseta) {
                    rows.push({ id: `evt-${ts}-${idx++}`, date, title, type: 'ORDER' });
                }
            }
        }
        if (rows.length === 0) {
            setNewError('Esa feria ya tiene todos esos días y casetas.');
            return;
        }
        setNewError(null);
        const ok = await runSave(
            () => addEvents(rows),
            existing ? 'Feria actualizada' : 'Feria creada',
            'No se pudo guardar la feria'
        );
        if (ok) {
            setShowNewModal(false);
            setSelectedDate(newFrom);
            setCurrentMonth(parseDateStr(newFrom));
            setSelectedFeria(name);
        }
    };

    const handleAddCaseta = async (feria: FeriaGroup) => {
        const caseta = casetaInput.trim();
        if (!caseta) return;
        const err = nameError('caseta', caseta);
        if (err) { addToast(err, 'error'); return; }
        if (feria.casetas.includes(caseta)) { addToast('Esa caseta ya existe en la feria', 'error'); return; }
        const ts = Date.now();
        const rows: EventType[] = feria.dates.map((date, i) => ({
            id: `evt-${ts}-${i}`,
            date,
            title: casetaTitle(feria.name, caseta),
            type: 'ORDER',
        }));
        const ok = await runSave(() => addEvents(rows), `Caseta "${caseta}" añadida`, 'No se pudo añadir la caseta');
        if (ok) setCasetaInput('');
    };

    const handleRemoveCaseta = async (feria: FeriaGroup, caseta: string) => {
        if (!window.confirm(`¿Quitar la caseta "${caseta}" de todos los días de ${feria.name}?\n\nLos pedidos ya realizados NO se borran.`)) return;
        const ids = feria.rows
            .filter(r => r.type === 'ORDER' && casetaNameOf(r.title) === caseta)
            .map(r => r.id);
        if (ids.length === 0) return;
        await runSave(() => removeEvents(ids), `Caseta "${caseta}" quitada`, 'No se pudo quitar la caseta');
    };

    const startEditDates = (feria: FeriaGroup) => {
        setEditFrom(feria.dates[0]);
        setEditTo(feria.dates[feria.dates.length - 1]);
        setEditingDates(true);
    };

    const handleSaveDates = async (feria: FeriaGroup) => {
        if (!editFrom || !editTo) { addToast('Indica ambas fechas', 'error'); return; }
        if (editTo < editFrom) { addToast('"Hasta" debe ser igual o posterior a "Desde"', 'error'); return; }
        const newDates = datesInRange(editFrom, editTo);
        if (newDates.length >= MAX_RANGE_DAYS) { addToast('El rango de fechas es demasiado largo', 'error'); return; }
        const currentSet = new Set(feria.dates);
        const newSet = new Set(newDates);
        const datesToAdd = newDates.filter(d => !currentSet.has(d));
        const datesToRemove = feria.dates.filter(d => !newSet.has(d));
        if (datesToAdd.length === 0 && datesToRemove.length === 0) {
            setEditingDates(false);
            addToast('Las fechas no han cambiado', 'info');
            return;
        }
        if (datesToRemove.length > 0) {
            const msg = `Se quitarán ${diasLabel(datesToRemove.length)} del calendario (${datesToRemove.map(fmtShort).join(', ')}).\n\nLos pedidos ya realizados NO se borran. ¿Continuar?`;
            if (!window.confirm(msg)) return;
        }
        const ts = Date.now();
        let idx = 0;
        const rowsToAdd: EventType[] = [];
        for (const date of datesToAdd) {
            rowsToAdd.push({
                id: `evt-${ts}-${idx++}`,
                date,
                title: feria.name,
                type: 'EVENT',
                ...(feria.description ? { description: feria.description } : {}),
            });
            for (const caseta of feria.casetas) {
                rowsToAdd.push({ id: `evt-${ts}-${idx++}`, date, title: casetaTitle(feria.name, caseta), type: 'ORDER' });
            }
        }
        const removeSet = new Set(datesToRemove);
        const idsToRemove = feria.rows.filter(r => removeSet.has(r.date)).map(r => r.id);

        const ok = await runSave(async () => {
            if (rowsToAdd.length > 0) await addEvents(rowsToAdd);
            if (idsToRemove.length > 0) await removeEvents(idsToRemove);
        }, 'Fechas actualizadas', 'No se pudieron actualizar las fechas');
        if (ok) {
            setEditingDates(false);
            setCurrentMonth(parseDateStr(editFrom));
        }
    };

    const handleDeleteFeria = async (feria: FeriaGroup) => {
        if (!window.confirm(`¿Eliminar la feria "${feria.name}"?\n\nSe eliminarán todos los días y casetas de la feria del calendario. Los pedidos ya realizados NO se borran.`)) return;
        const ids = feria.rows.map(r => r.id);
        const ok = await runSave(() => removeEvents(ids), 'Feria eliminada', 'No se pudo eliminar la feria');
        if (ok) setSelectedFeria(null);
    };

    // ── Month grid ──
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startingDay = new Date(year, month, 1).getDay() - 1; // Monday = 0
    if (startingDay === -1) startingDay = 6;
    const now = new Date();
    const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();

    const renderDayCells = () => {
        const cells: React.ReactNode[] = [];
        for (let i = 0; i < startingDay; i++) cells.push(<div key={`empty-${i}`} />);
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const ferias = feriasByDate.get(dateStr) ?? [];
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === today;
            const hasPedidos = (pedidoCountByDate.get(dateStr) ?? 0) > 0;
            const isPast = dateStr < today;
            cells.push(
                <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    aria-label={fmtLong(dateStr)}
                    aria-pressed={isSelected}
                    className={`min-h-[60px] sm:min-h-[84px] p-1 sm:p-1.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${isSelected
                        ? 'bg-accent-blue/20 border-accent-blue ring-2 ring-accent-blue/40'
                        : 'bg-bg-elevated/40 border-white/5 hover:bg-bg-elevated hover:border-white/15'
                        } ${isPast && !isSelected ? 'opacity-70' : ''}`}
                >
                    <div className="flex items-center justify-between gap-1 w-full">
                        <span className={`text-xs sm:text-sm font-bold leading-none ${isToday ? 'text-accent-blue' : ''}`}>{day}</span>
                        <span className="flex items-center gap-1">
                            {hasPedidos && <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" title="Hay pedidos este día" />}
                            {isToday && <span className="text-[8px] sm:text-[9px] uppercase font-black tracking-wider text-white bg-accent-blue px-1 rounded">Hoy</span>}
                        </span>
                    </div>
                    <div className="flex flex-col gap-0.5 w-full overflow-hidden">
                        {ferias.slice(0, 2).map(({ feria, casetas }) => (
                            <span
                                key={feria.name}
                                title={feria.name}
                                className="text-[10px] leading-tight px-1 py-0.5 rounded bg-accent-blue/20 text-accent-blue border border-accent-blue/30 truncate w-full"
                            >
                                {feria.name}{casetas.length > 0 && <span className="opacity-80"> · {casetas.length}</span>}
                            </span>
                        ))}
                        {ferias.length > 2 && (
                            <span className="text-[10px] leading-tight text-text-muted px-1">+{ferias.length - 2}</span>
                        )}
                    </div>
                </button>
            );
        }
        return cells;
    };

    // ── Renderers ──
    const renderFeriaRow = (f: FeriaGroup) => {
        const isActive = currentFeria?.name === f.name;
        return (
            <div
                key={f.name}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${isActive ? 'border-accent-blue/50 bg-accent-blue/10' : 'border-white/10 bg-bg-elevated/30'}`}
            >
                <div className="min-w-0 flex-1">
                    <div className="font-bold truncate" title={f.name}>{f.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                        {fmtRange(f.dates)} · {diasLabel(f.dates.length)}
                    </div>
                    {f.casetas.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {f.casetas.map(c => <span key={c} className="badge badge-blue text-[10px] py-0 px-1.5">{c}</span>)}
                        </div>
                    ) : (
                        <div className="text-[11px] text-text-muted/70 mt-1 italic">Sin casetas</div>
                    )}
                </div>
                <button
                    type="button"
                    className="btn btn-outline btn-sm min-h-[44px] shrink-0"
                    onClick={() => openFeria(f, f.dates[0])}
                >
                    <Eye size={14} strokeWidth={2.4} /> Ver
                </button>
            </div>
        );
    };

    const renderFeriaList = () => (
        <div className="card">
            <div className="flex items-center gap-3 mb-4">
                <span className="icon-chip icon-chip-blue"><Store size={18} strokeWidth={2.2} /></span>
                <div>
                    <h2 className="text-xl font-bold mb-0">Próximas ferias</h2>
                    <p className="text-xs text-text-muted mb-0">{upcomingFerias.length === 0 ? 'Nada programado' : `${upcomingFerias.length} programada${upcomingFerias.length === 1 ? '' : 's'}`}</p>
                </div>
            </div>

            {upcomingFerias.length === 0 ? (
                <div className="empty-state py-8">
                    <span className="empty-state-icon"><CalendarDays size={20} strokeWidth={2} /></span>
                    <p className="text-sm mb-2">No hay ferias programadas.</p>
                    <button type="button" className="btn btn-primary min-h-[44px]" onClick={() => openNewModal()}>
                        <CalendarPlus size={16} strokeWidth={2.2} /> Nueva feria
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {upcomingFerias.map(renderFeriaRow)}
                </div>
            )}

            {pastFerias.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <button
                        type="button"
                        className="w-full flex items-center justify-between gap-2 text-sm font-semibold text-text-muted hover:text-text-primary transition-colors min-h-[44px]"
                        onClick={() => setShowPast(v => !v)}
                        aria-expanded={showPast}
                    >
                        <span className="inline-flex items-center gap-2"><History size={14} strokeWidth={2.4} /> Ferias pasadas ({pastFerias.length})</span>
                        <ChevronDown size={16} strokeWidth={2.4} className={`transition-transform ${showPast ? 'rotate-180' : ''}`} />
                    </button>
                    {showPast && (
                        <div className="flex flex-col gap-2 mt-3 animate-fade-in">
                            {pastFerias.map(renderFeriaRow)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderDetailPanel = () => {
        if (!currentFeria) return null;
        const f = currentFeria;
        const isPastFeria = f.dates[f.dates.length - 1] < today;
        return (
            <div ref={detailRef} className="card border-accent-blue/25 animate-fade-in">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <span className="icon-chip icon-chip-blue shrink-0"><Store size={18} strokeWidth={2.2} /></span>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold mb-0.5 break-words">{f.name}</h2>
                            <p className="text-sm text-text-muted mb-0">
                                {fmtRange(f.dates)} · {diasLabel(f.dates.length)}
                                {isPastFeria && <span className="badge badge-gray ml-2 text-[10px] py-0 px-1.5">Pasada</span>}
                            </p>
                            {f.description && <p className="text-sm text-text-secondary mt-2 mb-0 break-words">{f.description}</p>}
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Cerrar"
                        className="text-text-muted hover:text-white transition-colors p-2 -m-2 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        onClick={() => setSelectedFeria(null)}
                    ><X size={18} strokeWidth={2.4} /></button>
                </div>

                {/* Casetas */}
                <div className="mb-5">
                    <div className="section-label mb-2">Casetas ({f.casetas.length})</div>
                    {f.casetas.length === 0 ? (
                        <p className="text-sm text-text-muted italic mb-2">Sin casetas todavía. Añade una para poder hacer pedidos por caseta.</p>
                    ) : (
                        <div className="flex flex-col gap-2 mb-3">
                            {f.casetas.map(c => (
                                <div key={c} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-bg-elevated/40 border border-white/5">
                                    <span className="font-medium truncate inline-flex items-center gap-2 min-w-0" title={c}>
                                        <Store size={14} strokeWidth={2.2} className="text-accent-blue shrink-0" />
                                        <span className="truncate">{c}</span>
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm text-accent-red hover:bg-accent-red/10 min-h-[36px] shrink-0"
                                        disabled={isSaving}
                                        onClick={() => handleRemoveCaseta(f, c)}
                                    >
                                        <Trash2 size={13} strokeWidth={2.4} /> Quitar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Nombre de la caseta"
                            aria-label="Nombre de la caseta"
                            value={casetaInput}
                            disabled={isSaving}
                            onChange={e => setCasetaInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCaseta(f); } }}
                        />
                        <button
                            type="button"
                            className="btn btn-primary min-h-[44px] shrink-0"
                            disabled={isSaving || !casetaInput.trim()}
                            onClick={() => handleAddCaseta(f)}
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.4} />} Añadir
                        </button>
                    </div>
                </div>

                {/* Fechas */}
                <div className="mb-5">
                    <div className="section-label mb-2">Fechas</div>
                    {!editingDates ? (
                        <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-bg-elevated/40 border border-white/5">
                            <span className="text-sm inline-flex items-center gap-2 min-w-0">
                                <CalendarDays size={14} strokeWidth={2.2} className="text-accent-blue shrink-0" />
                                <span className="truncate">{fmtRange(f.dates)}</span>
                            </span>
                            <button type="button" className="btn btn-outline btn-sm min-h-[36px] shrink-0" disabled={isSaving} onClick={() => startEditDates(f)}>
                                <Pencil size={13} strokeWidth={2.4} /> Editar fechas
                            </button>
                        </div>
                    ) : (
                        <div className="p-3 rounded-lg bg-bg-elevated/40 border border-accent-blue/20 animate-fade-in">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="edit-from">Desde</label>
                                    <input
                                        id="edit-from"
                                        type="date" className="px-2 sm:px-4 text-sm"
                                        value={editFrom}
                                        disabled={isSaving}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setEditFrom(v);
                                            if (editTo && v > editTo) setEditTo(v);
                                        }}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-to">Hasta</label>
                                    <input id="edit-to" type="date" className="px-2 sm:px-4 text-sm" value={editTo} min={editFrom || undefined} disabled={isSaving} onChange={e => setEditTo(e.target.value)} />
                                </div>
                            </div>
                            <p className="text-xs text-text-muted mt-2 mb-3">Los días nuevos se crean con las mismas casetas. Los días quitados desaparecen del calendario, pero sus pedidos no se borran.</p>
                            <div className="flex gap-2">
                                <button type="button" className="btn btn-outline w-full min-h-[44px]" disabled={isSaving} onClick={() => setEditingDates(false)}>Cancelar</button>
                                <button type="button" className="btn btn-primary w-full min-h-[44px]" disabled={isSaving} onClick={() => handleSaveDates(f)}>
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} strokeWidth={2.2} />} Guardar
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Peligro */}
                <div className="pt-4 border-t border-white/5">
                    <button
                        type="button"
                        className="btn btn-danger w-full min-h-[44px]"
                        disabled={isSaving}
                        onClick={() => handleDeleteFeria(f)}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} strokeWidth={2.2} />} Eliminar feria
                    </button>
                    <p className="text-[11px] text-text-muted mt-2 mb-0 text-center">Se quitan los días y casetas del calendario. Los pedidos ya realizados no se borran.</p>
                </div>
            </div>
        );
    };

    const renderDayPanel = () => {
        const ferias = feriasByDate.get(selectedDate) ?? [];
        const pedidos = pedidoCountByDate.get(selectedDate) ?? 0;
        return (
            <div className="card animate-fade-in">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                        <div className="section-label mb-1">Ese día</div>
                        <h3 className="text-lg font-bold mb-0 capitalize">{fmtLong(selectedDate)}</h3>
                        {pedidos > 0 && (
                            <p className="text-xs text-accent-green mt-1 mb-0 inline-flex items-center gap-1">
                                <ClipboardList size={12} strokeWidth={2.4} /> {pedidos} pedido{pedidos === 1 ? '' : 's'} realizado{pedidos === 1 ? '' : 's'}
                            </p>
                        )}
                    </div>
                    <button type="button" className="btn btn-outline btn-sm min-h-[44px] shrink-0" disabled={isSaving} onClick={() => openNewModal(selectedDate)}>
                        <CalendarPlus size={14} strokeWidth={2.4} /> Nueva feria
                    </button>
                </div>
                {ferias.length === 0 ? (
                    <p className="text-sm text-text-muted mb-0">No hay ninguna feria este día.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {ferias.map(({ feria, casetas }) => (
                            <div key={feria.name} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-bg-elevated/30">
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold truncate" title={feria.name}>{feria.name}</div>
                                    {casetas.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {casetas.map(c => <span key={c} className="badge badge-blue text-[10px] py-0 px-1.5">{c}</span>)}
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-text-muted/70 mt-1 italic">Sin casetas este día</div>
                                    )}
                                </div>
                                <button type="button" className="btn btn-outline btn-sm min-h-[44px] shrink-0" onClick={() => openFeria(feria)}>
                                    <Eye size={14} strokeWidth={2.4} /> Ver feria
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderNewModal = () => {
        if (!showNewModal) return null;
        const trimmedName = newName.trim();
        const existing = trimmedName ? feriaGroups.find(f => f.name === trimmedName) : undefined;
        const close = () => { if (!isSaving) setShowNewModal(false); };
        return (
            <div className="modal-overlay" onClick={close}>
                <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="new-feria-title">
                    <div className="flex items-center justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <span className="icon-chip icon-chip-blue"><CalendarPlus size={18} strokeWidth={2.2} /></span>
                            <div>
                                <h2 id="new-feria-title" className="text-xl font-bold mb-0">Nueva feria</h2>
                                <p className="text-xs text-text-muted mb-0">Días y casetas se crean de golpe.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            aria-label="Cerrar"
                            className="text-text-muted hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -m-2"
                            onClick={close}
                        ><X size={18} strokeWidth={2.4} /></button>
                    </div>

                    <div className="input-group">
                        <label htmlFor="nf-name">Nombre</label>
                        <input
                            id="nf-name"
                            type="text"
                            list="feria-names"
                            placeholder="Ej. Feria de Málaga"
                            value={newName}
                            disabled={isSaving}
                            autoFocus
                            onChange={e => { setNewName(e.target.value); setNewError(null); }}
                        />
                        <datalist id="feria-names">
                            {feriaGroups.map(f => <option key={f.name} value={f.name} />)}
                        </datalist>
                        {existing && (
                            <div className="mt-2 flex items-start gap-2 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/25 rounded-lg p-2.5">
                                <AlertTriangle size={14} strokeWidth={2.4} className="shrink-0 mt-0.5" />
                                <span>Ya existe una feria con este nombre ({fmtRange(existing.dates)}). Al guardar se añadirán estos días y casetas a esa misma feria.</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                        <div>
                            <label htmlFor="nf-from">Desde</label>
                            <input
                                id="nf-from"
                                type="date" className="px-2 sm:px-4 text-sm"
                                value={newFrom}
                                disabled={isSaving}
                                onChange={e => {
                                    const v = e.target.value;
                                    setNewFrom(v);
                                    if (!newTo || newTo < v) setNewTo(v);
                                    setNewError(null);
                                }}
                            />
                        </div>
                        <div>
                            <label htmlFor="nf-to">Hasta</label>
                            <input
                                id="nf-to"
                                type="date" className="px-2 sm:px-4 text-sm"
                                value={newTo}
                                min={newFrom || undefined}
                                disabled={isSaving}
                                onChange={e => { setNewTo(e.target.value); setNewError(null); }}
                            />
                        </div>
                        {newFrom && newTo && newTo >= newFrom && (
                            <p className="col-span-2 text-xs text-text-muted mb-0 -mt-1">
                                {diasLabel(datesInRange(newFrom, newTo).length)} · {fmtRange([newFrom, newTo])}
                            </p>
                        )}
                    </div>

                    <div className="input-group">
                        <label htmlFor="nf-caseta">Casetas <span className="font-normal text-text-muted/70">(opcional)</span></label>
                        <div className="flex gap-2">
                            <input
                                id="nf-caseta"
                                type="text"
                                placeholder="Ej. Caseta Principal"
                                value={newCasetaInput}
                                disabled={isSaving}
                                onChange={e => setNewCasetaInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewCasetaChip(); } }}
                            />
                            <button
                                type="button"
                                className="btn btn-outline min-h-[44px] shrink-0"
                                disabled={isSaving || !newCasetaInput.trim()}
                                onClick={addNewCasetaChip}
                            >
                                <Plus size={16} strokeWidth={2.4} /> Añadir
                            </button>
                        </div>
                        {newCasetas.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {newCasetas.map(c => (
                                    <span key={c} className="badge badge-blue gap-1 pr-1">
                                        {c}
                                        <button
                                            type="button"
                                            aria-label={`Quitar ${c}`}
                                            className="rounded-full hover:bg-white/15 p-0.5 transition-colors"
                                            disabled={isSaving}
                                            onClick={() => setNewCasetas(prev => prev.filter(x => x !== c))}
                                        ><X size={12} strokeWidth={2.6} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-text-muted mt-2 mb-0">Cada caseta tendrá su propio pedido cada día de la feria.</p>
                    </div>

                    <div className="input-group">
                        <label htmlFor="nf-desc">Descripción <span className="font-normal text-text-muted/70">(opcional)</span></label>
                        <textarea
                            id="nf-desc"
                            rows={2}
                            placeholder="Notas, dirección, contacto…"
                            value={newDescription}
                            disabled={isSaving}
                            onChange={e => setNewDescription(e.target.value)}
                        />
                    </div>

                    {newError && (
                        <div className="mb-4 flex items-start gap-2 text-sm text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg p-3">
                            <AlertTriangle size={16} strokeWidth={2.4} className="shrink-0 mt-0.5" />
                            <span>{newError}</span>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" className="btn btn-outline w-full min-h-[48px]" disabled={isSaving} onClick={close}>Cancelar</button>
                        <button type="button" className="btn btn-primary w-full min-h-[48px]" disabled={isSaving} onClick={handleCreateFeria}>
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.2} />}
                            {isSaving ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Page ──
    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <div className="section-label mb-2">Planificación</div>
                    <h1 className="page-title">Calendario</h1>
                    <p className="page-subtitle mb-0">Programa las ferias y sus casetas. Los pedidos se hacen desde Pedidos.</p>
                </div>
                <button type="button" className="btn btn-primary min-h-[48px] w-full md:w-auto" disabled={isSaving} onClick={() => openNewModal()}>
                    <CalendarPlus size={18} strokeWidth={2.2} /> Nueva feria
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Right column on desktop, first on mobile: list + detail */}
                <div className="flex flex-col gap-6 lg:col-span-2 lg:order-2">
                    {renderFeriaList()}
                    {renderDetailPanel()}
                </div>

                {/* Left column on desktop: month grid + "Ese día" */}
                <div className="flex flex-col gap-6 lg:col-span-3 lg:order-1">
                    <div className="card">
                        <div className="flex justify-between items-center gap-2 mb-4 bg-bg-elevated/30 p-2 rounded-xl">
                            <button type="button" className="btn btn-outline btn-sm min-h-[44px] sm:px-4" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} aria-label="Mes anterior">
                                <ChevronLeft size={16} strokeWidth={2.4} /> <span className="hidden sm:inline">Anterior</span>
                            </button>
                            <div className="text-center min-w-0">
                                <h3 className="text-base sm:text-lg font-bold mb-0 leading-tight">{MONTHS[month]} {year}</h3>
                                {!isCurrentMonth && (
                                    <button type="button" className="text-[11px] text-accent-blue hover:underline" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(today); }}>
                                        Ir a hoy
                                    </button>
                                )}
                            </div>
                            <button type="button" className="btn btn-outline btn-sm min-h-[44px] sm:px-4" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} aria-label="Mes siguiente">
                                <span className="hidden sm:inline">Siguiente</span> <ChevronRight size={16} strokeWidth={2.4} />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1 text-center text-text-muted font-bold text-[10px] sm:text-xs uppercase tracking-wider">
                            {WEEKDAYS.map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                            {renderDayCells()}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-text-muted">
                            <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm bg-accent-blue/30 border border-accent-blue/40" /> Feria · nº casetas</span>
                            <span className="inline-flex items-center gap-1.5"><span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-green" /> Día con pedidos</span>
                        </div>
                    </div>

                    {renderDayPanel()}
                </div>
            </div>

            {renderNewModal()}
        </div>
    );
};
