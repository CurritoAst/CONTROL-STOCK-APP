import React from 'react';
import { useAppContext } from '../context/AppContext';

export const Layout: React.FC<{ children: React.ReactNode; activeTab?: string; onTabChange?: (tab: any) => void }> = ({ children, activeTab, onTabChange }) => {
    const { role, setRole, activeLogs } = useAppContext();

    const pendingAudits = activeLogs.filter(log => log.status === 'CLOSED' || log.status === 'PENDING_PEDIDO').length;

    const [showLogoutModal, setShowLogoutModal] = React.useState(false);

    const handleLogout = () => {
        setShowLogoutModal(true);
    };

    const confirmLogout = () => {
        setRole(null);
    };

    const cancelLogout = () => {
        setShowLogoutModal(false);
    };

    // Master Tabs
    const masterTabs = [
        { id: 'PANEL', label: '📊 Panel Financiero' },
        { id: 'POS', label: '🏪 Punto de Venta' },
        { id: 'CALENDAR', label: '📅 Calendario Histórico' },
        { id: 'ANALYTICS', label: '📈 Control de Pérdidas' },
        { id: 'AUDIT', label: '📋 Pedidos Diarios', badge: pendingAudits },
        { id: 'CATALOG', label: '🥩 Catálogo de Productos' },
    ];

    // Employee Tabs
    const employeeTabs = [
        { id: 'PEDIDO', label: '📝 Pedido del Día' },
        { id: 'REPORTES', label: '📊 Reportes de Uso' },
    ];

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden text-text-primary">
            {/* Sidebar for Desktop */}
            <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-bg-secondary shrink-0">
                <div className="p-6 border-b border-white/10">
                    <div className="text-xl font-extrabold bg-gradient-to-r from-accent-blue to-accent-green bg-clip-text text-transparent">
                        DukeControlApp
                    </div>
                    <p className="text-xs text-text-muted mt-1 uppercase tracking-wider">{role === 'MASTER' ? '👑 Master' : '🧑‍🍳 Cocina'}</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {role === 'MASTER' && masterTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange && onTabChange(tab.id)}
                            className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-md transition-colors ${activeTab === tab.id ? 'bg-accent-blue/20 text-accent-blue' : 'hover:bg-bg-elevated text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            <span className="font-medium">{tab.label}</span>
                            {(tab.badge || 0) > 0 && (
                                <span className="bg-accent-red text-white text-xs px-2 py-0.5 rounded-full">{tab.badge}</span>
                            )}
                        </button>
                    ))}
                    {role === 'EMPLOYEE' && employeeTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange && onTabChange(tab.id)}
                            className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-md transition-colors ${activeTab === tab.id ? 'bg-accent-blue/20 text-accent-blue' : 'hover:bg-bg-elevated text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            <span className="font-medium">{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full btn btn-outline text-sm py-2"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative overflow-hidden bg-bg-primary">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between p-4 bg-bg-secondary/80 backdrop-blur-lg border-b border-white/10 z-10 shrink-0">
                    <div className="font-extrabold text-lg tracking-tight">
                        <span className="bg-gradient-to-r from-accent-blue to-accent-green bg-clip-text text-transparent">Duke</span>
                        <span className="text-white ml-0.5">ControlApp</span>
                    </div>
                    <button onClick={handleLogout} className="text-xs font-bold px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-text-muted hover:text-white transition-colors">
                        SALIR
                    </button>
                </header>

                {/* Scalable Container for Children */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
                    <div className="max-w-5xl mx-auto w-full animate-fade-in">
                        {children}
                    </div>
                </main>

                {/* Premium Bottom Navigation for Mobile */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-secondary/90 backdrop-blur-xl border-t border-white/10 flex justify-around p-3 pb-8 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] px-2">
                    {role === 'MASTER' && masterTabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        const icon = tab.label.split(' ')[0];
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange && onTabChange(tab.id)}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-all duration-300 ${isActive ? 'text-accent-blue scale-110' : 'text-text-muted'}`}
                            >
                                <div className={`text-xl ${isActive ? 'drop-shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'grayscale'}`}>{icon}</div>
                                <div className={`text-[9px] font-bold uppercase tracking-tight ${isActive ? 'text-accent-blue' : 'text-text-muted opacity-60'}`}>
                                    {tab.label.split(' ')[1].substring(0, 6)}
                                </div>
                                {(tab.badge || 0) > 0 && (
                                    <span className="absolute top-1 right-2 bg-accent-red text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full leading-none font-bold ring-2 ring-bg-secondary animate-pulse">
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    {role === 'EMPLOYEE' && employeeTabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        const icon = tab.label.split(' ')[0];
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange && onTabChange(tab.id)}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 relative transition-all duration-300 ${isActive ? 'text-accent-blue scale-110' : 'text-text-muted'}`}
                            >
                                <div className={`text-xl ${isActive ? 'drop-shadow-[0_0_8px_rgba(79,70,229,0.5)]' : 'grayscale'}`}>{icon}</div>
                                <div className={`text-[9px] font-bold uppercase tracking-tight ${isActive ? 'text-accent-blue' : 'text-text-muted opacity-60'}`}>
                                    {tab.label.split(' ')[1]}
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Logout Confirmation Modal */}
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="card w-full max-w-sm shadow-2xl border border-white/20">
                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold mb-2">¿Cerrar Sesión?</h3>
                            <p className="text-text-muted">¿Estás seguro de que quieres salir del sistema?</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={cancelLogout}
                                className="btn btn-outline flex-1"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="btn btn-danger flex-1"
                            >
                                Sí, salir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
