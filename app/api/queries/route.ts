import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { needDb } from '@/lib/db';
import { runQuery } from '@/lib/query';

export const POST = withAuth(async (req) => {
  const b = await req.json();
  const page = Math.max(1, Number(b.page) || 1), pageSize = Math.min(200, Number(b.pageSize) || 50);
  const r = await runQuery(await needDb(), b, page, pageSize);
  return NextResponse.json({ rows: r.rows, total: r.total, page, pageSize });
});
