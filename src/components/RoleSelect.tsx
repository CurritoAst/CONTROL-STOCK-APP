import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

export const RoleSelect: React.FC = () => {
    const { setRole } = useAppContext();
    const { addToast } = useToast();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        const user = username.trim().toLowerCase();
        const pass = password.trim();
        setIsLoading(true);

        setTimeout(() => {
            if (user === 'admin' && pass === 'master') {
                setRole('MASTER');
                addToast('Bienvenido, Master', 'success');
            } else if (user === 'cocina' && pass === '1234') {
                setRole('EMPLOYEE');
                addToast('Bienvenido al servicio de cocina', 'success');
            } else if (user === 'saul' && pass === 'GrupoDuke2026') {
                setRole('VIEWER');
                addToast('Bienvenido, Saúl', 'success');
            } else {
                addToast('Credenciales incorrectas', 'error');
                setIsLoading(false);
            }
        }, 300);
    };

    const dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeLabel = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="min-h-screen w-full grid lg:grid-cols-2 overflow-hidden">
            {/* ─── LEFT: Branded hero ─── */}
            <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
                {/* Ambient gradient layers */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent-blue/20 via-transparent to-accent-green/10" />
                <div className="absolute -top-32 -left-32 w-96 h-96 bg-accent-blue/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] bg-accent-green/10 rounded-full blur-3xl" />

                {/* Grid pattern overlay */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
                        backgroundSize: '48px 48px',
                        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 75%)'
                    }}
                />

                {/* Logo mark (top) */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-green p-[2px] shadow-xl">
                        <div className="w-full h-full rounded-2xl bg-bg-primary flex items-center justify-center">
                            <span className="text-xl font-black bg-gradient-to-br from-accent-blue to-accent-green bg-clip-text text-transparent">D</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-base font-extrabold tracking-tight">DukeControl</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-muted">Sistema Profesional</div>
                    </div>
                </div>

                {/* Main hero content (center) */}
                <div className="relative z-10 max-w-lg">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-6">
                        <span className="status-dot status-dot-live"></span>
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">Sistema operativo</span>
                    </div>
                    <h1 className="text-5xl font-black leading-[1.05] mb-6 tracking-tight">
                        Control total de tu
                        <span className="block bg-gradient-to-r from-accent-blue via-indigo-400 to-accent-green bg-clip-text text-transparent">
                            inventario y ventas
                        </span>
                    </h1>
                    <p className="text-base text-text-muted leading-relaxed max-w-md">
                        Gestión profesional de stock, pedidos diarios, analíticas de pérdidas y punto de venta — todo en tiempo real desde cualquier dispositivo.
                    </p>

                    {/* Feature pills */}
                    <div className="mt-8 flex flex-wrap gap-2">
                        {['Inventario', 'Pedidos', 'Analíticas', 'POS', 'Pérdidas'].map(f => (
                            <span key={f} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-text-secondary backdrop-blur-sm">
                                {f}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Footer info (bottom) */}
                <div className="relative z-10 flex items-end justify-between text-xs">
                    <div>
                        <div className="text-text-muted capitalize">{dateLabel}</div>
                        <div className="font-mono font-bold text-text-primary tracking-wider text-sm mt-0.5">{timeLabel}</div>
                    </div>
                    <div className="text-right text-text-muted">
                        <div className="text-[10px] uppercase tracking-[0.2em] font-bold">v2.0</div>
                        <div className="text-[10px] mt-0.5">Grupo Duke © 2026</div>
                    </div>
                </div>
            </div>

            {/* ─── RIGHT: Login form ─── */}
            <div className="flex items-center justify-center p-6 md:p-10 relative">
                {/* Mobile logo */}
                <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-green p-[2px]">
                        <div className="w-full h-full rounded-[10px] bg-bg-primary flex items-center justify-center">
                            <span className="text-base font-black bg-gradient-to-br from-accent-blue to-accent-green bg-clip-text text-transparent">D</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-extrabold tracking-tight">DukeControl</div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Sistema Profesional</div>
                    </div>
                </div>

                <div className="w-full max-w-sm">
                    <div className="mb-8 mt-12 lg:mt-0">
                        <div className="section-label mb-3">Acceso seguro</div>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Inicia sesión</h2>
                        <p className="text-sm text-text-muted">Introduce tus credenciales para continuar.</p>
                    </div>

                    <form onSubmit={handleLogin} className="flex flex-col gap-4">
                        <div className="input-group mb-0">
                            <label>Usuario</label>
                            <input
                                type="text"
                                placeholder="admin, cocina..."
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                                autoFocus
                            />
                        </div>

                        <div className="input-group mb-0">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="btn btn-primary w-full mt-3 py-4 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                <>
                                    Entrar al sistema
                                    <span className="text-lg -mr-1">→</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                            <span className="flex items-center gap-1.5">
                                <span className="status-dot status-dot-live" />
                                Conectado
                            </span>
                            <span className="font-mono">{timeLabel}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
