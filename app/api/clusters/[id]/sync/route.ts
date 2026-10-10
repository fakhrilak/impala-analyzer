import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { syncCluster } from '@/lib/sync';

export const POST = withAuth(async (_req, { params }) => {
  syncCluster(Number(params.id)).catch(() => {});
  return NextResponse.json({ started: true }, { status: 202 });
});
