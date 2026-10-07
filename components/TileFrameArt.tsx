'use client';

import { memo, useId, type ReactNode } from 'react';

/*
 * Molduras do tile desenhadas em SVG (pedras, trigo, rede, ondas…).
 * O tile é sempre 3:4, então o desenho usa um quadro fixo de 300×400 esticado no tile inteiro.
 * Tudo é gerado por código com sorteio "fixo" (mesma semente = mesmo desenho em todo aparelho).
 */

const W = 300, H = 400, R = 56; // canto arredondado do tile (22px) nesta escala

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = { x: number; y: number; a: number; side: 't' | 'r' | 'b' | 'l' | 'c' };

/** Pontos igualmente espaçados num retângulo arredondado (inset a partir da borda), com o ângulo da tangente. */
function perimeter(inset: number, step: number, r = R - inset * 0.6): Pt[] {
  const x0 = inset, y0 = inset, x1 = W - inset, y1 = H - inset;
  const poly: [number, number, Pt['side']][] = [];
  const arc = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 10; i++) { const t = from + (i / 10) * (Math.PI / 2); poly.push([cx + r * Math.cos(t), cy + r * Math.sin(t), 'c']); }
  };
  poly.push([x0 + r, y0, 't']); poly.push([x1 - r, y0, 't']); arc(x1 - r, y0 + r, -Math.PI / 2);
  poly.push([x1, y1 - r, 'r']); arc(x1 - r, y1 - r, 0);
  poly.push([x0 + r, y1, 'b']); arc(x0 + r, y1 - r, Math.PI / 2);
  poly.push([x0, y0 + r, 'l']); arc(x0 + r, y0 + r, Math.PI);
  poly.push([x0 + r, y0, 't']);
  const segs = poly.slice(1).map((p, i) => ({ a: poly[i], b: p, len: Math.hypot(p[0] - poly[i][0], p[1] - poly[i][1]) }));
  const total = segs.reduce((s, x) => s + x.len, 0);
  const n = Math.max(4, Math.round(total / step));
  const out: Pt[] = [];
  let si = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    while (si < segs.length - 1 && acc + segs[si].len < d) { acc += segs[si].len; si++; }
    const s = segs[si], t = s.len ? (d - acc) / s.len : 0;
    out.push({ x: s.a[0] + (s.b[0] - s.a[0]) * t, y: s.a[1] + (s.b[1] - s.a[1]) * t, a: Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]), side: s.b[2] === 'c' ? 'c' : s.b[2] });
  }
  return out;
}

const rr = (inset: number, r = R - inset * 0.6) => ({ x: inset, y: inset, width: W - inset * 2, height: H - inset * 2, rx: Math.max(4, r) });
const deg = (rad: number) => (rad * 180) / Math.PI;
const star = (cx: number, cy: number, r: number, inner = 0.45, n = 5, rot = -Math.PI / 2) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const rad = i % 2 ? r * inner : r, t = rot + (i * Math.PI) / n;
    return `${(cx + rad * Math.cos(t)).toFixed(1)},${(cy + rad * Math.sin(t)).toFixed(1)}`;
  }).join(' ');

/* ---------------- cada moldura ---------------- */

function Pedras() {
  const r = rng(11);
  const pts = perimeter(10, 11);
  const tones = ['#d3cdc2', '#bdb7ac', '#a9a398', '#e2ddd2', '#9a948a'];
  const stones = pts.map((p) => {
    const size = 9 + r() * 6, n = 5 + Math.floor(r() * 3), rot = r() * Math.PI;
    // cristais alongados, apontando para fora, como pedras empilhadas
    const stretch = 1.2 + r() * 0.7, tilt = (r() - 0.5) * 0.9;
    const ca = Math.cos(p.a + Math.PI / 2 + tilt), sa = Math.sin(p.a + Math.PI / 2 + tilt);
    const v = Array.from({ length: n }, (_, i) => {
      const t = rot + (i / n) * Math.PI * 2, k = 0.72 + r() * 0.38;
      const lx = Math.cos(t) * size * k * stretch, ly = Math.sin(t) * size * k * 0.75;
      return [p.x + lx * ca - ly * sa, p.y + lx * sa + ly * ca] as [number, number];
    });
    return { v, fill: tones[Math.floor(r() * tones.length)], k: r(), facet: Math.floor(r() * n), h: r() };
  }).sort((a, b) => a.k - b.k);
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {stones.map((s, i) => {
        const cx = s.v.reduce((a, p) => a + p[0], 0) / s.v.length, cy = s.v.reduce((a, p) => a + p[1], 0) / s.v.length;
        const n = s.v.length, a = s.v[s.facet], b = s.v[(s.facet + 1) % n], c = s.v[(s.facet + 3) % n], d = s.v[(s.facet + 4) % n];
        // hachura (traço de desenho) na face escura
        const hatch = Array.from({ length: 3 }, (_, k) => {
          const t = 0.3 + k * 0.2;
          return [c[0] + (cx - c[0]) * t, c[1] + (cy - c[1]) * t, d[0] + (cx - d[0]) * t, d[1] + (cy - d[1]) * t];
        });
        return (
          <g key={i}>
            <polygon points={s.v.map((p) => p.join(',')).join(' ')} fill={s.fill} stroke="#2e2a26" strokeWidth={2.4} />
            <polygon points={`${a.join(',')} ${b.join(',')} ${cx},${cy}`} fill="#fff" opacity={0.45} />
            <polygon points={`${c.join(',')} ${d.join(',')} ${cx},${cy}`} fill="#5a544c" opacity={0.28} />
            <path d={`M${a.join(' ')} L${cx} ${cy} L${c.join(' ')}`} fill="none" stroke="#2e2a26" strokeWidth={1.1} opacity={0.7} />
            {s.h > 0.35 && hatch.map((h, k) => <line key={k} x1={h[0]} y1={h[1]} x2={h[2]} y2={h[3]} stroke="#2e2a26" strokeWidth={0.8} opacity={0.55} />)}
          </g>
        );
      })}
      <rect {...rr(21)} fill="none" stroke="#1f1b18" strokeWidth={3.2} />
    </g>
  );
}

function Trigo({ id }: { id: string }) {
  const r = rng(7);
  const pts = perimeter(11, 13);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6d77a" /><stop offset=".5" stopColor="#d9a520" /><stop offset="1" stopColor="#f3c64a" />
        </linearGradient>
      </defs>
      <rect {...rr(11)} fill="none" stroke={`url(#${id}g)`} strokeWidth={9} />
      {/* espiga trançada ao redor */}
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${deg(p.a)})`}>
          <ellipse cx={0} cy={-4} rx={7} ry={3.4} transform="rotate(-28)" fill="#e9b93c" stroke="#9a6b10" strokeWidth={1.2} />
          <ellipse cx={0} cy={4} rx={7} ry={3.4} transform="rotate(28)" fill="#f2cc5c" stroke="#9a6b10" strokeWidth={1.2} />
          {i % 3 === 0 && <line x1={6} y1={-3} x2={13 + r() * 4} y2={-9} stroke="#b88a1c" strokeWidth={1} />}
        </g>
      ))}
      <rect {...rr(21)} fill="none" stroke="#9a6b10" strokeWidth={1.6} />
    </g>
  );
}

function Pesca() {
  const pts = perimeter(10, 7);
  return (
    <g>
      {/* rede nos cantos de baixo */}
      {[0, 1].map((side) => (
        <g key={side} stroke="#1f6fa8" strokeWidth={1.1} opacity={0.6} transform={side ? `translate(${W} 0) scale(-1 1)` : undefined}>
          {Array.from({ length: 7 }, (_, i) => <line key={`a${i}`} x1={0} y1={H - 110 + i * 16} x2={110 - i * 16} y2={H} />)}
          {Array.from({ length: 7 }, (_, i) => <line key={`b${i}`} x1={i * 16} y1={H} x2={0} y2={H - i * 16} />)}
        </g>
      ))}
      {/* corda torcida */}
      <rect {...rr(10)} fill="none" stroke="#c9a46a" strokeWidth={10} />
      {pts.map((p, i) => (
        <line key={i} x1={p.x - 4} y1={p.y - 5} x2={p.x + 4} y2={p.y + 5} transform={`rotate(${deg(p.a)} ${p.x} ${p.y})`} stroke="#8a6a3a" strokeWidth={1.6} strokeLinecap="round" />
      ))}
      <rect {...rr(4.5)} fill="none" stroke="#6e5230" strokeWidth={1.2} />
      <rect {...rr(15.5)} fill="none" stroke="#6e5230" strokeWidth={1.2} />
      {/* boias */}
      {[[W / 2, 10], [10, H / 2], [W - 10, H / 2]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r={9} fill="#e8562e" stroke="#7a2618" strokeWidth={1.6} /><path d={`M${x - 9} ${y} h18`} stroke="#fff" strokeWidth={3} /></g>
      ))}
    </g>
  );
}

function Reino({ id }: { id: string }) {
  const pts = perimeter(10, 26);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0a8" /><stop offset=".35" stopColor="#d4a017" /><stop offset=".65" stopColor="#ffe08a" /><stop offset="1" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      <rect {...rr(9)} fill="none" stroke={`url(#${id}o)`} strokeWidth={12} />
      <rect {...rr(19)} fill="none" stroke="#7b3fa0" strokeWidth={3.5} />
      <rect {...rr(3.5)} fill="none" stroke="#8a6508" strokeWidth={1.2} />
      {pts.map((p, i) => (
        <g key={i}>
          <rect x={p.x - 4.5} y={p.y - 4.5} width={9} height={9} transform={`rotate(45 ${p.x} ${p.y})`} fill={i % 2 ? '#7b3fa0' : '#c8553d'} stroke="#8a6508" strokeWidth={1.2} />
          <circle cx={p.x - 1.5} cy={p.y - 1.5} r={1.4} fill="#fff" opacity={0.8} />
        </g>
      ))}
      {/* coroa no topo */}
      <g transform={`translate(${W / 2} 16)`}>
        <path d="M-26 8 L-30 -16 L-14 -4 L0 -22 L14 -4 L30 -16 L26 8 Z" fill={`url(#${id}o)`} stroke="#8a6508" strokeWidth={2} strokeLinejoin="round" />
        <circle cx={0} cy={-2} r={4} fill="#c8553d" stroke="#8a6508" strokeWidth={1} />
        <circle cx={-15} cy={1} r={2.6} fill="#7b3fa0" /><circle cx={15} cy={1} r={2.6} fill="#7b3fa0" />
      </g>
    </g>
  );
}

function Videira() {
  const r = rng(5);
  const pts = perimeter(12, 18);
  const vine = pts.map((p, i) => `${i ? 'L' : 'M'}${(p.x + Math.cos(p.a + Math.PI / 2) * Math.sin(i * 1.7) * 4).toFixed(1)} ${(p.y + Math.sin(p.a + Math.PI / 2) * Math.sin(i * 1.7) * 4).toFixed(1)}`).join(' ') + 'Z';
  const grapes = (x: number, y: number, s = 1) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -14 q6 -8 14 -6" stroke="#5b7a1e" strokeWidth={2} fill="none" />
      {[[0, -6], [-6, 0], [6, 0], [-3, 6], [3, 6], [0, 12], [-9, -6], [9, -6]].map(([gx, gy], k) => (
        <circle key={k} cx={gx} cy={gy} r={4.6} fill={k % 2 ? '#7d4ca3' : '#6a3a91'} stroke="#3e1f5c" strokeWidth={1} />
      ))}
      <path d="M8 -12 q12 -6 18 4 q-10 6 -18 -4z" fill="#7fa650" stroke="#3f5a24" strokeWidth={1} />
    </g>
  );
  return (
    <g>
      <path d={vine} fill="none" stroke="#5b7a1e" strokeWidth={3.5} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const out = i % 2 ? 1 : -1, ang = deg(p.a) + out * (40 + r() * 20);
        return (
          <path key={i} d="M0 0 q6 -8 15 -6 q-2 9 -15 6z" transform={`translate(${p.x} ${p.y}) rotate(${ang})`}
            fill={i % 3 ? '#7fa650' : '#9bbf63'} stroke="#3f5a24" strokeWidth={1} />
        );
      })}
      {grapes(22, H - 30, 1)}{grapes(W - 22, H - 30, 1)}{grapes(24, 70, 0.8)}
    </g>
  );
}

function Ondas({ id }: { id: string }) {
  const pts = perimeter(9, 24);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd3ff" /><stop offset="1" stopColor="#1f6fa8" />
        </linearGradient>
      </defs>
      <rect {...rr(9)} fill="none" stroke={`url(#${id}w)`} strokeWidth={14} />
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${deg(p.a)})`}>
          <path d="M-12 4 q0 -12 12 -12 q9 0 9 8 q0 6 -6 6 q-5 0 -5 -4" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={13} cy={-7} r={1.6} fill="#fff" />
        </g>
      ))}
      <rect {...rr(17)} fill="none" stroke="#1f6fa8" strokeWidth={1.6} />
    </g>
  );
}

function Estrelas() {
  const r = rng(21);
  const pts = perimeter(10, 15);
  return (
    <g>
      <rect {...rr(9)} fill="none" stroke="#1d2b5a" strokeWidth={15} />
      <rect {...rr(17.5)} fill="none" stroke="#f6d365" strokeWidth={1.4} opacity={0.8} />
      {pts.map((p, i) => {
        const s = i % 4 === 0 ? 6.5 : 2.4 + r() * 2.2;
        return i % 4 === 0
          ? <polygon key={i} points={star(p.x, p.y, s)} fill="#f6d365" stroke="#fff3b0" strokeWidth={0.8} />
          : <circle key={i} cx={p.x + (r() - 0.5) * 6} cy={p.y + (r() - 0.5) * 6} r={s / 2.4} fill="#fff3b0" opacity={0.6 + r() * 0.4} />;
      })}
      <path d={`M${W / 2 - 8} 9 a8 8 0 1 0 12 -6 a6 6 0 1 1 -12 6z`} fill="#fff3b0" />
    </g>
  );
}

function Ramos() {
  const pts = perimeter(12, 11);
  return (
    <g>
      <rect {...rr(12)} fill="none" stroke="#556b2f" strokeWidth={2.2} />
      {pts.map((p, i) => {
        const side = i % 2 ? 1 : -1;
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${deg(p.a) + side * 50})`}>
            <path d="M0 0 q6 -5 16 -2 q-8 6 -16 2z" fill={i % 3 ? '#9db36b' : '#7d9b4a'} stroke="#3f5a24" strokeWidth={0.9} />
          </g>
        );
      })}
      {/* azeitonas */}
      {pts.filter((_, i) => i % 7 === 3).map((p, i) => <ellipse key={i} cx={p.x} cy={p.y} rx={3.4} ry={4.4} fill="#4a3a5c" stroke="#2b2118" strokeWidth={0.8} />)}
      {/* laço embaixo */}
      <g transform={`translate(${W / 2} ${H - 11})`}>
        <path d="M0 0 q-16 -12 -22 0 q6 10 22 0z M0 0 q16 -12 22 0 q-6 10 -22 0z" fill="#c8553d" stroke="#7a2618" strokeWidth={1.2} />
        <circle r={4} fill="#a23f2b" />
      </g>
    </g>
  );
}

function Arca() {
  const r = rng(3);
  const pts = perimeter(10, 30);
  return (
    <g>
      <rect {...rr(10)} fill="none" stroke="#8b5a2b" strokeWidth={17} />
      <rect {...rr(4)} fill="none" stroke="#5c3a1a" strokeWidth={1.6} />
      <rect {...rr(18.5)} fill="none" stroke="#5c3a1a" strokeWidth={2.2} />
      {/* veios da madeira e juntas das tábuas */}
      <rect {...rr(8)} fill="none" stroke="#a87443" strokeWidth={1.4} strokeDasharray="22 6 9 5" />
      <rect {...rr(13)} fill="none" stroke="#6f4520" strokeWidth={1} strokeDasharray="14 9 30 6" opacity={0.7} />
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${deg(p.a)})`}>
          <line x1={0} y1={-8} x2={0} y2={8} stroke="#4a2c12" strokeWidth={1.6} />
          <circle cx={-5} cy={-4.5} r={1.5} fill="#3a2410" /><circle cx={-5} cy={4.5} r={1.5} fill="#3a2410" />
          {r() > 0.6 && <ellipse cx={8} cy={0} rx={3} ry={1.6} fill="none" stroke="#6f4520" strokeWidth={0.8} />}
        </g>
      ))}
      {/* pomba com o ramo no topo */}
      <g transform={`translate(${W / 2} 13)`}>
        <path d="M-14 2 q4 -12 16 -8 q6 -10 14 -4 q-8 2 -8 8 q-4 8 -16 6 q-6 0 -6 -2z" fill="#fff" stroke="#5c3a1a" strokeWidth={1.4} />
        <path d="M14 -2 q8 -2 10 4" stroke="#556b2f" strokeWidth={2} fill="none" />
        <ellipse cx={22} cy={1} rx={3} ry={1.6} fill="#7d9b4a" />
      </g>
    </g>
  );
}

function Tabua({ id }: { id: string }) {
  const r = rng(9);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#efe9dd" /><stop offset=".5" stopColor="#cfc6b6" /><stop offset="1" stopColor="#b3a998" />
        </linearGradient>
      </defs>
      <rect {...rr(10)} fill="none" stroke={`url(#${id}s)`} strokeWidth={18} />
      <rect {...rr(1.5)} fill="none" stroke="#7d7363" strokeWidth={1.6} />
      <rect {...rr(19)} fill="none" stroke="#7d7363" strokeWidth={2} />
      <rect {...rr(17)} fill="none" stroke="#fff" strokeWidth={1} opacity={0.7} />
      {/* rachaduras e marcas de cinzel */}
      {Array.from({ length: 16 }, (_, i) => {
        const p = perimeter(10, 40)[i % perimeter(10, 40).length];
        const l = 4 + r() * 6;
        return <path key={i} d={`M${p.x} ${p.y} l${(r() - 0.5) * l} ${(r() - 0.5) * l} l${(r() - 0.5) * l} ${(r() - 0.5) * l}`} stroke="#8a806f" strokeWidth={0.9} fill="none" />;
      })}
      {/* duas tábuas no topo */}
      <g transform={`translate(${W / 2} 16)`}>
        {[-1, 1].map((s) => (
          <g key={s} transform={`translate(${s * 11} 0)`}>
            <path d="M-9 10 V-6 a9 9 0 0 1 18 0 V10z" fill={`url(#${id}s)`} stroke="#6e6556" strokeWidth={1.5} />
            {[-3, 1, 5].map((y) => <line key={y} x1={-5} x2={5} y1={y} y2={y} stroke="#6e6556" strokeWidth={1} />)}
          </g>
        ))}
      </g>
    </g>
  );
}

function Alianca() {
  const bands = ['#ff6b6b', '#ffb347', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
  const cloud = (x: number, y: number, flip = false) => (
    <g transform={`translate(${x} ${y}) ${flip ? 'scale(-1 1)' : ''}`}>
      <path d="M-26 8 a10 10 0 0 1 4 -18 a13 13 0 0 1 24 -4 a10 10 0 0 1 16 8 a8 8 0 0 1 2 14z" fill="#fff" stroke="#c9d6e3" strokeWidth={1.5} />
    </g>
  );
  return (
    <g>
      {bands.map((c, i) => <rect key={c} {...rr(3 + i * 3)} fill="none" stroke={c} strokeWidth={3.2} />)}
      {cloud(26, H - 16)}{cloud(W - 26, H - 16, true)}
      <polygon points={star(W / 2, 11, 7)} fill="#ffe066" stroke="#e0a800" strokeWidth={1} />
    </g>
  );
}

const ART: Record<string, (p: { id: string }) => ReactNode> = {
  'tf-pedras': Pedras,
  'tf-trigo': Trigo,
  'tf-pesca': Pesca,
  'tf-reino': Reino,
  'tf-videira': Videira,
  'tf-ondas': Ondas,
  'tf-estrelas': Estrelas,
  'tf-ramos': Ramos,
  'tf-arca': Arca,
  'tf-tabua': Tabua,
  'tf-alianca': Alianca,
};

export const hasFrameArt = (frame: string | null | undefined) => !!frame && frame in ART;

export const TileFrameArt = memo(function TileFrameArt({ frame }: { frame: string }) {
  const id = useId().replace(/:/g, '');
  const Art = ART[frame];
  if (!Art) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 z-[2] h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden
      style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,.25))' }}>
      <g transform={`translate(${W / 2} ${H / 2}) scale(1.045) translate(${-W / 2} ${-H / 2})`}><Art id={id} /></g>
    </svg>
  );
});
