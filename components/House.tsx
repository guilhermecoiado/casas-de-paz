'use client';

import type { HousePart } from '@/lib/game';

/** Casinha que vai sendo construída conforme a equipe desbloqueia as partes. */
export function House({ parts, className = '' }: { parts: Set<string>; className?: string }) {
  const has = (p: HousePart) => parts.has(p);
  const done = has('complete');
  const lit = has('lights');
  const pop = { className: 'anim-pop', style: { transformBox: 'fill-box' as const, transformOrigin: 'center bottom' } };

  return (
    <svg viewBox="0 0 320 260" className={className} role="img" aria-label="Casa de Paz em construção">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={done ? '#FFD9A0' : lit ? '#3B3F6B' : '#DDEFF7'} />
          <stop offset="1" stopColor={done ? '#FFF3DE' : lit ? '#8E79A8' : '#FBF6EE'} />
        </linearGradient>
        <radialGradient id="glowWin" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="1" stopColor="#F2A541" />
        </radialGradient>
      </defs>
      <rect width="320" height="260" rx="28" fill="url(#sky)" />

      {done && (
        <g className="anim-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <circle cx="262" cy="52" r="22" fill="#FFC857" />
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <line key={i} x1={262 + Math.cos(a) * 28} y1={52 + Math.sin(a) * 28} x2={262 + Math.cos(a) * 38} y2={52 + Math.sin(a) * 38} stroke="#FFC857" strokeWidth="4" strokeLinecap="round" />;
          })}
        </g>
      )}
      {lit && !done && (
        <g>
          {[[40, 40], [90, 26], [250, 36], [286, 70], [200, 22]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.2" fill="#FFF6D5" className="house-glow" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </g>
      )}

      {/* chão */}
      <ellipse cx="160" cy="226" rx="150" ry="22" fill={has('garden') ? '#8DBF7A' : '#E6D6BE'} />

      {/* contorno fantasma da casa (o que falta construir) */}
      <g fill="none" stroke="#C9B497" strokeWidth="2" strokeDasharray="6 6" opacity="0.8">
        <path d="M55 112 L160 45 L265 112" />
        <rect x="70" y="110" width="180" height="92" />
        <rect x="145" y="148" width="32" height="54" />
      </g>

      {has('foundation') && <rect {...pop} x="60" y="200" width="200" height="14" rx="3" fill="#9C8B78" />}

      {has('walls') && (
        <g {...pop}>
          <rect x="70" y="110" width="180" height="92" fill="#F6E3C8" />
          <rect x="70" y="110" width="180" height="92" fill="none" stroke="#C99A6B" strokeWidth="3" />
          {[128, 146, 164, 182].map((y) => <line key={y} x1="70" x2="250" y1={y} y2={y} stroke="#EBD2B0" strokeWidth="1.5" />)}
        </g>
      )}

      {has('door') && (
        <g {...pop}>
          <path d="M145 202 L145 162 Q161 144 177 162 L177 202 Z" fill="#C8553D" />
          <circle cx="170" cy="182" r="2.6" fill="#FFD56B" />
          <path d="M161 176 C155 171 156 166 159 167 C160 167 161 168.5 161 169 C161 168.5 162 167 163 167 C166 166 167 171 161 176 Z" fill="#FBF6EE" />
        </g>
      )}

      {has('windows') && (
        <g {...pop}>
          {[88, 202].map((x) => (
            <g key={x}>
              <rect x={x} y="128" width="32" height="32" rx="4" fill={lit ? 'url(#glowWin)' : '#BFE3F2'} stroke="#8C6A4A" strokeWidth="3" className={lit ? 'house-glow' : ''} />
              <line x1={x + 16} x2={x + 16} y1="128" y2="160" stroke="#8C6A4A" strokeWidth="2.5" />
              <line x1={x} x2={x + 32} y1="144" y2="144" stroke="#8C6A4A" strokeWidth="2.5" />
            </g>
          ))}
        </g>
      )}

      {has('chimney') && (
        <g {...pop}>
          <rect x="212" y="58" width="20" height="40" fill="#A2543F" />
          <rect x="208" y="54" width="28" height="8" rx="2" fill="#7D3F2F" />
          <circle cx="222" cy="44" r="7" fill="#fff" opacity="0.8" className="house-smoke" />
          <circle cx="228" cy="34" r="5" fill="#fff" opacity="0.7" className="house-smoke" style={{ animationDelay: '1.2s' }} />
        </g>
      )}

      {has('roof') && (
        <g {...pop}>
          <path d="M48 116 L160 42 L272 116 Z" fill="#C8553D" />
          <path d="M48 116 L160 42 L272 116" fill="none" stroke="#9C3F2B" strokeWidth="5" strokeLinejoin="round" />
          <circle cx="160" cy="82" r="11" fill="#FBF6EE" />
          <path d="M160 88 C153 83 154 78 157 79 C158.5 79.3 160 80.5 160 81 C160 80.5 161.5 79.3 163 79 C166 78 167 83 160 88 Z" fill="#C8553D" />
        </g>
      )}

      {has('lights') && (
        <g>
          <path d="M56 116 Q108 128 160 116 Q212 128 264 116" fill="none" stroke="#5A4634" strokeWidth="1.5" />
          {[70, 92, 114, 136, 160, 184, 206, 228, 250].map((x, i) => (
            <circle key={x} cx={x} cy={120 + (i % 2 === 0 ? 2 : 4)} r="4" fill={['#FFD56B', '#FF8E72', '#9FE0A8', '#8CCBFF'][i % 4]} className="house-glow" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </g>
      )}

      {has('garden') && (
        <g {...pop}>
          <circle cx="54" cy="204" r="16" fill="#5E9C57" />
          <circle cx="76" cy="208" r="12" fill="#6DAE63" />
          <circle cx="262" cy="206" r="15" fill="#5E9C57" />
          {[[50, 198, '#FF8E72'], [62, 206, '#FFD56B'], [258, 200, '#FFFFFF'], [270, 208, '#FF8E72'], [78, 202, '#FFFFFF']].map(([x, y, c], i) => (
            <circle key={i} cx={x as number} cy={y as number} r="3" fill={c as string} />
          ))}
          <path d="M150 214 L172 214 L182 240 L140 240 Z" fill="#E8D3B4" />
        </g>
      )}

      {has('fence') && (
        <g {...pop}>
          <line x1="14" x2="118" y1="226" y2="226" stroke="#FFFFFF" strokeWidth="4" />
          <line x1="202" x2="306" y1="226" y2="226" stroke="#FFFFFF" strokeWidth="4" />
          {[20, 36, 52, 68, 84, 100, 116, 206, 222, 238, 254, 270, 286, 302].map((x) => (
            <path key={x} d={`M${x - 4} 236 L${x - 4} 216 L${x} 210 L${x + 4} 216 L${x + 4} 236 Z`} fill="#FFFFFF" stroke="#E0D3C0" />
          ))}
        </g>
      )}

      {done && (
        <g className="anim-pop" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          <rect x="92" y="14" width="136" height="26" rx="13" fill="#2B2118" />
          <text x="160" y="32" textAnchor="middle" fontSize="13" fontWeight="800" fill="#FFD56B" fontFamily="Nunito, sans-serif">CASA DE PAZ ✓</text>
        </g>
      )}
    </svg>
  );
}
