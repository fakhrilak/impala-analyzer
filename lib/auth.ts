import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { readConfig } from './config';

const NAME = 'ia_session';
const TTL = 12 * 3600;
const sign = (p: string) => crypto.createHmac('sha256', readConfig().secret).update(p).digest('base64url');

export function setSession(user: string) {
  const p = Buffer.from(JSON.stringify({ u: user, exp: Date.now() + TTL * 1000 })).toString('base64url');
  cookies().set(NAME, `${p}.${sign(p)}`, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: TTL });
}
export function clearSession() { cookies().delete(NAME); }
export function isAuthed(): boolean {
  const v = cookies().get(NAME)?.value;
  if (!v) return false;
  const [p, s] = v.split('.');
  if (!p || !s || sign(p) !== s) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

export function withAuth(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    if (!isAuthed()) return NextResponse.json({ error: 'Sesi berakhir, silakan login ulang.' }, { status: 401 });
    try { return await fn(req, ctx); }
    catch (e: any) { return NextResponse.json({ error: e.message || String(e) }, { status: 500 }); }
  };
}
