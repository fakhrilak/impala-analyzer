import { NextResponse } from 'next/server';
import { readConfig, writeConfig, hashPw } from '@/lib/config';
import { setSession } from '@/lib/auth';

export async function POST(req: Request) {
  const cfg = readConfig();
  if (cfg.master) return NextResponse.json({ error: 'Master user sudah dibuat.' }, { status: 409 });
  const { username, password } = await req.json();
  if (!username || !password || password.length < 8) return NextResponse.json({ error: 'Username wajib diisi, password minimal 8 karakter.' }, { status: 400 });
  cfg.master = { username, ...hashPw(password) };
  writeConfig(cfg);
  setSession(username);
  return NextResponse.json({ ok: true });
}
