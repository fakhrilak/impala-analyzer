'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { COLS, CATEGORICAL, DEFAULT_VISIBLE, labelOf, typeOf } from '@/lib/columns';
import PlanDiagram from './PlanDiagram';
import Modal from './Modal';

type Filter = { col: string; op: string; val: string };
const NUM_OPS = ['=', '>', '<', '>=', '<='], TXT_OPS = ['Contains', 'Equals', 'Not Contains', 'Not Equals'];
const PAGE = 50;

const KV = ({ k, v }: { k: string; v: any }) => <div className="kv"><span className="muted">{k}</span><b>{v === null || v === undefined || v === '' ? '-' : String(v)}</b></div>;

export default function AnalyzerView() {
  const [clusters, setClusters] = useState<any[]>([]);
  const [clusterId, setClusterId] = useState('');
  const [fields, setFields] = useState<any>({ summary: [], counters: [], values: {} });
  const [visible, setVisible] = useState<string[]>(DEFAULT_VISIBLE);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [draft, setDraft] = useState<Filter>({ col: 'query_status', op: 'Contains', val: '' });
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: any[]; total: number }>({ rows: [], total: 0 });
  const [sel, setSel] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [showCols, setShowCols] = useState(false);
  const [colSearch, setColSearch] = useState('');
  const [counterSearch, setCounterSearch] = useState('');
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    api('/api/clusters').then((r) => setClusters(r.clusters)).catch(() => {});
    api('/api/queries/fields').then(setFields).catch(() => {});
    api('/api/settings').then((r) => setVisible(r.visible_columns)).catch(() => {});
  }, []);

  const allFields = useMemo(() => [
    'cluster', ...COLS.filter((c) => c.key !== 'per_node_memory').map((c) => c.key),
    ...fields.summary.map((k: string) => 'summary.' + k), ...fields.counters.map((k: string) => 'counter.' + k),
  ], [fields]);

  const body = useMemo(() => ({ filters, columns: visible, clusterId: clusterId || undefined, sort }), [filters, visible, clusterId, sort]);
  useEffect(() => {
    let live = true;
    api('/api/queries', { body: { ...body, page, pageSize: PAGE } })
      .then((r) => { if (live) { setData(r); setErr(''); } })
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [body, page, tick]);

  useEffect(() => {
    setRaw(null);
    if (!sel) return setDetail(null);
    api(`/api/queries/detail?cluster=${sel._cid}&qid=${encodeURIComponent(sel._qid)}`).then(setDetail).catch((e) => setErr(e.message));
  }, [sel]);

  const addFilter = () => {
    if (!draft.val.trim()) return setErr('Filter value cannot be empty.');
    if (typeOf(draft.col) === 'num' && !isFinite(Number(draft.val))) return setErr('Value must be a number.');
    setErr(''); setFilters([...filters, { ...draft, val: draft.val.trim() }]); setPage(1); setDraft({ ...draft, val: '' });
  };
  const changeCol = (col: string) => setDraft({ col, op: typeOf(col) === 'num' ? '=' : 'Contains', val: '' });
  const toggleCol = (k: string) => setVisible(visible.includes(k) ? visible.filter((x) => x !== k) : [...visible, k]);
  const sortBy = (col: string) => { setPage(1); setSort(sort?.col === col ? { col, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }); };
  const exportCsv = async () => {
    const r = await fetch('/api/queries/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return setErr((await r.json()).error);
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'impala_queries.csv'; a.click();
  };
  const loadRaw = async () => setRaw((await api(`/api/queries/detail?cluster=${sel._cid}&qid=${encodeURIComponent(sel._qid)}&raw=1`)).raw_profile || '');

  const pages = Math.max(1, Math.ceil(data.total / PAGE));
  const catVals: string[] = fields.values?.[draft.col] || [];
  const isCat = CATEGORICAL.includes(draft.col) && catVals.length > 0;
  const colMatch = (k: string) => labelOf(k).toLowerCase().includes(colSearch.toLowerCase());
  const nodes = (detail?.per_node_memory || '').split(';').map((s: string) => s.trim()).filter((s: string) => s.includes('(') && s.endsWith(')')).map((s: string) => [s.split('(')[0], s.slice(s.indexOf('(') + 1, -1)]);

  return (
    <>
      <section className="panel">
        <div className="row">
          <h2 className="grow">Analysis Results</h2>
          <label>Cluster<select value={clusterId} onChange={(e) => { setClusterId(e.target.value); setPage(1); }}>
            <option value="">All clusters</option>{clusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <button onClick={() => setTick(tick + 1)}>Refresh</button>
          <button onClick={() => setShowCols(!showCols)}>Manage Columns</button>
          <button onClick={exportCsv}>Download CSV</button>
        </div>
        {showCols && (
          <div style={{ marginTop: 12 }}>
            <div className="row"><label className="grow">Search columns<input value={colSearch} onChange={(e) => setColSearch(e.target.value)} /></label>
              <button className="primary" onClick={() => api('/api/settings', { method: 'PUT', body: { visible_columns: visible } }).then(() => setShowCols(false))}>Save View</button>
              <button onClick={() => setVisible(DEFAULT_VISIBLE)}>Reset to Default</button></div>
            <div className="colpick">{allFields.filter(colMatch).map((k) => (
              <label key={k}><input type="checkbox" checked={visible.includes(k)} onChange={() => toggleCol(k)} />{labelOf(k)}</label>))}</div>
          </div>)}
      </section>

      <section className="panel">
        <h3>Filters</h3>
        {filters.map((f, i) => (
          <div className="rule" key={i}><b>{labelOf(f.col)}</b><code>{f.op}</code><i>{f.val}</i>
            <button aria-label="Remove filter" onClick={() => { setFilters(filters.filter((_, j) => j !== i)); setPage(1); }}>✕</button></div>))}
        <div className="row" style={{ marginTop: 8 }}>
          <label className="grow" style={{ flex: 2 }}>Field<select value={draft.col} onChange={(e) => changeCol(e.target.value)}>
            {allFields.map((k) => <option key={k} value={k}>{labelOf(k)}</option>)}</select></label>
          <label style={{ width: 150 }}>Operator<select value={draft.op} onChange={(e) => setDraft({ ...draft, op: e.target.value })}>
            {(typeOf(draft.col) === 'num' ? NUM_OPS : TXT_OPS).map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="grow" style={{ flex: 2 }}>Value{isCat
            ? <select value={draft.val} onChange={(e) => setDraft({ ...draft, val: e.target.value })}><option value="">Select...</option>{catVals.map((v) => <option key={v}>{v}</option>)}</select>
            : <input value={draft.val} placeholder={typeOf(draft.col) === 'num' ? 'Number' : ''} onChange={(e) => setDraft({ ...draft, val: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addFilter()} />}</label>
          <button className="primary" onClick={addFilter}>Add Filter</button>
        </div>
        {err && <p className="err">{err}</p>}
      </section>

      <section className="panel">
        <p className="muted" style={{ marginTop: 0 }}>{data.total} queries found. Click a row to view full details.</p>
        {!data.rows.length ? <p className="muted">{data.total === 0 && !filters.length ? 'No data yet. Add a cluster and run a sync from the Clusters tab.' : 'No data matches the current filters.'}</p> : (
          <div className="tablewrap"><table>
            <thead><tr>{visible.map((k) => <th key={k} onClick={() => sortBy(k)}>{labelOf(k)}{sort?.col === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</th>)}</tr></thead>
            <tbody>{data.rows.map((r) => (
              <tr key={r._cid + r._qid} className={sel?._qid === r._qid && sel?._cid === r._cid ? 'sel' : ''} onClick={() => setSel(r)}>
                {visible.map((k) => <td key={k} className={typeOf(k) === 'num' ? 'num' : ''} title={String(r[k] ?? '')}>{r[k] ?? '-'}</td>)}</tr>))}</tbody>
          </table></div>)}
        <div className="pager" style={{ marginTop: 10 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </section>

      {detail && (
        <section className="panel">
          <div className="row">
            <h2 className="grow">Query Details <code>{detail.query_id}</code></h2>
            {detail.plan && <button className="primary" onClick={() => setShowPlan(true)}>Show Plan</button>}
            <button onClick={() => setSel(null)}>Close</button>
          </div>
          <h3 style={{ marginTop: 12 }}>SQL Statement</h3>
          <pre className="sql">{detail.sql_statement}</pre>
          <div className="grid4" style={{ marginTop: 16 }}>
            <div><h3>General Info</h3><KV k="Cluster" v={detail.cluster} /><KV k="Start Time" v={detail.start_time} /><KV k="Status" v={detail.query_status} /><KV k="Executor Group" v={detail.executor_group} /><KV k="Exec Option" v={detail.exec_option} /></div>
            <div><h3>Memory</h3><KV k="Admission Result" v={detail.admission_result} /><KV k="Mem Limit" v={detail.mem_limit_mb + ' MB'} /><KV k="Admitted Mem" v={detail.cluster_mem_admitted_mb + ' MB'} /><KV k="Peak Usage" v={detail.peak_memory_usage_mb + ' MB'} /><KV k="Peak Reservation" v={detail.peak_reservation_mb + ' MB'} /></div>
            <div><h3>Data Cache</h3><KV k="Hit Bytes" v={detail.data_cache_hit_bytes_mb + ' MB'} /><KV k="Miss Bytes" v={detail.data_cache_miss_bytes_mb + ' MB'} /><KV k="Hit Count" v={detail.data_cache_hit_count} /><KV k="Miss Count" v={detail.data_cache_miss_count} /></div>
            <div><h3>Spill & Storage</h3><KV k="Scratch Written" v={detail.scratch_bytes_written_mb + ' MB'} /><KV k="Scratch Read" v={detail.scratch_bytes_read_mb + ' MB'} /><KV k="File Used" v={detail.scratch_file_used_bytes_mb + ' MB'} /><KV k="Write IO Bytes" v={detail.write_io_bytes_mb + ' MB'} /></div>
          </div>
          <h3 style={{ marginTop: 16 }}>Memory per Worker Node</h3>
          {nodes.length ? <div className="tablewrap"><table><thead><tr><th>Worker Node</th><th>Peak Memory</th></tr></thead><tbody>{nodes.map(([n, m]: string[]) => <tr key={n} style={{ cursor: 'default' }}><td>{n}</td><td>{m}</td></tr>)}</tbody></table></div>
            : <p className="muted">No per-node memory data available for this query.</p>}
          <div className="grid4" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
            <div><h3>All Summary Fields ({Object.keys(detail.summary || {}).length})</h3>
              <div style={{ maxHeight: 360, overflow: 'auto' }}>{Object.entries(detail.summary || {}).map(([k, v]) => <KV key={k} k={k} v={v} />)}</div></div>
            <div><h3>All Counters ({Object.keys(detail.counters || {}).length})</h3>
              <input placeholder="Search counters..." value={counterSearch} onChange={(e) => setCounterSearch(e.target.value)} style={{ width: '100%', margin: '4px 0' }} />
              <div style={{ maxHeight: 320, overflow: 'auto' }}>{Object.entries(detail.counters || {}).filter(([k]) => k.toLowerCase().includes(counterSearch.toLowerCase())).map(([k, v]) => <KV key={k} k={k} v={v} />)}</div>
              <p className="muted" style={{ fontSize: 12 }}>Bytes are in bytes, time in milliseconds. Source: Execution Profile per fragment (summed; Peak/Limit counters use maximum value).</p></div>
          </div>
          <div style={{ marginTop: 12 }}>
            {raw === null ? <button onClick={loadRaw}>Show raw profile</button> : <><button onClick={() => setRaw(null)}>Hide raw profile</button><pre className="sql" style={{ maxHeight: 500 }}>{raw}</pre></>}
          </div>
          {showPlan && detail.plan && (
            <Modal title={`Execution Plan: ${detail.query_id}`} onClose={() => setShowPlan(false)}>
              <PlanDiagram plan={detail.plan} sql={detail.sql_statement} />
            </Modal>
          )}
        </section>)}
    </>
  );
}