// Port dari parser Python (Streamlit) + ekstraksi seluruh field Summary & semua counter.
const BYTE_COLS = new Set(['ScratchBytesWritten','ScratchFileUsedBytes','ScratchBytesRead','PeakUnpinnedBytes','WriteIoBytes','PeakReservation','ReservationLimit','PeakMemoryUsage','PerHostPeakMemUsage','DataCacheHitBytes','DataCacheMissBytes']);
const SCRATCH = new Set(['ScratchBytesWritten','ScratchFileUsedBytes','ScratchWrites','ScratchBytesRead']);
const MAX_BUFFER = new Set(['PeakUnpinnedBytes','PeakReservation','ReservationLimit','PeakMemoryUsage','PerHostPeakMemUsage']);
const ALL_COUNTERS = new Set([...SCRATCH, 'WriteIoBytes','WriteIoOps','DataCacheHitBytes','DataCacheMissBytes','DataCacheHitCount','DataCacheMissCount', ...MAX_BUFFER]);
const TYPED: Record<string, string> = {
  ScratchBytesWritten: 'scratch_bytes_written_mb', ScratchFileUsedBytes: 'scratch_file_used_bytes_mb', ScratchWrites: 'scratch_writes',
  ScratchBytesRead: 'scratch_bytes_read_mb', PeakUnpinnedBytes: 'peak_unpinned_bytes_mb', WriteIoBytes: 'write_io_bytes_mb',
  WriteIoOps: 'write_io_ops', PeakReservation: 'peak_reservation_mb', ReservationLimit: 'reservation_limit_mb',
  PeakMemoryUsage: 'peak_memory_usage_mb', PerHostPeakMemUsage: 'per_host_peak_mem_usage_mb',
  DataCacheHitBytes: 'data_cache_hit_bytes_mb', DataCacheMissBytes: 'data_cache_miss_bytes_mb',
  DataCacheHitCount: 'data_cache_hit_count', DataCacheMissCount: 'data_cache_miss_count',
};

const QUERY_ID_RE = /Query \(id=([0-9a-fA-F]+:[0-9a-fA-F]+)\)/;
const SQL_START_RE = /^\s*Sql Statement:\s?(.*)$/;
const SQL_END_RE = /^ {4}(Coordinator|Query Options[^:]*|Plan|Estimated Per-Host Mem|Request Pool|Catalog Server Operation|Query Compilation):/;
const HEADER_RE = /^\s+([A-Za-z_]+(?: \([a-z_]+=\d+\))?)(?: \[\d+ instances\])?:(?:\(Total.*)?$/;
const EXEC_OPTION_RE = /^\s*ExecOption:\s*(.*)$/;
const COUNTER_RE = /^\s*-\s+([A-Za-z0-9_]+):\s*(.+)$/;
const VALUE_RE = /^([\d.]+)\s*([A-Za-z]*)(?:\s*\((\d+)\))?/;
const INSTANCE_RE = /Instance [a-zA-Z0-9:]+ \(host=([a-zA-Z0-9.-]+:[0-9]+)\)/;
const TIME_RE = /^(?:\d+(?:\.\d+)?(?:ns|us|ms|s|m|h))+$/;
const UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
const SUFFIX: Record<string, number> = { K: 1000, M: 1e6, G: 1e9 };
const MS: Record<string, number> = { ns: 1e-6, us: 1e-3, ms: 1, s: 1e3, m: 6e4, h: 36e5 };

export function parseValue(raw: string): number | null {
  const m = VALUE_RE.exec(raw.trim());
  if (!m) return null;
  const [, num, unit, exact] = m;
  if (exact !== undefined) return parseInt(exact, 10);
  const n = parseFloat(num);
  if (isNaN(n)) return null;
  const u = unit.toUpperCase();
  return Math.trunc(n * (UNITS[u] ?? SUFFIX[u] ?? 1));
}
function parseTimeMs(tok: string): number {
  let ms = 0;
  for (const m of tok.matchAll(/(\d+(?:\.\d+)?)(ns|us|ms|s|m|h)/g)) ms += parseFloat(m[1]) * MS[m[2]];
  return ms;
}
const unescapeHtml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const round2 = (v: number) => Math.round(v * 100) / 100;
const humanBytes = (v: number) => {
  for (const u of ['B', 'KB', 'MB', 'GB', 'TB']) { if (v < 1024 || u === 'TB') return `${v.toFixed(2)} ${u}`; v /= 1024; }
  return `${v.toFixed(2)} B`;
};

export type Parsed = { query_id: string; row: Record<string, any>; summary: Record<string, string>; counters: Record<string, number> };

export function parseProfile(rawText: string): Parsed {
  const text = unescapeHtml(rawText);
  const qm = QUERY_ID_RE.exec(text);
  if (!qm) throw new Error('Bukan format profile Impala');
  const lines = text.split(/\r?\n/);

  // SQL
  const sql: string[] = [];
  let inSql = false;
  for (const line of lines) {
    if (inSql) { if (SQL_END_RE.test(line)) break; sql.push(line); }
    else { const sm = SQL_START_RE.exec(line); if (sm) { inSql = true; sql.push(sm[1]); } }
  }
  const sqlClean = sql.filter((l) => !l.trim().startsWith('--')).join(' ').split(/\s+/).filter(Boolean).join(' ');

  const mk = () => ({ node: {} as Record<string, number>, frag: {} as Record<string, number> });
  const data = mk(), generic = mk();
  const seen = { node: new Set<string>(), frag: new Set<string>() };
  const execOpts: string[] = [];
  const summary: Record<string, string> = {};
  const nodeMem: Record<string, number> = {};
  let inExec = false, skip = false, scope: 'node' | 'frag' = 'frag', lastHeader = '', sqlActive = false;
  let clusterMem = 0, memLimit = 0, executorGroup = '-', queryStatus = '-', admission = '-', perNodeSummary = '', host = '', startTime = '-';

  for (const line of lines) {
    if (!sqlActive && SQL_START_RE.test(line)) { sqlActive = true; continue; }
    if (sqlActive) { if (SQL_END_RE.test(line)) sqlActive = false; else continue; }

    const s = line.trim();
    const indent = line.length - line.replace(/^ +/, '').length;
    if (indent <= 4 && s !== '') host = '';

    if (!inExec && indent === 4) {
      const sm = /^ {4}([A-Za-z][^:]*?):\s+(\S.*)$/.exec(line);
      if (sm) summary[sm[1]] = sm[2].trim();
    }
    if (s.startsWith('Start Time:')) startTime = s.split(':').slice(1).join(':').trim();
    else if (s.startsWith('Cluster Memory Admitted:')) { const v = parseValue(s.split(':')[1]); if (v !== null) clusterMem = v; }
    else if (s.startsWith('Executor Group:')) executorGroup = s.split(':').slice(1).join(':').trim();
    else if (s.startsWith('Query Status:')) queryStatus = s.split(':').slice(1).join(':').trim();
    else if (s.startsWith('Admission result:')) admission = s.split(':').slice(1).join(':').trim();
    else if (s.startsWith('Per Node Peak Memory Usage:')) {
      const raw = s.split(':').slice(1).join(':').trim();
      perNodeSummary = [...raw.matchAll(/(\S+?)\(([^)]+)\)/g)].map((m) => `${m[1].split('.')[0]}(${m[2]})`).join('; ');
    }
    if (s.includes('MEM_LIMIT=') || s.includes('Mem Limit:')) {
      const m1 = /MEM_LIMIT=([\d.]+[a-zA-Z]*)/i.exec(s), m2 = /Mem Limit:\s*([\d.]+[a-zA-Z]*)/i.exec(s);
      const v = m1 ? parseValue(m1[1]) : m2 ? parseValue(m2[1]) : null;
      if (v !== null) memLimit = v;
    }
    const im = INSTANCE_RE.exec(line);
    if (im) { host = im[1].split('.')[0]; if (!(host in nodeMem)) nodeMem[host] = 0; }
    if (host && (s.startsWith('- PerHostPeakMemUsage:') || s.startsWith('- PeakMemoryUsage:'))) {
      const v = parseValue(s.split(':')[1]);
      if (v !== null) nodeMem[host] = Math.max(nodeMem[host], v);
    }

    if (/^ {2}Execution Profile/.test(line)) { inExec = true; continue; }
    if (!inExec) continue;
    if (/^ {4}\S/.test(line)) { const n = s; skip = n.startsWith('Averaged Fragment'); scope = n.startsWith('Per Node Profiles') ? 'node' : 'frag'; continue; }
    if (skip) continue;
    const hm = HEADER_RE.exec(line);
    if (hm) { lastHeader = hm[1]; continue; }
    const om = EXEC_OPTION_RE.exec(line);
    if (om) { if (om[1].toLowerCase().includes('spill')) execOpts.push(`${lastHeader}: ${om[1].trim()}`); continue; }

    const cm = COUNTER_RE.exec(line);
    if (!cm) continue;
    const name = cm[1];
    const tok = cm[2].trim().split(/[\s(]/)[0];
    const val = TIME_RE.test(tok) ? parseTimeMs(tok) : parseValue(cm[2]);
    if (val === null) continue;

    const gmax = /^Peak|Limit$|^Max/.test(name) || MAX_BUFFER.has(name);
    generic[scope][name] = gmax ? Math.max(generic[scope][name] ?? 0, val) : (generic[scope][name] ?? 0) + val;
    if (ALL_COUNTERS.has(name)) {
      seen[scope].add(name);
      data[scope][name] = MAX_BUFFER.has(name) ? Math.max(data[scope][name] ?? 0, val) : (data[scope][name] ?? 0) + val;
    }
  }

  const pick = (name: string) => {
    for (const sc of (SCRATCH.has(name) ? ['node', 'frag'] : ['frag', 'node']) as ('node' | 'frag')[])
      if (seen[sc].has(name)) return data[sc][name];
    return 0;
  };

  let perNode = '-';
  if (perNodeSummary) perNode = perNodeSummary;
  else {
    const l = Object.entries(nodeMem).filter(([, v]) => v > 0).map(([n, v]) => `${n}(${humanBytes(v)})`);
    if (l.length) perNode = l.join('; ');
  }

  const row: Record<string, any> = {
    query_id: qm[1], sql_statement: sqlClean, start_time: startTime, executor_group: executorGroup,
    query_status: queryStatus, admission_result: admission, per_node_memory: perNode,
    mem_limit_mb: memLimit ? round2(memLimit / 1048576) : 0, cluster_mem_admitted_mb: clusterMem ? round2(clusterMem / 1048576) : 0,
    exec_option: [...new Set(execOpts)].join('; ') || '-',
  };
  for (const c of ALL_COUNTERS) { const v = pick(c); row[TYPED[c]] = BYTE_COLS.has(c) ? round2(v / 1048576) : v; }

  return { query_id: qm[1], row, summary, counters: { ...generic.node, ...generic.frag } };
}
