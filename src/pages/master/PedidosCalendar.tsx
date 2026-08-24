import React, { useMemo } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Package, XCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { DailyLog } from '../../types';

// Local-time "YYYY-MM-DD" (same as FeriaCalendar). Never toISOString().slice —
// it shifts the day by the timezone offset around midnight.
const pad = (n: number) => String(n).padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());

// Helper to get days in month
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

// Helper to get starting day of week (0 = Sunday, 1 = Monday)
function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export const PedidosCalendar: React.FC<{
    selectedDate: string;
    onSelectDate: (date: string) => void;
    currentMonth: Date;
    onMonthChange: (date: Date) => void;
}> = ({ selectedDate, onSelectDate, currentMonth, onMonthChange }) => {
    const { activeLogs, historicalLogs, events = [] } = useAppContext();

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    // Adjust so Monday is 0, Sunday is 6
    let startingDay = getFirstDayOfMonth(year, month) - 1;
    if (startingDay === -1) startingDay = 6;

    const prevMonth = () => onMonthChange(new Date(year, month - 1, 1));
    const nextMonth = () => onMonthChange(new Date(year, month + 1, 1));

    // Map logs to dates for quick lookup
    const logsByDate = useMemo(() => {
        const map = new Map<string, DailyLog>();
        // Add historical logs first
        historicalLogs.forEach(log => map.set(log.date, log));
        // Overwrite with any active logs
        activeLogs.forEach(log => map.set(log.date, log));
        return map;
    }, [activeLogs, historicalLogs]);

    const getStatusUI = (log: DailyLog | undefined, isSelected: boolean) => {
        if (!log) {
            return <div className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-text-muted/50'}`}>Sin Pedido</div>;
        }

        // Single-admin flow: OPEN/PENDING_PEDIDO = en curso, CLOSED/APPROVED = cerrado,
        // REJECTED = descartado (legacy).
        switch (log.status) {
            case 'PENDING_PEDIDO':
            case 'OPEN':
                return <div className={`text-xs mt-1 ${isSelected ? 'text-white/90 font-bold' : 'text-accent-green'}`}>En curso</div>;
            case 'CLOSED':
            case 'APPROVED':
                return <div className={`text-xs mt-1 flex items-center gap-1 ${isSelected ? 'text-white/90 font-bold' : 'text-text-muted'}`}>Cerrado <CheckCircle2 size={11} className="shrink-0" /></div>;
            case 'REJECTED':
                return <div className={`text-xs mt-1 flex items-center gap-1 ${isSelected ? 'text-white/90 font-bold' : 'text-accent-red'}`}>Descartado <XCircle size={11} className="shrink-0" /></div>;
            default:
                return null;
        }
    };

    const renderCalendar = () => {
        const days = [];
        const today = todayStr();

        // Empty slots for days before the 1st
        for (let i = 0; i < startingDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const log = logsByDate.get(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === today;

            days.push(
                <button
                    key={day}
                    onClick={() => onSelectDate(dateStr)}
                    className={`p-2 sm:p-3 min-h-[72px] border border-white/5 rounded-lg flex flex-col items-center justify-center transition-all ${isSelected
                        ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30 scale-105 z-10'
                        : 'bg-bg-elevated/40 hover:bg-bg-elevated cursor-pointer'
                        } ${isToday && !isSelected ? 'ring-2 ring-accent-blue/50' : ''}`}
                >
                    <div className="flex items-center gap-2">
                        <span className={`text-lg sm:text-xl font-bold ${isToday && !isSelected ? 'text-accent-blue' : ''}`}>{day}</span>
                        {isToday && <span className={`text-[10px] uppercase text-white px-1 rounded ${isSelected ? 'bg-white/25' : 'bg-accent-blue'}`}>Hoy</span>}
                    </div>
                    {getStatusUI(log, isSelected)}
                    {/* Ferias/casetas programadas ese día */}
                    <div className="mt-1 flex flex-col gap-1 w-full overflow-hidden">
                        {events.filter(e => e.date === dateStr).slice(0, 2).map(e => (
                            <div key={e.id} className={`text-[9px] sm:text-[10px] flex items-center gap-1 px-1 rounded-sm w-full text-left ${e.type === 'EVENT' ? 'bg-accent-blue/30 text-accent-blue' : 'bg-accent-green/30 text-accent-green'}`} title={e.title}>
                                {e.type === 'EVENT' ? <CalendarDays size={9} className="shrink-0" /> : <Package size={9} className="shrink-0" />}
                                <span className="truncate">{e.title}</span>
                            </div>
                        ))}
                    </div>
                </button>
            );
        }

        return days;
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <div className="card mb-8 animate-fade-in">
            <div className="flex items-start gap-3 mb-6">
                <span className="icon-chip icon-chip-blue"><CalendarDays size={18} strokeWidth={2.2} /></span>
                <div>
                    <h2 className="text-2xl font-bold mb-1">Planificador de Pedidos</h2>
                    <p className="text-sm text-text-muted">Selecciona un día para hacer pedidos o registrar sus sobrantes.</p>
                </div>
            </div>

            <div className="flex justify-between items-center gap-2 mb-4 bg-bg-elevated/30 p-2 rounded-xl">
                <button className="btn btn-outline btn-sm sm:px-4 sm:py-2 sm:text-sm" onClick={prevMonth}><ChevronLeft size={16} /> Anterior</button>
                <h3 className="text-base sm:text-lg font-bold text-center">{monthNames[month]} {year}</h3>
                <button className="btn btn-outline btn-sm sm:px-4 sm:py-2 sm:text-sm" onClick={nextMonth}>Siguiente <ChevronRight size={16} /></button>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-text-muted font-bold text-xs sm:text-sm uppercase tracking-wider">
                <div>Lun</div>
                <div>Mar</div>
                <div>Mié</div>
                <div>Jue</div>
                <div>Vie</div>
                <div>Sáb</div>
                <div>Dom</div>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {renderCalendar()}
            </div>
        </div>
    );
};
