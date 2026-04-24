import React, { useState } from 'react';
import { DailyAudit } from './DailyAudit';
import { ProductCatalog } from './ProductCatalog';
import { AnalyticsContainer } from './AnalyticsContainer';
import { MasterCalendar } from './MasterCalendar';
import { PointOfSale } from './PointOfSale';
import { FinancialFeriaReport } from './FinancialFeriaReport';
import { EmployeeDashboard } from '../employee/EmployeeDashboard';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabaseClient';

export const MasterDashboard: React.FC<{
    activeTab: 'PANEL' | 'AUDIT' | 'CATALOG' | 'ANALYTICS' | 'CALENDAR' | 'POS' | 'CREATE';
    onTabChange: (tab: 'PANEL' | 'AUDIT' | 'CATALOG' | 'ANALYTICS' | 'CALENDAR' | 'POS' | 'CREATE') => void;
}> = ({ activeTab, onTabChange }) => {
    const { historicalLogs, activeLogs, deleteDailyLog, isPushEnabled, requestPushPermission } = useAppContext();
    const [isBackingUp, setIsBackingUp] = useState(false);

    const downloadBackup = async () => {
        setIsBackingUp(true);
        try {
            const [
                { data: products },
                { data: events },
                { data: logs },
                { data: items }
            ] = await Promise.all([
                supabase.from('products').select('*'),
                supabase.from('events').select('*'),
                supabase.from('daily_logs').select('*'),
                supabase.from('log_items').select('*')
            ]);

            const backup = {
                fecha: new Date().toISOString(),
                products: products || [],
                events: events || [],
                daily_logs: logs || [],
                log_items: items || []
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

    const pendingAudits = activeLogs.filter(log => log.status === 'CLOSED' || log.status === 'PENDING_PEDIDO').length;

    return (
        <div className="animate-fade-in w-full">
            {/* Desktop Tabs (hide on mobile since they are in BottomNav) */}
            <div className="hidden md:flex gap-4 mb-8 overflow-x-auto pb-2">
                <button
                    className={`btn ${activeTab === 'PANEL' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTabChange('PANEL')}
                >
                    📊 Panel Financiero
                </button>
                <button
                    className={`btn ${activeTab === 'ANALYTICS' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTabChange('ANALYTICS')}
                >
                    📈 Control de Pérdidas
                </button>
                <button
                    className={`btn ${activeTab === 'CALENDAR' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTabChange('CALENDAR')}
                >
                    📅 Calendario Histórico
                </button>
                <button
                    className={`btn ${activeTab === 'AUDIT' ? 'btn-primary' : 'btn-outline'} relative`}
                    onClick={() => onTabChange('AUDIT')}
                >
                    📋 Pedidos Diarios
                    {pendingAudits > 0 && (
                        <span className="absolute -top-2 -right-2 bg-accent-red text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md">
                            {pendingAudits}
                        </span>
                    )}
                </button>
                <button
                    className={`btn ${activeTab === 'CATALOG' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTabChange('CATALOG')}
                >
                    🥩 Catálogo de Productos
                </button>
                <button
                    className={`btn ${activeTab === 'POS' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTabChange('POS')}
                >
                    🏪 Punto de Venta
                </button>
                <button
                    className={`btn ${activeTab === 'CREATE' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => onTabChange('CREATE')}
                >
                    🗂 Gestión Diaria
                </button>
            </div>

            {activeTab === 'PANEL' && (
                <div className="animate-fade-in">
                    {/* ─── Page Header ─── */}
                    <div className="page-header">
                        <div>
                            <div className="section-label mb-2">Vista general</div>
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
                            {pendingAudits > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-red/10 border border-accent-red/30">
                                    <span className="status-dot status-dot-alert" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-red">{pendingAudits} pendiente{pendingAudits !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {!isPushEnabled && (
                        <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">🔔</div>
                                <div>
                                    <h4 className="font-bold text-accent-blue leading-tight mb-1">Activar Notificaciones</h4>
                                    <p className="text-sm text-text-muted">Recibe avisos inmediatos cuando la cocina envíe nuevos pedidos para su revisión.</p>
                                </div>
                            </div>
                            <button
                                className="btn bg-accent-blue text-black hover:bg-accent-blue/90 whitespace-nowrap w-full sm:w-auto shrink-0"
                                onClick={() => requestPushPermission()}
                            >
                                Permitir Avisos
                            </button>
                        </div>
                    )}
                    {isPushEnabled && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">✅</div>
                                <div>
                                    <h4 className="font-bold text-green-400 leading-tight mb-1">Notificaciones Activas</h4>
                                    <p className="text-sm text-text-muted">Recibirás avisos en tu pantalla de bloqueo cuando haya nuevos pedidos.</p>
                                </div>
                            </div>
                            <button
                                className="btn btn-outline whitespace-nowrap w-full sm:w-auto shrink-0"
                                onClick={async () => {
                                    const result = await supabase.functions.invoke('send-web-push', {
                                        body: { title: '🔔 Prueba de Notificación', message: '¡Las notificaciones están funcionando correctamente!', target_role: 'MASTER' },
                                        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
                                    });
                                    console.log('Push result:', result);
                                }}
                            >
                                Enviar Prueba 🧪
                            </button>
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
                                <div className="w-10 h-10 rounded-xl bg-accent-red/15 border border-accent-red/20 flex items-center justify-center text-base">
                                    💸
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
                                <div className="w-10 h-10 rounded-xl bg-accent-blue/15 border border-accent-blue/20 flex items-center justify-center text-base">
                                    📊
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
                                    <div className="text-[10px] text-text-muted">En curso o por auditar</div>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-accent-green/15 border border-accent-green/20 flex items-center justify-center text-base">
                                    📦
                                </div>
                            </div>
                            <div className="text-3xl font-black text-accent-green tracking-tight">
                                {activeLogs.filter(l => ['PENDING_PEDIDO', 'OPEN', 'CLOSED'].includes(l.status)).length}
                                <span className="text-base text-accent-green/70 ml-2 font-bold">activos</span>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="text-xl mb-6 flex items-center gap-2">
                            <span>📦 Gestión de Pedidos y Gastos Activos</span>
                        </h3>
                        {activeLogs.filter(l => ['PENDING_PEDIDO', 'OPEN', 'CLOSED'].includes(l.status)).length === 0 ? (
                            <div className="text-center py-10 bg-white/5 rounded-xl border border-dashed border-white/10">
                                <p className="text-text-muted uppercase tracking-widest text-xs font-bold">No hay pedidos o gastos activos en este momento</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {activeLogs
                                    .filter(l => ['PENDING_PEDIDO', 'OPEN', 'CLOSED'].includes(l.status))
                                    .map(log => {
                                        const isClosed = log.status === 'CLOSED';
                                        const isPending = log.status === 'PENDING_PEDIDO';

                                        // Calculate cost based on status:
                                        // If CLOSED, we know consumed. If OPEN/PENDING, we only know prepared (estimated cost).
                                        const dayCost = log.items.reduce((sum, i) => {
                                            const qty = isClosed ? i.consumed : i.prepared;
                                            return sum + (qty * i.product.price);
                                        }, 0);

                                        return (
                                            <div key={log.id} className="group p-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-xl transition-all flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-bold flex items-center gap-2">
                                                        <span className="text-accent-blue">📅</span>
                                                        {log.date}
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                                                            isPending ? 'bg-accent-blue/20 text-accent-blue' :
                                                            isClosed ? 'bg-accent-green/20 text-accent-green' :
                                                            'bg-accent-purple/20 text-accent-purple'
                                                        }`}>
                                                            {isPending ? 'Pendiente' : isClosed ? 'Por Auditar' : 'En Curso'}
                                                        </span>
                                                    </div>
                                                    {log.eventTitle && (
                                                        <div className="text-xs font-bold text-text-muted uppercase tracking-tight line-clamp-1">
                                                            🏠 {log.eventTitle.replace(' - Caseta:', '')}
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
                                                        className="btn btn-outline border-accent-red/30 text-accent-red hover:bg-accent-red/10 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm("¿Borrar este pedido?")) {
                                                                deleteDailyLog(log.id);
                                                            }
                                                        }}
                                                        title="Borrar pedido"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>

                    <FinancialFeriaReport />

                    <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="text-3xl">💾</div>
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
                            {isBackingUp ? '⏳ Descargando...' : '💾 Descargar Backup'}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'ANALYTICS' && <AnalyticsContainer />}
            {activeTab === 'CALENDAR' && <MasterCalendar />}
            {activeTab === 'AUDIT' && <DailyAudit />}
            {activeTab === 'CATALOG' && <ProductCatalog />}
            {activeTab === 'POS' && <PointOfSale />}
            {activeTab === 'CREATE' && (
                <div className="animate-fade-in">
                    <div className="page-header">
                        <div>
                            <div className="section-label mb-2">Operación diaria</div>
                            <h1 className="page-title">Gestión Diaria</h1>
                            <p className="page-subtitle">Crear pedidos nuevos, registrar sobrantes de pedidos en curso y gestionar casetas. La factura se imprime automáticamente al enviar.</p>
                        </div>
                    </div>
                    <EmployeeDashboard />
                </div>
            )}
        </div>
    );
};
