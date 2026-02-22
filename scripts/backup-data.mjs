#!/usr/bin/env node
/**
 * backup-data.mjs — Export IndexedDB data to a JSON file on disk
 * 
 * Since IndexedDB lives in the browser, this script opens the app
 * in a headless-like way and triggers the export via the browser.
 * 
 * But for simplicity, we use a different approach:
 * We directly read the Dexie database using the same DB schema
 * by spawning a quick script in the app context.
 * 
 * Actually, the most reliable way: use the app's export URL.
 * Since we can't do that without a running browser, we'll use
 * a simpler approach — remind the user and provide the path.
 * 
 * This script is called during promote to remind about backups.
 */

import { readdir, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(__dirname);
const backupDir = join(projectDir, 'backups');

async function checkBackups() {
    // Ensure backups directory exists
    if (!existsSync(backupDir)) {
        await mkdir(backupDir, { recursive: true });
    }

    // List existing backups
    const files = (await readdir(backupDir)).filter(f => f.endsWith('.json')).sort().reverse();

    if (files.length === 0) {
        console.log('\n⚠️  No data backups found!');
        console.log('   Go to your app → click "Data" → "Export Backup (JSON)"');
        console.log(`   Save the file to: ${backupDir}/`);
        console.log('');
        return false;
    }

    const latest = files[0];
    const latestPath = join(backupDir, latest);
    const stats = await stat(latestPath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

    if (ageHours > 24) {
        console.log(`\n⚠️  Latest backup is ${Math.floor(ageHours)}h old: ${latest}`);
        console.log('   Consider exporting a fresh backup from the app.');
        console.log('');
        return true;
    }

    console.log(`\n✅ Latest backup: ${latest} (${Math.floor(ageHours)}h ago)`);
    console.log(`   ${files.length} total backup(s) in ${backupDir}`);
    console.log('');
    return true;
}

checkBackups().catch(console.error);
