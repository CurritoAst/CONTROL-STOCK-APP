import React, { useState } from 'react';
import { BarChart3, CalendarDays, TrendingDown } from 'lucide-react';
import { ProductAnalytics } from './ProductAnalytics';
import { EventAnalytics } from './EventAnalytics';

export const AnalyticsContainer: React.FC = () => {
    const [view, setView] = useState<'PRODUCTS' | 'EVENTS'>('PRODUCTS');

    return (
        <div className="w-full animate-fade-in content-auto-height">
            <div className="page-header">
                <div className="flex items-start gap-3">
                    <span className="icon-chip icon-chip-blue mt-1">
                        <TrendingDown size={18} strokeWidth={2.2} />
                    </span>
                    <div>
                        <div className="section-label mb-1">Análisis</div>
                        <h1 className="page-title">Control de Pérdidas</h1>
                    </div>
                </div>
                <div className="flex bg-bg-elevated/50 border border-white/5 p-1 rounded-xl w-full md:w-auto shrink-0">
                    <button
                        className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${view === 'PRODUCTS' ? 'bg-accent-blue text-white shadow-md' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                        onClick={() => setView('PRODUCTS')}
                    >
                        <BarChart3 size={16} strokeWidth={2.2} />
                        Por Producto
                    </button>
                    <button
                        className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${view === 'EVENTS' ? 'bg-accent-blue text-white shadow-md' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                        onClick={() => setView('EVENTS')}
                    >
                        <CalendarDays size={16} strokeWidth={2.2} />
                        Por Evento / Feria
                    </button>
                </div>
            </div>

            {view === 'PRODUCTS' ? <ProductAnalytics /> : <EventAnalytics />}
        </div>
    );
};
