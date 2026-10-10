export type PlanNode = {
  id: number; title: string; sub: string; fragment: string; children: number[];
  info: string; rows: number | null; maxMs: number | null; avgMs: number | null; instances: number;
};
export type Plan = { nodes: PlanNode[]; root: number | null; secondary: number[] };

const OP_RE = /^([|\-\s]*)(\d+):([A-Z][A-Z0-9 \-]*?)(?:\s+\[(.*)\])?\s*$/;
const FRAG_RE = /^[|\-\s]*F(\d+):PLAN FRAGMENT/;
const NODE_RE = /^\s+([A-Z_]+_NODE) \(id=(\d+)\):\(Total: ([^,)]+)(?:, non-child: ([^,)]+))?/;
const HEADER_RE = /^\s+([A-Za-z_]+(?: \([a-z_]+=\d+\))?)(?: \[\d+ instances\])?:(?:\(Total.*)?$/;
const MS: Record<string, number> = { ns: 1e-6, us: 1e-3, ms: 1, s: 1e3, m: 6e4, h: 36e5 };

const unescapeHtml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function parseMs(t: string): number {
  let ms = 0;
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)(ns|us|ms|s|m|h)/g)) ms += parseFloat(m[1]) * MS[m[2]];
  return ms;
}
function parseCount(v: string): number | null {
  const e = /\((\d+)\)\s*$/.exec(v.trim());
  if (e) return parseInt(e[1], 10);
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function planLines(lines: string[]): string[] {
  const i = lines.findIndex((l) => /^\s*Plan:\s*$/.test(l));
  if (i < 0) return [];
  const out: string[] = [];
  let dashes = 0;
  for (let j = i + 1; j < lines.length; j++) {
    if (/^\s*-{10,}\s*$/.test(lines[j])) { if (++dashes === 2) break; continue; }
    if (dashes === 1) out.push(lines[j]);
  }
  return out;
}

export function parsePlan(raw: string): Plan | null {
  const lines = unescapeHtml(raw).split(/\r?\n/);
  const nodes = new Map<number, PlanNode>();
  const secondary: number[] = [];
  const lastAtCol: Record<number, number> = {};
  let root: number | null = null, frag = '', last: PlanNode | null = null, prevId: number | null = null;


  for (const line of planLines(lines)) {
    const fm = FRAG_RE.exec(line);
    if (fm) { frag = 'F' + fm[1]; last = null; continue; }
    const m = OP_RE.exec(line);
    if (!m) {
      const t = line.replace(/^[|\s]*/, '').trim();
      if (last && t) last.info += (last.info ? '\n' : '') + t;
      continue;
    }
    const prefix = m[1], col = prefix.length, isSec = prefix.endsWith('--');
    const id = parseInt(m[2], 10);
    let sub = m[4] || '';
    const name = m[3].trim();
    if (name.startsWith('SCAN') && sub.includes(',')) sub = sub.slice(0, sub.lastIndexOf(',')); // buang info partisi
    const node: PlanNode = { id, title: `${m[2]}:${name}`, sub, fragment: frag, children: [], info: '', rows: null, maxMs: null, avgMs: null, instances: 0 };
    nodes.set(id, node);
    const parentId = (isSec ? lastAtCol[col - 3] : lastAtCol[col]) ?? prevId ?? undefined;
    if (parentId !== undefined && parentId !== id) { nodes.get(parentId)!.children.push(id); if (isSec) secondary.push(id); }
    else if (root === null) root = id;
    lastAtCol[col] = id;
    for (const k of Object.keys(lastAtCol)) if (Number(k) > col) delete lastAtCol[Number(k)];
    last = node;
    prevId = id;
  }
  if (!nodes.size) return null;

  // sisi build join (secondary) diletakkan di kanan
  const sec = new Set(secondary);
  for (const n of nodes.values()) n.children.sort((a, b) => Number(sec.has(a)) - Number(sec.has(b)));

  // waktu (non-child) & rows aktual dari Execution Profile
  const times = new Map<number, number[]>(), rows = new Map<number, number>();
  let inExec = false, skip = false, cur: number | null = null;
  for (const line of lines) {
    if (/^ {2}Execution Profile/.test(line)) { inExec = true; continue; }
    if (!inExec) continue;
    if (/^ {4}\S/.test(line)) { skip = line.trim().startsWith('Averaged Fragment'); cur = null; continue; }
    if (skip) continue;
    const nm = NODE_RE.exec(line);
    if (nm) {
      cur = parseInt(nm[2], 10);
      const arr = times.get(cur) || [];
      arr.push(parseMs(nm[4] ?? nm[3]));
      times.set(cur, arr);
      continue;
    }
    if (HEADER_RE.test(line)) { cur = null; continue; }
    if (cur !== null) {
      const rm = /^\s*-\s+RowsReturned:\s*(.+)$/.exec(line);
      if (rm) { const v = parseCount(rm[1]); if (v !== null) rows.set(cur, (rows.get(cur) || 0) + v); }
    }
  }
  for (const n of nodes.values()) {
    const t = times.get(n.id);
    if (t?.length) { n.maxMs = Math.max(...t); n.avgMs = t.reduce((a, b) => a + b, 0) / t.length; n.instances = t.length; }
    n.rows = rows.get(n.id) ?? null;
  }
  return { nodes: [...nodes.values()], root, secondary };
}