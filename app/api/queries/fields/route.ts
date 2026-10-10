import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const GET = withAuth(async () => {
  const db = await needDb();
  const sample = '(SELECT summary, counters FROM queries ORDER BY synced_at DESC LIMIT 300) s';
  const keys = async (col: string) => (await db.query(`SELECT DISTINCT k FROM ${sample}, jsonb_object_keys(s.${col}) AS k ORDER BY k`)).rows.map((r) => r.k);
  const values: Record<string, string[]> = {};
  for (const c of ['query_status', 'executor_group', 'admission_result', 'exec_option'])
    values[c] = (await db.query(`SELECT DISTINCT ${c} v FROM queries WHERE ${c} IS NOT NULL ORDER BY 1 LIMIT 200`)).rows.map((r) => r.v);
  values.cluster = (await db.query('SELECT name FROM clusters ORDER BY name')).rows.map((r) => r.name);
  return NextResponse.json({ summary: await keys('summary'), counters: await keys('counters'), values });
});
