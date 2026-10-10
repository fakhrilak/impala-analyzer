'use client';
import { useMemo } from 'react';

type N = { id: number; title: string; sub: string; children: number[]; info: string; rows: number | null; maxMs: number | null; avgMs: number | null; instances: number };
const W = 250, H = 82, GX = 40, GY = 80, PAD = 30;

const fmtMs = (ms: number | null) =>
  ms === null ? '-' : ms >= 1000 ? `${Math.floor(ms / 1000)}s ${Math.round(ms % 1000)}ms` : `${ms.toFixed(3)}ms`;

// Memetakan secara persis spektrum gradasi/heat dari gambar referensi (watermarked_img_7450082551830787667.jpg)
const heatColor = (h: number, title: string) => {
  // EXCHANGE selalu dirender hitam pekat sesuai gambar referensi
  if (title.includes('EXCHANGE')) return '#000000';
  
  // Jika maxMs kosong/null (h=0) tapi bukan EXCHANGE, beri warna dark burgundy sebagai default
  if (h <= 0) return '#3A120A'; 

  // Interpolasi warna dari Merah Tua/Burgundy (#3A120A) ke Oranye Menyala (#FF4D22)
  const t = Math.pow(Math.min(1, h), 0.85);
  const r = Math.round(58 + (255 - 58) * t);   // 58 -> 255
  const g = Math.round(18 + (77 - 18) * t);    // 18 -> 77
  const b = Math.round(10 + (34 - 10) * t);    // 10 -> 34
  return `rgb(${r},${g},${b})`;
};

const cut = (s: string, n = 36) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export default function PlanDiagram({ plan }: { plan: { nodes: N[]; root: number | null; secondary: number[] } }) {
  const L = useMemo(() => {
    if (plan.root === null) return null;
    const byId = new Map<number, N>(plan.nodes.map((n) => [n.id, n]));
    const wc = new Map<number, number>();
    const width = (id: number): number => {
      if (wc.has(id)) return wc.get(id)!;
      const ch = byId.get(id)!.children;
      const w = ch.length ? Math.max(W, ch.reduce((s, c) => s + width(c), 0) + GX * (ch.length - 1)) : W;
      wc.set(id, w); return w;
    };
    const pos = new Map<number, { x: number; y: number }>();
    let depth = 0;
    const place = (id: number, left: number, d: number) => {
      const w = width(id), ch = byId.get(id)!.children;
      pos.set(id, { x: left + w / 2 - W / 2, y: PAD + d * (H + GY) });
      depth = Math.max(depth, d);
      const total = ch.reduce((s, c) => s + width(c), 0) + GX * Math.max(0, ch.length - 1);
      let x = left + (w - total) / 2;
      for (const c of ch) { place(c, x, d + 1); x += width(c) + GX; }
    };
    place(plan.root, PAD, 0);
    const maxMs = Math.max(1, ...plan.nodes.map((n) => n.maxMs || 0));
    return { byId, pos, maxMs, w: width(plan.root) + PAD * 2, h: PAD * 2 + (depth + 1) * H + depth * GY };
  }, [plan]);
  if (!L) return null;
  const sec = new Set(plan.secondary);

  return (
    <div style={{ marginTop: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Container dengan warna background gelap menyesuaikan screenshot terbaru Anda */}
      <div style={{ overflow: 'auto', background: '#192027', borderRadius: 6, padding: '32px 24px', border: '1px solid #232b35' }}>
        <svg width={L.w} height={L.h} style={{ display: 'block', minWidth: '100%' }}>
          <defs>
            <marker id="plan-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: '#555D68' }} />
            </marker>
            <marker id="plan-arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: '#E43831' }} />
            </marker>
          </defs>
          
          {/* Garis & Panah */}
          {plan.nodes.flatMap((p) => p.children.map((cid) => {
            const c = L.byId.get(cid)!, pp = L.pos.get(p.id), cp = L.pos.get(cid);
            if (!pp || !cp) return null;
            
            const cx = cp.x + W / 2, cy = cp.y, px = pp.x + W / 2, py = pp.y + H, mid = py + (cy - py) / 2;
            const red = p.title.includes('EXCHANGE');
            
            return (
              <g key={p.id + '-' + cid}>
                <path 
                  d={`M${cx},${cy} V${mid} H${px} V${py + 2}`} 
                  fill="none" 
                  markerEnd={`url(#${red ? 'plan-arrow-red' : 'plan-arrow'})`}
                  strokeDasharray={red ? '4 4' : undefined} 
                  strokeWidth={1.5}
                  stroke={red ? '#E43831' : '#555D68'} 
                />
                {c.rows !== null && (
                  <text x={cx + 8} y={cy - 20} fontSize={10} fill="#8A94A6" fontWeight={500}>
                    {c.rows.toLocaleString('id-ID')}
                  </text>
                )}
              </g>
            );
          }))}
          
          {/* Node Kotak */}
          {plan.nodes.map((n) => {
            const p = L.pos.get(n.id);
            if (!p) return null;
            
            const lines: { t: string; s: number; fw: number }[] = [{ t: n.title.toUpperCase(), s: 13, fw: 800 }];
            if (n.sub) lines.push({ t: cut(n.sub.toUpperCase()), s: 11, fw: 700 });
            if (n.instances) lines.push({ t: `${n.instances} instance${n.instances > 1 ? 's' : ''}`, s: 11, fw: 500 });
            if (n.maxMs !== null) lines.push({ t: `Max: ${fmtMs(n.maxMs)}, avg: ${fmtMs(n.avgMs)}`, s: 11, fw: 500 });
            
            const totalH = lines.length * 16;
            const y0 = p.y + (H - totalH) / 2 + 12;
            
            return (
              <g key={n.id}>
                <title>{`${n.title}${n.sub ? ' [' + n.sub + ']' : ''}\n${n.info}`}</title>
                <rect 
                  x={p.x} y={p.y} width={W} height={H} rx={4} 
                  fill={heatColor((n.maxMs || 0) / L.maxMs, n.title)} 
                  stroke="#11161A" strokeWidth={1} 
                />
                {lines.map((l, i) => (
                  <text key={i} x={p.x + W / 2} y={y0 + i * 16} textAnchor="middle" fontSize={l.s} fontWeight={l.fw} fill="#ffffff">
                    {l.t}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}