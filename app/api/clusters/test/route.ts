import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { decrypt } from '@/lib/config';
import { listQueryIds } from '@/lib/impala';

export const POST = withAuth(async (req) => {
  const b = await req.json();
  let password = b.password || '';
  if (!password && b.id) {
    const db = await needDb();
    const r = (await db.query('SELECT password_enc FROM clusters WHERE id=$1', [b.id])).rows[0];
    if (r?.password_enc) password = decrypt(r.password_enc);
  }
  const ids = await listQueryIds({ base_url: b.base_url, username: b.username, password, insecure_tls: b.insecure_tls !== false });
  return NextResponse.json({ ok: true, completed: ids.length });
});
