import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FILE = path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'config.json');

export type DbConfig = { host: string; port: number; database: string; user: string; password: string; ssl: boolean };
export type AppConfig = { secret: string; master?: { username: string; salt: string; hash: string }; db?: DbConfig };

export function writeConfig(c: AppConfig) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(c, null, 2), { mode: 0o600 });
}
export function readConfig(): AppConfig {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  const c: AppConfig = { secret: crypto.randomBytes(32).toString('hex') };
  writeConfig(c);
  return c;
}

export function hashPw(pw: string, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
export function checkPw(pw: string, m: { salt: string; hash: string }) {
  const h = crypto.scryptSync(pw, m.salt, 64);
  const e = Buffer.from(m.hash, 'hex');
  return h.length === e.length && crypto.timingSafeEqual(h, e);
}

const key = () => crypto.createHash('sha256').update(readConfig().secret).digest();
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const e = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), e].map((b) => b.toString('base64')).join('.');
}
export function decrypt(s: string): string {
  const [iv, tag, e] = s.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(e), d.final()]).toString('utf8');
}
