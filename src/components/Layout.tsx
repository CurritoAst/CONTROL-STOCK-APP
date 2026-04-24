import React from 'react';
import { useAppContext } from '../context/AppContext';

type TabDef = {
    id: string;
    label: string;
    icon: string;
    shortLabel: string;
    badge?: number;
};

type SectionDef = {
    section: string;
    items: TabDef[];
};

export const Layout: React.FC<{ children: React.ReactNode; activeTab?: string; onTabChange?: (tab: any) => void }> = ({ children, activeTab, onTabChange }) => {
    const { role, setRole, activeLogs } = useAppContext();

    const pendingAudits = activeLogs.filter(log => log.status === 'CLOSED' || log.status === 'PENDING_PEDIDO').length;

    const [showLogoutModal, setShowLogoutModal] = React.useState(false);

    const handleLogout = () => setShowLogoutModal(true);
    const confirmLogout = () => setRole(null);
    const cancelLogout = () => setShowLogoutModal(false);

    const masterSections: SectionDef[] = [
        {
            section: 'Principal',
            items: [
                { id: 'PANEL', label: 'Panel Financiero', icon: '📊', shortLabel: 'Panel' },
                { id: 'POS', label: 'Punto de Venta', icon: '🏪', shortLabel: 'POS' },
            ]
        },
        {
            section: 'Operaciones',
            items: [
                { id: 'CREATE', label: 'Gestión Diaria', icon: '🗂', shortLabel: 'Gestión' },
                { id: 'AUDIT', label: 'Pedidos Diarios', icon: '📋', shortLabel: 'Pedidos', badge: pendingAudits },
                { id: 'CATALOG', label: 'Catálogo de Productos', icon: '🥩', shortLabel: 'Catálogo' },
                { id: 'CALENDAR', label: 'Calendario', icon: '📅', shortLabel: 'Calend.' },
            ]
        },
        {
            section: 'Análisis',
            items: [
                { id: 'ANALYTICS', label: 'Control de Pérdidas', icon: '📈', shortLabel: 'Pérdidas' },
            ]
        }
    ];

    const employeeSections: SectionDef[] = [
        {
            section: 'Operaciones',
            items: [
                { id: 'PEDIDO', label: 'Pedido del Día', icon: '📝', shortLabel: 'Pedido' },
                { id: 'REPORTES', label: 'Reportes de Uso', icon: '📊', shortLabel: 'Reportes' },
            ]
        }
    ];

    const sections = role === 'MASTER' ? masterSections : role === 'EMPLOYEE' ? employeeSections : [];
    const flatTabs: TabDef[] = sections.flatMap(s => s.items);

    const roleLabel = role === 'MASTER' ? 'Master' : role === 'EMPLOYEE' ? 'Cocina' : 'Viewer';
    const roleIcon = role === 'MASTER' ? '👑' : role === 'EMPLOYEE' ? '🧑‍🍳' : '👁️';

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
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">{roleIcon} {roleLabel}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav with sections */}
                <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
                    {sections.map(section => (
                        <div key={section.section}>
                            <div className="section-label px-3 mb-2">{section.section}</div>
                            <div className="flex flex-col gap-1">
                                {section.items.map(tab => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => onTabChange && onTabChange(tab.id)}
                                            className={`nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
                                        >
                                            <span className="flex items-center gap-3">
                                                <span className={`text-base transition-transform ${isActive ? '' : 'grayscale opacity-60'}`}>{tab.icon}</span>
                                                <span>{tab.label}</span>
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
                        </div>
                    ))}
                </nav>

                {/* Footer: logout */}
                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wide text-text-secondary hover:text-white transition-all"
                    >
                        <span className="text-sm">↩</span>
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
                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">{roleIcon} {roleLabel}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                    >
                        Salir
                    </button>
                </header>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
                    <div className="max-w-6xl mx-auto w-full animate-fade-in">
                        {children}
                    </div>
                </main>

                {/* ─── Mobile Bottom Nav ─── */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-bg-secondary/85 backdrop-blur-2xl border-t border-white/5 shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.6)]">
                    <div className="flex justify-around items-stretch px-1 pt-2 pb-safe pb-3">
                        {flatTabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange && onTabChange(tab.id)}
                                    className="flex-1 flex flex-col items-center justify-center gap-1 relative py-1.5 min-w-0"
                                >
                                    {/* Active indicator */}
                                    {isActive && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-accent-blue to-accent-green rounded-full" />
                                    )}
                                    <div className={`text-lg transition-all ${isActive ? 'scale-110' : 'grayscale opacity-50'}`}>
                                        {tab.icon}
                                    </div>
                                    <div className={`text-[9px] font-bold uppercase tracking-tight truncate max-w-full px-1 ${isActive ? 'text-accent-blue' : 'text-text-muted'}`}>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
                    <div className="card w-full max-w-sm shadow-2xl border border-white/10">
                        <div className="text-center mb-6">
                            <div className="inline-flex w-12 h-12 rounded-full bg-accent-red/15 border border-accent-red/30 items-center justify-center text-2xl mb-3">↩</div>
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
