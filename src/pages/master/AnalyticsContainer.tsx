import React, { useState } from 'react';
import { ProductAnalytics } from './ProductAnalytics';
import { EventAnalytics } from './EventAnalytics';

export const AnalyticsContainer: React.FC = () => {
    const [view, setView] = useState<'PRODUCTS' | 'EVENTS'>('PRODUCTS');

    return (
        <div className="w-full animate-fade-in content-auto-height space-y-6">
            <div className="flex bg-bg-elevated/50 p-1 rounded-lg w-full max-w-sm mx-auto mb-6">
                <button
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${view === 'PRODUCTS' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                    onClick={() => setView('PRODUCTS')}
                >
                    Por Producto
                </button>
                <button
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${view === 'EVENTS' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                    onClick={() => setView('EVENTS')}
                >
                    Por Evento / Feria
                </button>
            </div>

            {view === 'PRODUCTS' ? <ProductAnalytics /> : <EventAnalytics />}
        </div>
    );
};
