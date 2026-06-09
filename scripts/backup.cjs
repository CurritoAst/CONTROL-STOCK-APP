/**
 * BACKUP AUTOMÁTICO - MACARIO
 * Descarga todos los datos de Supabase y guarda un archivo JSON en D:\
 *
 * Para ejecutar manualmente: node scripts/backup.js
 * Para automatizar: configurar en el Programador de Tareas de Windows
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Configuración ──────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ikagbmbvsehdvbmspfwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vAsF5VdMJ5xFYQ-CdetqIw_fldKtmxs';
const BACKUP_DIR   = 'C:\\Users\\curri\\OneDrive\\Desktop\\Copias Maca';
// ──────────────────────────────────────────────────────────────────────────────

// Single page fetch with optional Range header to defeat the 1000-row default.
function fetchPage(table, from, to) {
    return new Promise((resolve, reject) => {
        const url = new URL(`/rest/v1/${table}?select=*`, SUPABASE_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Range': `${from}-${to}`,
                'Range-Unit': 'items',
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Error parsing ${table}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// Walks a table in 1000-row chunks until exhausted. Supabase REST silently
// caps each response at 1000 rows; without pagination the newest items get
// lost the moment any table grows past that line.
async function fetchTable(table) {
    const PAGE = 1000;
    const all = [];
    for (let from = 0; ; from += PAGE) {
        const page = await fetchPage(table, from, from + PAGE - 1);
        if (!Array.isArray(page) || page.length === 0) break;
        all.push(...page);
        if (page.length < PAGE) break;
    }
    return all;
}

async function runBackup() {
    console.log('[Macario Backup] Iniciando copia de seguridad...');

    // Crear carpeta de backups si no existe
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`[Macario Backup] Carpeta creada: ${BACKUP_DIR}`);
    }

    // Descargar todas las tablas
    const [products, events, daily_logs, log_items] = await Promise.all([
        fetchTable('products'),
        fetchTable('events'),
        fetchTable('daily_logs'),
        fetchTable('log_items')
    ]);

    const backup = {
        fecha: new Date().toISOString(),
        resumen: {
            productos: products.length,
            eventos: events.length,
            pedidos: daily_logs.length,
            items_pedidos: log_items.length
        },
        products,
        events,
        daily_logs,
        log_items
    };

    // Nombre de archivo con fecha y hora
    const ahora = new Date();
    const fecha = ahora.toISOString().slice(0, 10);
    const hora  = ahora.toTimeString().slice(0, 8).replace(/:/g, '-');
    const filename = `backup-macario-${fecha}_${hora}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');

    // Borrar backups antiguos (conservar los últimos 30)
    const archivos = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup-macario-') && f.endsWith('.json'))
        .sort();

    if (archivos.length > 30) {
        const aEliminar = archivos.slice(0, archivos.length - 30);
        for (const f of aEliminar) {
            fs.unlinkSync(path.join(BACKUP_DIR, f));
            console.log(`[Macario Backup] Eliminado backup antiguo: ${f}`);
        }
    }

    console.log(`[Macario Backup] ✅ Backup guardado en: ${filepath}`);
    console.log(`[Macario Backup] Resumen: ${products.length} productos, ${events.length} eventos, ${daily_logs.length} pedidos`);
}

runBackup().catch(err => {
    console.error('[Macario Backup] ❌ Error:', err.message);
    process.exit(1);
});
