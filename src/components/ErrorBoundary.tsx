import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react';

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
    return { hasError: true, error };
  }

  public componentDidMount() {
    // Escuchar mensajes del Service Worker (cuando un chunk JS falla de cargar)
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data?.type === 'RELOAD_PAGE') {
        window.location.reload();
      }
    });
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('⛔ Error capturado por ErrorBoundary:', error, errorInfo);

    // Si el error es un fallo al cargar un módulo (chunk de Vite obsoleto),
    // recargamos automáticamente para obtener los assets nuevos.
    const isChunkError = (
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed') ||
      error.message?.includes('dynamically imported module') ||
      error.message?.includes('Unable to preload CSS') ||
      error.message?.includes('error loading dynamically imported module')
    );

    if (isChunkError) {
      console.warn('🔄 Detectado chunk obsoleto. Recargando app...');
      setTimeout(() => window.location.reload(), 500);
    }
  }

  public render() {
    if (this.state.hasError) {
      const isChunkError = (
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Unable to preload CSS')
      );

      if (isChunkError) {
        // Pantalla de actualización - se recargará sola
        return (
          <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4 text-center">
            <div className="card p-8 max-w-md w-full animate-fade-in">
              <div className="icon-chip icon-chip-blue mx-auto mb-5">
                <RefreshCw size={18} strokeWidth={2.2} className="animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-3">Actualizando...</h1>
              <p className="text-text-muted text-sm leading-relaxed">Hay una nueva versión disponible. Cargando...</p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4 text-center">
          <div className="card p-8 max-w-md w-full animate-fade-in">
            <div className="icon-chip icon-chip-red mx-auto mb-5">
              <TriangleAlert size={18} strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-3 tracking-tight">Vaya, algo ha fallado</h1>
            <p className="text-text-muted mb-6 text-sm leading-relaxed">
              Nuestros escudos de protección han interceptado un error inesperado.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full py-3"
            >
              <RotateCcw size={16} strokeWidth={2.2} />
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

