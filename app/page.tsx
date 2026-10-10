'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import AnalyzerView from '@/components/AnalyzerView';
import ClustersView from '@/components/ClustersView';
import SettingsView from '@/components/SettingsView';

function AuthForm({ mode, onDone }: { mode: 'setup' | 'login'; onDone: () => void }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('');
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { await api(mode === 'setup' ? '/api/setup' : '/api/login', { body: { username: u, password: p } }); onDone(); }
    catch (x: any) { setErr(x.message); }
  };
  return (
    <div className="center"><form className="panel" onSubmit={go}>
      <h2>{mode === 'setup' ? 'Buat akun master' : 'Masuk ke Impala Analyzer'}</h2>
      {mode === 'setup' && <span className="muted">Akun ini mengelola koneksi database dan cluster Impala. Simpan baik-baik, tersimpan terenkripsi (hash) di server.</span>}
      <label>Username<input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" /></label>
      <label>Password{mode === 'setup' ? ' (min. 8 karakter)' : ''}<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} /></label>
      {err && <span className="err">{err}</span>}
      <button className="primary">{mode === 'setup' ? 'Buat akun & masuk' : 'Masuk'}</button>
    </form></div>
  );
}

export default function Home() {
  const [st, setSt] = useState<any>(null);
  const [tab, setTab] = useState('analyzer');
  const load = async () => setSt(await api('/api/status'));
  useEffect(() => { load(); }, []);
  if (!st) return <div className="center muted">Memuat…</div>;
  if (!st.masterSet) return <AuthForm mode="setup" onDone={load} />;
  if (!st.authed) return <AuthForm mode="login" onDone={load} />;
  const cur = st.dbOk ? tab : 'settings';
  const tabs: [string, string][] = [['analyzer', 'Analisis'], ['clusters', 'Cluster'], ['settings', 'Pengaturan']];
  return (
    <>
      <header className="top">
        <span className="brand">Impala Analyzer</span>
        <nav className="tabs">
          {tabs.map(([k, l]) => (
            <button key={k} className="tab" aria-current={cur === k} disabled={!st.dbOk && k !== 'settings'} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <button onClick={async () => { await api('/api/logout', { method: 'POST' }); load(); }}>Keluar</button>
      </header>
      <main className="wrap">
        {!st.dbOk && <div className="panel"><b>Database belum terhubung.</b> <span className="muted">Aplikasi tetap berjalan; isi koneksi PostgreSQL di bawah untuk mulai menambah cluster.{st.dbError ? ' Error terakhir: ' + st.dbError : ''}</span></div>}
        {cur === 'analyzer' && <AnalyzerView />}
        {cur === 'clusters' && <ClustersView />}
        {cur === 'settings' && <SettingsView onChanged={load} />}
      </main>
    </>
  );
}
