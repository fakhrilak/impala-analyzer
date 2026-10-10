import https from 'https';
import http from 'http';

export type Endpoint = { base_url: string; username?: string | null; password?: string | null; insecure_tls?: boolean };

export function httpGet(ep: Endpoint, pathAndQuery: string, timeout = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(ep.base_url.replace(/\/+$/, '') + pathAndQuery);
    const mod = u.protocol === 'https:' ? https : http;
    const headers: Record<string, string> = {};
    if (ep.username) headers.Authorization = 'Basic ' + Buffer.from(`${ep.username}:${ep.password || ''}`).toString('base64');
    const req = mod.request(u, { method: 'GET', headers, rejectUnauthorized: !ep.insecure_tls, timeout }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 401) return reject(new Error('401 Unauthorized: periksa username & password'));
        if ((res.statusCode || 0) >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        resolve(body);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout menghubungi coordinator')));
    req.on('error', reject);
    req.end();
  });
}

export async function listQueryIds(ep: Endpoint): Promise<string[]> {
  const data = JSON.parse(await httpGet(ep, '/queries?json'));
  const ids: string[] = [];
  // in_flight_queries sengaja dilewati: profilenya belum final dan tidak akan diperbarui.
  for (const q of data.completed_queries || []) if (q.query_id) ids.push(q.query_id);
  return [...new Set(ids)];
}
export const fetchProfile = (ep: Endpoint, id: string) =>
  httpGet(ep, `/query_profile_plain_text?query_id=${encodeURIComponent(id)}`, 120000);
