import { Pool } from 'pg';
import { COLS, DEFAULT_VISIBLE, typeOf } from './columns';

export type Filter = { col: string; op: string; val: string };
const NUM_OPS: Record<string, string> = { '=': '=', '>': '>', '<': '<', '>=': '>=', '<=': '<=' };

function colExpr(col: string, params: any[]): string {
  if (col === 'cluster') return 'c.name';
  if (COLS.some((c) => c.key === col)) return `q.${col}`;
  if (col.startsWith('summary.')) { params.push(col.slice(8)); return `(q.summary->>$${params.length}::text)`; }
  if (col.startsWith('counter.')) { params.push(col.slice(8)); return `((q.counters->>$${params.length}::text)::double precision)`; }
  throw new Error('Kolom tidak valid: ' + col);
}
const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&');

function buildWhere(filters: Filter[], clusterId: number | undefined, params: any[]) {
  const w: string[] = [];
  if (clusterId) { params.push(clusterId); w.push(`q.cluster_id=$${params.length}`); }
  for (const f of filters || []) {
    const e = colExpr(f.col, params);
    if (typeOf(f.col) === 'num') {
      const n = Number(f.val), op = NUM_OPS[f.op];
      if (!isFinite(n) || !op) throw new Error(`Filter tidak valid: ${f.col} ${f.op} ${f.val}`);
      params.push(n); w.push(`${e} ${op} $${params.length}`);
    } else {
      const contains = f.op.includes('Contains');
      params.push(contains ? `%${esc(f.val)}%` : f.val);
      const p = `$${params.length}::text`;
      if (f.op === 'Contains') w.push(`${e} ILIKE ${p}`);
      else if (f.op === 'Not Contains') w.push(`COALESCE(${e},'') NOT ILIKE ${p}`);
      else if (f.op === 'Equals') w.push(`${e} = ${p}`);
      else if (f.op === 'Not Equals') w.push(`${e} IS DISTINCT FROM ${p}`);
      else throw new Error('Operator tidak valid: ' + f.op);
    }
  }
  return w.length ? 'WHERE ' + w.join(' AND ') : '';
}

export async function runQuery(db: Pool, b: any, page: number, pageSize: number | null) {
  const cols: string[] = (b.columns?.length ? b.columns : DEFAULT_VISIBLE).filter((x: string) => x !== 'per_node_memory');
  const params: any[] = [];
  const sel = cols.map((c, i) => `${colExpr(c, params)} AS "c${i}"`);
  const where = buildWhere(b.filters, b.clusterId ? Number(b.clusterId) : undefined, params);
  const sc = b.sort?.col ? colExpr(b.sort.col, params) : 'q.start_time';
  const dir = b.sort?.dir === 'asc' ? 'ASC' : 'DESC';
  const from = `FROM queries q JOIN clusters c ON c.id=q.cluster_id ${where}`;
  const cnt = params.slice();
  // count query hanya memakai parameter filter -> bangun ulang tanpa select/sort
  const cp: any[] = [];
  const cwhere = buildWhere(b.filters, b.clusterId ? Number(b.clusterId) : undefined, cp);
  const total = (await db.query(`SELECT count(*)::int AS n FROM queries q JOIN clusters c ON c.id=q.cluster_id ${cwhere}`, cp)).rows[0].n;
  const lim = pageSize ? `LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}` : 'LIMIT 100000';
  const { rows } = await db.query(
    `SELECT q.cluster_id AS _cid, q.query_id AS _qid, ${sel.join(', ')} ${from} ORDER BY ${sc} ${dir} NULLS LAST ${lim}`, params);
  void cnt;
  return {
    total, cols,
    rows: rows.map((r) => { const o: any = { _cid: r._cid, _qid: r._qid }; cols.forEach((c, i) => (o[c] = r['c' + i])); return o; }),
  };
}
