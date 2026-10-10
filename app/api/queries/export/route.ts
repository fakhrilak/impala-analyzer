import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { runQuery } from '@/lib/query';
import { labelOf } from '@/lib/columns';

const cell = (v: any) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

export const POST = withAuth(async (req) => {
  const b = await req.json();
  const r = await runQuery(await needDb(), b, 1, null);
  const csv = [r.cols.map((c) => cell(labelOf(c))).join(','), ...r.rows.map((row) => r.cols.map((c) => cell(row[c])).join(','))].join('\n');
  return new Response('\ufeff' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="impala_queries.csv"' } });
});
