/* Desenhos do jogo "Casa na Rocha" (canvas 2D, quadro lógico de 1920×1080). */

import type { PowerId, TaskId } from './net';

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
  carryQty?: number;
  happy?: boolean;
  dizzy?: boolean;
  name?: string;
  guestStar?: boolean;
  scale?: number;
  alpha?: number;
  tool?: string;        // emoji da ferramenta na mão (acabamento)
  work?: number;        // 0..1 braço levantado trabalhando
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
  else if (o.tool) { const up = o.work ?? 0; ctx.moveTo(-24, -60); ctx.lineTo(-36, -40); ctx.moveTo(24 * face, -60); ctx.lineTo((34 + up * 6) * face, -62 - up * 34); }
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
  if (o.tool) { const up = o.work ?? 0; ctx.save(); ctx.translate((40 + up * 6) * face, -70 - up * 34); ctx.rotate(face * (0.3 - up * 0.6)); ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.tool, 0, 0); ctx.restore(); }
  // carregando
  if (o.carry) { ctx.save(); ctx.translate(0, -158); item(ctx, o.carry, 0, 0, o.carryQty ?? 1, 0.95); ctx.restore(); }
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
/** Equipes do acabamento (fase 5): cada jogador recebe uma e toca rápido no celular. */
export const TASKS: { id: TaskId; label: string; verb: string; emoji: string; tool: string; color: string; done: string }[] = [
  { id: 'paint', label: 'Pintura', verb: 'PINTAR', emoji: '🎨', tool: '🖌️', color: '#E26D9A', done: 'Pintura pronta!' },
  { id: 'light', label: 'Elétrica', verb: 'ACENDER', emoji: '💡', tool: '💡', color: '#E8A12E', done: 'Luzes acesas!' },
  { id: 'garden', label: 'Jardim', verb: 'PLANTAR', emoji: '🌳', tool: '🌱', color: '#5E8C3A', done: 'Jardim pronto!' },
  { id: 'decor', label: 'Decoração', verb: 'DECORAR', emoji: '🎀', tool: '🎀', color: '#C8553D', done: 'Decoração pronta!' },
];
export const TASK = Object.fromEntries(TASKS.map((t) => [t.id, t])) as Record<TaskId, (typeof TASKS)[number]>;
export interface FinProg { paint: number; light: number; garden: number; decor: number } // 0..1
export const NO_FIN: FinProg = { paint: 0, light: 0, garden: 0, decor: 0 };
export const ITEM_LABEL: Record<ItemType, string> = { stone: 'pedras', brick: 'tijolos', tile: 'telhas', wood: 'madeiras', glass: 'vidros' };
export const ITEM_EMOJI: Record<ItemType, string> = { stone: '🪨', brick: '🧱', tile: '🔺', wood: '🪵', glass: '🪟' };

export function glow(ctx: Ctx, x: number, y: number, r = 44, a = 0.9, rgb = '255,240,180') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

/** Quanto vale cada pacote de material: x1 (comum), x4 (azul) e x10 (dourado). */
export const QTY_STYLE: Record<number, { glow: string; badge: string; label: string }> = {
  1: { glow: '255,240,180', badge: '', label: '' },
  4: { glow: '120,200,255', badge: '#2F8FD0', label: 'x4' },
  10: { glow: '255,205,60', badge: '#C8553D', label: 'x10' },
};

function shape(ctx: Ctx, t: ItemType, gold: boolean) {
  ctx.lineWidth = 3; ctx.lineJoin = 'round';
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
}

/** Material centrado em (x, y). Pacotes x4 aparecem empilhados e com selo azul; x10, dourados. */
export function item(ctx: Ctx, t: ItemType, x: number, y: number, qty = 1, s = 1) {
  const tier = qty >= 10 ? 2 : qty >= 4 ? 1 : 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * [1, 1.1, 1.22][tier], s * [1, 1.1, 1.22][tier]);
  if (tier >= 1) { ctx.save(); ctx.translate(7, -9); ctx.globalAlpha *= 0.9; shape(ctx, t, tier === 2); ctx.restore(); ctx.save(); ctx.translate(-7, -4); shape(ctx, t, tier === 2); ctx.restore(); ctx.translate(2, 4); }
  shape(ctx, t, tier === 2);
  if (tier) {
    const st = QTY_STYLE[qty >= 10 ? 10 : 4];
    ctx.fillStyle = st.badge; ctx.beginPath(); ctx.arc(24, -22, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${tier === 2 ? 12 : 14}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(st.label, 24, -17);
  }
  ctx.restore();
}

/* ---------------- poderes ---------------- */

export const POWERS: Record<PowerId, { label: string; emoji: string; self: boolean; color: string; rgb: string; dur: number; use: string }> = {
  freeze: { label: 'Congelar', emoji: '❄️', self: false, color: '#4FB8E8', rgb: '120,210,250', dur: 3, use: 'JOGAR' },
  speed: { label: 'Turbo', emoji: '⚡', self: true, color: '#E8A12E', rgb: '255,220,80', dur: 6, use: 'USAR' },
  giant: { label: 'Gigante', emoji: '🍄', self: true, color: '#E25B45', rgb: '255,140,120', dur: 7, use: 'USAR' },
  shrink: { label: 'Encolher', emoji: '🔻', self: false, color: '#7B3FA0', rgb: '190,140,230', dur: 6, use: 'JOGAR' },
  fire: { label: 'Fogo', emoji: '🔥', self: false, color: '#F26B1D', rgb: '255,150,60', dur: 5, use: 'JOGAR' },
  magnet: { label: 'Ímã', emoji: '🧲', self: true, color: '#C8553D', rgb: '255,160,150', dur: 6, use: 'USAR' },
  shield: { label: 'Escudo', emoji: '🛡️', self: true, color: '#2F8FD0', rgb: '120,190,255', dur: 8, use: 'USAR' },
};

/** Bolha de poder caindo/parada. */
export function powerBubble(ctx: Ctx, id: PowerId, x: number, y: number, t: number) {
  const P = POWERS[id];
  glow(ctx, x, y, 56, 0.9, P.rgb);
  ctx.save(); ctx.translate(x, y + Math.sin(t * 4) * 3);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fill();
  ctx.strokeStyle = P.color; ctx.lineWidth = 4; ctx.stroke();
  ctx.font = `30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(P.emoji, 0, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(-10, -12, 6, 4, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

export function bee(ctx: Ctx, x: number, y: number, t: number, i: number) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; const fl = Math.sin(t * 60 + i) * 3;
  ctx.beginPath(); ctx.ellipse(-4, -9 - fl, 7, 5, -0.5, 0, TAU); ctx.ellipse(5, -9 + fl, 7, 5, 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#F2C230'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.fillRect(-3, -8, 3, 16); ctx.fillRect(4, -7, 3, 14); ctx.beginPath(); ctx.arc(-11, 0, 3, 0, TAU); ctx.fill();
  ctx.restore();
}

export function boulder(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#8f887d'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5f5a52'; ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(r * 0.2, -r * 0.5); ctx.moveTo(-r * 0.1, r * 0.4); ctx.lineTo(r * 0.5, r * 0.1); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.25, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Raio: aviso no chão (k<1) e depois o raio caindo (k>=1). */
export function bolt(ctx: Ctx, x: number, y: number, k: number, t: number) {
  if (k < 1) {
    ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(t * 14));
    ctx.fillStyle = '#E25B45'; ctx.beginPath(); ctx.ellipse(x, y, 60, 14, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#E25B45'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, 0); ctx.stroke();
    ctx.restore(); return;
  }
  const a = Math.max(0, 1 - (k - 1) * 4);
  ctx.save(); ctx.globalAlpha = a;
  glow(ctx, x, y, 140, 0.9, '255,250,200');
  ctx.strokeStyle = '#FFF6B0'; ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x, 0);
  let yy = 0, xx = x; while (yy < y) { yy += 60; xx = x + (Math.random() - 0.5) * 50; ctx.lineTo(xx, Math.min(y, yy)); }
  ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
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
  { x: 870, y: 338, w: 180 }, // bem acima do telhado: daqui não dá para entregar
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

export function platform(ctx: Ctx, p: Plat, dy = 0, moving = false) {
  ctx.save(); ctx.translate(0, dy);
  ctx.fillStyle = moving ? '#2F6F9F' : '#8b5a2b'; rr(ctx, p.x, p.y, p.w, 26, 10); ctx.fill();
  ctx.fillStyle = moving ? '#4FA3DD' : '#a87443'; rr(ctx, p.x + 4, p.y + 3, p.w - 8, 9, 5); ctx.fill();
  ctx.fillStyle = '#5c3a1a'; for (let i = p.x + 30; i < p.x + p.w - 10; i += 60) { ctx.beginPath(); ctx.arc(i, p.y + 18, 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ---------------- a casa (progresso por fase) ---------------- */

export interface HouseProg { stone: number; brick: number; tile: number; wood: number; glass: number } // 0..1
const HX0 = 812, HX1 = 1108, BASE = ROCK.top;

export function house(ctx: Ctx, p: HouseProg, t: number, opts: { wobble?: number; fall?: number; outline?: boolean; fin?: FinProg } = {}) {
  const f = opts.fin ?? NO_FIN;
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
  // pintura: o rolo passa da esquerda para a direita cobrindo os tijolos
  if (f.paint > 0) {
    const pw = (HX1 - HX0) * f.paint;
    ctx.save(); ctx.beginPath(); ctx.rect(HX0 - 4, BASE - 330, pw + 4, 300); ctx.clip();
    ctx.fillStyle = '#FBF1E1'; ctx.fillRect(HX0 - 2, BASE - 322, HX1 - HX0 + 4, 290);
    ctx.fillStyle = 'rgba(200,170,130,0.12)'; for (let y = BASE - 300; y < BASE - 40; y += 34) ctx.fillRect(HX0, y, HX1 - HX0, 3);
    ctx.fillStyle = '#E9CFAE'; ctx.fillRect(HX0 - 2, BASE - 322, 14, 290); ctx.fillRect(HX1 - 12, BASE - 322, 14, 290);
    ctx.fillStyle = C.terra; ctx.fillRect(HX0 - 2, BASE - 58, HX1 - HX0 + 4, 24);
    ctx.restore();
    if (f.paint < 1) { // borda molhada + rolo
      const ex = HX0 + pw;
      ctx.fillStyle = '#F2DFC4'; ctx.fillRect(ex - 6, BASE - 322, 8, 290);
      ctx.fillStyle = '#E26D9A'; rr(ctx, ex - 10, BASE - 200 + Math.sin(t * 8) * 60, 22, 60, 8); ctx.fill();
    }
  }
  // porta (madeira) e janelas (vidro)
  if (p.wood > 0) {
    const dh = 130 * p.wood;
    ctx.fillStyle = f.paint >= 1 ? '#3E6B48' : '#8b5a2b'; rr(ctx, 930, BASE - 34 - dh, 64, dh, [26, 26, 0, 0]); ctx.fill();
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 3; ctx.stroke();
    if (p.wood >= 1) { ctx.fillStyle = '#F3C64A'; ctx.beginPath(); ctx.arc(982, BASE - 100, 4, 0, TAU); ctx.fill(); }
    // guirlanda na porta
    const wr = pop(f.decor, 0.3);
    if (wr > 0) { ctx.save(); ctx.translate(962, BASE - 128); ctx.scale(wr, wr); ctx.strokeStyle = '#3E6B48'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke(); ctx.fillStyle = C.terra; for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 3.5, 0, TAU); ctx.fill(); } ctx.restore(); }
  }
  // placa "Casa de Paz" acima da porta
  const pl = pop(f.decor, 0.5);
  if (pl > 0) { ctx.save(); ctx.translate(962, BASE - 282); ctx.scale(pl, pl); ctx.fillStyle = '#8b5a2b'; rr(ctx, -58, -15, 116, 30, 8); ctx.fill(); ctx.fillStyle = '#FBF1E1'; ctx.font = `900 16px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Casa de Paz', 0, 6); ctx.restore(); }
  for (const [wx, i] of [[848, 0], [1030, 1]] as const) {
    const q = Math.max(0, Math.min(1, p.glass * 2 - i));
    if (q <= 0) continue;
    if (f.light > 0) glow(ctx, wx + 28, BASE - 202, 70, 0.7 * f.light);
    ctx.save(); ctx.globalAlpha *= q; ctx.fillStyle = f.light > 0 ? mix('#ffe28a', '#fff4c2', f.light) : '#ffe28a'; ctx.fillRect(wx, BASE - 230, 56, 56); ctx.restore();
    const sh = pop(f.decor, 0.85);
    if (sh > 0) { ctx.fillStyle = '#3E6B48'; ctx.fillRect(wx - 6 - 20 * sh, BASE - 232, 20 * sh, 60); ctx.fillRect(wx + 62, BASE - 232, 20 * sh, 60); }
    ctx.strokeStyle = f.paint >= 1 ? '#fff' : '#5c3a1a'; ctx.lineWidth = 5; ctx.strokeRect(wx, BASE - 230, 56, 56);
    const fb = pop(f.decor, 0.15);
    if (fb > 0) {
      ctx.save(); ctx.translate(wx + 28, BASE - 168); ctx.scale(fb, fb);
      ctx.fillStyle = '#8b5a2b'; rr(ctx, -34, 0, 68, 14, 4); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#E26D9A', '#F2A541', '#fff', '#E25B45', '#7B3FA0'][i]; ctx.beginPath(); ctx.arc(-26 + i * 13, -3, 6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
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
  // varal de luzes no beiral e luminária da porta
  if (f.light > 0 && !fall) {
    const pts: [number, number][] = [];
    const seg = (x0: number, y0: number, x1: number, y1: number, n: number) => { for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; pts.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 14 + 10]); } };
    seg(772, BASE - 330, 960, BASE - 476, 8); seg(960, BASE - 476, 1148, BASE - 330, 8); seg(800, BASE - 326, 1120, BASE - 326, 10);
    ctx.strokeStyle = 'rgba(43,33,24,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 6) : ctx.moveTo(x, y - 6))); ctx.stroke();
    const lit = Math.floor(f.light * pts.length);
    pts.forEach(([x, y], i) => {
      const on = i < lit, tw = on ? 0.75 + 0.25 * Math.sin(t * 5 + i) : 0;
      if (on) glow(ctx, x, y, 22, 0.8 * tw);
      ctx.fillStyle = on ? ['#FFE28A', '#FFB86B', '#FFF4C2'][i % 3] : '#d9cdb8'; ctx.beginPath(); ctx.ellipse(x, y, 6, 8, 0, 0, TAU); ctx.fill();
    });
    if (f.light >= 1) { glow(ctx, 1012, BASE - 150, 50, 0.9); ctx.fillStyle = C.ink; rr(ctx, 1004, BASE - 166, 16, 8, 3); ctx.fill(); ctx.fillStyle = '#FFE28A'; rr(ctx, 1006, BASE - 158, 12, 18, 5); ctx.fill(); }
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
  if (carrying) item(ctx, carrying, 0, -40, 1, 0.8);
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

/** Aparece com um pulinho quando o progresso passa de `at` (0 = escondido, termina em 1). */
const pop = (v: number, at: number) => {
  const k = Math.max(0, Math.min(1, (v - at) / 0.12));
  if (k <= 0) return 0;
  const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); // easeOutBack
};

function tree(ctx: Ctx, x: number, y: number, s: number, t: number) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.3 + x) * 0.015);
  ctx.fillStyle = '#7a4f2a'; rr(ctx, -12, -120, 24, 120, 8); ctx.fill();
  for (const [cx, cy, r, c] of [[-40, -150, 48, '#5E8C3A'], [40, -150, 48, '#5E8C3A'], [0, -200, 60, '#6E9E45'], [-10, -140, 50, '#4f7a30']] as const) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#E25B45'; for (const [ax, ay] of [[-30, -170], [28, -190], [10, -140], [-50, -130], [46, -140]]) { ctx.beginPath(); ctx.arc(ax, ay, 7, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function bush(ctx: Ctx, x: number, y: number, s: number) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (const [cx, cy, r] of [[-26, -18, 24], [0, -30, 30], [26, -18, 24]]) { ctx.fillStyle = '#5E8C3A'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#F3C64A'; for (const [cx, cy] of [[-20, -26], [6, -42], [22, -22]]) { ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill(); }
  ctx.restore();
}
const FLOWERS: [number, string][] = [[90, '#E26D9A'], [1840, '#F2A541'], [220, '#fff'], [1700, '#E25B45'], [370, '#7B3FA0'], [1580, '#E26D9A'], [150, '#F2A541'], [1780, '#fff'], [300, '#E25B45'], [1650, '#7B3FA0'], [440, '#E26D9A'], [1500, '#F2A541'], [40, '#7B3FA0'], [1880, '#E26D9A'], [520, '#fff'], [1420, '#E25B45']];

/** Acabamento fora da casa (jardim, escada na rocha, cerquinha). Desenhado antes das plataformas. */
export function finishBack(ctx: Ctx, f: FinProg, t: number) {
  if (!f.garden && !f.decor) return;
  // escada de pedra esculpida na rocha, até a porta
  const st = pop(f.decor, 0.0);
  if (st > 0) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, st);
    const steps = [[1040, 260], [1000, 220], [960, 180], [920, 140], [884, 104]];
    steps.forEach(([y, w], i) => { ctx.fillStyle = i % 2 ? '#E3DCCF' : '#D6CEBF'; rr(ctx, 962 - w / 2, y - 4, w, 40, 6); ctx.fill(); ctx.strokeStyle = 'rgba(80,72,64,0.35)'; ctx.lineWidth = 3; ctx.stroke(); });
    ctx.restore();
  }
  // cerquinha branca e caixa de correio
  const fe = pop(f.decor, 0.68);
  if (fe > 0) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, fe);
    for (const [a, b] of [[560, 700], [1230, 1370]]) {
      ctx.fillStyle = '#fff'; ctx.fillRect(a, GROUND - 46, b - a, 7); ctx.fillRect(a, GROUND - 24, b - a, 7);
      for (let x = a; x <= b - 10; x += 22) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x, GROUND - 56); ctx.lineTo(x + 6, GROUND - 64); ctx.lineTo(x + 12, GROUND - 56); ctx.lineTo(x + 12, GROUND); ctx.fill(); }
    }
    ctx.fillStyle = '#6b5643'; ctx.fillRect(1395, GROUND - 70, 8, 70); ctx.fillStyle = C.terra; rr(ctx, 1380, GROUND - 98, 40, 30, [14, 14, 4, 4]); ctx.fill();
    ctx.restore();
  }
  // jardim: árvores crescem, arbustos e flores pelo chão
  const g = f.garden;
  const grow = (a: number, b: number) => { const k = Math.max(0, Math.min(1, (g - a) / (b - a))); return k <= 0 ? 0 : 1 - Math.pow(1 - k, 3); };
  tree(ctx, 470, GROUND + 4, grow(0, 0.3), t);
  tree(ctx, 1480, GROUND + 4, grow(0.15, 0.45) * 0.9, t);
  bush(ctx, 668, GROUND + 6, grow(0.4, 0.55));
  bush(ctx, 1262, GROUND + 6, grow(0.45, 0.6));
  const nf = Math.floor(Math.max(0, (g - 0.5) / 0.5) * FLOWERS.length + (g >= 1 ? FLOWERS.length : 0));
  FLOWERS.slice(0, nf).forEach(([x, c]) => {
    ctx.strokeStyle = '#5E8C3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, GROUND + 4); ctx.lineTo(x, GROUND - 22); ctx.stroke();
    ctx.fillStyle = c; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 7, GROUND - 26 + Math.sin(a) * 7, 6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x, GROUND - 26, 4, 0, TAU); ctx.fill();
  });
}

/** Cama elástica no chão (squish 0..1 quando alguém acabou de quicar). */
export function trampoline(ctx: Ctx, x: number, w: number, squish: number) {
  const top = GROUND - 40 + squish * 16;
  ctx.save();
  ctx.strokeStyle = '#6b5643'; ctx.lineWidth = 5;
  for (const lx of [x + 12, x + w - 12]) { ctx.beginPath(); ctx.moveTo(lx, GROUND + 4); ctx.lineTo(lx, top + 6); ctx.stroke(); }
  ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i <= 6; i++) { const yy = top + 8 + ((GROUND - top - 8) * i) / 6; ctx.lineTo(x + w / 2 + (i % 2 ? 14 : -14), yy); }
  ctx.stroke();
  ctx.fillStyle = C.terra; rr(ctx, x, top - 4, w, 12, 6); ctx.fill();
  ctx.fillStyle = C.amber; rr(ctx, x + 8, top - 2, w - 16, 5, 3); ctx.fill();
  ctx.restore();
}

/** Balão que atravessa o céu trazendo material dourado. */
export function balloon(ctx: Ctx, x: number, y: number, t: number, hasItem: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.7) * 0.05);
  ctx.strokeStyle = 'rgba(43,33,24,0.6)'; ctx.lineWidth = 2;
  if (hasItem) { ctx.beginPath(); ctx.moveTo(0, 46); ctx.lineTo(0, 82); ctx.stroke(); }
  ctx.fillStyle = C.terra; ctx.beginPath(); ctx.ellipse(0, 0, 40, 48, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.ellipse(0, 0, 14, 48, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-16, -18, 8, 14, -0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9c3f2b'; ctx.beginPath(); ctx.moveTo(-6, 46); ctx.lineTo(6, 46); ctx.lineTo(0, 54); ctx.fill();
  ctx.restore();
}

/* ---------------- desmoronamento ---------------- */

export interface Debris { x: number; y: number; w: number; h: number; kind: ItemType; color: string; vx: number; vy: number; rot: number; vr: number; delay: number; hits: number }

/** Quebra a casa (no estado em que está) em pedaços soltos, na mesma posição do desenho. */
export function houseDebris(p: HouseProg): Debris[] {
  const out: Debris[] = [];
  const add = (x: number, y: number, w: number, h: number, kind: ItemType, color: string) => {
    const cx = x + w / 2, cy = y + h / 2;
    out.push({ x: cx, y: cy, w, h, kind, color, vx: 0, vy: 0, rot: 0, vr: 0, delay: Math.max(0, (cy - (BASE - 480)) / 480) * 2.2 + Math.random() * 0.5, hits: 0 });
  };
  const ns = Math.round(p.stone * 9);
  for (let i = 0; i < ns; i++) add(800 + i * 36, BASE - 34, 34, 34, 'stone', ['#bdb7ac', '#d3cdc2', '#a9a398'][i % 3]);
  const rows = 13, perRow = 8, nb = Math.round(p.brick * rows * perRow);
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < perRow; c++) {
    if (k++ >= nb) continue;
    const w = 38, h = 22, off = r % 2 ? 19 : 0, x = HX0 + c * w + off, y = BASE - 34 - (r + 1) * h;
    if (x + w > HX1 + 4) continue;
    add(x, y, Math.min(w - 3, HX1 - x), h - 3, 'brick', (r + c) % 3 ? '#C8553D' : '#B44A34');
  }
  if (p.wood > 0) { const dh = 130 * p.wood; add(930, BASE - 34 - dh, 32, dh, 'wood', '#8b5a2b'); add(962, BASE - 34 - dh, 32, dh, 'wood', '#7a4f26'); }
  for (const [wx, i] of [[848, 0], [1030, 1]] as const) if (p.glass * 2 - i > 0) add(wx, BASE - 230, 56, 56, 'glass', '#ffe28a');
  if (p.tile > 0) {
    const top = BASE - 330 - 146 * p.tile;
    for (let y = BASE - 330; y > top - 18; y -= 18) for (let x = 770 + ((y / 18) % 2) * 14; x < 1150; x += 28) {
      const half = ((y - (BASE - 476)) / 146) * 188; // meia largura do telhado nessa altura
      if (Math.abs(x - 960) > half - 6 || y < BASE - 476) continue;
      add(x - 15, y - 15, 30, 15, 'tile', ((x + y) / 14) % 3 < 1 ? '#c23d31' : '#D9483B');
    }
  }
  return out;
}

export function drawDebris(ctx: Ctx, d: Debris) {
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
  ctx.fillStyle = d.color;
  if (d.kind === 'tile') { ctx.beginPath(); ctx.arc(0, d.h / 2, d.w / 2, Math.PI, 0); ctx.fill(); }
  else {
    rr(ctx, -d.w / 2, -d.h / 2, d.w, d.h, d.kind === 'stone' ? 8 : 4); ctx.fill();
    if (d.kind === 'stone' || d.kind === 'glass' || d.kind === 'wood') { ctx.strokeStyle = d.kind === 'stone' ? '#4a4540' : '#5c3a1a'; ctx.lineWidth = d.kind === 'glass' ? 5 : 3; ctx.stroke(); }
  }
  ctx.restore();
}
