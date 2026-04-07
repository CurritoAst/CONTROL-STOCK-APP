import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { DailyLog } from '../../types';
import { sendViaGmail } from '../../lib/gmailSend';

export const ORDER_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 18px; margin-bottom: 24px; }
  .brand { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
  .brand span { color: #e05c00; }
  .meta { text-align: right; }
  .meta .label { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; }
  .meta .value { font-size: 15px; font-weight: 700; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
  .info-box { background: #f7f7f7; border-radius: 8px; padding: 12px 16px; }
  .info-box .lbl { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 700; }
  .info-box .val { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .cat-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #444; background: #f0f0f0; padding: 6px 12px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; margin: 10px 0 0; }
  table { width: 100%; border-collapse: collapse; }
  .item-row td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  .item-row:last-child td { border-bottom: none; }
  .qty { font-size: 20px; font-weight: 900; color: #1d4ed8; text-align: right; width: 60px; }
  .footer { margin-top: 36px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 16px; } @page { margin: 10mm; } }
`;


export const printRawOrder = (log: { date: string, eventTitle?: string, items: any[] }, email = false) => {
    const byCategory: Record<string, typeof log.items> = {};
    log.items.filter(i => i.prepared > 0).forEach(item => {
        const cat = item.product.category || 'Sin categoría';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    const sections = Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b, 'es'))
        .map(([cat, items]) => `
            <div class="cat-title">${cat}</div>
            <table>
                ${items.map(item => `
                    <tr class="item-row">
                        <td style="font-weight:600">${item.product.name}</td>
                        <td class="qty">${item.prepared}</td>
                    </tr>
                `).join('')}
            </table>
        `).join('');

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<title>Pedido – ${log.eventTitle || 'Pedido'} – ${log.date}</title>
<style>${ORDER_PRINT_STYLES}</style></head>
<body>
  <div class="header">
    <div>
      <div class="brand">MACARIO<span>.</span></div>
      <div style="color:#555;margin-top:4px;font-size:13px;">Hoja de Pedido</div>
    </div>
    <div class="meta">
      <div class="label">Fecha del servicio</div>
      <div class="value">${log.date}</div>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="lbl">Evento / Pedido</div>
      <div class="val">${log.eventTitle || 'Pedido General'}</div>
    </div>
    <div class="info-box">
      <div class="lbl">Total productos</div>
      <div class="val">${log.items.filter(i => i.prepared > 0).length} referencias</div>
    </div>
  </div>
  ${sections}
  <div class="footer">Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <script>window.onload = function() { window.print(); }</script>
</body></html>`;

    if (email) {
        return sendViaGmail(html, `Pedido-${log.eventTitle || 'General'}-${log.date}.html`);
    } else {
        const blob = new Blob([html], { type: 'text/html' });
        window.open(URL.createObjectURL(blob), '_blank');
        return Promise.resolve();
    }
};

export const DailyAudit: React.FC = () => {
    const { activeLogs, products, approveDailyLog, approvePedido, rejectPedido, deleteDailyLog, updatePedidoItems } = useAppContext();
    const { addToast } = useToast();
    const [sendingEmail, setSendingEmail] = useState<string | null>(null);

    const handleEmail = async (fn: () => Promise<void>, key: string) => {
        setSendingEmail(key);
        try {
            await fn();
            addToast('PDF enviado a la impresora correctamente', 'success');
        } catch (e: any) {
            addToast('Error al enviar: ' + (e.message || 'inténtalo de nuevo'), 'error');
        } finally {
            setSendingEmail(null);
        }
    };

    // The Master needs to audit things that are PENDING_PEDIDO, OPEN or CLOSED
    const logsToAudit = activeLogs.filter(log => log.status === 'PENDING_PEDIDO' || log.status === 'OPEN' || log.status === 'CLOSED');

    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editingItems, setEditingItems] = useState<{ product: any, prepared: number }[]>([]);
    const [editCategory, setEditCategory] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    if (logsToAudit.length === 0) {
        return (
            <div className="card text-center text-muted py-8">
                No hay pedidos diarios pendientes o en curso en este momento.
            </div>
        );
    }

    const startEditing = (log: DailyLog) => {
        setEditingLogId(log.id);
        // Initialize editing items with ALL items in the log (not filtering products here yet)
        const initialEdits = log.items.map(i => ({
            product: i.product,
            prepared: i.prepared
        }));
        setEditingItems(initialEdits);
        setEditCategory("");
    };

    const handleUpdateQuantity = (productId: string, newQuantity: number) => {
        setEditingItems(prev => {
            const existing = prev.find(item => item.product.id === productId);
            if (existing) {
                return prev.map(item =>
                    item.product.id === productId ? { ...item, prepared: Math.max(0, newQuantity) } : item
                );
            } else {
                const prod = products.find(p => p.id === productId);
                if (prod && newQuantity > 0) {
                    return [...prev, { product: prod, prepared: newQuantity }];
                }
                return prev;
            }
        });
    };

    const saveChanges = async (logId: string) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const validItems = editingItems.filter(i => i.prepared > 0);
            await updatePedidoItems(logId, validItems);
            setEditingLogId(null);
            setEditCategory("");
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const categories = Array.from(new Set(products.map(p => p.category || 'General'))).sort();

    return (
        <div className="flex flex-col gap-6">
            {logsToAudit.map(log => {
                if (log.status === 'PENDING_PEDIDO' || log.status === 'OPEN') {
                    const isPending = log.status === 'PENDING_PEDIDO';
                    const isEditing = editingLogId === log.id;

                    return (
                        <div key={log.id} className={`card animate-fade-in border-l-4 ${isPending ? 'border-l-accent-blue' : 'border-l-accent-purple'}`}>
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-white/10 pb-4 gap-4">
                                <div>
                                    <h2 className="text-2xl mb-1">Pedido Diario {log.eventTitle ? `- ${log.eventTitle}` : ''}</h2>
                                    <p className="text-text-muted">Día de servicio: {log.date}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {!isPending && (
                                        <>
                                            <button
                                                className="btn btn-outline border-accent-green/30 text-accent-green hover:bg-accent-green/10 text-xs py-1 px-2"
                                                onClick={() => printRawOrder(log)}
                                            >
                                                🖨️ Imprimir Pedido
                                            </button>
                                            <button
                                                disabled={!!sendingEmail}
                                                className="btn btn-outline border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-xs py-1 px-2 disabled:opacity-50"
                                                onClick={() => handleEmail(() => printRawOrder(log, true), log.id)}
                                            >
                                                {sendingEmail === log.id ? '⏳ Enviando...' : '✉️ Email'}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="btn btn-outline border-accent-red/30 text-accent-red hover:bg-accent-red/10 text-xs py-1 px-2"
                                        onClick={() => {
                                            if (window.confirm("¿Seguro que quieres borrar este pedido por completo?")) {
                                                deleteDailyLog(log.id);
                                                addToast("Pedido eliminado", "info");
                                            }
                                        }}
                                    >
                                        🗑️ Borrar
                                    </button>
                                    <span className={`badge ${isPending ? 'badge-blue' : 'badge-purple'}`}>
                                        {isPending ? 'Esperando Aprobación Inicial' : 'Pedido Aceptado (En curso)'}
                                    </span>
                                </div>
                            </div>

                            <div className="mb-6 overflow-x-auto pb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold">Cantidades Solicitadas:</h3>
                                    {!isEditing && (
                                        <button
                                            className="btn btn-outline border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 text-sm py-1"
                                            onClick={() => startEditing(log)}
                                        >
                                            ✏️ Editar Pedido
                                        </button>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="animate-fade-in flex flex-col gap-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/20 p-4 rounded-lg border border-white/10">
                                            <span className="text-sm font-medium text-text-muted">Filtrar por Sección:</span>
                                            <select 
                                                className="bg-bg-primary/50 border border-white/20 rounded p-2 text-white outline-none focus:border-accent-blue w-full sm:w-auto"
                                                value={editCategory || "General"}
                                                onChange={(e) => setEditCategory(e.target.value === "General" ? "" : e.target.value)}
                                            >
                                                <option value="General">Todas las Categorías</option>
                                                {categories.filter(c => c !== "General").map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                                            {products
                                                .filter(p => !editCategory || p.category === editCategory)
                                                .sort((a,b) => a.name.localeCompare(b.name))
                                                .map(product => {
                                                    const editItem = editingItems.find(i => i.product.id === product.id);
                                                    const qty = editItem?.prepared || 0;
                                                    return (
                                                        <div key={product.id} className={`p-4 border rounded-lg transition-colors flex flex-col justify-between gap-3 ${qty > 0 ? 'border-accent-blue/40 bg-accent-blue/5' : 'border-white/10 bg-bg-primary/50'}`}>
                                                            <div>
                                                                <div className="font-bold text-lg mb-1 truncate" title={product.name}>{product.name}</div>
                                                                <span className="badge badge-gray">{product.category || 'General'}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold" onClick={() => handleUpdateQuantity(product.id, qty - 1)}>-</button>
                                                                    <span className={`text-xl font-bold w-10 text-center ${qty > 0 ? 'text-accent-blue' : 'text-text-muted'}`}>{qty}</span>
                                                                    <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-accent-blue/40 text-white flex items-center justify-center font-bold" onClick={() => handleUpdateQuantity(product.id, qty + 1)}>+</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>

                                        <div className="flex gap-4 mt-6 pt-4 border-t border-white/10">
                                            <button className="btn btn-outline flex-1" onClick={() => setEditingLogId(null)} disabled={isSaving}>Cancelar</button>
                                            <button className="btn btn-primary flex-1 shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2" onClick={() => saveChanges(log.id)} disabled={isSaving}>
                                                {isSaving ? <span className="animate-spin text-lg">⏳</span> : null}
                                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {log.items.map(item => (
                                            item.prepared > 0 && (
                                                <div key={item.product.id} className="p-3 bg-white/5 rounded-md text-center">
                                                    <div className="font-medium mb-2 truncate" title={item.product.name}>{item.product.name}</div>
                                                    <div className="text-2xl font-bold text-accent-blue">{item.prepared}</div>
                                                </div>
                                            )
                                        ))}
                                        {log.items.length === 0 && (
                                            <div className="col-span-full text-text-muted text-center py-4 bg-black/20 rounded-md">Sin productos solicitados.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {!isEditing && isPending && (
                                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                                    <button
                                        className="btn btn-outline border-accent-red text-accent-red hover:bg-accent-red hover:text-white flex-1 text-lg py-4"
                                        onClick={() => {
                                            rejectPedido(log.id);
                                            addToast(`Pedido para ${log.date} rechazado.`, "error");
                                        }}
                                    >
                                        ❌ Rechazar
                                    </button>
                                    <button
                                        className="btn btn-primary flex-2 w-full sm:w-2/3 text-lg py-4 shadow-lg shadow-accent-blue/20"
                                        onClick={() => {
                                            approvePedido(log.id);
                                            addToast(`Pedido para ${log.date} aprobado.`, "success");
                                        }}
                                    >
                                        ✅ Aprobar Pedido para el día {log.date}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                }

                if (log.status === 'CLOSED') {
                    const totalCost = log.items.reduce((sum, item) => sum + (item.consumed * item.product.price), 0);

                    return (
                        <div key={log.id} className="card animate-fade-in border-l-4 border-l-accent-green">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-white/10 pb-4 gap-4">
                                <div>
                                    <h2 className="text-2xl mb-1">Pedidos Diarios (Cierre) {log.eventTitle ? `- ${log.eventTitle}` : ''}</h2>
                                    <p className="text-text-muted">Revisión del servicio del día: {log.date}</p>
                                </div>
                                <div className="flex flex-col gap-2 items-end">
                                    <div className="text-3xl font-bold text-accent-red">{totalCost.toLocaleString('es-ES')} €</div>
                                    <button
                                        className="btn btn-outline border-accent-red/30 text-accent-red hover:bg-accent-red/10 text-xs py-1 px-2"
                                        onClick={() => {
                                            if (window.confirm("¿Seguro que quieres borrar este pedido cerrado?")) {
                                                deleteDailyLog(log.id);
                                                addToast("Pedido eliminado", "info");
                                            }
                                        }}
                                    >
                                        🗑️ Borrar Histórico
                                    </button>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h3 className="text-lg font-bold mb-4">Desglose de Consumos y Sobrantes:</h3>
                                <div className="flex flex-col gap-3">
                                    {log.items.map(item => {
                                        const sobrante = item.prepared - item.consumed;
                                        const cost = item.consumed * item.product.price;

                                        return (
                                            <div key={item.product.id} className="flex flex-col md:grid md:grid-cols-[1fr_auto_auto_auto_auto] gap-4 md:items-center p-4 bg-white/5 rounded-md border border-white/5">
                                                <div className="font-bold text-lg border-b border-white/10 md:border-0 pb-2 md:pb-0">{item.product.name}</div>

                                                <div className="grid grid-cols-2 md:flex md:flex-row gap-4 md:gap-0">
                                                    <div className="text-left md:text-center md:px-4 md:border-l border-white/10">
                                                        <div className="text-text-muted text-xs uppercase mb-1">Pedido</div>
                                                        <div className="text-lg font-medium">{item.prepared}</div>
                                                    </div>
                                                    <div className="text-right md:text-center md:px-4 md:border-l border-white/10">
                                                        <div className="text-text-muted text-xs uppercase mb-1">Consumido</div>
                                                        <div className="font-bold text-lg text-accent-blue">{item.consumed}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 md:flex md:flex-row gap-4 md:gap-0 mt-2 md:mt-0 pt-2 md:pt-0 border-t border-white/5 md:border-0">
                                                    <div className="text-left md:text-center md:px-4 md:border-l border-white/10">
                                                        <div className="text-text-muted text-xs uppercase mb-1">Sobrante</div>
                                                        <div className={`text-lg font-bold ${sobrante < 0 ? 'text-accent-red' : 'text-accent-green'}`}>{sobrante}</div>
                                                    </div>
                                                    <div className="text-right md:px-4 md:border-l border-white/10 md:min-w-[100px]">
                                                        <div className="text-text-muted text-xs uppercase mb-1">Coste</div>
                                                        <div className="text-accent-red font-bold text-lg">{cost.toLocaleString('es-ES')} €</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                className="btn btn-success w-full text-lg py-4"
                                onClick={() => {
                                    approveDailyLog(log.id);
                                    addToast(`Servicio del día ${log.date} cerrado y registrado correctamente`, "success");
                                }}
                            >
                                ✅ Aprobar Servicio y Registrar Costes
                            </button>
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
};
