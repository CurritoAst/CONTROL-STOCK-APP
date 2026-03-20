import React, { useState, useMemo } from 'react';
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
                    className={`p-3 md:p-4 border border-white/5 rounded-md flex flex-col items-center justify-center transition-all ${log ? (isSelected ? 'bg-accent-blue text-white shadow-lg' : 'bg-bg-elevated/50 hover:bg-bg-elevated cursor-pointer')
                        : 'opacity-30 cursor-not-allowed'
                        }`}
                >
                    <span className="text-lg font-medium">{day}</span>
                    {log && (
                        <div className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-accent-green'}`}>
                            Registrado
                        </div>
                    )}
                    {/* RenderAdminEvents in Master View */}
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

    const renderDailyDetail = () => {
        if (!selectedDate) {
            return (
                <div className="card text-center text-text-muted py-12">
                    Selecciona un día en el calendario que tenga registro para ver su análisis detallado.
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
            <div className="card animate-fade-in mt-6 border-t-[6px] border-t-accent-blue shadow-2xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h3 className="text-2xl font-black mb-1">Análisis de Servicio</h3>
                        <p className="text-text-muted text-sm font-bold uppercase tracking-wider">📅 {selectedDate}</p>
                    </div>
                    <span className="badge badge-blue py-2 px-4 text-[10px]">SERVICIO AUDITADO</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                    <div className="bg-bg-primary/40 p-6 rounded-2xl border border-white/5 text-center shadow-inner">
                        <div className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-2">Inversión Consumida</div>
                        <div className="text-3xl font-black text-accent-red">{totalGasto.toLocaleString('es-ES')} €</div>
                    </div>
                    <div className="bg-accent-blue/5 p-6 rounded-2xl border border-accent-blue/10 text-center shadow-inner">
                        <div className="text-accent-blue text-[10px] font-black uppercase tracking-widest mb-2">Retorno de Mercancía</div>
                        <div className="text-3xl font-black text-accent-blue">{totalSobranteGasto.toLocaleString('es-ES')} €</div>
                    </div>
                </div>

                <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-text-muted text-[10px] font-black uppercase tracking-widest">
                                <th className="px-4 py-2">Producto</th>
                                <th className="px-4 py-2 text-center">PED</th>
                                <th className="px-4 py-2 text-center">SOB</th>
                                <th className="px-4 py-2 text-center">MERMA</th>
                                <th className="px-4 py-2 text-right">VALOR (€)</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {itemDetails.map(d => (
                                <tr key={d.product.id} className="bg-white/[0.02] hover:bg-white/[0.05] transition-colors rounded-xl group">
                                    <td className="px-4 py-3 font-bold rounded-l-xl border-l border-white/5">{d.product.name}</td>
                                    <td className="px-4 py-3 text-center text-text-muted font-bold">{d.prepared}</td>
                                    <td className="px-4 py-3 text-center font-black text-accent-blue">{d.sobrante}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black ${d.porcentajeSobrante > 30 ? 'bg-accent-red/20 text-accent-red' : 'bg-white/10 text-text-muted'}`}>
                                            {d.porcentajeSobrante.toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-accent-red rounded-r-xl border-r border-white/5">{d.gastoReal.toLocaleString('es-ES')} €</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-black bg-bg-elevated/20 text-sm">
                                <td colSpan={4} className="px-4 py-4 text-right rounded-l-xl">RESUMEN DIARIO</td>
                                <td className="px-4 py-4 text-right text-accent-red rounded-r-xl">{totalGasto.toLocaleString('es-ES')} €</td>
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
            <div className="card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-3xl font-black mb-1">Calendario Histórico</h2>
                        <p className="text-text-muted text-sm font-bold uppercase tracking-wider">Control de costes por fecha</p>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-8 bg-bg-primary/40 p-3 rounded-2xl border border-white/5 shadow-inner">
                    <button className="btn btn-outline py-2 px-4 shadow-none" onClick={prevMonth}>&larr;</button>
                    <h3 className="text-xl font-black text-accent-blue uppercase tracking-tight">{monthNames[month]} {year}</h3>
                    <button className="btn btn-outline py-2 px-4 shadow-none" onClick={nextMonth}>&rarr;</button>
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-3 mb-4 text-center text-text-muted font-black text-[10px] uppercase tracking-widest px-1">
                    <div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div>
                </div>

                <div className="grid grid-cols-7 gap-1 md:gap-3">
                    {renderCalendar()}
                </div>
            </div>

            {renderDailyDetail()}
        </div>
    );
};
