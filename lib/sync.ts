import { needDb } from './db';
import { decrypt } from './config';
import { COLS } from './columns';
import { fetchProfile, listQueryIds } from './impala';
import { parseProfile } from './parser';
import { Pool } from 'pg';

const g = globalThis as any;
g.__syncing = g.__syncing || new Set<number>();

const INSERT_COLS = ['cluster_id', ...COLS.map((c) => c.key), 'summary', 'counters', 'raw_profile'];
const INSERT_SQL = `INSERT INTO queries (${INSERT_COLS.join(',')}) VALUES (${INSERT_COLS.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT (cluster_id, query_id) DO NOTHING`;

export const isSyncing = (id: number) => g.__syncing.has(id);

export async function saveProfile(db: Pool, clusterId: number, raw: string): Promise<boolean> {
  const p = parseProfile(raw);
  const vals = [clusterId, ...COLS.map((col) => p.row[col.key] ?? (col.type === 'num' ? 0 : '')), JSON.stringify(p.summary), JSON.stringify(p.counters), raw];
  const r = await db.query(INSERT_SQL, vals);
  return (r.rowCount || 0) > 0; // false = sudah ada (duplikat)
}

export async function syncCluster(id: number) {
  if (g.__syncing.has(id)) return;
  g.__syncing.add(id);
  const db = await needDb();
  try {
    const { rows } = await db.query('SELECT * FROM clusters WHERE id=$1', [id]);
    const c = rows[0];
    if (!c) return;
    // await db.query(`UPDATE clusters SET last_sync_at=now(), last_sync_status='running', last_sync_message=NULL WHERE id=$1`, [id]);
    await db.query(`SELECT id FROM clusters WHERE sync_enabled AND source_type='url' AND (last_sync_at IS NULL OR last_sync_at + make_interval(mins => sync_interval_min) <= now())`, [id]);
    try {
      const ep = { base_url: c.base_url, username: c.username, password: c.password_enc ? decrypt(c.password_enc) : '', insecure_tls: c.insecure_tls };
      const ids = await listQueryIds(ep);
      const have = new Set((await db.query('SELECT query_id FROM queries WHERE cluster_id=$1', [id])).rows.map((r) => r.query_id));
      const todo = ids.filter((x) => !have.has(x));
      let added = 0, failed = 0, firstErr = '';
      let i = 0;
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (i < todo.length) {
          const qid = todo[i++];
          try {
            const raw = await fetchProfile(ep, qid);
            const p = parseProfile(raw);
            const vals = [id, ...COLS.map((col) => p.row[col.key] ?? (col.type === 'num' ? 0 : '')), JSON.stringify(p.summary), JSON.stringify(p.counters), raw];
            await db.query(INSERT_SQL, vals);
            added++;
          } catch (e: any) { failed++; firstErr = firstErr || `${qid}: ${e.message}`; }
        }
      }));
      await db.query(`UPDATE clusters SET last_sync_status=$2, last_sync_message=$3 WHERE id=$1`,
        [id, failed && !added ? 'error' : 'ok', `${added} baru, ${failed} gagal, ${ids.length - todo.length} sudah ada${firstErr ? ' — ' + firstErr : ''}`]);
    } catch (e: any) {
      await db.query(`UPDATE clusters SET last_sync_status='error', last_sync_message=$2 WHERE id=$1`, [id, e.message]);
    }
  } finally { g.__syncing.delete(id); }
}
