'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import AnalyzerView from '@/components/AnalyzerView';
import ClustersView from '@/components/ClustersView';
import SettingsView from '@/components/SettingsView';

function AuthForm({ mode, onDone }: { mode: 'setup' | 'login'; onDone: () => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');

  const go = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setErr('');
    try { 
      await api(mode === 'setup' ? '/api/setup' : '/api/login', { body: { username: u, password: p } }); 
      onDone(); 
    } catch (x: any) { 
      setErr(x.message); 
    }
  };

  return (
    <div className="center">
      <form className="panel" onSubmit={go}>
        <h2>{mode === 'setup' ? 'Set up master account' : 'Sign in to Impala Analyzer'}</h2>
        {mode === 'setup' && (
          <span className="muted">
            This account manages database connections and Impala clusters. Keep it safe; it is securely hashed and stored on the server.
          </span>
        )}
        <label>
          Username
          <input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label>
          Password{mode === 'setup' ? ' (min. 8 characters)' : ''}
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} />
        </label>
        {err && <span className="err">{err}</span>}
        <button className="primary">
          {mode === 'setup' ? 'Create account & sign in' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function Home() {
  const [st, setSt] = useState<any>(null);
  const [tab, setTab] = useState('analyzer');
  
  const load = async () => setSt(await api('/api/status'));
  
  useEffect(() => { 
    load(); 
  }, []);
  
  if (!st) return <div className="center muted">Loading…</div>;
  if (!st.masterSet) return <AuthForm mode="setup" onDone={load} />;
  if (!st.authed) return <AuthForm mode="login" onDone={load} />;
  
  const cur = st.dbOk ? tab : 'settings';
  const tabs: [string, string][] = [
    ['analyzer', 'Analyzer'], 
    ['clusters', 'Clusters'], 
    ['settings', 'Settings']
  ];

  return (
    <>
      <header className="top">
        <span className="brand">Impala Analyzer</span>
        <nav className="tabs">
          {tabs.map(([k, l]) => (
            <button 
              key={k} 
              className="tab" 
              aria-current={cur === k} 
              disabled={!st.dbOk && k !== 'settings'} 
              onClick={() => setTab(k)}
            >
              {l}
            </button>
          ))}
        </nav>
        <button onClick={async () => { await api('/api/logout', { method: 'POST' }); load(); }}>
          Sign out
        </button>
      </header>
      <main className="wrap">
        {!st.dbOk && (
          <div className="panel">
            <b>Database is not connected.</b> 
            <span className="muted">
              The application is running; configure the PostgreSQL connection below to start adding clusters.
              {st.dbError ? ' Last error: ' + st.dbError : ''}
            </span>
          </div>
        )}
        {cur === 'analyzer' && <AnalyzerView />}
        {cur === 'clusters' && <ClustersView />}
        {cur === 'settings' && <SettingsView onChanged={load} />}
      </main>
    </>
  );
}