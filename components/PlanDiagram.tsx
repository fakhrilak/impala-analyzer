'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type N = { id: number; title: string; sub: string; children: number[]; info: string; rows: number | null; maxMs: number | null; avgMs: number | null; instances: number };
const W = 250, H = 82, GX = 40, GY = 80, PAD = 30;

const fmtMs = (ms: number | null) =>
  ms === null ? '-' : ms >= 1000 ? `${Math.floor(ms / 1000)}s ${Math.round(ms % 1000)}ms` : `${ms.toFixed(3)}ms`;

const heatColor = (h: number, title: string) => {
  if (title.includes('EXCHANGE')) return '#000000';
  if (h <= 0) return '#3A120A'; 
  const t = Math.pow(Math.min(1, h), 0.85);
  const r = Math.round(58 + (255 - 58) * t);
  const g = Math.round(18 + (77 - 18) * t);
  const b = Math.round(10 + (34 - 10) * t);
  return `rgb(${r},${g},${b})`;
};

const cut = (s: string, n = 36) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export default function PlanDiagram({ plan, sql }: { plan: { nodes: N[]; root: number | null; secondary: number[] }, sql?: string }) {
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const centerView = () => {
    if (!L || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTransform({ x: (rect.width - L.w) / 2, y: 40, scale: 1 });
  };

  useEffect(() => { centerView(); }, [L]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); 
      setTransform(t => {
        if (e.ctrlKey || e.metaKey) {
          const zoomFactor = Math.exp(-e.deltaY * 0.01);
          const newScale = Math.min(Math.max(0.1, t.scale * zoomFactor), 5); 
          const rect = el.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const dx = (mouseX - t.x) * (newScale / t.scale - 1);
          const dy = (mouseY - t.y) * (newScale / t.scale - 1);
          return { x: t.x - dx, y: t.y - dy, scale: newScale };
        } else {
          return { ...t, x: t.x - e.deltaX, y: t.y - e.deltaY };
        }
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!L) return null;

  return (
    <div style={{ marginTop: 16, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Tampilan SQL Snippet */}
      {sql && (
        <div style={{
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          color: '#8A94A6',
          background: '#14191F',
          padding: '8px 12px',
          borderRadius: 4,
          border: '1px solid #232b35',
          marginBottom: 12,
          maxHeight: 60,
          overflow: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {sql}
        </div>
      )}

      {/* Header dengan Hint Bantuan & Tombol Reset */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: '#8A94A6' }}>
          <b>Pinch / Ctrl+Scroll</b> to zoom &nbsp;&bull;&nbsp; <b>Swipe / Drag</b> to pan
        </span>
        <button 
          onClick={centerView}
          style={{ background: '#192027', border: '1px solid #3c454e', color: '#fff', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
        >
          Reset View
        </button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ 
          width: '100%', 
          height: '70vh', 
          minHeight: 500,
          background: '#14191F', 
          borderRadius: 6, 
          border: '1px solid #232b35',
          overflow: 'hidden', 
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none'
        }}
      >
        <svg width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <marker id="plan-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: '#555D68' }} />
            </marker>
            <marker id="plan-arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: '#E43831' }} />
            </marker>
          </defs>
          
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
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
                      {c.rows.toLocaleString('en-US')}
                    </text>
                  )}
                </g>
              );
            }))}
            
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
          </g>
        </svg>
      </div>
    </div>
  );
}