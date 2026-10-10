import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { parsePlan } from '@/lib/plan';

export const GET = withAuth(async (req) => {
  const u = new URL(req.url);
  const db = await needDb();
  const { rows } = await db.query('SELECT q.*, c.name AS cluster FROM queries q JOIN clusters c ON c.id=q.cluster_id WHERE q.cluster_id=$1 AND q.query_id=$2', [Number(u.searchParams.get('cluster')), u.searchParams.get('qid')]);
  if (!rows[0]) throw new Error('Query tidak ditemukan');
  const out: any = rows[0];
  try { out.plan = parsePlan(out.raw_profile || ''); } catch { out.plan = null; }
  if (u.searchParams.get('raw') !== '1') delete out.raw_profile;
  return NextResponse.json(out);
});