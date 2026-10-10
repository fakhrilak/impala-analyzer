'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

const EMPTY = { source_type: 'url', name: '', base_url: '', username: '', password: '', insecure_tls: true, sync_enabled: true, sync_interval_min: 15 };
const ago = (d: string | null) => (d ? new Date(d).toLocaleString('id-ID') : 'belum pernah');

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
    try { const r = await api('/api/clusters/test', { body: form }); setMsg({ ok: true, t: `Terhubung. ${r.completed} query selesai terdaftar di coordinator.` }); }
    catch (e: any) { setMsg({ ok: false, t: e.message }); }
  };
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const act = async (fn: () => Promise<any>) => { try { await fn(); } catch (e: any) { setMsg({ ok: false, t: e.message }); } load(); };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (!input.files?.length || target === null) return;
    const fd = new FormData();
    Array.from(input.files).forEach((f) => fd.append('files', f));
    setBusyId(target); setMsg(null);
    try {
      const r = await fetch(`/api/clusters/${target}/upload`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg({ ok: true, t: `Upload selesai: ${j.added} query baru, ${j.duplicate} duplikat dilewati, ${j.invalid} file bukan profile Impala valid.${j.errors?.length ? ' ' + j.errors[0] : ''}` });
    } catch (x: any) { setMsg({ ok: false, t: x.message }); }
    setBusyId(null); input.value = ''; load();
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".zip" multiple hidden onChange={onFiles} />
      <section className="panel">
        <div className="row"><h2 className="grow">Cluster Impala</h2>
          <button className="primary" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>Tambah cluster</button></div>
        {msg && !form && <p className={msg.ok ? 'okc' : 'err'}>{msg.t}</p>}
        {!list.length ? <p className="muted">Belum ada cluster. Tambahkan cluster dari URL coordinator Impala, atau buat cluster Upload ZIP untuk menganalisis profile dari file.</p> : (
          <div className="tablewrap" style={{ marginTop: 10 }}><table>
            <thead><tr><th>Nama</th><th>Sumber</th><th>Query</th><th>Jadwal</th><th>Update terakhir</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map((c) => {
              const up = c.source_type === 'upload';
              return (
              <tr key={c.id} style={{ cursor: 'default' }}>
                <td><b>{c.name}</b></td>
                <td>{up ? <span className="pill">Upload ZIP</span> : c.base_url}</td>
                <td>{c.query_count}</td>
                <td>{up ? <span className="muted">manual</span> : c.sync_enabled ? `tiap ${c.sync_interval_min} menit` : <span className="muted">dijeda</span>}</td>
                <td>{ago(c.last_sync_at)}</td>
                <td title={c.last_sync_message || ''}>
                  <span className={'pill ' + (c.last_sync_status === 'error' ? 'err' : c.last_sync_status === 'ok' ? 'okc' : '')}>
                    {c.running || busyId === c.id ? 'berjalan…' : c.last_sync_status || '-'}</span>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{c.last_sync_message?.slice(0, 70)}</span></td>
                <td>
                  {up ? <button className="link" disabled={busyId === c.id} onClick={() => { setTarget(c.id); fileRef.current?.click(); }}>Upload ZIP</button> : <>
                    <button className="link" disabled={c.running} onClick={() => act(() => api(`/api/clusters/${c.id}/sync`, { method: 'POST', body: {} }))}>Sync sekarang</button>
                    <button className="link" onClick={() => act(() => api(`/api/clusters/${c.id}`, { method: 'PATCH', body: { sync_enabled: !c.sync_enabled } }))}>{c.sync_enabled ? 'Jeda' : 'Lanjutkan'}</button></>}
                  <button className="link" onClick={() => { setMsg(null); setForm({ ...c, password: '' }); }}>Ubah</button>
                  <button className="link danger" onClick={() => { if (confirm(`Hapus cluster "${c.name}"? Semua data query dari cluster ini ikut terhapus.`)) act(() => api(`/api/clusters/${c.id}`, { method: 'DELETE' })); }}>Hapus</button>
                </td>
              </tr>);
            })}</tbody>
          </table></div>)}
      </section>
      {form && (
        <section className="panel">
          <h2>{form.id ? `Ubah ${form.name}` : 'Cluster baru'}</h2>
          {!form.id && (
            <div className="row" style={{ marginTop: 10 }}>
              <label>Sumber data<select value={form.source_type} onChange={(e) => set('source_type', e.target.value)}>
                <option value="url">URL coordinator Impala (sync otomatis)</option>
                <option value="upload">Upload file ZIP (manual)</option></select></label>
            </div>)}
          <div className="row" style={{ marginTop: 10 }}>
            <label className="grow">Nama<input value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
            {!isUpload && <label className="grow" style={{ flex: 2 }}>URL coordinator<input value={form.base_url} onChange={(e) => set('base_url', e.target.value)} placeholder="https://coordinator-web-cluster2.apps.example" /></label>}
          </div>
          {isUpload ? <p className="muted">Setelah cluster dibuat, klik <b>Upload ZIP</b> pada baris cluster untuk mengunggah file zip berisi query profile. Upload bisa diulang kapan saja; query yang sudah ada otomatis dilewati.</p> : <>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="grow">Username<input value={form.username || ''} onChange={(e) => set('username', e.target.value)} autoComplete="off" /></label>
              <label className="grow">Password<input type="password" value={form.password} placeholder={form.id ? 'Kosongkan jika tidak diubah' : ''} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" /></label>
              <label style={{ width: 150 }}>Sync tiap (menit)<input type="number" min={1} value={form.sync_interval_min} onChange={(e) => set('sync_interval_min', e.target.value)} /></label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" checked={form.sync_enabled} onChange={(e) => set('sync_enabled', e.target.checked)} />Sync otomatis aktif</label>
              <label style={{ flexDirection: 'row', alignItems: 'center' }}><input type="checkbox" checked={form.insecure_tls} onChange={(e) => set('insecure_tls', e.target.checked)} />Abaikan verifikasi sertifikat TLS</label>
            </div></>}
          <div className="row" style={{ marginTop: 14 }}>
            {!isUpload && <button onClick={test}>Tes koneksi</button>}
            <button className="primary" onClick={save}>Simpan cluster</button>
            <button onClick={() => setForm(null)}>Batal</button>
            {msg && <span className={msg.ok ? 'okc' : 'err'}>{msg.t}</span>}
          </div>
        </section>)}
    </>
  );
}