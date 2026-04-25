/**
 * Hecht Service — Database Backup Logic
 *
 * Server-side only. Creates JSON dumps of all tables,
 * gzips them, uploads to R2, and applies GFS retention.
 *
 * Restore strategy: see db/schema.sql + restore script.
 */

import { gzipSync } from 'zlib';
import { createAdminClient } from './supabase';
import { uploadToR2, listR2Objects, deleteFromR2 } from './r2';

// Tables to back up — match db/schema.sql exactly
const TABLES = [
  'service_centers',
  'warranty_registrations',
  'comments',
  'users',
  'action_log',
  'login_attempts',
];

const BACKUP_PREFIX = 'backup-';
const BACKUP_SUFFIX = '.json.gz';

/**
 * Pull all rows from all tables into a single JSON object.
 */
async function createDatabaseDump() {
  const supabase = createAdminClient();
  const tables = {};
  const stats = {};

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      throw new Error(`Failed to dump ${table}: ${error.message}`);
    }
    tables[table] = data || [];
    stats[table] = (data || []).length;
  }

  return {
    version: '1.0',
    created_at: new Date().toISOString(),
    schema_ref: 'db/schema.sql',
    table_counts: stats,
    tables,
  };
}

/**
 * Compress JSON string with gzip (level 9 = max compression).
 */
function compressDump(dumpObject) {
  const json = JSON.stringify(dumpObject);
  return gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
}

/**
 * Generate backup key from current UTC date.
 * Example: "backup-2026-04-25.json.gz"
 */
function generateBackupKey(date = new Date()) {
  const iso = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${BACKUP_PREFIX}${iso}${BACKUP_SUFFIX}`;
}

/**
 * Parse date from backup key.
 * Returns null if key format invalid.
 */
function parseBackupDate(key) {
  const match = key.match(/^backup-(\d{4}-\d{2}-\d{2})\.json\.gz$/);
  if (!match) return null;
  const date = new Date(match[1] + 'T00:00:00Z');
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Apply GFS retention: keep
 *   - all backups from last 7 days (daily)
 *   - first backup of each ISO week, last 4 weeks (weekly)
 *   - first backup of each calendar month, last 12 months (monthly)
 * Delete everything else.
 *
 * Returns { kept, deleted } counts.
 */
async function applyRetention() {
  const objects = await listR2Objects(BACKUP_PREFIX);
  const backups = objects
    .map((obj) => ({ ...obj, date: parseBackupDate(obj.key) }))
    .filter((b) => b.date !== null)
    .sort((a, b) => b.date - a.date); // newest first

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);

  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setUTCDate(now.getUTCDate() - 28);

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setUTCMonth(now.getUTCMonth() - 12);

  const keep = new Set();
  const seenWeeks = new Set();
  const seenMonths = new Set();

  for (const b of backups) {
    // Rule 1: keep all from last 7 days
    if (b.date >= sevenDaysAgo) {
      keep.add(b.key);
      continue;
    }

    // Rule 2: weekly — first backup per ISO week, within last 4 weeks
    if (b.date >= fourWeeksAgo) {
      const weekKey = getISOWeekKey(b.date);
      if (!seenWeeks.has(weekKey)) {
        seenWeeks.add(weekKey);
        keep.add(b.key);
        continue;
      }
    }

    // Rule 3: monthly — first backup per calendar month, within last 12 months
    if (b.date >= twelveMonthsAgo) {
      const monthKey = `${b.date.getUTCFullYear()}-${b.date.getUTCMonth()}`;
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        keep.add(b.key);
      }
    }
  }

  // Delete everything not in keep set
  let deleted = 0;
  for (const b of backups) {
    if (!keep.has(b.key)) {
      await deleteFromR2(b.key);
      deleted++;
    }
  }

  return { kept: keep.size, deleted, total: backups.length };
}

/**
 * Returns ISO week key like "2026-W17"
 */
function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Main entry — creates and uploads backup, then applies retention.
 */
export async function runBackup() {
  const startedAt = Date.now();

  // 1. Dump database
  const dump = await createDatabaseDump();
  const totalRows = Object.values(dump.table_counts).reduce((a, b) => a + b, 0);

  // 2. Compress
  const compressed = compressDump(dump);

  // 3. Upload to R2
  const key = generateBackupKey();
  await uploadToR2(key, compressed, 'application/gzip');

  // 4. Apply retention (cleanup old backups)
  const retention = await applyRetention();

  const durationMs = Date.now() - startedAt;

  return {
    success: true,
    key,
    size_bytes: compressed.length,
    size_kb: Math.round(compressed.length / 1024),
    total_rows: totalRows,
    table_counts: dump.table_counts,
    retention,
    duration_ms: durationMs,
  };
}
