import { Pool } from 'pg';
import { readConfig, DbConfig } from './config';
import { COLS } from './columns';

const g = globalThis as any;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clusters (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  base_url TEXT NOT NULL,
  username TEXT,
  password_enc TEXT,
  insecure_tls BOOLEAN NOT NULL DEFAULT TRUE,
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sync_interval_min INT NOT NULL DEFAULT 15,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS queries (
  cluster_id INT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  query_id TEXT NOT NULL,
  ${COLS.map((c) => `${c.key} ${c.type === 'num' ? 'DOUBLE PRECISION' : 'TEXT'}`).filter((l) => !l.startsWith('query_id ')).join(',\n  ')},
  summary JSONB NOT NULL DEFAULT '{}',
  counters JSONB NOT NULL DEFAULT '{}',
  raw_profile TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cluster_id, query_id)
);
CREATE INDEX IF NOT EXISTS queries_start_idx ON queries (cluster_id, start_time DESC);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
`;

export function makePool(c: DbConfig) {
  const p = new Pool({
    host: c.host, port: c.port, database: c.database, user: c.user, password: c.password,
    ssl: c.ssl ? { rejectUnauthorized: false } : undefined, max: 10, connectionTimeoutMillis: 8000,
  });
  p.on('error', () => {});
  return p;
}

export async function getDb(): Promise<Pool | null> {
  const c = readConfig().db;
  if (!c) return null;
  const sig = JSON.stringify(c);
  if (g.__pg?.sig === sig) { await g.__pg.ready; return g.__pg.pool; }
  g.__pg?.pool.end().catch(() => {});
  const pool = makePool(c);
  const ready = pool.query(SCHEMA);
  g.__pg = { sig, pool, ready };
  ready.catch(() => { if (g.__pg?.pool === pool) g.__pg = null; });
  await ready;
  return pool;
}
export async function needDb(): Promise<Pool> {
  const p = await getDb();
  if (!p) throw new Error('Database belum dikonfigurasi. Buka tab Pengaturan.');
  return p;
}
