import { NextResponse } from 'next/server';
import { readConfig, checkPw } from '@/lib/config';
import { setSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { master } = readConfig();
  const { username, password } = await req.json();
  if (!master || username !== master.username || !checkPw(String(password || ''), master))
    return NextResponse.json({ error: 'Username atau password salah.' }, { status: 401 });
  setSession(username);
  return NextResponse.json({ ok: true });
}
