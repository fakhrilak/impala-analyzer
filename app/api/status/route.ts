import { NextResponse } from 'next/server';
import { readConfig } from '@/lib/config';
import { isAuthed } from '@/lib/auth';
import { getDb } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cfg = readConfig();
  const authed = isAuthed();
  const out: any = { masterSet: !!cfg.master, authed };
  if (authed) {
    out.dbConfigured = !!cfg.db;
    out.dbOk = false;
    try { out.dbOk = !!(await getDb()); } catch (e: any) { out.dbError = e.message; }
  }
  return NextResponse.json(out);
}
