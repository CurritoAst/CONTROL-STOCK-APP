#!/usr/bin/env node
/**
 * RESTORE FROM BACKUP - MACARIO
 *
 * Restaura los productos (stock, nombres, precios, categorías) al estado
 * del JSON de backup indicado.
 *
 *  • Si un producto del backup ya existe → se actualizan sus datos.
 *  • Si un producto del backup no existe → se crea.
 *  • Si en BD hay productos que NO están en el backup → se eliminan.
 *    Antes de borrarlos se limpian los log_items que les referencien
 *    para no romper la integridad referencial.
 *
 * El script también acepta backups que incluyan events / daily_logs /
 * log_items: si esos arrays vienen rellenos en el JSON, también se
 * restauran. Si están vacíos (o no aparecen) se respetan los actuales.
 *
 * Uso:
 *   node scripts/restore.cjs <ruta-backup.json>            # dry run (no toca nada)
 *   node scripts/restore.cjs <ruta-backup.json> --apply    # aplica los cambios
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ikagbmbvsehdvbmspfwn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vAsF5VdMJ5xFYQ-CdetqIw_fldKtmxs';

const args = process.argv.slice(2);
const backupPath = args[0];
const APPLY = args.includes('--apply');

if (!backupPath) {
    console.error('Uso: node scripts/restore.cjs <ruta-backup.json> [--apply]');
    process.exit(1);
}
if (!fs.existsSync(backupPath)) {
    console.error('Archivo de backup no encontrado:', backupPath);
    process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const restoreEvents = Array.isArray(backup.events) && backup.events.length > 0;
const restoreLogs   = Array.isArray(backup.daily_logs) && backup.daily_logs.length > 0;
const restoreItems  = Array.isArray(backup.log_items) && backup.log_items.length > 0;

const baseHeaders = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
};

async function fetchAll(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: baseHeaders });
    if (!res.ok) throw new Error(`GET ${table} (${res.status}): ${await res.text()}`);
    return await res.json();
}

async function deleteByIds(table, ids, idColumn = 'id') {
    if (ids.length === 0) return;
    const BATCH = 80;
    for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const list = batch.map(id => `"${String(id).replace(/"/g, '\\"')}"`).join(',');
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${idColumn}=in.(${encodeURIComponent(list)})`,
            { method: 'DELETE', headers: { ...baseHeaders, Prefer: 'return=minimal' } }
        );
        if (!res.ok) throw new Error(`DELETE ${table} (${res.status}): ${await res.text()}`);
    }
}

async function upsert(table, rows) {
    if (rows.length === 0) return;
    const BATCH = 80;
    for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(slice),
        });
        if (!res.ok) throw new Error(`UPSERT ${table} (${res.status}): ${await res.text()}`);
    }
}

async function insertAll(table, rows) {
    if (rows.length === 0) return;
    const BATCH = 80;
    for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...baseHeaders, Prefer: 'return=minimal' },
            body: JSON.stringify(slice),
        });
        if (!res.ok) throw new Error(`INSERT ${table} (${res.status}): ${await res.text()}`);
    }
}

async function safetyBackup() {
    console.log('\n📦 Guardando snapshot de seguridad del estado actual...');
    const [products, events, daily_logs, log_items] = await Promise.all([
        fetchAll('products'),
        fetchAll('events'),
        fetchAll('daily_logs'),
        fetchAll('log_items'),
    ]);
    const snap = { fecha: new Date().toISOString(), products, events, daily_logs, log_items };
    const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const dir = path.dirname(backupPath);
    const out = path.join(dir, `pre-restore-${ts}.json`);
    fs.writeFileSync(out, JSON.stringify(snap, null, 2));
    console.log(`   Guardado en: ${out}`);
}

async function main() {
    console.log(`📂 Backup: ${backupPath}`);
    console.log(`📅 Tomado: ${backup.fecha || '(sin fecha)'}`);
    console.log(`📊 Contenido del backup:`);
    console.log(`     - ${backup.products?.length ?? 0} products`);
    console.log(`     - ${backup.events?.length ?? 0} events ${restoreEvents ? '(SE RESTAURAN)' : '(no se tocan)'}`);
    console.log(`     - ${backup.daily_logs?.length ?? 0} daily_logs ${restoreLogs ? '(SE RESTAURAN)' : '(no se tocan)'}`);
    console.log(`     - ${backup.log_items?.length ?? 0} log_items ${restoreItems ? '(SE RESTAURAN)' : '(solo limpieza FK)'}`);

    const [curProducts, curEvents, curLogs, curItems] = await Promise.all([
        fetchAll('products'),
        fetchAll('events'),
        fetchAll('daily_logs'),
        fetchAll('log_items'),
    ]);

    console.log(`\n📊 Estado actual de la BD:`);
    console.log(`     - ${curProducts.length} products`);
    console.log(`     - ${curEvents.length} events`);
    console.log(`     - ${curLogs.length} daily_logs`);
    console.log(`     - ${curItems.length} log_items`);

    const backupProductIds = new Set(backup.products.map(p => p.id));
    const productsToDelete = curProducts.filter(p => !backupProductIds.has(p.id));
    const productIdsToDelete = new Set(productsToDelete.map(p => p.id));

    // log_items huérfanos: los que apuntan a productos que vamos a borrar
    const orphanItems = curItems.filter(it => productIdsToDelete.has(it.product_id));

    let eventsToDelete = [];
    let itemsToReplace = curItems;
    let logsToReplace = curLogs;

    if (restoreEvents) {
        const backupEventIds = new Set(backup.events.map(e => e.id));
        eventsToDelete = curEvents.filter(e => !backupEventIds.has(e.id));
    }

    console.log(`\n📋 Plan de restauración:`);
    console.log(`     • Borrar ${productsToDelete.length} products que NO están en el backup`);
    console.log(`     • Limpiar ${orphanItems.length} log_items huérfanos (referencian productos a borrar)`);
    console.log(`     • Upsertar ${backup.products.length} products del backup (stock, precio, etc.)`);
    if (restoreEvents) console.log(`     • Borrar ${eventsToDelete.length} events extra; upsertar ${backup.events.length}`);
    if (restoreLogs)   console.log(`     • Borrar TODOS los ${curLogs.length} daily_logs actuales y re-insertar ${backup.daily_logs.length}`);
    if (restoreItems)  console.log(`     • Borrar TODOS los ${curItems.length} log_items actuales y re-insertar ${backup.log_items.length}`);

    if (productsToDelete.length > 0) {
        console.log(`\n🗑️  Productos que se VAN A ELIMINAR (primeros 30):`);
        productsToDelete.slice(0, 30).forEach(p => {
            console.log(`     - ${p.name} (stock=${p.stock}, id=${p.id})`);
        });
        if (productsToDelete.length > 30) {
            console.log(`     ... y ${productsToDelete.length - 30} más`);
        }
    }

    // Stock changes preview
    const stockChanges = [];
    for (const bp of backup.products) {
        const cur = curProducts.find(p => p.id === bp.id);
        if (cur && cur.stock !== bp.stock) {
            stockChanges.push({ name: bp.name, before: cur.stock, after: bp.stock });
        }
    }
    if (stockChanges.length > 0) {
        console.log(`\n📦 Cambios de stock (productos existentes — primeros 30):`);
        stockChanges.slice(0, 30).forEach(c => {
            const arrow = c.after > c.before ? '↑' : '↓';
            console.log(`     ${arrow} ${c.name}: ${c.before} → ${c.after}`);
        });
        if (stockChanges.length > 30) console.log(`     ... y ${stockChanges.length - 30} más`);
    }

    if (!APPLY) {
        console.log(`\n⚠️  DRY RUN — no se ha cambiado NADA en la BD.`);
        console.log(`    Para ejecutar de verdad: añade --apply al final del comando.`);
        return;
    }

    await safetyBackup();

    console.log(`\n🚀 Aplicando cambios...`);

    let step = 1;
    if (restoreItems) {
        console.log(`  ${step++} Borrando todos los log_items actuales (${curItems.length})...`);
        await deleteByIds('log_items', curItems.map(i => i.id));
    } else if (orphanItems.length > 0) {
        console.log(`  ${step++} Limpiando ${orphanItems.length} log_items huérfanos...`);
        await deleteByIds('log_items', orphanItems.map(i => i.id));
    }

    if (restoreLogs) {
        console.log(`  ${step++} Borrando todos los daily_logs actuales (${curLogs.length})...`);
        await deleteByIds('daily_logs', curLogs.map(l => l.id));
    }

    if (restoreEvents && eventsToDelete.length > 0) {
        console.log(`  ${step++} Borrando ${eventsToDelete.length} events extra...`);
        await deleteByIds('events', eventsToDelete.map(e => e.id));
    }

    if (productsToDelete.length > 0) {
        console.log(`  ${step++} Borrando ${productsToDelete.length} products extra...`);
        await deleteByIds('products', productsToDelete.map(p => p.id));
    }

    console.log(`  ${step++} Upsertando ${backup.products.length} products del backup...`);
    await upsert('products', backup.products);

    if (restoreEvents) {
        console.log(`  ${step++} Upsertando ${backup.events.length} events...`);
        await upsert('events', backup.events);
    }

    if (restoreLogs) {
        console.log(`  ${step++} Insertando ${backup.daily_logs.length} daily_logs...`);
        await insertAll('daily_logs', backup.daily_logs);
    }

    if (restoreItems) {
        console.log(`  ${step++} Insertando ${backup.log_items.length} log_items...`);
        await insertAll('log_items', backup.log_items);
    }

    console.log(`\n✅ Restauración completada.`);
    console.log(`   Stock y catálogo coinciden con el backup del ${backup.fecha || '(sin fecha)'}`);
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
});
