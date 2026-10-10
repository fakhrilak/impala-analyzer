import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { encrypt } from '@/lib/config';
import { isSyncing } from '@/lib/sync';

const LIST = `SELECT c.id,c.name,c.source_type,c.base_url,c.username,c.insecure_tls,c.sync_enabled,c.sync_interval_min,c.last_sync_at,
  c.last_sync_status,c.last_sync_message,(SELECT count(*) FROM queries q WHERE q.cluster_id=c.id)::int AS query_count
  FROM clusters c ORDER BY c.id`;

export const dynamic = 'force-dynamic';
export const GET = withAuth(async () => {
  const db = await needDb();
  const rows = (await db.query(LIST)).rows.map((r) => ({ ...r, running: isSyncing(r.id) }));
  return NextResponse.json({ clusters: rows });
});

export const POST = withAuth(async (req) => {
  const b = await req.json();
  const db = await needDb();
  const upload = b.source_type === 'upload';
  const name = String(b.name || '').trim(), url = upload ? '' : String(b.base_url || '').trim().replace(/\/+$/, '');
  if (!name || (!upload && !/^https?:\/\//.test(url))) throw new Error('Nama wajib diisi dan URL harus diawali http:// atau https://');
  const { rows } = await db.query(
    `INSERT INTO clusters (name,base_url,username,password_enc,insecure_tls,sync_enabled,sync_interval_min,source_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [name, url, b.username || null, b.password ? encrypt(String(b.password)) : null, b.insecure_tls !== false, !upload && b.sync_enabled !== false, Math.max(1, Number(b.sync_interval_min) || 15), upload ? 'upload' : 'url']);
  return NextResponse.json({ id: rows[0].id });
});
