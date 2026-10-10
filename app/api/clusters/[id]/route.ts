import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { encrypt } from '@/lib/config';

export const PATCH = withAuth(async (req, { params }) => {
  const b = await req.json();
  const db = await needDb();
  const sets: string[] = [], vals: any[] = [];
  const add = (col: string, v: any) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
  if (b.name !== undefined) add('name', String(b.name).trim());
  if (b.base_url !== undefined) add('base_url', String(b.base_url).trim().replace(/\/+$/, ''));
  if (b.username !== undefined) add('username', b.username || null);
  if (b.password) add('password_enc', encrypt(String(b.password)));
  if (b.insecure_tls !== undefined) add('insecure_tls', !!b.insecure_tls);
  if (b.sync_enabled !== undefined) add('sync_enabled', !!b.sync_enabled);
  if (b.sync_interval_min !== undefined) add('sync_interval_min', Math.max(1, Number(b.sync_interval_min) || 15));
  if (!sets.length) return NextResponse.json({ ok: true });
  vals.push(Number(params.id));
  await db.query(`UPDATE clusters SET ${sets.join(',')} WHERE id=$${vals.length}`, vals);
  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (_req, { params }) => {
  const db = await needDb();
  await db.query('DELETE FROM clusters WHERE id=$1', [Number(params.id)]); // data query ikut terhapus (CASCADE)
  return NextResponse.json({ ok: true });
});
