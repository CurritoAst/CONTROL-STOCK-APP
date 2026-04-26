import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { BackupSnapshot, BackupTrigger } from '../../types';

const TRIGGER_LABELS: Record<BackupTrigger, { label: string; color: string }> = {
    'manual':              { label: 'Manual',         color: 'bg-accent-blue/20 text-accent-blue border-accent-blue/30' },
    'auto-approve':        { label: 'Pre-aprobación', color: 'bg-accent-green/20 text-accent-green border-accent-green/30' },
    'auto-reject':         { label: 'Pre-rechazo',    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    'auto-edit-historical':{ label: 'Pre-edición día',color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    'auto-edit-total':     { label: 'Pre-edición total', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    'auto-delete':         { label: 'Pre-borrado',    color: 'bg-accent-red/20 text-accent-red border-accent-red/30' },
    'auto-restore':        { label: 'Pre-restauración', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    'scheduled':           { label: 'Programada',     color: 'bg-white/10 text-text-muted border-white/10' },
};

const formatBytes = (b: number | null) => {
    if (!b) return '—';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const BackupsPanel: React.FC = () => {
    const { listBackups, createBackup, deleteBackup, restoreFromBackup } = useAppContext();
    const { addToast } = useToast();
    const [backups, setBackups] = useState<BackupSnapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [tableMissing, setTableMissing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [filterTrigger, setFilterTrigger] = useState<BackupTrigger | 'ALL'>('ALL');
    const [search, setSearch] = useState('');
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [confirmRestore, setConfirmRestore] = useState<BackupSnapshot | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<BackupSnapshot | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const list = await listBackups();
            setBackups(list);
            setTableMissing(false);
        } catch (e: any) {
            console.warn('Failed to read backups:', e);
            setTableMissing(false); // localStorage always works
        } finally {
            setLoading(false);
        }
    }, [listBackups]);

    useEffect(() => { refresh(); }, [refresh]);

    const handleCreateManual = async () => {
        const label = window.prompt('Etiqueta para esta copia (opcional):', `Copia manual ${new Date().toLocaleString('es-ES')}`);
        if (label === null) return;
        setCreating(true);
        try {
            const result = await createBackup(label || 'Copia manual', 'manual');
            if (!result) {
                addToast('Error al crear copia (¿tabla "backups" no existe?)', 'error');
            } else {
                addToast('Copia creada correctamente', 'success');
                await refresh();
            }
        } catch (e: any) {
            addToast('Error: ' + (e.message || 'inténtalo de nuevo'), 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (backup: BackupSnapshot) => {
        setDownloadingId(backup.id);
        try {
            const raw = localStorage.getItem(`macario_backup_${backup.id}`);
            if (!raw) throw new Error('Copia no encontrada en almacén local');
            const row = JSON.parse(raw);
            const payload = row.payload || row;
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const ts = backup.created_at.replace(/[:.]/g, '-').slice(0, 19);
            a.href = url;
            a.download = `backup-${ts}-${backup.trigger_type}.json`;
            a.click();
            URL.revokeObjectURL(url);
            addToast('Descargado a Descargas', 'success');
        } catch (e: any) {
            addToast('Error al descargar: ' + (e.message || 'inténtalo de nuevo'), 'error');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleRestore = async () => {
        if (!confirmRestore) return;
        setRestoringId(confirmRestore.id);
        const id = confirmRestore.id;
        setConfirmRestore(null);
        try {
            await restoreFromBackup(id);
            addToast('Restauración completada', 'success');
            await refresh();
        } catch (e: any) {
            addToast('Error al restaurar: ' + (e.message || 'inténtalo de nuevo'), 'error');
        } finally {
            setRestoringId(null);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const id = confirmDelete.id;
        setConfirmDelete(null);
        try {
            await deleteBackup(id);
            addToast('Copia eliminada', 'info');
            await refresh();
        } catch (e: any) {
            addToast('Error al borrar: ' + (e.message || 'inténtalo de nuevo'), 'error');
        }
    };

    const filtered = useMemo(() => {
        return backups.filter(b => {
            if (filterTrigger !== 'ALL' && b.trigger_type !== filterTrigger) return false;
            if (search.trim() !== '') {
                const q = search.trim().toLowerCase();
                const haystack = `${b.label || ''} ${b.description || ''} ${b.trigger_type}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [backups, filterTrigger, search]);

    const totalSize = backups.reduce((s, b) => s + (b.size_bytes || 0), 0);

    if (tableMissing) {
        return (
            <div className="animate-fade-in">
                <div className="page-header">
                    <div>
                        <div className="section-label mb-2">Copias de seguridad</div>
                        <h1 className="page-title">Copias de Seguridad</h1>
                    </div>
                </div>
                <div className="card border border-yellow-500/30 bg-yellow-500/5">
                    <h3 className="text-yellow-400 font-bold mb-2">⚠️ Tabla "backups" no encontrada</h3>
                    <p className="text-sm text-text-muted mb-4">
                        Para activar esta sección necesitas crear la tabla en Supabase. Abre el SQL editor de Supabase y ejecuta el contenido del archivo:
                    </p>
                    <pre className="bg-black/40 border border-white/10 rounded p-3 text-xs text-accent-blue overflow-x-auto">supabase/migrations/20260426_create_backups.sql</pre>
                    <p className="text-xs text-text-muted mt-3">Una vez creada, recarga la página y podrás ver y gestionar todas las copias.</p>
                    <button onClick={refresh} className="btn btn-outline mt-4 text-xs">Reintentar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <div className="section-label mb-2">Histórico de snapshots</div>
                    <h1 className="page-title">Copias de Seguridad</h1>
                    <p className="page-subtitle">
                        {backups.length} {backups.length === 1 ? 'copia' : 'copias'} · {formatBytes(totalSize)} en total
                    </p>
                </div>
                <button
                    onClick={handleCreateManual}
                    disabled={creating}
                    className="btn btn-primary disabled:opacity-50"
                >
                    {creating ? '⏳ Creando...' : '💾 Crear copia ahora'}
                </button>
            </div>

            <div className="card mb-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Buscar por etiqueta o descripción..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-bg-primary/50 border border-white/20 rounded-lg p-2 pl-9 text-white outline-none focus:border-accent-blue placeholder:text-text-muted text-sm"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
                </div>
                <select
                    value={filterTrigger}
                    onChange={e => setFilterTrigger(e.target.value as any)}
                    className="bg-bg-primary/50 border border-white/20 rounded-lg p-2 text-white outline-none focus:border-accent-blue text-sm"
                >
                    <option value="ALL">Todos los tipos</option>
                    {(Object.keys(TRIGGER_LABELS) as BackupTrigger[]).map(t => (
                        <option key={t} value={t}>{TRIGGER_LABELS[t].label}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="card text-center py-10 text-text-muted">Cargando copias...</div>
            ) : filtered.length === 0 ? (
                <div className="card text-center py-10 text-text-muted">
                    {backups.length === 0 ? 'Aún no hay copias de seguridad.' : 'No hay copias que coincidan con los filtros.'}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {filtered.map(b => {
                        const tag = TRIGGER_LABELS[b.trigger_type] || TRIGGER_LABELS.manual;
                        const isRestoring = restoringId === b.id;
                        const isDownloading = downloadingId === b.id;
                        return (
                            <div key={b.id} className="card flex flex-col md:flex-row md:items-center justify-between gap-3 py-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className={`badge text-[9px] border ${tag.color}`}>{tag.label}</span>
                                        <span className="text-sm font-bold truncate" title={b.label || ''}>
                                            {b.label || '(sin etiqueta)'}
                                        </span>
                                    </div>
                                    {b.description && (
                                        <div className="text-xs text-text-muted truncate" title={b.description}>
                                            {b.description}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted font-mono">
                                        <span>📅 {formatDate(b.created_at)}</span>
                                        <span>📦 {b.products_count ?? 0} prod</span>
                                        <span>📋 {b.daily_logs_count ?? 0} pedidos</span>
                                        <span>📊 {formatBytes(b.size_bytes)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    <button
                                        onClick={() => handleDownload(b)}
                                        disabled={isDownloading || isRestoring}
                                        className="btn btn-outline text-xs py-1.5 px-3 disabled:opacity-50"
                                        title="Descargar como JSON"
                                    >
                                        {isDownloading ? '⏳' : '💾 Descargar'}
                                    </button>
                                    <button
                                        onClick={() => setConfirmRestore(b)}
                                        disabled={isDownloading || isRestoring}
                                        className="btn btn-outline border-accent-green/40 text-accent-green hover:bg-accent-green/10 text-xs py-1.5 px-3 disabled:opacity-50"
                                        title="Restaurar este estado"
                                    >
                                        {isRestoring ? '⏳ Restaurando...' : '↺ Restaurar'}
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(b)}
                                        disabled={isDownloading || isRestoring}
                                        className="btn btn-outline border-accent-red/40 text-accent-red hover:bg-accent-red/10 text-xs py-1.5 px-3 disabled:opacity-50"
                                        title="Borrar copia"
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Restore confirm modal */}
            {confirmRestore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
                    <div className="card w-full max-w-md border border-accent-green/30">
                        <h3 className="text-xl font-bold mb-2 text-accent-green">↺ Restaurar copia</h3>
                        <p className="text-sm text-text-muted mb-1">
                            Estás a punto de restaurar la BD al estado de:
                        </p>
                        <p className="font-bold mb-1">{confirmRestore.label || '(sin etiqueta)'}</p>
                        <p className="text-xs text-text-muted mb-4 font-mono">{formatDate(confirmRestore.created_at)}</p>
                        <p className="text-xs text-yellow-400 mb-5">
                            ⚠️ Antes de aplicar se creará automáticamente otra copia de seguridad del estado actual, así que podrás revertir.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmRestore(null)} className="btn btn-outline flex-1">Cancelar</button>
                            <button onClick={handleRestore} className="btn btn-success flex-1">Restaurar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirm modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
                    <div className="card w-full max-w-md border border-accent-red/30">
                        <h3 className="text-xl font-bold mb-2 text-accent-red">🗑 Borrar copia</h3>
                        <p className="text-sm text-text-muted mb-1">¿Borrar la copia:</p>
                        <p className="font-bold mb-1">{confirmDelete.label || '(sin etiqueta)'}</p>
                        <p className="text-xs text-text-muted mb-5 font-mono">{formatDate(confirmDelete.created_at)}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDelete(null)} className="btn btn-outline flex-1">Cancelar</button>
                            <button onClick={handleDelete} className="btn btn-danger flex-1">Borrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
