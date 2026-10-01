'use client';

import type { CSSProperties } from 'react';
import type { PathId } from '@/lib/rewards';

/* ---------------- Ornamentos das molduras de perfil ---------------- */

type Orn = { e: string; s: number; style: CSSProperties; cls?: string };

// posições em % do avatar; s = tamanho relativo ao avatar
const AVATAR_ORN: Record<string, Orn[]> = {
  'af-semente': [
    { e: '🌱', s: 0.32, style: { left: '-10%', bottom: '4%' }, cls: 'orn-bob' },
    { e: '🌱', s: 0.28, style: { right: '-8%', bottom: '10%', transform: 'scaleX(-1)' } },
  ],
  'af-peixes': [
    { e: '🐟', s: 0.3, style: { left: '-12%', bottom: '2%', transform: 'rotate(-20deg)' }, cls: 'orn-bob' },
    { e: '🐟', s: 0.26, style: { right: '-10%', top: '6%', transform: 'scaleX(-1) rotate(-20deg)' } },
  ],
  'af-chama': [
    { e: '🔥', s: 0.34, style: { left: '33%', top: '-22%' }, cls: 'orn-flicker' },
  ],
  'af-coroa': [
    { e: '👑', s: 0.4, style: { left: '30%', top: '-30%', transform: 'rotate(-8deg)' } },
  ],
  'af-pomba': [
    { e: '🕊️', s: 0.32, style: { right: '-12%', top: '-8%' }, cls: 'orn-bob' },
  ],
  'af-oliveira': [
    { e: '🌿', s: 0.3, style: { left: '-12%', top: '30%', transform: 'rotate(-30deg)' } },
    { e: '🌿', s: 0.3, style: { right: '-12%', top: '30%', transform: 'scaleX(-1) rotate(-30deg)' } },
  ],
  'af-belem': [
    { e: '⭐', s: 0.3, style: { right: '-6%', top: '-10%' }, cls: 'orn-flicker' },
    { e: '✨', s: 0.22, style: { left: '-6%', bottom: '0%' }, cls: 'orn-bob' },
  ],
};

export function AvatarOrnaments({ frame, size }: { frame: string | null | undefined; size: number }) {
  const list = frame ? AVATAR_ORN[frame] : undefined;
  if (!list) return null;
  return (
    <>
      {list.map((o, i) => (
        <span key={i} className={`orn ${o.cls ?? ''}`} style={{ ...o.style, fontSize: Math.max(10, size * o.s) }} aria-hidden>
          {o.e}
        </span>
      ))}
    </>
  );
}

/* ---------------- Ornamentos das molduras do tile ---------------- */

const TILE_ORN: Record<string, Orn[]> = {
  // cantos de cima (o canto superior direito fica para o selo ✓/falta)
  'tf-trigo': [
    { e: '🌾', s: 1, style: { left: 5, top: 6, transform: 'rotate(-15deg)' } },
    { e: '🌾', s: 0.9, style: { right: 6, top: 40, transform: 'scaleX(-1) rotate(-15deg)' } },
  ],
  'tf-pesca': [
    { e: '🎣', s: 1, style: { left: 6, top: 6 } },
    { e: '🐟', s: 0.9, style: { right: 8, top: 40, transform: 'scaleX(-1)' }, cls: 'orn-bob' },
  ],
  'tf-reino': [
    { e: '👑', s: 1, style: { left: '50%', top: 3, marginLeft: -9 } },
  ],
  'tf-videira': [
    { e: '🍇', s: 1, style: { left: 5, top: 5 } },
    { e: '🍃', s: 0.85, style: { left: 8, top: 32, transform: 'rotate(-30deg)' }, cls: 'orn-bob' },
    { e: '🍇', s: 0.9, style: { right: 6, top: 40, transform: 'scaleX(-1)' } },
  ],
};

export function TileOrnaments({ frame }: { frame: string | null | undefined }) {
  const list = frame ? TILE_ORN[frame] : undefined;
  if (!list) return null;
  return (
    <>
      {list.map((o, i) => (
        <span key={i} className={`orn z-[2] ${o.cls ?? ''}`} style={{ ...o.style, fontSize: 17 * o.s }} aria-hidden>
          {o.e}
        </span>
      ))}
    </>
  );
}

/* ---------------- Animações do tile (partículas) ---------------- */

const d = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

export function TileFx({ anim, kit }: { anim: string | null | undefined; kit: PathId | null | undefined }) {
  return (
    <>
      {anim && (
        <div className="fx" aria-hidden>
          {anim === 'ta-broto' && [12, 42, 72].map((x, i) => <span key={i} className="fx-sprout" style={{ left: `${x}%`, ...d(i * 0.9) }}>🌱</span>)}
          {anim === 'ta-pesca' && [30, 50, 65].map((y, i) => <span key={i} className="fx-fish" style={{ top: `${y}%`, left: 0, ...d(i * 1.7) }}>{i === 1 ? '🐠' : '🐟'}</span>)}
          {anim === 'ta-pentecostes' && (
            <>
              <span className="fx-glow-bottom" />
              {[8, 30, 52, 74].map((x, i) => <span key={i} className="fx-flame" style={{ left: `${x}%`, ...d(i * 0.3) }}>🔥</span>)}
            </>
          )}
          {anim === 'ta-gloria' && [10, 28, 46, 64, 82].map((x, i) => <span key={i} className="fx-spark" style={{ left: `${x}%`, ...d(i * 0.65) }}>✦</span>)}
          {anim === 'ta-gotas' && [15, 40, 65, 85].map((x, i) => <span key={i} className="fx-drop" style={{ left: `${x}%`, ...d(i * 0.6) }}>💧</span>)}
          {anim === 'ta-pomba' && <span className="fx-dove" style={{ left: 0 }}>🕊️</span>}
        </div>
      )}
      {kit && <KitFx kit={kit} />}
    </>
  );
}

/** Animações secretas dos kits completos (easter eggs). */
export function KitFx({ kit }: { kit: PathId }) {
  return (
    <div className="fx" aria-hidden>
      {kit === 'semeador' && (
        <>
          <span className="kit-sun">☀️</span>
          {[2, 18, 34, 50, 66, 82].map((x, i) => <span key={i} className="kit-wheat" style={{ left: `${x}%`, ...d(i * 0.25) }}>🌾</span>)}
        </>
      )}
      {kit === 'pescador' && (
        <>
          <span className="kit-wave" />
          {[10, 40, 68].map((x, i) => <span key={i} className="kit-jump" style={{ left: `${x}%`, ...d(i * 0.8) }}>🐟</span>)}
        </>
      )}
      {kit === 'mensageiro' && (
        <>
          <span className="kit-dove">🕊️</span>
          {[14, 40, 66, 86].map((x, i) => <span key={i} className="kit-tongue" style={{ left: `${x}%`, ...d(i * 0.15) }}>🔥</span>)}
        </>
      )}
      {kit === 'reino' && (
        <>
          <span className="kit-rays" />
          <span className="kit-crown">👑</span>
        </>
      )}
    </div>
  );
}
