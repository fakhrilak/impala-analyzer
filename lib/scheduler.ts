import { getDb } from './db';
import { syncCluster } from './sync';

const g = globalThis as any;

async function tick() {
  try {
    const db = await getDb();
    if (!db) return; // belum dikonfigurasi: aplikasi tetap jalan, scheduler menunggu
    const { rows } = await db.query(
      `SELECT id FROM clusters WHERE sync_enabled AND (last_sync_at IS NULL OR last_sync_at + make_interval(mins => sync_interval_min) <= now())`);
    for (const r of rows) await syncCluster(r.id);
  } catch {}
}
export function startScheduler() {
  if (g.__sched) return;
  g.__sched = setInterval(tick, 30_000);
  setTimeout(tick, 5_000);
}
