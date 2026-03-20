import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

export const RoleSelect: React.FC = () => {
    const { setRole } = useAppContext();
    const { addToast } = useToast();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        const user = username.trim().toLowerCase();
        const pass = password.trim();

        if (user === 'admin' && pass === 'master') {
            setRole('MASTER');
            addToast('Bienvenido, Master', 'success');
        } else if (user === 'cocina' && pass === '1234') {
            setRole('EMPLOYEE');
            addToast('Bienvenido al servicio de cocina', 'success');
        } else {
            addToast('Credenciales incorrectas', 'error');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div className="card w-full max-w-sm">
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold mb-2">Acceso al Sistema</h2>
                    <p className="text-text-muted">Inicia sesión para continuar</p>
                </div>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div className="input-group mb-0">
                        <label>Usuario</label>
                        <input
                            type="text"
                            placeholder="Ej. cocina o admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="bg-bg-elevated/40"
                        />
                    </div>

                    <div className="input-group mb-0">
                        <label>Contraseña / PIN</label>
                        <input
                            type="password"
                            placeholder="••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-bg-elevated/40"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary w-full mt-4 py-4 text-lg">
                        Entrar
                    </button>
                </form>

            </div>
        </div>
    );
};
