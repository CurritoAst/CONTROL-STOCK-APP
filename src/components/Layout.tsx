import React from 'react';
import { useAppContext } from '../context/AppContext';
import { LayoutDashboard, ClipboardList, CalendarDays, Beef, LogOut, Crown, WifiOff } from 'lucide-react';
import type { MainTab } from '../App';

type TabDef = {
    id: MainTab;
    label: string;
    icon: React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number | string }>;
    shortLabel: string;
    badge?: number;
};

export const Layout: React.FC<{ children: React.ReactNode; activeTab: MainTab; onTabChange: (tab: MainTab) => void }> = ({ children, activeTab, onTabChange }) => {
    const { setRole, activeLogs, dbUnreachable } = useAppContext();

    // Pedidos still in progress (sobrantes not registered yet) — the only thing
    // that needs the admin's attention in the single-admin flow.
    const openPedidos = activeLogs.filter(log => log.status !== 'APPROVED' && log.status !== 'REJECTED').length;

    const [showLogoutModal, setShowLogoutModal] = React.useState(false);

    const handleLogout = () => setShowLogoutModal(true);
    const confirmLogout = () => setRole(null);
    const cancelLogout = () => setShowLogoutModal(false);

    const tabs: TabDef[] = [
        { id: 'PANEL', label: 'Panel', icon: LayoutDashboard, shortLabel: 'Panel' },
        { id: 'PEDIDOS', label: 'Pedidos', icon: ClipboardList, shortLabel: 'Pedidos', badge: openPedidos },
        { id: 'CALENDAR', label: 'Calendario', icon: CalendarDays, shortLabel: 'Calendario' },
        { id: 'CATALOG', label: 'Productos', icon: Beef, shortLabel: 'Productos' },
    ];

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden text-text-primary">
            {/* ─── Desktop Sidebar ─── */}
            <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/5 bg-gradient-to-b from-bg-secondary/60 to-bg-primary/90 backdrop-blur-xl relative">
                {/* Logo */}
                <div className="p-5 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-blue to-accent-green p-[2px] shadow-lg shadow-accent-blue/20">
                            <div className="w-full h-full rounded-[10px] bg-bg-primary flex items-center justify-center">
                                <span className="text-sm font-black bg-gradient-to-br from-accent-blue to-accent-green bg-clip-text text-transparent">D</span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-extrabold tracking-tight leading-tight">DukeControl</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="status-dot status-dot-live" />
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
                                    <Crown size={10} strokeWidth={2.5} /> Admin
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-4 py-5">
                    <div className="section-label px-3 mb-2">Menú</div>
                    <div className="flex flex-col gap-1">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange(tab.id)}
                                    className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
                                >
                                    <span className="flex items-center gap-3 min-w-0">
                                        <Icon
                                            size={18}
                                            strokeWidth={isActive ? 2.4 : 2}
                                            className={`shrink-0 transition-colors ${isActive ? 'text-accent-blue' : 'text-text-muted'}`}
                                        />
                                        <span className="truncate text-base">{tab.label}</span>
                                    </span>
                                    {(tab.badge || 0) > 0 && (
                                        <span className="bg-accent-red/90 text-white text-[10px] font-black px-1.5 min-w-5 h-5 flex items-center justify-center rounded-md shadow-sm">
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Footer: logout */}
                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-text-secondary hover:text-white transition-all"
                    >
                        <LogOut size={14} strokeWidth={2.2} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* ─── Main Content ─── */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between px-4 py-3 bg-bg-secondary/70 backdrop-blur-xl border-b border-white/5 z-10 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-green p-[2px]">
                            <div className="w-full h-full rounded-[7px] bg-bg-primary flex items-center justify-center">
                                <span className="text-xs font-black bg-gradient-to-br from-accent-blue to-accent-green bg-clip-text text-transparent">D</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-extrabold tracking-tight leading-none">DukeControl</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="status-dot status-dot-live" />
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
                                    <Crown size={10} strokeWidth={2.5} /> Admin
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        aria-label="Cerrar sesión"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                    >
                        <LogOut size={12} strokeWidth={2.4} />
                        Salir
                    </button>
                </header>

                {/* Backend unreachable banner */}
                {dbUnreachable && (
                    <div role="alert" className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-accent-red/15 border-b border-accent-red/30 text-sm">
                        <span className="icon-chip icon-chip-red w-8 h-8 rounded-lg"><WifiOff size={15} strokeWidth={2.4} /></span>
                        <div className="min-w-0">
                            <div className="font-bold text-accent-red leading-tight">Sin conexión con la base de datos</div>
                            <div className="text-xs text-text-muted">Los datos que ves pueden estar incompletos. Reintentando automáticamente cada 30 s…</div>
                        </div>
                    </div>
                )}

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
                    <div className="max-w-6xl mx-auto w-full animate-fade-in">
                        {children}
                    </div>
                </main>

                {/* ─── Mobile Bottom Nav (4 items — fits any phone) ─── */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-bg-secondary/85 backdrop-blur-2xl border-t border-white/5 shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.6)]">
                    <div className="flex items-stretch justify-around px-1 pt-2 pb-safe pb-3">
                        {tabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange(tab.id)}
                                    className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1 relative py-1.5 min-h-[52px]"
                                >
                                    {isActive && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-accent-blue to-accent-green rounded-full" />
                                    )}
                                    <Icon
                                        size={21}
                                        strokeWidth={isActive ? 2.4 : 2}
                                        className={`transition-all ${isActive ? 'text-accent-blue scale-110' : 'text-text-muted opacity-70'}`}
                                    />
                                    <div className={`text-[10px] font-bold uppercase tracking-tight truncate max-w-full px-1 ${isActive ? 'text-accent-blue' : 'text-text-muted'}`}>
                                        {tab.shortLabel}
                                    </div>
                                    {(tab.badge || 0) > 0 && (
                                        <span className="absolute top-0 right-1/2 translate-x-[150%] bg-accent-red text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full leading-none ring-2 ring-bg-secondary">
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </div>

            {/* ─── Logout Modal ─── */}
            {showLogoutModal && (
                <div className="modal-overlay">
                    <div className="card w-full max-w-sm shadow-2xl border border-white/10">
                        <div className="text-center mb-6">
                            <div className="inline-flex w-12 h-12 rounded-full bg-accent-red/15 border border-accent-red/30 items-center justify-center text-accent-red mb-3">
                                <LogOut size={20} strokeWidth={2.2} />
                            </div>
                            <h3 className="text-xl font-bold mb-1.5">¿Cerrar Sesión?</h3>
                            <p className="text-sm text-text-muted">Tendrás que volver a introducir tus credenciales.</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={cancelLogout} className="btn btn-outline flex-1">Cancelar</button>
                            <button onClick={confirmLogout} className="btn btn-danger flex-1">Sí, salir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
