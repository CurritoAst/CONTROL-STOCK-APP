import React, { useState, useMemo } from 'react';
import { CalendarDays, CheckCircle2, Package, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
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

export const MasterCalendar: React.FC = () => {
    const { historicalLogs, events = [] } = useAppContext();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    // Adjust so Monday is 0, Sunday is 6
    let startingDay = getFirstDayOfMonth(year, month) - 1;
    if (startingDay === -1) startingDay = 6;

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // Map logs to dates
    const logsByDate = useMemo(() => {
        const map = new Map<string, DailyLog>();
        historicalLogs.forEach(log => {
            map.set(log.date, log);
        });
        return map;
    }, [historicalLogs]);

    const renderCalendar = () => {
        const days = [];

        // Empty slots for days before the 1st
        for (let i = 0; i < startingDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const log = logsByDate.get(dateStr);
            const isSelected = selectedDate === dateStr;

            days.push(
                <button
                    key={day}
                    onClick={() => log && setSelectedDate(dateStr)}
                    disabled={!log}
                    className={`p-2 sm:p-3 border border-white/5 rounded-lg flex flex-col items-center justify-center transition-all ${log ? (isSelected ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/30 scale-105 z-10' : 'bg-bg-elevated/40 hover:bg-bg-elevated cursor-pointer')
                        : 'opacity-30 cursor-not-allowed'
                        }`}
                >
                    <span className="text-lg sm:text-xl font-bold">{day}</span>
                    {log && (
                        <div className={`text-xs mt-1 flex items-center gap-1 ${isSelected ? 'text-white/90 font-bold' : 'text-accent-green'}`}>
                            Registrado <CheckCircle2 size={11} className="shrink-0" />
                        </div>
                    )}
                    {/* RenderAdminEvents in Master View */}
                    <div className="mt-1 flex flex-col gap-1 w-full overflow-hidden">
                        {events.filter(e => e.date === dateStr).slice(0, 2).map(e => (
                            <div key={e.id} className={`text-[9px] sm:text-[10px] flex items-center gap-1 px-1 py-0.5 rounded-sm w-full text-left ${e.type === 'EVENT' ? 'bg-accent-blue/30 text-accent-blue' : 'bg-accent-green/30 text-accent-green'}`} title={e.title}>
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

    const renderDailyDetail = () => {
        if (!selectedDate) {
            return (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"><CalendarDays size={20} /></div>
                        <p className="mb-0 text-text-muted">Selecciona un día en el calendario que tenga registro para ver su análisis detallado.</p>
                    </div>
                </div>
            );
        }

        const log = logsByDate.get(selectedDate);
        if (!log) return null;

        let totalGasto = 0;
        let totalSobranteGasto = 0;
        let costeEsperado = 0;

        const itemDetails = log.items.map(item => {
            const gastoReal = item.consumed * item.product.price;
            totalGasto += gastoReal;

            const multiplicadorVenta = 3; // Suponemos que se vende al triple del coste (margen estándar hostelería 30% foodcost)
            const gananciaPotencial = (item.prepared * item.product.price) * multiplicadorVenta;
            const gananciaReal = (item.consumed * item.product.price) * multiplicadorVenta;

            const sobrante = item.prepared - item.consumed;
            const costeSobrante = sobrante * item.product.price;
            if (sobrante > 0) totalSobranteGasto += costeSobrante;

            costeEsperado += (item.prepared * item.product.price);

            const porcentajeSobrante = item.prepared > 0 ? (sobrante / item.prepared) * 100 : 0;

            return {
                ...item,
                gastoReal,
                sobrante,
                porcentajeSobrante,
                gananciaPotencial,
                gananciaReal,
                costeSobrante
            };
        });

        // 30% food cost assumption for gross profit (Ganancia = Ventas - Coste Producto)

        return (
            <div className="card animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <span className="icon-chip icon-chip-blue"><BarChart3 size={18} /></span>
                        <div>
                            <h3 className="text-xl font-bold mb-0.5">Análisis de Servicio</h3>
                            <p className="text-text-muted text-xs mb-0 flex items-center gap-1.5"><CalendarDays size={12} className="shrink-0" /> {selectedDate}</p>
                        </div>
                    </div>
                    <span className="badge badge-blue">SERVICIO AUDITADO</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="stat-card">
                        <div className="section-label mb-2">Inversión Consumida</div>
                        <div className="text-3xl font-bold num text-accent-red">{totalGasto.toLocaleString('es-ES')} €</div>
                    </div>
                    <div className="stat-card">
                        <div className="section-label text-accent-blue mb-2">Retorno de Mercancía</div>
                        <div className="text-3xl font-bold num text-accent-blue">{totalSobranteGasto.toLocaleString('es-ES')} €</div>
                    </div>
                </div>

                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th className="text-right">PED</th>
                                <th className="text-right">SOB</th>
                                <th className="text-right">MERMA</th>
                                <th className="text-right">VALOR (€)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemDetails.map(d => (
                                <tr key={d.product.id}>
                                    <td className="font-semibold">{d.product.name}</td>
                                    <td className="text-right num text-text-muted">{d.prepared}</td>
                                    <td className="text-right num font-semibold text-accent-blue">{d.sobrante}</td>
                                    <td className="text-right">
                                        <span className={`badge ${d.porcentajeSobrante > 30 ? 'badge-red' : 'badge-gray'}`}>
                                            {d.porcentajeSobrante.toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="text-right num font-semibold text-accent-red">{d.gastoReal.toLocaleString('es-ES')} €</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-white/10 bg-white/5">
                                <td colSpan={4} className="text-right text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">RESUMEN DIARIO</td>
                                <td className="text-right num font-bold text-accent-red">{totalGasto.toLocaleString('es-ES')} €</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    return (
        <div className="animate-fade-in w-full space-y-6">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Calendario Histórico</h1>
                    <p className="page-subtitle">Control de costes por fecha</p>
                </div>
            </div>

            <div className="card">
                <div className="flex justify-between items-center gap-2 mb-4 bg-bg-elevated/30 p-2 rounded-xl">
                    <button className="btn btn-outline px-3 py-2" onClick={prevMonth} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
                    <h3 className="text-base sm:text-lg font-bold mb-0 text-center">{monthNames[month]} {year}</h3>
                    <button className="btn btn-outline px-3 py-2" onClick={nextMonth} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center section-label px-1">
                    <div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div>
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {renderCalendar()}
                </div>
            </div>

            {renderDailyDetail()}
        </div>
    );
};
