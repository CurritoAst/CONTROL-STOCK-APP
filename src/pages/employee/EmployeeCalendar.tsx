import React, { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { DailyLog } from '../../types';

// Helper to get days in month
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

// Helper to get starting day of week (0 = Sunday, 1 = Monday)
function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export const EmployeeCalendar: React.FC<{
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

        switch (log.status) {
            case 'PENDING_PEDIDO':
                return <div className={`text-xs mt-1 ${isSelected ? 'text-white/90 font-bold' : 'text-accent-blue'}`}>Esperando Aprobación</div>;
            case 'REJECTED':
                return <div className={`text-xs mt-1 ${isSelected ? 'text-white/90 font-bold' : 'text-accent-red'}`}>Rechazado ❌</div>;
            case 'OPEN':
                return <div className={`text-xs mt-1 ${isSelected ? 'text-white/90 font-bold' : 'text-yellow-400'}`}>Servicio Abierto</div>;
            case 'CLOSED':
                return <div className={`text-xs mt-1 ${isSelected ? 'text-white/90 font-bold' : 'text-accent-green'}`}>Cerrado (Pendiente)</div>;
            case 'APPROVED':
                return <div className={`text-xs mt-1 ${isSelected ? 'text-white/90 font-bold' : 'text-text-muted'}`}>Realizado ✅</div>;
            default:
                return null;
        }
    };

    const renderCalendar = () => {
        const days = [];
        const todayStr = new Date().toISOString().split('T')[0];

        // Empty slots for days before the 1st
        for (let i = 0; i < startingDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const log = logsByDate.get(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === todayStr;

            days.push(
                <button
                    key={day}
                    onClick={() => onSelectDate(dateStr)}
                    className={`p-2 sm:p-3 border border-white/5 rounded-md flex flex-col items-center justify-center transition-all ${isSelected
                        ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30 scale-105 z-10'
                        : 'bg-bg-elevated/40 hover:bg-bg-elevated cursor-pointer'
                        } ${isToday && !isSelected ? 'ring-2 ring-accent-blue/50' : ''}`}
                >
                    <div className="flex items-center gap-2">
                        <span className={`text-lg sm:text-xl font-bold ${isToday && !isSelected ? 'text-accent-blue' : ''}`}>{day}</span>
                        {isToday && <span className="text-[10px] uppercase bg-accent-blue text-white px-1 rounded">Hoy</span>}
                    </div>
                    {getStatusUI(log, isSelected)}
                    {/* RenderAdminEvents in Employee View */}
                    <div className="mt-1 flex flex-col gap-1 w-full overflow-hidden">
                        {events.filter(e => e.date === dateStr).slice(0, 2).map(e => (
                            <div key={e.id} className={`text-[9px] sm:text-[10px] truncate px-1 rounded-sm w-full text-left ${e.type === 'EVENT' ? 'bg-accent-blue/30 text-accent-blue' : 'bg-accent-green/30 text-accent-green'}`} title={e.title}>
                                {e.type === 'EVENT' ? '📅 ' : '📦 '}{e.title}
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
        <div className="card mb-8 animate-fade-in border-t-4 border-t-accent-blue">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div>
                    <h2 className="text-2xl mb-1">📅 Planificador de Pedidos</h2>
                    <p className="text-text-muted">Selecciona cualquier día para crear pedidos futuros o gestionar sobrantes.</p>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4 bg-bg-elevated/30 p-2 rounded-md">
                <button className="btn btn-outline px-3 py-1 sm:px-4 sm:py-2 text-sm sm:text-base" onClick={prevMonth}>&larr; Anterior</button>
                <h3 className="text-lg sm:text-xl font-bold">{monthNames[month]} {year}</h3>
                <button className="btn btn-outline px-3 py-1 sm:px-4 sm:py-2 text-sm sm:text-base" onClick={nextMonth}>Siguiente &rarr;</button>
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
