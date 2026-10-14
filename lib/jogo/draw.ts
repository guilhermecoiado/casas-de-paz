/* Desenhos do jogo "Casa na Rocha" (canvas 2D, quadro lógico de 1920×1080). */

export const W = 1920, H = 1080, TAU = Math.PI * 2;
export const C = {
  terra: '#C8553D', ink: '#2B2118', cream: '#F7F0E4', amber: '#F2A541', olive: '#5E8C3A', sky: '#4FA3DD',
  muted: '#8A6F57', brown: '#6b5643',
};
export const FONT = 'Nunito, system-ui, sans-serif';

export type Ctx = CanvasRenderingContext2D;
export const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

/* ---------------- personagens: 12 combinações de cor + acessório ---------------- */

export type Acc = 'cap' | 'bow' | 'crown' | 'beanie' | 'flower' | 'glasses' | 'helmet' | 'straw' | 'headphones' | 'bandana' | 'tophat' | 'curls';
export const CHARS: { color: string; acc: Acc }[] = [
  { color: '#C8553D', acc: 'cap' },
  { color: '#7B3FA0', acc: 'bow' },
  { color: '#E8A12E', acc: 'crown' },
  { color: '#2F8FD0', acc: 'beanie' },
  { color: '#E26D9A', acc: 'flower' },
  { color: '#3E6B48', acc: 'glasses' },
  { color: '#6B5643', acc: 'helmet' },
  { color: '#E25B45', acc: 'straw' },
  { color: '#1D2B5A', acc: 'headphones' },
  { color: '#3FBFB3', acc: 'bandana' },
  { color: '#8C9C2E', acc: 'tophat' },
  { color: '#B5651D', acc: 'curls' },
];

export interface PoseOpts {
  face?: 1 | -1;
  walk?: number;        // fase da caminhada (0 parado)
  air?: boolean;
  carry?: ItemType | null;
  carryGold?: boolean;
  happy?: boolean;
  dizzy?: boolean;
  name?: string;
  guestStar?: boolean;
  scale?: number;
  alpha?: number;
}

/** Desenha o bonequinho com os pés em (x, y). */
export function person(ctx: Ctx, x: number, y: number, slot: number, o: PoseOpts = {}) {
  const ch = CHARS[slot % CHARS.length];
  const s = o.scale ?? 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const face = o.face ?? 1;
  // sombra
  if (!o.air) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 7, 0, 0, TAU); ctx.fill(); }
  // pernas
  const sw = o.walk ? Math.sin(o.walk) * 9 : 0;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath();
  if (o.air) { ctx.moveTo(-10, -26); ctx.lineTo(-18, -8); ctx.moveTo(10, -26); ctx.lineTo(16, -12); }
  else { ctx.moveTo(-10, -26); ctx.lineTo(-12 + sw, -2); ctx.moveTo(10, -26); ctx.lineTo(12 - sw, -2); }
  ctx.stroke();
  // corpo
  ctx.fillStyle = ch.color; rr(ctx, -26, -78, 52, 58, 24); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, -18 * face - (face < 0 ? 16 : 0), -72, 16, 30, 8); ctx.fill();
  // braços
  ctx.strokeStyle = ch.color; ctx.lineWidth = 10; ctx.beginPath();
  if (o.carry) { ctx.moveTo(-22, -62); ctx.lineTo(-14, -98); ctx.moveTo(22, -62); ctx.lineTo(14, -98); }
  else if (o.air) { ctx.moveTo(-24, -60); ctx.lineTo(-38, -86); ctx.moveTo(24, -60); ctx.lineTo(38, -86); }
  else { ctx.moveTo(-24, -60); ctx.lineTo(-36 - sw * 0.4, -40); ctx.moveTo(24, -60); ctx.lineTo(36 + sw * 0.4, -40); }
  ctx.stroke();
  // cabeça
  ctx.fillStyle = '#F3DCC4'; ctx.beginPath(); ctx.arc(0, -104, 28, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(232,140,120,0.5)'; ctx.beginPath(); ctx.ellipse(-15 + face * 2, -96, 6, 4, 0, 0, TAU); ctx.ellipse(15 + face * 2, -96, 6, 4, 0, 0, TAU); ctx.fill();
  // rosto (olha para o lado que anda)
  const fx = face * 3;
  ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (o.dizzy) {
    for (const ex of [-9, 9]) { ctx.beginPath(); ctx.moveTo(ex + fx - 4, -110); ctx.lineTo(ex + fx + 4, -102); ctx.moveTo(ex + fx + 4, -110); ctx.lineTo(ex + fx - 4, -102); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(fx, -93, 5, 5, 0, 0, TAU); ctx.fill();
  } else if (o.happy) {
    ctx.beginPath(); ctx.arc(-9 + fx, -106, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(9 + fx, -106, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.fillStyle = '#5a2a22'; ctx.beginPath(); ctx.arc(fx, -98, 8, 0, Math.PI); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(-9 + fx, -107, 4, 0, TAU); ctx.arc(9 + fx, -107, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(fx, -98, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  acc(ctx, ch.acc, ch.color, face);
  // carregando
  if (o.carry) { ctx.save(); ctx.translate(0, -158); item(ctx, o.carry, 0, 0, !!o.carryGold, 0.95); ctx.restore(); }
  ctx.restore();
  // etiqueta do nome (sem escala do pulo)
  if (o.name) nameTag(ctx, x, y - (o.carry ? 196 : 158) * s, o.name, ch.color, o.guestStar);
}

function acc(ctx: Ctx, a: Acc, color: string, face: number) {
  ctx.save();
  if (a === 'cap') { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -114, 26, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#9c3f2b'; rr(ctx, face > 0 ? -2 : -38, -118, 40, 9, 4); ctx.fill(); }
  if (a === 'bow') { ctx.fillStyle = '#E26D9A'; ctx.beginPath(); ctx.moveTo(14, -132); ctx.lineTo(0, -142); ctx.lineTo(0, -122); ctx.closePath(); ctx.moveTo(14, -132); ctx.lineTo(28, -142); ctx.lineTo(28, -122); ctx.closePath(); ctx.fill(); }
  if (a === 'crown') { ctx.fillStyle = '#F3C64A'; ctx.beginPath(); ctx.moveTo(-20, -126); ctx.lineTo(-22, -146); ctx.lineTo(-10, -136); ctx.lineTo(0, -150); ctx.lineTo(10, -136); ctx.lineTo(22, -146); ctx.lineTo(20, -126); ctx.closePath(); ctx.fill(); }
  if (a === 'beanie') { ctx.fillStyle = '#F2A541'; ctx.beginPath(); ctx.arc(0, -114, 27, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -142, 7, 0, TAU); ctx.fill(); }
  if (a === 'flower') { ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { const t = (i / 5) * TAU; ctx.beginPath(); ctx.arc(-18 + Math.cos(t) * 7, -126 + Math.sin(t) * 7, 5, 0, TAU); ctx.fill(); } ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(-18, -126, 4, 0, TAU); ctx.fill(); }
  if (a === 'glasses') { ctx.strokeStyle = C.ink; ctx.lineWidth = 3; const fx = face * 3; ctx.beginPath(); ctx.arc(-10 + fx, -106, 8, 0, TAU); ctx.moveTo(18 + fx, -106); ctx.arc(10 + fx, -106, 8, 0, TAU); ctx.moveTo(-2 + fx, -106); ctx.lineTo(2 + fx, -106); ctx.stroke(); }
  if (a === 'helmet') { ctx.fillStyle = '#F2C230'; ctx.beginPath(); ctx.arc(0, -112, 29, Math.PI, 0); ctx.fill(); rr(ctx, -34, -114, 68, 8, 4); ctx.fill(); }
  if (a === 'straw') { ctx.fillStyle = '#E9C77B'; ctx.beginPath(); ctx.ellipse(0, -120, 42, 9, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, -122, 20, Math.PI, 0); ctx.fill(); ctx.fillStyle = C.terra; ctx.fillRect(-20, -128, 40, 5); }
  if (a === 'headphones') { ctx.strokeStyle = '#1D2B5A'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -108, 30, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.fillStyle = '#1D2B5A'; rr(ctx, -34, -114, 12, 20, 5); ctx.fill(); rr(ctx, 22, -114, 12, 20, 5); ctx.fill(); }
  if (a === 'bandana') { ctx.fillStyle = C.terra; ctx.fillRect(-27, -126, 54, 9); ctx.beginPath(); ctx.moveTo(-face * 26, -124); ctx.lineTo(-face * 40, -132); ctx.lineTo(-face * 38, -116); ctx.fill(); }
  if (a === 'tophat') { ctx.fillStyle = C.ink; rr(ctx, -30, -128, 60, 8, 4); ctx.fill(); rr(ctx, -19, -160, 38, 34, 4); ctx.fill(); ctx.fillStyle = C.terra; ctx.fillRect(-19, -134, 38, 6); }
  if (a === 'curls') { ctx.fillStyle = '#5a3a22'; for (const [cx, cy] of [[-22, -116], [-12, -128], [2, -132], [16, -128], [24, -116]]) { ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TAU); ctx.fill(); } }
  ctx.restore();
}

export function nameTag(ctx: Ctx, x: number, y: number, name: string, color: string, star?: boolean) {
  ctx.save();
  ctx.font = `900 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(name).width + 26;
  ctx.fillStyle = color; rr(ctx, x - w / 2, y - 18, w, 32, 16); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6, y + 14); ctx.lineTo(x + 6, y + 14); ctx.lineTo(x, y + 22); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(name, x, y + 6);
  if (star) { ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x + w / 2 - 2, y - 16, 11, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `900 14px ${FONT}`; ctx.fillText('★', x + w / 2 - 2, y - 11); }
  ctx.restore();
}

/* ---------------- materiais ---------------- */

export type ItemType = 'stone' | 'brick' | 'tile' | 'wood' | 'glass';
export const ITEM_LABEL: Record<ItemType, string> = { stone: 'pedras', brick: 'tijolos', tile: 'telhas', wood: 'madeiras', glass: 'vidros' };
export const ITEM_EMOJI: Record<ItemType, string> = { stone: '🪨', brick: '🧱', tile: '🔺', wood: '🪵', glass: '🪟' };

export function glow(ctx: Ctx, x: number, y: number, r = 44, a = 0.9) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,240,180,${a})`); g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

/** Material centrado em (x, y). */
export function item(ctx: Ctx, t: ItemType, x: number, y: number, gold = false, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineWidth = 3; ctx.lineJoin = 'round';
  if (t === 'brick') {
    ctx.fillStyle = gold ? '#F3C64A' : C.terra; rr(ctx, -26, -15, 52, 30, 6); ctx.fill(); ctx.strokeStyle = gold ? '#a07a10' : '#7a2618'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(0, 15); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke();
  } else if (t === 'tile') {
    ctx.fillStyle = gold ? '#F3C64A' : '#D9483B'; ctx.beginPath(); ctx.moveTo(-28, 12); ctx.quadraticCurveTo(0, -30, 28, 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = gold ? '#a07a10' : '#7a2618'; ctx.stroke();
  } else if (t === 'wood') {
    ctx.fillStyle = gold ? '#F3C64A' : '#a87443'; rr(ctx, -32, -10, 64, 20, 6); ctx.fill(); ctx.strokeStyle = gold ? '#a07a10' : '#5c3a1a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, -2); ctx.lineTo(18, -2); ctx.stroke();
  } else if (t === 'glass') {
    ctx.fillStyle = gold ? '#F3C64A' : '#bfe3f7'; rr(ctx, -22, -22, 44, 44, 6); ctx.fill(); ctx.strokeStyle = gold ? '#a07a10' : '#2f8fd0'; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-12, 8); ctx.lineTo(6, -12); ctx.stroke();
  } else {
    ctx.fillStyle = gold ? '#F3C64A' : '#bdb7ac'; ctx.beginPath(); ctx.moveTo(-26, 14); ctx.lineTo(-18, -14); ctx.lineTo(10, -20); ctx.lineTo(26, 2); ctx.lineTo(14, 18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = gold ? '#a07a10' : '#4a4540'; ctx.stroke();
  }
  if (gold) { ctx.fillStyle = '#fff'; ctx.font = `900 16px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('x3', 0, 6); }
  ctx.restore();
}

/* ---------------- cenário ---------------- */

export const GROUND = 930;
export const ROCK = { x0: 722, x1: 1208, top: 868 };
export interface Plat { x: number; y: number; w: number }
export const PLATS: Plat[] = [
  { x: 300, y: 790, w: 190 },
  { x: 140, y: 640, w: 300 },
  { x: 520, y: 500, w: 240 },
  { x: 860, y: 400, w: 200 },
  { x: 1220, y: 520, w: 260 },
  { x: 1430, y: 790, w: 190 },
  { x: 1540, y: 660, w: 300 },
];

function cloud(ctx: Ctx, x: number, y: number, s: number, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff'; ctx.translate(x, y); ctx.scale(s, s);
  for (const [cx, cy, r] of [[0, 0, 40], [45, -18, 52], [100, 0, 42], [50, 18, 40]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/** Céu, colinas, chão e rocha. `dark` 0..1 escurece para a tempestade. */
export function scenery(ctx: Ctx, t: number, dark = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('#CFE6F2', '#4a5a6e', dark)); g.addColorStop(0.55, mix('#F4EBDD', '#7d8794', dark)); g.addColorStop(1, mix('#F7F0E4', '#9aa0a6', dark));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sol
  ctx.save(); ctx.globalAlpha = 1 - dark;
  ctx.fillStyle = 'rgba(242,165,65,0.25)'; ctx.beginPath(); ctx.arc(1780, 330, 90, 0, TAU); ctx.fill();
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(1780, 330, 52, 0, TAU); ctx.fill(); ctx.restore();
  const drift = (t * 12) % (W + 400);
  cloud(ctx, ((220 + drift) % (W + 400)) - 200, 250, 1.2, 0.9 - dark * 0.3);
  cloud(ctx, ((900 + drift * 0.7) % (W + 400)) - 200, 210, 0.9, 0.8 - dark * 0.3);
  cloud(ctx, ((1260 + drift * 0.85) % (W + 400)) - 200, 300, 1.1, 0.85 - dark * 0.3);
  ctx.fillStyle = mix('#B9CF9A', '#5f6b55', dark); ctx.beginPath(); ctx.moveTo(0, 800); ctx.quadraticCurveTo(300, 640, 640, 760); ctx.quadraticCurveTo(980, 860, 1300, 720); ctx.quadraticCurveTo(1650, 600, 1920, 760); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080); ctx.fill();
  ctx.fillStyle = mix('#9DBB7C', '#4f5c48', dark); ctx.beginPath(); ctx.moveTo(0, 880); ctx.quadraticCurveTo(420, 760, 900, 860); ctx.quadraticCurveTo(1400, 960, 1920, 840); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080); ctx.fill();
  ctx.fillStyle = mix('#E9D3A8', '#8f8670', dark); ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = mix('#7FAE52', '#4c6b38', dark); rr(ctx, -20, GROUND - 12, W + 40, 26, 13); ctx.fill();
  // rocha
  ctx.fillStyle = mix('#A9A398', '#6d6962', dark); ctx.beginPath(); ctx.moveTo(700, 1080); ctx.lineTo(ROCK.x0, 905); ctx.lineTo(790, ROCK.top); ctx.lineTo(1130, ROCK.top); ctx.lineTo(ROCK.x1, 900); ctx.lineTo(1230, 1080); ctx.fill();
  ctx.fillStyle = mix('#C9C3B8', '#86827b', dark); ctx.beginPath(); ctx.moveTo(735, 905); ctx.lineTo(795, 876); ctx.lineTo(980, 874); ctx.lineTo(920, 930); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6f695f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1000, 900); ctx.lineTo(1040, 960); ctx.lineTo(1020, 1020); ctx.stroke();
}

export function platform(ctx: Ctx, p: Plat, dy = 0) {
  ctx.save(); ctx.translate(0, dy);
  ctx.fillStyle = '#8b5a2b'; rr(ctx, p.x, p.y, p.w, 26, 10); ctx.fill();
  ctx.fillStyle = '#a87443'; rr(ctx, p.x + 4, p.y + 3, p.w - 8, 9, 5); ctx.fill();
  ctx.fillStyle = '#5c3a1a'; for (let i = p.x + 30; i < p.x + p.w - 10; i += 60) { ctx.beginPath(); ctx.arc(i, p.y + 18, 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ---------------- a casa (progresso por fase) ---------------- */

export interface HouseProg { stone: number; brick: number; tile: number; wood: number; glass: number } // 0..1
const HX0 = 812, HX1 = 1108, BASE = ROCK.top;

export function house(ctx: Ctx, p: HouseProg, t: number, opts: { wobble?: number; fall?: number; outline?: boolean } = {}) {
  ctx.save();
  if (opts.wobble) { ctx.translate(960, BASE); ctx.rotate(Math.sin(t * 9) * 0.03 * opts.wobble); ctx.translate(-960, -BASE); }
  const fall = opts.fall ?? 0;
  // contorno do que falta
  if (opts.outline !== false) {
    ctx.save(); ctx.setLineDash([14, 12]); ctx.strokeStyle = 'rgba(43,33,24,0.3)'; ctx.lineWidth = 5;
    ctx.strokeRect(HX0, BASE - 334, HX1 - HX0, 300);
    ctx.beginPath(); ctx.moveTo(780, BASE - 334); ctx.lineTo(960, BASE - 470); ctx.lineTo(1140, BASE - 334); ctx.stroke();
    ctx.restore();
  }
  // fundação (9 pedras)
  const ns = Math.round(p.stone * 9);
  for (let i = 0; i < ns; i++) { ctx.fillStyle = ['#bdb7ac', '#d3cdc2', '#a9a398'][i % 3]; rr(ctx, 800 + i * 36, BASE - 34, 34, 34, 8); ctx.fill(); ctx.strokeStyle = '#4a4540'; ctx.lineWidth = 3; ctx.stroke(); }
  // paredes: 13 fileiras de tijolo, preenchendo tijolo a tijolo
  const rows = 13, perRow = 8, totalB = rows * perRow, nb = Math.round(p.brick * totalB);
  let k = 0;
  ctx.save(); if (fall) ctx.translate(fall * 40, fall * fall * 400);
  for (let r = 0; r < rows; r++) for (let c = 0; c < perRow; c++) {
    if (k++ >= nb) continue;
    const w = 38, h = 22, off = r % 2 ? 19 : 0, x = HX0 + c * w + off, y = BASE - 34 - (r + 1) * h;
    if (x + w > HX1 + 4) continue;
    ctx.fillStyle = (r + c) % 3 ? '#C8553D' : '#B44A34'; rr(ctx, x, y, Math.min(w - 3, HX1 - x), h - 3, 4); ctx.fill();
  }
  // porta (madeira) e janelas (vidro)
  if (p.wood > 0) {
    const dh = 130 * p.wood;
    ctx.fillStyle = '#8b5a2b'; rr(ctx, 930, BASE - 34 - dh, 64, dh, [26, 26, 0, 0]); ctx.fill();
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 3; ctx.stroke();
    if (p.wood >= 1) { ctx.fillStyle = '#F3C64A'; ctx.beginPath(); ctx.arc(982, BASE - 100, 4, 0, TAU); ctx.fill(); }
  }
  for (const [wx, i] of [[848, 0], [1030, 1]] as const) {
    const q = Math.max(0, Math.min(1, p.glass * 2 - i));
    if (q <= 0) continue;
    ctx.save(); ctx.globalAlpha *= q; ctx.fillStyle = '#ffe28a'; ctx.fillRect(wx, BASE - 230, 56, 56); ctx.restore();
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 5; ctx.strokeRect(wx, BASE - 230, 56, 56);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx + 28, BASE - 230); ctx.lineTo(wx + 28, BASE - 174); ctx.moveTo(wx, BASE - 202); ctx.lineTo(wx + 56, BASE - 202); ctx.stroke();
  }
  ctx.restore();
  // telhado: fileiras de telha de baixo para cima
  if (p.tile > 0) {
    ctx.save(); if (fall) { ctx.translate(-fall * 60, fall * fall * 520); }
    ctx.beginPath(); ctx.moveTo(772, BASE - 330); ctx.lineTo(960, BASE - 476); ctx.lineTo(1148, BASE - 330); ctx.closePath(); ctx.clip();
    const top = BASE - 330 - 146 * p.tile;
    for (let y = BASE - 330; y > top - 18; y -= 18) for (let x = 770 + ((y / 18) % 2) * 14; x < 1150; x += 28) {
      ctx.fillStyle = ((x + y) / 14) % 3 < 1 ? '#c23d31' : '#D9483B';
      ctx.beginPath(); ctx.arc(x, y, 15, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
    if (p.tile >= 1) { ctx.strokeStyle = '#9c2f25'; ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(772, BASE - 330); ctx.lineTo(960, BASE - 476); ctx.lineTo(1148, BASE - 330); ctx.stroke(); }
  }
  ctx.restore();
}

export function scaffold(ctx: Ctx) {
  ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(1135, BASE - 34); ctx.lineTo(1135, BASE - 250); ctx.moveTo(1195, BASE - 34); ctx.lineTo(1195, BASE - 250);
  ctx.moveTo(1130, BASE - 150); ctx.lineTo(1200, BASE - 150); ctx.moveTo(1130, BASE - 250); ctx.lineTo(1200, BASE - 250); ctx.stroke();
}

export function ant(ctx: Ctx, x: number, y: number, dir: number, t: number, carrying?: ItemType | null) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.fillStyle = C.ink; for (const [cx, r] of [[-16, 9], [0, 11], [18, 9]]) { ctx.beginPath(); ctx.arc(cx, -10, r, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  for (const [i, lx] of [[0, -8], [1, 2], [2, 12]]) { const a = Math.sin(t * 20 + i * 2) * 5; ctx.beginPath(); ctx.moveTo(lx, -6); ctx.lineTo(lx - 6 + a, 6); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(24, -16); ctx.lineTo(34, -28); ctx.stroke();
  if (carrying) item(ctx, carrying, 0, -40, false, 0.8);
  ctx.restore();
}

export function mix(a: string, b: string, k: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, k))));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, r = 32, fill = 'rgba(255,255,255,0.95)') {
  ctx.save(); ctx.shadowColor = 'rgba(43,33,24,0.16)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.fillStyle = fill; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.restore();
}

/** Escreve o texto diminuindo a fonte até caber na largura (nunca vaza da caixa). */
export function fitText(ctx: Ctx, text: string, x: number, y: number, maxW: number, weight: number, size: number) {
  let sz = size;
  ctx.font = `${weight} ${sz}px ${FONT}`;
  while (sz > 10 && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${FONT}`; }
  ctx.fillText(text, x, y);
}
