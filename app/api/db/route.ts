import { NextResponse } from 'next/server';
import { readConfig, writeConfig, DbConfig } from '@/lib/config';
import { withAuth } from '@/lib/auth';
import { getDb, makePool } from '@/lib/db';

export const GET = withAuth(async () => {
  const { db } = readConfig();
  return NextResponse.json({ db: db ? { ...db, password: '' } : null });
});

export const POST = withAuth(async (req) => {
  const b = await req.json();
  const cfg = readConfig();
  const next: DbConfig = {
    host: String(b.host || '').trim(), port: Number(b.port) || 5432, database: String(b.database || '').trim(),
    user: String(b.user || '').trim(), password: b.password ? String(b.password) : cfg.db?.password || '', ssl: !!b.ssl,
  };
  if (!next.host || !next.database || !next.user) throw new Error('Host, database, dan user wajib diisi.');
  const pool = makePool(next);
  try { await pool.query('SELECT 1'); } finally { await pool.end().catch(() => {}); }
  if (b.action === 'save') {
    cfg.db = next;
    writeConfig(cfg);
    await getDb(); // buat tabel bila belum ada
  }
  return NextResponse.json({ ok: true });
});
