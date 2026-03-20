import React, { createContext, useContext, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = (message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 3000);
    };

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`px-4 py-3 rounded-md shadow-lg text-white font-medium animate-fade-in pointer-events-auto flex items-center gap-2 ${toast.type === 'success'
                                ? 'bg-accent-green'
                                : toast.type === 'error'
                                    ? 'bg-accent-red'
                                    : 'bg-accent-blue'
                            }`}
                        style={{ maxWidth: '300px' }}
                    >
                        {toast.type === 'success' && '✅ '}
                        {toast.type === 'error' && '❌ '}
                        {toast.type === 'info' && 'ℹ️ '}
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
