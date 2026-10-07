'use client';

import { memo, useId, type ReactNode } from 'react';

/*
 * Molduras de perfil desenhadas em SVG (no lugar do anel colorido com emoji).
 * Quadro de 100×100 = o tamanho externo do avatar com moldura (o mesmo de antes, então nada sai do lugar).
 * A foto ocupa o círculo de raio `pr` no centro; o anel vai de pr até 50 e os enfeites podem passar um pouco para fora.
 */

const C = 50;

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
const rad = (deg: number) => (deg * Math.PI) / 180;
/** ponto no círculo (0° = topo, sentido horário) */
const at = (r: number, deg: number) => ({ x: C + r * Math.sin(rad(deg)), y: C - r * Math.cos(rad(deg)) });
const around = (n: number, from = 0, to = 360) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (to - from >= 360 ? n : Math.max(1, n - 1)));
const star = (cx: number, cy: number, r: number, inner = 0.45, n = 5) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const rr = i % 2 ? r * inner : r, t = -Math.PI / 2 + (i * Math.PI) / n;
    return `${(cx + rr * Math.cos(t)).toFixed(2)},${(cy + rr * Math.sin(t)).toFixed(2)}`;
  }).join(' ');
const leaf = 'M0 0 q2.6 -3.4 7 -2.4 q-1.4 3.8 -7 2.4z';

type P = { id: string; pr: number };
const band = (pr: number) => ({ r: (pr + 50) / 2, w: 50 - pr });

/* ---------------- molduras ---------------- */

function Semente({ pr }: P) {
  const { r, w } = band(pr);
  return (
    <g>
      <circle cx={C} cy={C} r={r} fill="none" stroke="#8a6a44" strokeWidth={w} />
      <circle cx={C} cy={C} r={r} fill="none" stroke="#6f532f" strokeWidth={w * 0.25} strokeDasharray="1.2 3.4" opacity={0.6} />
      {[200, 160, 245, 115].map((d, i) => {
        const p = at(50, d);
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${d + 180})`}>
            <path d="M0 0 V-9" stroke="#4f7d3a" strokeWidth={1.4} strokeLinecap="round" />
            <path d={leaf} transform="translate(0 -7) rotate(-35) scale(1.1)" fill="#8bbf6a" stroke="#3f5a24" strokeWidth={0.5} />
            <path d={leaf} transform="translate(0 -6) scale(-1.1 1.1) rotate(-35)" fill="#7aab57" stroke="#3f5a24" strokeWidth={0.5} />
          </g>
        );
      })}
    </g>
  );
}

function Peixes({ id, pr }: P) {
  const { r, w } = band(pr);
  return (
    <g>
      <defs><linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9fd9f5" /><stop offset="1" stopColor="#1f6fa8" /></linearGradient></defs>
      <circle cx={C} cy={C} r={r} fill="none" stroke={`url(#${id}p)`} strokeWidth={w} />
      {around(14).map((d, i) => {
        const p = at(r, d);
        return <path key={i} d="M-2.4 0.8 q1.2 -2.4 2.4 0 q1.2 2.4 2.4 0" transform={`translate(${p.x} ${p.y}) rotate(${d + 90})`} fill="none" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" opacity={0.85} />;
      })}
      {[[235, 1], [110, -1]].map(([d, s], i) => {
        const p = at(51, d);
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${d + 90}) scale(${s} 1)`}>
            <path d="M-6 0 q4 -4.5 9 0 q-5 4.5 -9 0z M3 0 l4 -3 v6z" fill="#ffb347" stroke="#b5651d" strokeWidth={0.6} />
            <circle cx={-3.4} cy={-0.6} r={0.7} fill="#2b2118" />
          </g>
        );
      })}
    </g>
  );
}

function Chama({ pr }: P) {
  const { r, w } = band(pr);
  return (
    <g>
      <circle cx={C} cy={C} r={r} fill="none" stroke="#ff7a3a" strokeWidth={w} />
      <g className="af-art-spin">
        {around(18).map((d, i) => {
          const p = at(r + w * 0.2, d);
          const big = i % 2 === 0;
          return (
            <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${d}) scale(${big ? 1 : 0.75})`}>
              <path d="M0 -9 q4.6 5 3.4 8.4 q-1 2.6 -3.4 2.6 q-2.4 0 -3.4 -2.6 q-1.2 -3.4 3.4 -8.4z" fill={big ? '#ff5e3a' : '#ff8a3a'} />
              <path d="M0 -4.4 q2.2 2.8 1.6 4.4 q-0.6 1.2 -1.6 1.2 q-1 0 -1.6 -1.2 q-0.6 -1.6 1.6 -4.4z" fill="#ffd56b" />
            </g>
          );
        })}
      </g>
      <circle cx={C} cy={C} r={pr + 0.5} fill="none" stroke="#ffd56b" strokeWidth={1.2} />
    </g>
  );
}

function Coroa({ id, pr }: P) {
  const { r, w } = band(pr);
  return (
    <g>
      <defs><linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0a8" /><stop offset=".4" stopColor="#d4a017" /><stop offset=".7" stopColor="#ffe08a" /><stop offset="1" stopColor="#b8860b" /></linearGradient></defs>
      <circle cx={C} cy={C} r={r} fill="none" stroke={`url(#${id}g)`} strokeWidth={w} />
      <circle cx={C} cy={C} r={pr + 0.5} fill="none" stroke="#7b3fa0" strokeWidth={1.1} />
      {around(10, 40, 320).map((d, i) => { const p = at(r, d); return <circle key={i} cx={p.x} cy={p.y} r={1.3} fill={i % 2 ? '#7b3fa0' : '#c8553d'} stroke="#8a6508" strokeWidth={0.4} />; })}
      <g transform="translate(50 3)">
        <path d="M-12 4 L-14 -7 L-6 -1.5 L0 -10 L6 -1.5 L14 -7 L12 4 Z" fill={`url(#${id}g)`} stroke="#8a6508" strokeWidth={0.9} strokeLinejoin="round" />
        <circle cx={0} cy={0.5} r={1.8} fill="#c8553d" /><circle cx={-7} cy={1.5} r={1.1} fill="#7b3fa0" /><circle cx={7} cy={1.5} r={1.1} fill="#7b3fa0" />
      </g>
    </g>
  );
}

function Pomba({ pr }: P) {
  const { r, w } = band(pr);
  return (
    <g>
      <circle cx={C} cy={C} r={r} fill="none" stroke="#cfe6f5" strokeWidth={w} />
      <circle cx={C} cy={C} r={50} fill="none" stroke="#8aa9bf" strokeWidth={0.8} />
      <circle cx={C} cy={C} r={pr} fill="none" stroke="#8aa9bf" strokeWidth={0.8} />
      {around(18).map((d, i) => {
        const p = at(r, d);
        return <path key={i} d="M0 3 q-2.2 -3 0 -6 q2.2 3 0 6z" transform={`translate(${p.x} ${p.y}) rotate(${d + 60})`} fill="#fff" stroke="#bfd6e6" strokeWidth={0.5} />;
      })}
      <g transform={`translate(${at(50, 318).x} ${at(50, 318).y}) scale(-0.95 0.95)`}>
        <path d="M-9 1 q3 -8 10 -5 q4 -7 9 -2.5 q-5 1.5 -5 5 q-2.5 5.5 -10 4 q-4 0 -4 -1.5z" fill="#fff" stroke="#8aa9bf" strokeWidth={0.8} />
        <path d="M9 -2 q5 -1 6 2.5" stroke="#556b2f" strokeWidth={1.1} fill="none" />
        <ellipse cx={14} cy={0} rx={1.8} ry={1} fill="#7d9b4a" />
        <circle cx={-3} cy={-4} r={0.6} fill="#2b2118" />
      </g>
    </g>
  );
}

function Oliveira({ pr }: P) {
  const r = (pr + 50) / 2;
  const side = (s: 1 | -1) => around(9, 190, 345).map((d, i) => {
    const dd = s === 1 ? d : 360 - d;
    const p = at(r, dd);
    return (
      <g key={`${s}${i}`} transform={`translate(${p.x} ${p.y}) rotate(${dd + (s === 1 ? 70 : 110)})`}>
        <path d={leaf} transform="scale(1.6)" fill={i % 2 ? '#9db36b' : '#7d9b4a'} stroke="#3f5a24" strokeWidth={0.45} />
        <path d={leaf} transform="scale(1.45 -1.45) rotate(10)" fill={i % 2 ? '#7d9b4a' : '#9db36b'} stroke="#3f5a24" strokeWidth={0.45} />
      </g>
    );
  });
  return (
    <g>
      <circle cx={C} cy={C} r={r} fill="none" stroke="#556b2f" strokeWidth={2} strokeDasharray="72 18" strokeDashoffset={-27} />
      {side(1)}{side(-1)}
      {[205, 155].map((d, i) => { const p = at(r + 1, d); return <ellipse key={i} cx={p.x} cy={p.y} rx={1.6} ry={2.1} fill="#4a3a5c" />; })}
    </g>
  );
}

function Belem({ pr }: P) {
  const { r, w } = band(pr);
  const rnd = rng(4);
  return (
    <g>
      <circle cx={C} cy={C} r={r} fill="none" stroke="#1d2b5a" strokeWidth={w} />
      {around(16).map((d, i) => { const p = at(r + (rnd() - 0.5) * w * 0.5, d + rnd() * 10); return <circle key={i} cx={p.x} cy={p.y} r={0.5 + rnd() * 0.7} fill="#fff3b0" />; })}
      <polygon points={star(at(51, 325).x, at(51, 325).y, 8, 0.38)} fill="#f6d365" stroke="#fff3b0" strokeWidth={0.6} />
      <polygon points={star(at(48, 145).x, at(48, 145).y, 3.6, 0.45)} fill="#fff3b0" />
    </g>
  );
}

function Pedra({ pr }: P) {
  const rnd = rng(17);
  const { r, w } = band(pr);
  const stones = around(17).map((d) => {
    const p = at(r + (rnd() - 0.3) * 2, d + rnd() * 6);
    const n = 5 + Math.floor(rnd() * 2), s = 6.2 + rnd() * 2.6, rot = rnd() * Math.PI;
    const v = Array.from({ length: n }, (_, i) => { const t = rot + (i / n) * Math.PI * 2, k = 0.75 + rnd() * 0.35; return [p.x + Math.cos(t) * s * k, p.y + Math.sin(t) * s * k * 0.85]; });
    return { v, fill: ['#d3cdc2', '#bdb7ac', '#a9a398', '#e2ddd2'][Math.floor(rnd() * 4)], k: rnd() };
  }).sort((a, b) => a.k - b.k);
  return (
    <g strokeLinejoin="round">
      <circle cx={C} cy={C} r={r} fill="none" stroke="#8f897f" strokeWidth={w} />
      {stones.map((s, i) => {
        const cx = s.v.reduce((a, q) => a + q[0], 0) / s.v.length, cy = s.v.reduce((a, q) => a + q[1], 0) / s.v.length;
        return (
          <g key={i}>
            <polygon points={s.v.map((q) => q.join(',')).join(' ')} fill={s.fill} stroke="#2e2a26" strokeWidth={1} />
            <polygon points={`${s.v[0].join(',')} ${s.v[1].join(',')} ${cx},${cy}`} fill="#fff" opacity={0.45} />
            <line x1={cx} y1={cy} x2={s.v[3][0]} y2={s.v[3][1]} stroke="#2e2a26" strokeWidth={0.5} opacity={0.6} />
          </g>
        );
      })}
      <circle cx={C} cy={C} r={pr + 0.4} fill="none" stroke="#1f1b18" strokeWidth={1.3} />
    </g>
  );
}

function Aguas({ id, pr }: P) {
  const { r, w } = band(pr);
  return (
    <g>
      <defs><linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9efff" /><stop offset="1" stopColor="#2f8fd0" /></linearGradient></defs>
      <circle cx={C} cy={C} r={r} fill="none" stroke={`url(#${id}a)`} strokeWidth={w} />
      {around(12).map((d, i) => {
        const p = at(r, d);
        return <path key={i} d="M-3.4 1.6 q0 -4.4 3.4 -4.4 q2.8 0 2.8 2.4 q0 1.8 -1.8 1.8" transform={`translate(${p.x} ${p.y}) rotate(${d + 90})`} fill="none" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" />;
      })}
      {[[30, 3.2], [55, 2.2], [210, 2.6]].map(([d, s], i) => {
        const p = at(52, d);
        return <path key={i} d={`M0 ${-s * 1.6} q${s} ${s * 1.4} ${s} ${s * 2.2} a${s} ${s} 0 1 1 ${-s * 2} 0 q0 ${-s * 0.8} ${s} ${-s * 2.2}z`} transform={`translate(${p.x} ${p.y})`} fill="#7fd3ff" stroke="#1f6fa8" strokeWidth={0.5} />;
      })}
    </g>
  );
}

function Videira({ pr }: P) {
  const r = (pr + 50) / 2;
  const path = around(48).map((d, i) => { const p = at(r + Math.sin(i * 1.3) * 1.6, d); return `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`; }).join(' ') + 'Z';
  return (
    <g>
      <path d={path} fill="none" stroke="#5b7a1e" strokeWidth={2.6} strokeLinejoin="round" />
      {around(12).map((d, i) => { const p = at(r, d + 10); return <path key={i} d={leaf} transform={`translate(${p.x} ${p.y}) rotate(${d + (i % 2 ? 60 : 120)}) scale(1.5)`} fill={i % 3 ? '#7fa650' : '#9bbf63'} stroke="#3f5a24" strokeWidth={0.45} />; })}
      <g transform={`translate(${at(50, 225).x} ${at(50, 225).y})`}>
        {[[0, -3], [-3, 0], [3, 0], [-1.5, 3], [1.5, 3], [0, 6], [-4.5, -3], [4.5, -3]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={2.2} fill={k % 2 ? '#7d4ca3' : '#6a3a91'} stroke="#3e1f5c" strokeWidth={0.45} />)}
      </g>
    </g>
  );
}

function Rebanho({ pr }: P) {
  const { r, w } = band(pr);
  return (
    <g>
      {around(20).map((d, i) => { const p = at(r, d); return <circle key={i} cx={p.x} cy={p.y} r={w * 0.62} fill="#fff" stroke="#d8cdb9" strokeWidth={0.6} />; })}
      <circle cx={C} cy={C} r={r} fill="none" stroke="#fff" strokeWidth={w * 0.8} />
      <g transform={`translate(${at(51, 140).x} ${at(51, 140).y})`}>
        <ellipse cx={0} cy={0} rx={6.5} ry={5} fill="#fff" stroke="#b9ad98" strokeWidth={0.7} />
        <ellipse cx={5.5} cy={-1.5} rx={2.6} ry={2.2} fill="#3b332b" />
        <circle cx={6.2} cy={-2} r={0.5} fill="#fff" />
        <path d="M-3 4.5 v2.5 M2 4.5 v2.5" stroke="#3b332b" strokeWidth={1.1} strokeLinecap="round" />
      </g>
    </g>
  );
}

function Alianca({ pr }: P) {
  const cols = ['#ff6b6b', '#ffb347', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
  const w = (50 - pr) / cols.length;
  const cloud = (d: number) => { const p = at(50, d); return <path key={d} d="M-8 3 a3.2 3.2 0 0 1 1.4 -5.8 a4.2 4.2 0 0 1 7.8 -1.2 a3.2 3.2 0 0 1 5.2 2.6 a2.6 2.6 0 0 1 0.6 4.4z" transform={`translate(${p.x} ${p.y})`} fill="#fff" stroke="#c9d6e3" strokeWidth={0.6} />; };
  return (
    <g>
      {cols.map((c, i) => <circle key={c} cx={C} cy={C} r={50 - w * (i + 0.5)} fill="none" stroke={c} strokeWidth={w + 0.15} />)}
      {cloud(140)}{cloud(220)}
    </g>
  );
}

function Leao({ pr }: P) {
  const { r } = band(pr);
  const rnd = rng(8);
  const tuft = (d: number, i: number, rr: number, sc: number) => {
    const p = at(rr, d);
    return <path key={`${rr}-${i}`} d="M-4.5 2 q0 -9 4.5 -12 q4.5 3 4.5 12 q-4.5 2.5 -9 0z" transform={`translate(${p.x} ${p.y}) rotate(${d + (rnd() - 0.5) * 16}) scale(${sc})`}
      fill={i % 2 ? '#c97a2a' : '#e09a3c'} stroke="#7a4512" strokeWidth={0.6} strokeLinejoin="round" />;
  };
  return (
    <g>
      {around(16).map((d, i) => tuft(d + 11, i, r + 1, 1.05))}
      {around(16).map((d, i) => tuft(d, i + 1, r - 1, 0.9))}
      <circle cx={C} cy={C} r={pr + 1} fill="none" stroke="#f6c453" strokeWidth={2.2} />
      <circle cx={C} cy={C} r={pr + 0.1} fill="none" stroke="#8d4b14" strokeWidth={0.8} />
    </g>
  );
}

function Brasa({ id, pr }: P) {
  const { r, w } = band(pr);
  const rnd = rng(12);
  return (
    <g>
      <defs><radialGradient id={`${id}b`}><stop offset="0" stopColor="#ffe08a" /><stop offset="1" stopColor="#ff3d2e" /></radialGradient></defs>
      <circle cx={C} cy={C} r={r} fill="none" stroke="#7a1f12" strokeWidth={w} />
      <circle cx={C} cy={C} r={r} fill="none" stroke="#ff6a2a" strokeWidth={w * 0.6} strokeDasharray="3 2.2" className="af-art-glow" />
      {around(18).map((d, i) => { const p = at(r + (rnd() - 0.5) * w * 0.6, d + rnd() * 8); return <circle key={i} cx={p.x} cy={p.y} r={0.7 + rnd() * 0.8} fill={`url(#${id}b)`} />; })}
      {[20, 140, 260].map((d) => {
        const p = at(50 - 1, d);
        return <g key={d} transform={`translate(${p.x} ${p.y}) rotate(${d})`}><path d="M0 -7 q3.6 4 2.8 6.6 q-0.8 2 -2.8 2 q-2 0 -2.8 -2 q-0.8 -2.6 2.8 -6.6z" fill="#ff7a3a" className="af-art-flicker" /></g>;
      })}
    </g>
  );
}

function Lampiao({ id, pr }: P) {
  const { r, w } = band(pr);
  const p = at(51, 320);
  return (
    <g>
      <defs><linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset="1" stopColor="#c98a1f" /></linearGradient></defs>
      <circle cx={C} cy={C} r={r} fill="none" stroke={`url(#${id}l)`} strokeWidth={w} />
      <circle cx={C} cy={C} r={r} fill="none" stroke="#8c6a2f" strokeWidth={0.6} strokeDasharray="1 2.4" />
      <g transform={`translate(${p.x} ${p.y})`}>
        <circle r={9} fill="#ffcf6b" opacity={0.35} className="af-art-glow" />
        <path d="M-2.5 -9 h5 M0 -9 v2" stroke="#3a2a14" strokeWidth={1} />
        <path d="M-4 -7 h8 l-1 2 v8 l1 2 h-8 l1 -2 v-8z" fill="#ffd56b" stroke="#3a2a14" strokeWidth={0.9} strokeLinejoin="round" />
        <path d="M0 -3 q2 2 1 4 q-1 1 -2 0 q-1 -2 1 -4z" fill="#e2502c" />
      </g>
    </g>
  );
}

function Chave({ id, pr }: P) {
  const { r, w } = band(pr);
  const p = at(50, 215);
  return (
    <g>
      <defs><linearGradient id={`${id}k`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e2a4" /><stop offset=".5" stopColor="#c9a24a" /><stop offset="1" stopColor="#8c6a2f" /></linearGradient></defs>
      <circle cx={C} cy={C} r={r} fill="none" stroke={`url(#${id}k)`} strokeWidth={w} />
      <circle cx={C} cy={C} r={pr + 0.4} fill="none" stroke="#6e5022" strokeWidth={0.8} />
      <g transform={`translate(${p.x} ${p.y}) rotate(-35) scale(1.35)`}>
        <circle cx={0} cy={-6} r={4.2} fill="none" stroke="#c9a24a" strokeWidth={2.2} />
        <circle cx={0} cy={-6} r={4.2} fill="none" stroke="#6e5022" strokeWidth={0.5} />
        <path d="M0 -1.8 V10 M0 6 h3 M0 9 h2.4" stroke="#c9a24a" strokeWidth={2.2} strokeLinecap="round" />
      </g>
    </g>
  );
}

const ART: Record<string, (p: P) => ReactNode> = {
  'af-semente': Semente, 'af-peixes': Peixes, 'af-chama': Chama, 'af-coroa': Coroa, 'af-pomba': Pomba, 'af-oliveira': Oliveira,
  'af-belem': Belem, 'af-pedra': Pedra, 'af-aguas': Aguas, 'af-videira': Videira, 'af-rebanho': Rebanho, 'af-alianca': Alianca,
  'af-leao': Leao, 'af-brasa': Brasa, 'ck-af-lampiao': Lampiao, 'ck-af-chave': Chave,
};

export const hasAvatarArt = (frame: string | null | undefined) => !!frame && frame in ART;

/** Desenha a moldura em volta da foto. `pr` = raio da foto no quadro de 100. */
export const AvatarFrameArt = memo(function AvatarFrameArt({ frame, pr }: { frame: string; pr: number }) {
  const id = useId().replace(/:/g, '');
  const Art = ART[frame];
  if (!Art) return null;
  return (
    <svg className="pointer-events-none absolute overflow-visible" style={{ left: '-14%', top: '-14%', width: '128%', height: '128%' }}
      viewBox="-14 -14 128 128" aria-hidden>
      <Art id={id} pr={pr} />
    </svg>
  );
});
