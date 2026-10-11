'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SettingsView({ onChanged }: { onChanged: () => void }) {
  const [f, setF] = useState<any>({ host: '', port: 5432, database: 'impala_analyzer', user: '', password: '', ssl: false });
  const [hasPw, setHasPw] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  
  useEffect(() => { 
    api('/api/db').then((r) => { 
      if (r.db) { setF(r.db); setHasPw(true); } 
    }).catch(() => {}); 
  }, []);
  
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  
  const run = async (action: 'test' | 'save') => {
    setBusy(true); 
    setMsg(null);
    try {
      await api('/api/db', { body: { ...f, action } });
      setMsg({ ok: true, t: action === 'test' ? 'Connection successful.' : 'Saved. Tables initialized.' });
      if (action === 'save') onChanged();
    } catch (e: any) { 
      setMsg({ ok: false, t: e.message }); 
    }
    setBusy(false);
  };
  
  return (
    <section className="panel" style={{ maxWidth: 720 }}>
      <h2>PostgreSQL Connection</h2>
      <p className="muted">All cluster data and analysis results are stored in this database. Tables are created automatically upon saving.</p>
      <div className="row">
        <label className="grow">
          Host
          <input value={f.host} onChange={(e) => set('host', e.target.value)} placeholder="10.0.0.5" />
        </label>
        <label style={{ width: 90 }}>
          Port
          <input type="number" value={f.port} onChange={(e) => set('port', e.target.value)} />
        </label>
        <label className="grow">
          Database
          <input value={f.database} onChange={(e) => set('database', e.target.value)} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <label className="grow">
          User
          <input value={f.user} onChange={(e) => set('user', e.target.value)} autoComplete="off" />
        </label>
        <label className="grow">
          Password
          <input type="password" value={f.password} placeholder={hasPw ? 'Leave blank to keep unchanged' : ''} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center' }}>
          <input type="checkbox" checked={f.ssl} onChange={(e) => set('ssl', e.target.checked)} />
          SSL
        </label>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button disabled={busy} onClick={() => run('test')}>Test connection</button>
        <button className="primary" disabled={busy} onClick={() => run('save')}>Save & initialize tables</button>
        {msg && <span className={msg.ok ? 'okc' : 'err'}>{msg.t}</span>}
      </div>
    </section>
  );
}