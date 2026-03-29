import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("⛔ ALERTA URGENTE: Un error no capturado casi cuelga la página:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-red-500/30">
            <svg className="w-16 h-16 mx-auto mb-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <h1 className="text-2xl font-bold text-slate-100 mb-4 tracking-tight">Vaya, algo ha fallado</h1>
            <p className="text-slate-400 mb-6 text-sm">
              Nuestros escudos de protección han interceptado un error inesperado (posible bucle o saturación).
              Hemos bloqueado la caída total de la aplicación.
            </p>
            <div className="bg-slate-900 p-3 rounded-lg text-left overflow-hidden mb-6 hidden">
               <code className="text-xs text-red-400 break-words font-mono">
                  {this.state.error?.message}
               </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98]"
            >
              Reiniciar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
