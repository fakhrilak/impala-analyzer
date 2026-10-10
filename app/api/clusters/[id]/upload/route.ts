import { NextResponse } from 'next/server';
import { unzipSync, strFromU8 } from 'fflate';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { saveProfile } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const QID = /Query \(id=([0-9a-fA-F]+:[0-9a-fA-F]+)\)/;

export const POST = withAuth(async (req, { params }) => {
  const id = Number(params.id);
  const db = await needDb();
  const c = (await db.query('SELECT source_type FROM clusters WHERE id=$1', [id])).rows[0];
  if (!c) throw new Error('Cluster tidak ditemukan');
  if (c.source_type !== 'upload') throw new Error('Cluster ini bukan tipe Upload ZIP.');

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) throw new Error('Pilih file .zip terlebih dahulu.');

  const have = new Set((await db.query('SELECT query_id FROM queries WHERE cluster_id=$1', [id])).rows.map((r) => r.query_id));
  const stat = { added: 0, duplicate: 0, invalid: 0 };
  const errors: string[] = [];

  for (const f of files) {
    let entries: Record<string, Uint8Array>;
    try { entries = unzipSync(new Uint8Array(await f.arrayBuffer())); }
    catch { errors.push(`${f.name}: bukan file zip yang valid`); continue; }
    for (const [name, bytes] of Object.entries(entries)) {
      if (name.endsWith('/') || name.includes('__MACOSX') || !bytes.length) continue;
      const raw = strFromU8(bytes);
      const m = QID.exec(raw);
      if (!m) { stat.invalid++; continue; }
      if (have.has(m[1])) { stat.duplicate++; continue; }
      try {
        if (await saveProfile(db, id, raw)) stat.added++; else stat.duplicate++;
        have.add(m[1]);
      } catch (e: any) { stat.invalid++; errors.push(`${name}: ${e.message}`); }
    }
  }
  await db.query(`UPDATE clusters SET last_sync_at=now(), last_sync_status=$2, last_sync_message=$3 WHERE id=$1`,
    [id, errors.length && !stat.added ? 'error' : 'ok', `Upload: ${stat.added} baru, ${stat.duplicate} duplikat, ${stat.invalid} tidak valid`]);
  return NextResponse.json({ ...stat, errors: errors.slice(0, 5) });
});