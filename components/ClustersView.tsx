'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const EMPTY = { source_type: 'url', name: '', base_url: '', username: '', password: '', insecure_tls: true, sync_enabled: true, sync_interval_min: 15 };
const ago = (d: string | null) => (d ? new Date(d).toLocaleString('en-US') : 'never');

// Ikon SVG sederhana
const UploadIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const SyncIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>;
const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const PauseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const EditIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const DeleteIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;

export default function ClustersView() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const load = useCallback(() => api('/api/clusters').then((r) => setList(r.clusters)).catch((e) => setMsg({ ok: false, t: e.message })), []);
  
  useEffect(() => { load(); }, [load]);
  
  useEffect(() => {
    if (!list.some((c) => c.running || c.last_sync_status === 'running')) return;
    const t = setInterval(load, 3000); return () => clearInterval(t);
  }, [list, load]);

  const isUpload = form?.source_type === 'upload';
  
  const save = async () => {
    setMsg(null);
    try {
      if (form.id) await api(`/api/clusters/${form.id}`, { method: 'PATCH', body: form });
      else await api('/api/clusters', { body: form });
      setForm(null); load();
    } catch (e: any) { setMsg({ ok: false, t: e.message }); }
  };
  
  const test = async () => {
    setMsg(null);
    try { 
      const r = await api('/api/clusters/test', { body: form }); 
      setMsg({ ok: true, t: `Connected. ${r.completed} queries successfully registered in the coordinator.` }); 
    } catch (e: any) { 
      setMsg({ ok: false, t: e.message }); 
    }
  };
  
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const act = async (fn: () => Promise<any>) => { try { await fn(); } catch (e: any) { setMsg({ ok: false, t: e.message }); } load(); };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (!input.files?.length || target === null) return;
    const fd = new FormData();
    Array.from(input.files).forEach((f) => fd.append('files', f));
    setBusyId(target); 
    setMsg(null);
    try {
      const r = await fetch(`/api/clusters/${target}/upload`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg({ ok: true, t: `Upload complete: ${j.added} new queries, ${j.duplicate} duplicates skipped, ${j.invalid} invalid Impala profile files.${j.errors?.length ? ' ' + j.errors[0] : ''}` });
    } catch (x: any) { 
      setMsg({ ok: false, t: x.message }); 
    }
    setBusyId(null); 
    input.value = ''; 
    load();
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".zip" multiple hidden onChange={onFiles} />
      <section className="panel">
        <div className="row">
          <h2 className="grow">Impala Clusters</h2>
          <button className="primary" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>Add cluster</button>
        </div>
        {msg && !form && <p className={msg.ok ? 'okc' : 'err'}>{msg.t}</p>}
        {!list.length ? (
          <p className="muted">No clusters available. Add a cluster from an Impala coordinator URL, or create a ZIP Upload cluster to analyze profiles from files.</p>
        ) : (
          <div className="tablewrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Source</th>
                  <th>Queries</th>
                  <th>Schedule</th>
                  <th>Last Update</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const up = c.source_type === 'upload';
                  return (
                    <tr key={c.id} style={{ cursor: 'default' }}>
                      <td><b>{c.name}</b></td>
                      <td>{up ? <span className="pill">ZIP Upload</span> : c.base_url}</td>
                      <td>{c.query_count}</td>
                      <td>{up ? <span className="muted">manual</span> : c.sync_enabled ? `every ${c.sync_interval_min} mins` : <span className="muted">paused</span>}</td>
                      <td>{ago(c.last_sync_at)}</td>
                      <td title={c.last_sync_message || ''}>
                        <span className={'pill ' + (c.last_sync_status === 'error' ? 'err' : c.last_sync_status === 'ok' ? 'okc' : '')}>
                          {c.running || busyId === c.id ? 'running…' : c.last_sync_status || '-'}
                        </span>
                        <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{c.last_sync_message?.slice(0, 70)}</span>
                      </td>
                      <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', borderBottom: 'none' }}>
                        {up ? (
                          <button className="link icon-btn" title="Upload ZIP" disabled={busyId === c.id} onClick={() => { setTarget(c.id); fileRef.current?.click(); }}>
                            <UploadIcon />
                          </button>
                        ) : (
                          <>
                            <button className="link icon-btn" title="Sync now" disabled={c.running} onClick={() => act(() => api(`/api/clusters/${c.id}/sync`, { method: 'POST', body: {} }))}>
                              <SyncIcon />
                            </button>
                            <button className="link icon-btn" title={c.sync_enabled ? 'Pause' : 'Resume'} onClick={() => act(() => api(`/api/clusters/${c.id}`, { method: 'PATCH', body: { sync_enabled: !c.sync_enabled } }))}>
                              {c.sync_enabled ? <PauseIcon /> : <PlayIcon />}
                            </button>
                          </>
                        )}
                        <button className="link icon-btn" title="Edit" onClick={() => { setMsg(null); setForm({ ...c, password: '' }); }}>
                          <EditIcon />
                        </button>
                        <button className="link danger icon-btn" title="Delete" onClick={() => { if (confirm(`Delete cluster "${c.name}"? All query data from this cluster will be deleted.`)) act(() => api(`/api/clusters/${c.id}`, { method: 'DELETE' })); }}>
                          <DeleteIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {form && (
        <section className="panel">
          <h2>{form.id ? `Edit ${form.name}` : 'New Cluster'}</h2>
          {!form.id && (
            <div className="row" style={{ marginTop: 10 }}>
              <label>
                Data source
                <select value={form.source_type} onChange={(e) => set('source_type', e.target.value)}>
                  <option value="url">Impala coordinator URL (auto-sync)</option>
                  <option value="upload">ZIP file upload (manual)</option>
                </select>
              </label>
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <label className="grow">
              Name
              <input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            {!isUpload && (
              <label className="grow" style={{ flex: 2 }}>
                Coordinator URL
                <input value={form.base_url} onChange={(e) => set('base_url', e.target.value)} placeholder="https://coordinator-web-cluster2.apps.example" />
              </label>
            )}
          </div>
          {isUpload ? (
            <p className="muted">Once the cluster is created, click the <b>Upload ZIP</b> icon on the cluster row to upload a zip file containing query profiles. Uploads can be repeated anytime; existing queries will be skipped automatically.</p>
          ) : (
            <>
              <div className="row" style={{ marginTop: 10 }}>
                <label className="grow">
                  Username
                  <input value={form.username || ''} onChange={(e) => set('username', e.target.value)} autoComplete="off" />
                </label>
                <label className="grow">
                  Password
                  <input type="password" value={form.password} placeholder={form.id ? 'Leave blank to keep unchanged' : ''} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
                </label>
                <label style={{ width: 150 }}>
                  Sync every (mins)
                  <input type="number" min={1} value={form.sync_interval_min} onChange={(e) => set('sync_interval_min', e.target.value)} />
                </label>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <input type="checkbox" checked={form.sync_enabled} onChange={(e) => set('sync_enabled', e.target.checked)} />
                  Enable auto-sync
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <input type="checkbox" checked={form.insecure_tls} onChange={(e) => set('insecure_tls', e.target.checked)} />
                  Skip TLS certificate verification
                </label>
              </div>
            </>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            {!isUpload && <button onClick={test}>Test connection</button>}
            <button className="primary" onClick={save}>Save cluster</button>
            <button onClick={() => setForm(null)}>Cancel</button>
            {msg && <span className={msg.ok ? 'okc' : 'err'}>{msg.t}</span>}
          </div>
        </section>
      )}
    </>
  );
}