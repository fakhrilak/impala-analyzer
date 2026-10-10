import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { DEFAULT_VISIBLE } from '@/lib/columns';

export const GET = withAuth(async () => {
  const db = await needDb();
  const r = (await db.query("SELECT value FROM app_settings WHERE key='visible_columns'")).rows[0];
  return NextResponse.json({ visible_columns: r?.value || DEFAULT_VISIBLE });
});
export const PUT = withAuth(async (req) => {
  const b = await req.json();
  const db = await needDb();
  const cols = (Array.isArray(b.visible_columns) ? b.visible_columns : []).map(String);
  await db.query("INSERT INTO app_settings (key,value) VALUES ('visible_columns',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(cols)]);
  return NextResponse.json({ ok: true });
});
