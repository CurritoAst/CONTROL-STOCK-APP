#!/usr/bin/env node
/**
 * SYNC BACKUPS - MACARIO
 *
 * Descarga todas las copias de seguridad almacenadas en la tabla
 * `backups` de Supabase y las guarda como archivos JSON individuales
 * en la carpeta local. Útil para mantener una réplica off-line de
 * todos los snapshots históricos.
 *
 * Uso (manual): node scripts/sync-backups.cjs
 * Uso (programado): añadir un trigger del Programador de Tareas que
 * ejecute scripts/sync-backups.bat con la frecuencia que prefieras.
 *
 * Solo descarga los archivos que aún no existan localmente, así que
 * ejecutarlo varias veces es seguro y barato.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://ikagbmbvsehdvbmspfwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vAsF5VdMJ5xFYQ-CdetqIw_fldKtmxs';
const BACKUP_DIR   = 'C:\\Users\\curri\\OneDrive\\Desktop\\Copias Maca';

function get(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Accept: 'application/json',
            }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                else { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

const safeFilename = s => String(s || '').replace(/[<>:"/\\|?*\s]+/g, '_').slice(0, 60);

async function main() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        console.log(`📁 Carpeta creada: ${BACKUP_DIR}`);
    }

    console.log(`🔍 Listando copias en Supabase...`);
    const list = await get(`${SUPABASE_URL}/rest/v1/backups?select=id,created_at,label,trigger_type&order=created_at.desc`);
    console.log(`   Encontradas ${list.length} copias`);

    let synced = 0, skipped = 0, errors = 0;

    for (const meta of list) {
        const ts = meta.created_at.replace(/[:.]/g, '-').slice(0, 19);
        const labelPart = safeFilename(meta.label || meta.trigger_type);
        const filename = `cloud-${ts}-${meta.trigger_type}-${labelPart}.json`;
        const dest = path.join(BACKUP_DIR, filename);

        if (fs.existsSync(dest)) {
            skipped++;
            continue;
        }

        try {
            const url = `${SUPABASE_URL}/rest/v1/backups?select=*&id=eq.${encodeURIComponent(meta.id)}`;
            const rows = await get(url);
            if (rows && rows.length > 0) {
                const row = rows[0];
                const fileContent = {
                    fecha: row.created_at,
                    label: row.label,
                    trigger_type: row.trigger_type,
                    description: row.description,
                    ...row.payload,
                };
                fs.writeFileSync(dest, JSON.stringify(fileContent, null, 2));
                console.log(`✓ ${filename}`);
                synced++;
            }
        } catch (e) {
            console.error(`✗ ${filename}: ${e.message}`);
            errors++;
        }
    }

    console.log(`\n📊 Resumen: ${synced} nuevas · ${skipped} ya existían · ${errors} errores`);
    console.log(`📂 Carpeta: ${BACKUP_DIR}`);
}

main().catch(err => {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
});
