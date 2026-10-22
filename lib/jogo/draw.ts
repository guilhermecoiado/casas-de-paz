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
  wings: { label: 'Asas', emoji: '🕊️', self: true, color: '#8C9C2E', rgb: '220,240,170', dur: 6, use: 'USAR' },
  double: { label: 'Pontos x2', emoji: '💎', self: true, color: '#7B3FA0', rgb: '210,170,250', dur: 10, use: 'USAR' },
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
export type PlatKind = 'plank' | 'branch' | 'cloud' | 'board' | 'deck' | 'isle' | 'bridge' | 'boat' | 'see';
export interface Plat { x: number; y: number; w: number; kind?: PlatKind }
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
export function scenery(ctx: Ctx, t: number, dark = 0, dusk = false) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix(dusk ? '#F2B48C' : '#CFE6F2', '#4a5a6e', dark)); g.addColorStop(0.55, mix(dusk ? '#F8DDBF' : '#F4EBDD', '#7d8794', dark)); g.addColorStop(1, mix('#F7F0E4', '#9aa0a6', dark));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sol
  ctx.save(); ctx.globalAlpha = 1 - dark;
  ctx.fillStyle = 'rgba(242,165,65,0.25)'; ctx.beginPath(); ctx.arc(1780, 330, 90, 0, TAU); ctx.fill();
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(1780, 330, 52, 0, TAU); ctx.fill(); ctx.restore();
  const drift = (t * 12) % (W + 400);
  cloud(ctx, ((220 + drift) % (W + 400)) - 200, 250, 1.2, 0.9 - dark * 0.3);
  cloud(ctx, ((900 + drift * 0.7) % (W + 400)) - 200, 210, 0.9, 0.8 - dark * 0.3);
  cloud(ctx, ((1260 + drift * 0.85) % (W + 400)) - 200, 300, 1.1, 0.85 - dark * 0.3);
  ctx.fillStyle = mix(dusk ? '#A9C28A' : '#B9CF9A', '#5f6b55', dark); ctx.beginPath(); ctx.moveTo(0, 800); ctx.quadraticCurveTo(300, 640, 640, 760); ctx.quadraticCurveTo(980, 860, 1300, 720); ctx.quadraticCurveTo(1650, 600, 1920, 760); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080); ctx.fill();
  ctx.fillStyle = mix('#9DBB7C', '#4f5c48', dark); ctx.beginPath(); ctx.moveTo(0, 880); ctx.quadraticCurveTo(420, 760, 900, 860); ctx.quadraticCurveTo(1400, 960, 1920, 840); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080); ctx.fill();
  ctx.fillStyle = mix('#E9D3A8', '#8f8670', dark); ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = mix('#7FAE52', '#4c6b38', dark); rr(ctx, -20, GROUND - 12, W + 40, 26, 13); ctx.fill();
  // rocha
  ctx.fillStyle = mix('#A9A398', '#6d6962', dark); ctx.beginPath(); ctx.moveTo(700, 1080); ctx.lineTo(ROCK.x0, 905); ctx.lineTo(790, ROCK.top); ctx.lineTo(1130, ROCK.top); ctx.lineTo(ROCK.x1, 900); ctx.lineTo(1230, 1080); ctx.fill();
  ctx.fillStyle = mix('#C9C3B8', '#86827b', dark); ctx.beginPath(); ctx.moveTo(735, 905); ctx.lineTo(795, 876); ctx.lineTo(980, 874); ctx.lineTo(920, 930); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6f695f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1000, 900); ctx.lineTo(1040, 960); ctx.lineTo(1020, 1020); ctx.stroke();
}

export function platform(ctx: Ctx, p: Plat, dy = 0, moving = false, warn = 0, gone = false, t = 0) {
  if (p.kind && p.kind !== 'plank') { ctx.save(); ctx.translate(0, dy); platKind(ctx, p, warn, gone, t); ctx.restore(); return; }
  ctx.save(); ctx.translate(0, dy);
  ctx.fillStyle = moving ? '#2F6F9F' : '#8b5a2b'; rr(ctx, p.x, p.y, p.w, 26, 10); ctx.fill();
  ctx.fillStyle = moving ? '#4FA3DD' : '#a87443'; rr(ctx, p.x + 4, p.y + 3, p.w - 8, 9, 5); ctx.fill();
  ctx.fillStyle = '#5c3a1a'; for (let i = p.x + 30; i < p.x + p.w - 10; i += 60) { ctx.beginPath(); ctx.arc(i, p.y + 18, 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

/* ---------------- tela 2: vale do rio ---------------- */

export const RIVER = { x0: 640, x1: 1250, top: 950, bed: 1010 };
export const CLIFF = { x0: 1250, top: 740 };
export const WIND = { x0: 470, x1: 560, top: 300 };
const CLIFF_STEPS: [number, number][] = [[1250, 892], [1280, 854], [1310, 816], [1340, 778], [1370, 740]];
/** Altura do penhasco (escada esculpida + topo) em x, ou null fora dele. */
export function cliffSurface(x: number): number | null {
  if (x < CLIFF.x0) return null;
  let y = CLIFF_STEPS[0][1];
  for (const [sx, sy] of CLIFF_STEPS) if (x >= sx) y = sy;
  return y;
}

function platKind(ctx: Ctx, p: Plat, warn: number, gone: boolean, t: number) {
  const { x, y, w } = p;
  switch (p.kind) {
    case 'branch': {
      const left = x + w / 2 < 190, x0 = left ? x + w : x, x1 = left ? x : x + w, d = left ? -1 : 1;
      ctx.fillStyle = '#7A4F2A'; ctx.beginPath(); ctx.moveTo(x0 - d * 20, y - 2); ctx.quadraticCurveTo((x0 + x1) / 2, y - 4, x1, y + 2); ctx.lineTo(x1, y + 12); ctx.quadraticCurveTo((x0 + x1) / 2, y + 26, x0 - d * 20, y + 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#A8794A'; rr(ctx, Math.min(x0, x1), y - 2, w, 7, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(50,30,15,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y + 14); ctx.lineTo(x1 - d * 30, y + 12); ctx.stroke();
      for (const [a, b, r, c] of [[0, -6, 22, '#4E8A3A'], [-d * 20, -14, 16, '#5E8C3A'], [d * 12, -22, 14, '#4E8A3A'], [-d * 6, -18, 8, '#7FB55A']] as const) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x1 + d * 6 + a, y + b, r, 0, TAU); ctx.fill(); }
      break;
    }
    case 'cloud': {
      ctx.save(); ctx.globalAlpha *= gone ? 0.16 : 1 - warn * 0.55;
      if (warn > 0 && !gone) ctx.translate(Math.sin(t * 50) * 3 * warn, 0);
      ctx.fillStyle = '#fff';
      for (let i = 0; i <= 4; i++) { const cx = x + 18 + (i * (w - 36)) / 4; ctx.beginPath(); ctx.arc(cx, y + 14 - (i % 2) * 8, 24 + (i % 2) * 6, 0, TAU); ctx.fill(); }
      rr(ctx, x, y, w, 32, 16); ctx.fill();
      if (gone) { ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(43,33,24,0.5)'; ctx.lineWidth = 3; rr(ctx, x, y - 10, w, 42, 20); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'board': {
      if (gone) { ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(43,33,24,0.3)'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, 18); ctx.restore(); break; }
      const n = Math.max(2, Math.round(w / 56)), bw = w / n;
      for (let i = 0; i < n; i++) {
        ctx.save(); ctx.translate(x + i * bw + bw / 2, y + 9); ctx.rotate(warn > 0 ? Math.sin(t * 40 + i) * 0.08 * warn : 0);
        ctx.fillStyle = i % 2 ? '#a87443' : '#9a6a3c'; rr(ctx, -bw / 2 + 2, -9, bw - 4, 18, 4); ctx.fill();
        ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-bw / 4, -9); ctx.lineTo(-bw / 8, 2); ctx.lineTo(bw / 6, 9); ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'deck': {
      ctx.fillStyle = '#6b4a2a'; for (let px = x + 14; px < x + w; px += 64) ctx.fillRect(px, y + 14, 12, H - y);
      ctx.fillStyle = '#8b5a2b'; rr(ctx, x, y, w, 18, 5); ctx.fill();
      ctx.fillStyle = '#a87443'; for (let px = x + 3; px < x + w - 6; px += 22) { rr(ctx, px, y + 2, 19, 7, 3); ctx.fill(); }
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x + 4, y - 44, 8, 44); ctx.fillStyle = '#C8553D'; ctx.beginPath(); ctx.arc(x + 8, y - 46, 8, 0, TAU); ctx.fill();
      break;
    }
    case 'isle': {
      ctx.fillStyle = '#8F887D'; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + w, y + 6); ctx.lineTo(x + w * 0.72, y + 62); ctx.lineTo(x + w * 0.45, y + 92); ctx.lineTo(x + w * 0.22, y + 56); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#A9A398'; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + 10); ctx.lineTo(x + w * 0.5, y + 10); ctx.lineTo(x + w * 0.4, y + 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7FAE52'; rr(ctx, x - 6, y - 6, w + 12, 18, 9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + w * 0.45 + Math.sin(t * 2 + i) * 20, y + 110 + i * 14, 4, 0, TAU); ctx.fill(); }
      break;
    }
    case 'bridge': {
      ctx.fillStyle = '#6b5643'; ctx.fillRect(x - 6, y - 50, 12, 80); ctx.fillRect(x + w - 6, y - 50, 12, 80);
      ctx.strokeStyle = '#6b5643'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.quadraticCurveTo(x + w / 2, y - 6, x + w, y - 46); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.quadraticCurveTo(x + w / 2, y + 22, x + w, y + 4); ctx.stroke();
      for (let i = 0; i <= 10; i++) { const k = i / 10, px = x + w * k, sag = Math.sin(k * Math.PI) * 8; ctx.fillStyle = i % 2 ? '#a87443' : '#9a6a3c'; rr(ctx, px - 16, y + sag, 32, 12, 4); ctx.fill(); ctx.strokeStyle = 'rgba(107,86,67,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, y + sag); ctx.lineTo(px, y - 46 + Math.sin(k * Math.PI) * 20); ctx.stroke(); }
      break;
    }
    case 'boat': {
      ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(x - 10, y + 4); ctx.lineTo(x + w + 10, y + 4); ctx.lineTo(x + w - 20, y + 46); ctx.lineTo(x + 20, y + 46); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a87443'; rr(ctx, x - 10, y - 2, w + 20, 10, 4); ctx.fill();
      ctx.fillStyle = '#C8553D'; ctx.fillRect(x + 10, y + 16, w - 20, 6);
      break;
    }
  }
}

/** Gangorra: duas pontas (esquerda e direita) que sobem e descem. */
export function seesaw(ctx: Ctx, l: Plat, r: Plat) {
  const x0 = l.x, x1 = r.x + r.w, cx = (x0 + x1) / 2, cy = (l.y + r.y) / 2 + 14;
  ctx.fillStyle = '#6b5643'; ctx.beginPath(); ctx.moveTo(cx - 34, GROUND + 4); ctx.lineTo(cx, cy); ctx.lineTo(cx + 34, GROUND + 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9c3f2b'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 + 8, l.y + 9); ctx.lineTo(x1 - 8, r.y + 9); ctx.stroke();
  ctx.strokeStyle = C.terra; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x0 + 8, l.y + 6); ctx.lineTo(x1 - 8, r.y + 6); ctx.stroke();
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, TAU); ctx.fill();
}

/** Coluna de vento que leva para cima. */
export function windColumn(ctx: Ctx, t: number) {
  const { x0, x1, top } = WIND;
  ctx.save();
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, top, x1 - x0, GROUND - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const yy = GROUND - (((t * 380 + i * 77) % (GROUND - top))), xx = x0 + 18 + ((i * 29) % (x1 - x0 - 36)); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 34); ctx.stroke(); }
  ctx.fillStyle = '#8FBF5A'; for (let i = 0; i < 4; i++) { const yy = GROUND - (((t * 300 + i * 160) % (GROUND - top))); ctx.save(); ctx.translate(x0 + 30 + Math.sin(t * 3 + i) * 22, yy); ctx.rotate(t * 4 + i); ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = '#6b5643'; rr(ctx, x0 + 6, GROUND - 14, x1 - x0 - 12, 18, 6); ctx.fill(); ctx.fillStyle = '#4a3a2c'; for (let xx = x0 + 16; xx < x1 - 12; xx += 14) ctx.fillRect(xx, GROUND - 12, 6, 12);
  ctx.restore();
}

/** Cenário da tela 2: vale, rio, penhasco com escada e a árvore gigante (atrás das plataformas). */
export function scenery2(ctx: Ctx, t: number, dark = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('#9CC3E0', '#4a5a6e', dark)); g.addColorStop(0.45, mix('#F7D9B0', '#7d8794', dark)); g.addColorStop(1, mix('#F6C48F', '#9aa0a6', dark));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const drift = (t * 10) % (W + 400);
  cloud(ctx, ((700 + drift) % (W + 400)) - 200, 170, 0.9, 0.7 - dark * 0.3);
  cloud(ctx, ((1500 + drift * 0.8) % (W + 400)) - 200, 230, 0.8, 0.6 - dark * 0.3);
  ctx.fillStyle = mix('#B7C9D6', '#56606a', dark); ctx.beginPath(); ctx.moveTo(0, 640);
  for (const [a, b] of [[200, 470], [420, 600], [640, 430], [900, 620], [1150, 480], [1400, 610], [1650, 450], [1920, 590]]) ctx.lineTo(a, b);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  ctx.fillStyle = mix('#E6EEF3', '#7a848c', dark); for (const [a, b] of [[640, 430], [1650, 450], [200, 470]]) { ctx.beginPath(); ctx.moveTo(a - 40, b + 30); ctx.lineTo(a, b); ctx.lineTo(a + 40, b + 30); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = mix('#9DBB7C', '#4f5c48', dark); ctx.beginPath(); ctx.moveTo(0, 780); ctx.quadraticCurveTo(500, 700, 1000, 790); ctx.quadraticCurveTo(1400, 850, 1920, 760); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
  // chão (só à esquerda do rio)
  ctx.fillStyle = mix('#E9D3A8', '#8f8670', dark); ctx.fillRect(0, GROUND, RIVER.x0, H - GROUND);
  ctx.fillStyle = mix('#7FAE52', '#4c6b38', dark); rr(ctx, -20, GROUND - 12, RIVER.x0 + 30, 26, 13); ctx.fill();
  // leito e margens do rio
  const rg = ctx.createLinearGradient(0, RIVER.top, 0, H); rg.addColorStop(0, mix('#4F98CC', '#2f4f66', dark)); rg.addColorStop(1, mix('#2E6696', '#1e3346', dark));
  ctx.fillStyle = rg; ctx.fillRect(RIVER.x0, RIVER.top - 10, RIVER.x1 - RIVER.x0 + 20, H - RIVER.top + 10);
  ctx.fillStyle = mix('#8a6a48', '#4a3a2c', dark); ctx.beginPath(); ctx.moveTo(RIVER.x0 - 10, GROUND); ctx.lineTo(RIVER.x0 + 14, GROUND); ctx.lineTo(RIVER.x0 + 4, H); ctx.lineTo(RIVER.x0 - 10, H); ctx.fill();
  // penhasco com escada esculpida
  ctx.fillStyle = mix('#A9A398', '#6d6962', dark); ctx.beginPath(); ctx.moveTo(CLIFF.x0 - 20, H); ctx.lineTo(CLIFF.x0, CLIFF_STEPS[0][1] + 20);
  CLIFF_STEPS.forEach(([sx, sy]) => { ctx.lineTo(sx, sy); ctx.lineTo(sx + 30, sy); }); ctx.lineTo(W, CLIFF.top); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = mix('#E3DCCF', '#8a857d', dark); CLIFF_STEPS.slice(0, -1).forEach(([sx, sy]) => { rr(ctx, sx - 2, sy - 2, 34, 12, 4); ctx.fill(); });
  ctx.fillStyle = mix('#C9C3B8', '#86827b', dark); ctx.beginPath(); ctx.moveTo(1420, 790); ctx.lineTo(1520, 760); ctx.lineTo(1700, 770); ctx.lineTo(1600, 840); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6f695f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1500, 880); ctx.lineTo(1540, 950); ctx.lineTo(1520, 1030); ctx.moveTo(1760, 820); ctx.lineTo(1790, 900); ctx.stroke();
  ctx.fillStyle = mix('#7FAE52', '#4c6b38', dark); rr(ctx, CLIFF_STEPS[4][0] - 6, CLIFF.top - 12, W - CLIFF_STEPS[4][0] + 30, 24, 12); ctx.fill();
  // árvore gigante (o tronco e a copa; os galhos são plataformas)
  const tx = 190, blob = (a: number, b: number, r: number, c: string) => { ctx.fillStyle = mix(c, '#33402c', dark); ctx.beginPath(); ctx.arc(a, b, r, 0, TAU); ctx.fill(); };
  const sway = Math.sin(t * 0.8) * 3;
  for (const [a, b, r] of [[60, 230, 110], [300, 190, 120], [190, 110, 120], [380, 300, 90], [0, 350, 90], [120, 50, 90], [290, 70, 80]]) blob(a + sway, b, r, '#3F6B2A');
  ctx.fillStyle = mix('#6A4223', '#3a2a1c', dark); for (const [d, k] of [[-1, 1], [1, 1], [-1, 0.6], [1, 0.55]]) { ctx.beginPath(); ctx.moveTo(tx - 30 * d, GROUND - 50); ctx.quadraticCurveTo(tx + 70 * d * k * 1.6, GROUND - 30, tx + 120 * d * k * 1.4, GROUND + 5); ctx.lineTo(tx + 40 * d, GROUND + 5); ctx.closePath(); ctx.fill(); }
  const tg = ctx.createLinearGradient(tx - 60, 0, tx + 60, 0); tg.addColorStop(0, mix('#5A381D', '#2e2016', dark)); tg.addColorStop(0.5, mix('#8A5A30', '#4a3626', dark)); tg.addColorStop(1, mix('#5A381D', '#2e2016', dark));
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(tx - 62, GROUND + 5); ctx.bezierCurveTo(tx - 48, 700, tx - 40, 400, tx - 30, 150); ctx.lineTo(tx + 30, 150); ctx.bezierCurveTo(tx + 40, 400, tx + 48, 700, tx + 62, GROUND + 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(50,30,15,0.45)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { const xx = tx - 36 + i * 9; ctx.beginPath(); ctx.moveTo(xx, 900); ctx.bezierCurveTo(xx + 8, 700, xx - 8, 500, xx + (i - 4) * 2, 180); ctx.stroke(); }
  ctx.fillStyle = '#3A2412'; ctx.beginPath(); ctx.ellipse(tx + 4, 620, 14, 22, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7A4F2A'; ctx.lineWidth = 4; ctx.stroke();
  for (const [a, b, r] of [[100, 200, 95], [260, 150, 105], [180, 70, 100], [340, 270, 75], [30, 300, 70], [230, 250, 80]]) blob(a + sway, b, r, '#5E8C3A');
  for (const [a, b, r] of [[80, 170, 45], [240, 110, 50], [170, 40, 40], [320, 230, 35]]) blob(a + sway, b, r, '#7FB55A');
  [[70, 240], [150, 120], [280, 190], [330, 300], [210, 40], [30, 330], [250, 280]].forEach(([a, b], i) => blob(a + sway, b, 8, i % 2 ? '#E26D9A' : '#E8A12E'));
  // ninho com passarinho e balanço
  ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.ellipse(tx + 150, 556, 26, 10, 0, 0, Math.PI); ctx.fill(); blob(tx + 160, 542, 11, '#2F5F95');
  ctx.fillStyle = '#F2A541'; ctx.beginPath(); ctx.moveTo(tx + 170, 540); ctx.lineTo(tx + 182, 543); ctx.lineTo(tx + 170, 546); ctx.fill();
  const sw = Math.sin(t * 1.6) * 10;
  ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(70, 694); ctx.lineTo(60 + sw, 860); ctx.moveTo(140, 694); ctx.lineTo(130 + sw, 860); ctx.stroke();
  ctx.fillStyle = C.terra; rr(ctx, 48 + sw, 858, 94, 12, 4); ctx.fill();
}

/** Baleia: rot = direção da cabeça (segue o salto), open 0..1 = boca. Tudo fica dentro do contorno do corpo. */
export function whale(ctx: Ctx, x: number, y: number, rot: number, open: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (Math.cos(rot) < 0) ctx.scale(1, -1); // indo para a esquerda: barriga continua para baixo
  const body = () => { ctx.beginPath(); ctx.ellipse(0, 0, 140, 66, 0, 0, TAU); };
  // cauda (presa no fim do corpo)
  const flap = Math.sin(t * 9) * 12;
  ctx.fillStyle = '#3E6E9E'; ctx.beginPath(); ctx.moveTo(-110, -16); ctx.quadraticCurveTo(-160, -10, -200, -58 + flap); ctx.quadraticCurveTo(-185, 0, -200, 58 + flap); ctx.quadraticCurveTo(-160, 10, -110, 16); ctx.closePath(); ctx.fill();
  // nadadeira de cima
  ctx.beginPath(); ctx.moveTo(-40, -58); ctx.quadraticCurveTo(-24, -96, 0, -100); ctx.quadraticCurveTo(-6, -76, 14, -60); ctx.closePath(); ctx.fill();
  body(); ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = '#DCEAF3'; ctx.beginPath(); ctx.ellipse(10, 54, 150, 40, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(62,110,158,0.5)'; ctx.lineWidth = 3; for (let i = -70; i <= 70; i += 20) { ctx.beginPath(); ctx.moveTo(i, 28); ctx.lineTo(i + 8, 70); ctx.stroke(); }
  // boca: abre por dentro do corpo (articulação perto do olho)
  const hx = 34, hy = 12, top = -6 - 34 * open, bot = 18 + 46 * open;
  if (open > 0.05) {
    ctx.fillStyle = '#7A1F2B'; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(150, top); ctx.lineTo(150, bot); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#E26D9A'; ctx.beginPath(); ctx.ellipse(96, bot - 8 * open, 34, 10 * open, 0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) { const k = 0.35 + i * 0.17, px = hx + (150 - hx) * k, py = hy + (top - hy) * k; ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py); ctx.lineTo(px, py + 12 * open); ctx.closePath(); ctx.fill(); }
  } else { ctx.strokeStyle = '#1F4570'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy + 4); ctx.quadraticCurveTo(90, 22, 140, 6); ctx.stroke(); }
  ctx.restore();
  // olho e borrifo
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(40, -26, 12, 0, TAU); ctx.fill(); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(44, -26, 6, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Água do rio (por cima de quem está nadando). */
export function riverWater(ctx: Ctx, t: number) {
  ctx.save(); ctx.beginPath(); ctx.rect(RIVER.x0, 0, RIVER.x1 - RIVER.x0, H); ctx.clip();
  water(ctx, RIVER.top, t); ctx.restore();
}

/** Acabamento da tela 2: jardim no alto do penhasco, poste aceso, cerquinha e flores no vale. */
export function finishBack2(ctx: Ctx, f: FinProg, t: number) {
  const top = CLIFF.top;
  const g = f.garden, grow = (a: number, b: number) => { const k = Math.max(0, Math.min(1, (g - a) / (b - a))); return k <= 0 ? 0 : 1 - Math.pow(1 - k, 3); };
  tree(ctx, 1880, top + 4, grow(0, 0.3) * 0.8, t);
  bush(ctx, 600, GROUND + 6, grow(0.4, 0.6));
  const nf = Math.floor(Math.max(0, (g - 0.4) / 0.6) * 12 + (g >= 1 ? 12 : 0));
  [[40, GROUND], [1830, top], [110, GROUND], [1470, top], [330, GROUND], [1860, top], [420, GROUND], [600, GROUND], [250, GROUND], [1400, top], [560, GROUND], [1900, top]].slice(0, nf).forEach(([x, y], i) => {
    const c = ['#E26D9A', '#F2A541', '#fff', '#E25B45', '#7B3FA0'][i % 5];
    ctx.strokeStyle = '#5E8C3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 22); ctx.stroke();
    ctx.fillStyle = c; for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 7, y - 26 + Math.sin(a) * 7, 6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x, y - 26, 4, 0, TAU); ctx.fill();
  });
  // vasos floridos na porta
  const pots = pop(g, 0.7);
  if (pots > 0) for (const px of [1428, 1772]) { ctx.save(); ctx.translate(px, top); ctx.scale(pots, pots); ctx.fillStyle = '#B5562F'; ctx.beginPath(); ctx.moveTo(-18, -34); ctx.lineTo(18, -34); ctx.lineTo(13, 0); ctx.lineTo(-13, 0); ctx.fill(); ctx.fillStyle = '#4E8A3A'; ctx.beginPath(); ctx.arc(0, -50, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#F2C14E'; ctx.beginPath(); ctx.arc(-8, -56, 5, 0, TAU); ctx.arc(9, -46, 5, 0, TAU); ctx.fill(); ctx.restore(); }
  // caminho de pedras, cerquinha e bandeirinhas
  const d = f.decor;
  if (pop(d, 0) > 0) { ctx.fillStyle = '#E3DCCF'; for (const [a, b] of [[1410, 746], [1452, 752], [1494, 746], [1536, 750]]) { ctx.beginPath(); ctx.ellipse(a, b, 18, 6, 0, 0, TAU); ctx.fill(); } }
  const fe = pop(d, 0.6);
  if (fe > 0) {
    ctx.save(); ctx.globalAlpha *= Math.min(1, fe); ctx.fillStyle = '#fff';
    for (let x = 1800; x < 1915; x += 16) { rr(ctx, x, top - 40, 9, 40, [4, 4, 0, 0]); ctx.fill(); }
    ctx.fillRect(1796, top - 30, 124, 5); ctx.fillRect(1796, top - 16, 124, 5); ctx.restore();
  }
  const bn = pop(d, 0.4);
  if (bn > 0) {
    ctx.strokeStyle = 'rgba(43,33,24,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1404, top - 150); ctx.quadraticCurveTo(1420, top - 110, 1442, top - 200); ctx.stroke();
    ['#C8553D', '#F2C14E', '#2F5F95'].forEach((c, i) => { const k = (i + 1) / 4, px = 1404 + 38 * k, py = top - 150 - 50 * k + Math.sin(k * Math.PI) * 26; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(px - 8, py); ctx.lineTo(px + 8, py); ctx.lineTo(px, py + 18 * bn); ctx.fill(); });
  }
  // poste de luz
  if (f.light > 0) {
    ctx.fillStyle = C.ink; ctx.fillRect(1400, top - 150, 8, 150); rr(ctx, 1388, top - 172, 32, 26, 6); ctx.fill();
    if (f.light >= 0.5) glow(ctx, 1404, top - 160, 60, 0.9);
    ctx.fillStyle = f.light >= 0.5 ? '#FFE08A' : '#d9cdb8'; rr(ctx, 1394, top - 166, 20, 16, 4); ctx.fill();
  }
}

/* ---------------- a casa (progresso por fase) ---------------- */

export interface HouseProg { stone: number; brick: number; tile: number; wood: number; glass: number } // 0..1
const HX0 = 812, HX1 = 1108, BASE = ROCK.top;
/** Cores da casa de cada tela. */
export interface HouseTheme { brick: [string, string]; tile: [string, string]; ridge: string; wall: string; door: string; shutter: string; chalet?: boolean; wood?: [string, string]; wall2?: string }
export const THEME_ROCHA: HouseTheme = { brick: ['#C8553D', '#B44A34'], tile: ['#c23d31', '#D9483B'], ridge: '#9c2f25', wall: '#FBF1E1', door: '#3E6B48', shutter: '#3E6B48' };
export const THEME_GRANDE: HouseTheme = { brick: ['#D9A441', '#C48E2E'], tile: ['#2F5F95', '#3E77B5'], ridge: '#1F4570', wall: '#EAF3F8', door: '#2F5F95', shutter: '#C8553D' };
/** Chalé da tela 2: térreo de pedra, andar de cima de madeira, telhado escuro com chaminé. */
export const THEME_VALE: HouseTheme = { brick: ['#D8D0C2', '#C6BDAD'], tile: ['#5A3B2A', '#6E4B36'], ridge: '#3E2A1E', wall: '#F4E3C3', door: '#2F5F95', shutter: '#C8553D', chalet: true, wood: ['#B98552', '#A8743F'], wall2: '#4F7D63' };
/** Altura extra do 2º andar. */
export const STORY2 = 198;

export function house(ctx: Ctx, p: HouseProg, t: number, opts: { wobble?: number; fall?: number; outline?: boolean; fin?: FinProg; stories?: 1 | 2; theme?: HouseTheme; dx?: number; dy?: number } = {}) {
  const f = opts.fin ?? NO_FIN;
  const S = opts.stories === 2 ? STORY2 : 0, T = opts.theme ?? THEME_ROCHA, CH = !!T.chalet;
  ctx.save(); ctx.translate(opts.dx ?? 0, opts.dy ?? 0);
  if (opts.wobble) { ctx.translate(960, BASE); ctx.rotate(Math.sin(t * 9) * 0.03 * opts.wobble); ctx.translate(-960, -BASE); }
  const fall = opts.fall ?? 0;
  // contorno do que falta
  if (opts.outline !== false) {
    ctx.save(); ctx.setLineDash([14, 12]); ctx.strokeStyle = 'rgba(43,33,24,0.3)'; ctx.lineWidth = 5;
    ctx.strokeRect(HX0, BASE - 334 - S, HX1 - HX0, 300 + S);
    ctx.beginPath(); ctx.moveTo(780, BASE - 334 - S); ctx.lineTo(960, BASE - 470 - S); ctx.lineTo(1140, BASE - 334 - S); ctx.stroke();
    ctx.restore();
  }
  // fundação (9 pedras)
  const ns = Math.round(p.stone * 9);
  for (let i = 0; i < ns; i++) { ctx.fillStyle = ['#bdb7ac', '#d3cdc2', '#a9a398'][i % 3]; rr(ctx, 800 + i * 36, BASE - 34, 34, 34, 8); ctx.fill(); ctx.strokeStyle = '#4a4540'; ctx.lineWidth = 3; ctx.stroke(); }
  // paredes: 13 fileiras de tijolo, preenchendo tijolo a tijolo
  const rows = 13 + (S ? 9 : 0), perRow = 8, totalB = rows * perRow, nb = Math.round(p.brick * totalB);
  let k = 0;
  ctx.save(); if (fall) ctx.translate(fall * 40, fall * fall * 400);
  for (let r = 0; r < rows; r++) for (let c = 0; c < perRow; c++) {
    if (k++ >= nb) continue;
    const log = CH && r >= 13, w = 38, h = 22, off = r % 2 && !log ? 19 : 0, x = HX0 + c * w + off, y = BASE - 34 - (r + 1) * h;
    if (x + w > HX1 + 4) continue;
    if (log) { ctx.fillStyle = T.wood![r % 2]; rr(ctx, x, y, Math.min(w + 1, HX1 - x), h - 2, c === 0 || c === perRow - 1 ? 8 : 0); ctx.fill(); continue; }
    ctx.fillStyle = (r + c) % 3 ? T.brick[0] : T.brick[1]; rr(ctx, x, y, Math.min(w - 3, HX1 - x), h - 3, CH ? 7 : 4); ctx.fill();
  }
  // 2º andar: viga de madeira separando os andares
  if (S && nb > 13 * perRow) { ctx.fillStyle = '#8b5a2b'; rr(ctx, HX0 - 10, BASE - 34 - 13 * 22 - 5, HX1 - HX0 + 20, 12, 4); ctx.fill(); }
  // pintura: o rolo passa da esquerda para a direita cobrindo os tijolos
  if (f.paint > 0) {
    const pw = (HX1 - HX0) * f.paint;
    ctx.save(); ctx.beginPath(); ctx.rect(HX0 - 4, BASE - 330 - S, pw + 4, 300 + S); ctx.clip();
    ctx.fillStyle = T.wall; ctx.fillRect(HX0 - 2, BASE - 322 - S, HX1 - HX0 + 4, 290 + S);
    if (CH && S) { const yb = BASE - 34 - 13 * 22; ctx.fillStyle = T.wall2!; ctx.fillRect(HX0 - 2, BASE - 322 - S, HX1 - HX0 + 4, yb - (BASE - 322 - S)); ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let x = HX0 + 20; x < HX1; x += 24) ctx.fillRect(x, BASE - 322 - S, 3, yb - (BASE - 322 - S)); }
    ctx.fillStyle = 'rgba(200,170,130,0.12)'; for (let y = BASE - 300 - S; y < BASE - 40; y += 34) ctx.fillRect(HX0, y, HX1 - HX0, 3);
    ctx.fillStyle = '#E9CFAE'; ctx.fillRect(HX0 - 2, BASE - 322 - S, 14, 290 + S); ctx.fillRect(HX1 - 12, BASE - 322 - S, 14, 290 + S);
    if (S) { ctx.fillStyle = '#8b5a2b'; ctx.fillRect(HX0 - 2, BASE - 34 - 13 * 22 - 5, HX1 - HX0 + 4, 12); }
    ctx.fillStyle = C.terra; ctx.fillRect(HX0 - 2, BASE - 58, HX1 - HX0 + 4, 24);
    ctx.restore();
    if (f.paint < 1) { // borda molhada + rolo
      const ex = HX0 + pw;
      ctx.fillStyle = '#F2DFC4'; ctx.fillRect(ex - 6, BASE - 322 - S, 8, 290 + S);
      ctx.fillStyle = '#E26D9A'; rr(ctx, ex - 10, BASE - 200 + Math.sin(t * 8) * 60, 22, 60, 8); ctx.fill();
    }
  }
  // porta (madeira) e janelas (vidro)
  if (p.wood > 0) {
    const dh = 130 * p.wood;
    const dw = CH ? 100 : 64;
    ctx.fillStyle = f.paint >= 1 ? T.door : '#8b5a2b'; rr(ctx, 962 - dw / 2, BASE - 34 - dh, dw, dh, [dw * 0.42, dw * 0.42, 0, 0]); ctx.fill();
    ctx.strokeStyle = '#5c3a1a'; ctx.lineWidth = 3; ctx.stroke();
    if (CH) { ctx.beginPath(); ctx.moveTo(962, BASE - 34 - dh); ctx.lineTo(962, BASE - 34); ctx.stroke(); }
    if (p.wood >= 1) { ctx.fillStyle = '#F3C64A'; ctx.beginPath(); ctx.arc(982, BASE - 100, 4, 0, TAU); ctx.fill(); }
    // guirlanda na porta
    const wr = pop(f.decor, 0.3);
    if (wr > 0) { ctx.save(); ctx.translate(962, BASE - 128); ctx.scale(wr, wr); ctx.strokeStyle = '#3E6B48'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.stroke(); ctx.fillStyle = C.terra; for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; ctx.beginPath(); ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 3.5, 0, TAU); ctx.fill(); } ctx.restore(); }
  }
  // placa "Casa de Paz" acima da porta
  const pl = pop(f.decor, 0.5);
  if (pl > 0) { ctx.save(); ctx.translate(962, BASE - 282); ctx.scale(pl, pl); ctx.fillStyle = '#8b5a2b'; rr(ctx, -58, -15, 116, 30, 8); ctx.fill(); ctx.fillStyle = '#FBF1E1'; ctx.font = `900 16px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Casa de Paz', 0, 6); ctx.restore(); }
  const wins: [number, number, number][] = S ? [[848, 0, 0], [1030, 1, 0], [848, 2, S], [1030, 3, S]] : [[848, 0, 0], [1030, 1, 0]];
  for (const [wx, i, oy] of wins) {
    const q = Math.max(0, Math.min(1, p.glass * wins.length - i));
    if (q <= 0) continue;
    if (f.light > 0) glow(ctx, wx + 28, BASE - oy - 202, 70, 0.7 * f.light);
    ctx.save(); ctx.globalAlpha *= q; ctx.fillStyle = f.light > 0 ? mix('#ffe28a', '#fff4c2', f.light) : '#ffe28a'; ctx.fillRect(wx, BASE - oy - 230, 56, 56); ctx.restore();
    const sh = pop(f.decor, 0.85);
    if (sh > 0) { ctx.fillStyle = T.shutter; ctx.fillRect(wx - 6 - 20 * sh, BASE - oy - 232, 20 * sh, 60); ctx.fillRect(wx + 62, BASE - oy - 232, 20 * sh, 60); }
    ctx.strokeStyle = f.paint >= 1 ? '#fff' : '#5c3a1a'; ctx.lineWidth = 5; ctx.strokeRect(wx, BASE - oy - 230, 56, 56);
    const fb = pop(f.decor, 0.15);
    if (fb > 0) {
      ctx.save(); ctx.translate(wx + 28, BASE - oy - 168); ctx.scale(fb, fb);
      ctx.fillStyle = '#8b5a2b'; rr(ctx, -34, 0, 68, 14, 4); ctx.fill();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#E26D9A', '#F2A541', '#fff', '#E25B45', '#7B3FA0'][i]; ctx.beginPath(); ctx.arc(-26 + i * 13, -3, 6, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx + 28, BASE - oy - 230); ctx.lineTo(wx + 28, BASE - oy - 174); ctx.moveTo(wx, BASE - oy - 202); ctx.lineTo(wx + 56, BASE - oy - 202); ctx.stroke();
  }
  // chalé: varanda com guarda-corpo no 2º andar
  if (CH && S && p.wood >= 1) {
    const yb = BASE - 34 - 13 * 22 - 5;
    ctx.fillStyle = '#7A4A2A'; rr(ctx, HX0 - 16, yb - 4, HX1 - HX0 + 32, 12, 4); ctx.fill(); rr(ctx, HX0 - 16, yb - 46, HX1 - HX0 + 32, 8, 4); ctx.fill();
    for (let x = HX0 - 10; x <= HX1 + 10; x += 22) ctx.fillRect(x, yb - 42, 6, 40);
  }
  ctx.restore();
  // telhado: fileiras de telha de baixo para cima (sobe junto com o 2º andar)
  const E = CH ? 34 : 0, RL = 772 - E, RR = 1148 + E, RB = BASE - 330 + E * 0.4, RT = BASE - 476 - E * 0.3;
  ctx.save(); ctx.translate(0, -S);
  // chaminé com fumaça
  if (CH && p.tile > 0.4) {
    ctx.fillStyle = '#8F887D'; ctx.fillRect(1056, BASE - 470, 42, 110); ctx.fillStyle = '#6f695f'; ctx.fillRect(1050, BASE - 476, 54, 12);
    if (p.tile >= 1 && !fall) for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - k)})`; ctx.beginPath(); ctx.arc(1077 + k * 40 + Math.sin(t * 2 + i) * 6, BASE - 490 - k * 110, 14 + k * 22, 0, TAU); ctx.fill(); }
  }
  if (p.tile > 0) {
    ctx.save(); if (fall) { ctx.translate(-fall * 60, fall * fall * 520); }
    ctx.beginPath(); ctx.moveTo(RL, RB); ctx.lineTo(960, RT); ctx.lineTo(RR, RB); ctx.closePath(); ctx.clip();
    const top = RB - (RB - RT) * p.tile;
    for (let y = RB; y > top - 18; y -= 18) for (let x = RL - 2 + ((y / 18) % 2) * 14; x < RR + 2; x += 28) {
      ctx.fillStyle = ((x + y) / 14) % 3 < 1 ? T.tile[0] : T.tile[1];
      ctx.beginPath(); ctx.arc(x, y, 15, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
    if (p.tile >= 1) { ctx.strokeStyle = T.ridge; ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(RL, RB); ctx.lineTo(960, RT); ctx.lineTo(RR, RB); ctx.stroke(); }
    // chalé: janela redonda no alto do telhado
    if (CH && p.tile >= 1 && p.glass > 0) { if (f.light > 0) glow(ctx, 960, BASE - 400, 60, 0.7 * f.light); ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(960, BASE - 398, 26, 0, TAU); ctx.fill(); ctx.strokeStyle = f.paint >= 1 ? '#fff' : '#5c3a1a'; ctx.lineWidth = 6; ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(934, BASE - 398); ctx.lineTo(986, BASE - 398); ctx.moveTo(960, BASE - 424); ctx.lineTo(960, BASE - 372); ctx.stroke(); }
  }
  // varal de luzes no beiral e luminária da porta
  if (f.light > 0 && !fall) {
    const pts: [number, number][] = [];
    const seg = (x0: number, y0: number, x1: number, y1: number, n: number) => { for (let i = 0; i < n; i++) { const k = (i + 0.5) / n; pts.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 14 + 10]); } };
    seg(RL, RB, 960, RT, 8); seg(960, RT, RR, RB, 8); seg(800, BASE - 326, 1120, BASE - 326, 10); if (CH && S) seg(HX0 - 10, BASE - 380 + S, HX1 + 10, BASE - 380 + S, 12);
    ctx.strokeStyle = 'rgba(43,33,24,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 6) : ctx.moveTo(x, y - 6))); ctx.stroke();
    const lit = Math.floor(f.light * pts.length);
    pts.forEach(([x, y], i) => {
      const on = i < lit, tw = on ? 0.75 + 0.25 * Math.sin(t * 5 + i) : 0;
      if (on) glow(ctx, x, y, 22, 0.8 * tw);
      ctx.fillStyle = on ? ['#FFE28A', '#FFB86B', '#FFF4C2'][i % 3] : '#d9cdb8'; ctx.beginPath(); ctx.ellipse(x, y, 6, 8, 0, 0, TAU); ctx.fill();
    });
    if (f.light >= 1) { glow(ctx, 1012, BASE - 150 + S, 50, 0.9); ctx.fillStyle = C.ink; rr(ctx, 1004, BASE - 166 + S, 16, 8, 3); ctx.fill(); ctx.fillStyle = '#FFE28A'; rr(ctx, 1006, BASE - 158 + S, 12, 18, 5); ctx.fill(); }
  }
  ctx.restore();
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
export function houseDebris(p: HouseProg, stories: 1 | 2 = 1, T: HouseTheme = THEME_ROCHA, dx = 0, dy = 0): Debris[] {
  const S = stories === 2 ? STORY2 : 0;
  const out: Debris[] = [];
  const add = (x: number, y: number, w: number, h: number, kind: ItemType, color: string) => {
    const cx = x + w / 2, cy = y + h / 2;
    out.push({ x: cx, y: cy, w, h, kind, color, vx: 0, vy: 0, rot: 0, vr: 0, delay: Math.max(0, (cy - (BASE - 480 - S)) / (480 + S)) * 2.2 + Math.random() * 0.5, hits: 0 });
  };
  const ns = Math.round(p.stone * 9);
  for (let i = 0; i < ns; i++) add(800 + i * 36, BASE - 34, 34, 34, 'stone', ['#bdb7ac', '#d3cdc2', '#a9a398'][i % 3]);
  const rows = 13 + (S ? 9 : 0), perRow = 8, nb = Math.round(p.brick * rows * perRow);
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < perRow; c++) {
    if (k++ >= nb) continue;
    const w = 38, h = 22, off = r % 2 ? 19 : 0, x = HX0 + c * w + off, y = BASE - 34 - (r + 1) * h;
    if (x + w > HX1 + 4) continue;
    add(x, y, Math.min(w - 3, HX1 - x), h - 3, 'brick', (r + c) % 3 ? T.brick[0] : T.brick[1]);
  }
  if (p.wood > 0) { const dh = 130 * p.wood; add(930, BASE - 34 - dh, 32, dh, 'wood', '#8b5a2b'); add(962, BASE - 34 - dh, 32, dh, 'wood', '#7a4f26'); }
  const wins: [number, number, number][] = S ? [[848, 0, 0], [1030, 1, 0], [848, 2, S], [1030, 3, S]] : [[848, 0, 0], [1030, 1, 0]];
  for (const [wx, i, oy] of wins) if (p.glass * wins.length - i > 0) add(wx, BASE - 230 - oy, 56, 56, 'glass', '#ffe28a');
  if (p.tile > 0) {
    const top = BASE - 330 - 146 * p.tile;
    for (let y = BASE - 330; y > top - 18; y -= 18) for (let x = 770 + ((y / 18) % 2) * 14; x < 1150; x += 28) {
      const half = ((y - (BASE - 476)) / 146) * 188; // meia largura do telhado nessa altura
      if (Math.abs(x - 960) > half - 6 || y < BASE - 476) continue;
      add(x - 15, y - 15 - S, 30, 15, 'tile', ((x + y) / 14) % 3 < 1 ? T.tile[0] : T.tile[1]);
    }
  }
  out.forEach((d) => { d.x += dx; d.y += dy; });
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

/** Urso que anda pelo chão (tela 2). */
export function bear(ctx: Ctx, x: number, y: number, dir: number, t: number, scared: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  const step = Math.sin(t * 10) * 6;
  ctx.fillStyle = '#6B4226';
  for (const lx of [-38, -14, 16, 40]) { rr(ctx, lx - 9, -40 + (lx % 2 ? step : -step) * 0.3, 18, 40, 7); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(0, -62, 62, 40, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(62, -82, 30, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(48, -108, 11, 0, TAU); ctx.arc(76, -108, 11, 0, TAU); ctx.fill();
  ctx.fillStyle = '#C9A27A'; ctx.beginPath(); ctx.ellipse(84, -76, 14, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(94, -80, 5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(66, -90, 4, 0, TAU); ctx.fill();
  if (scared) { ctx.fillStyle = '#fff'; ctx.font = `900 30px ${FONT}`; ctx.fillText('!', 50, -126); }
  ctx.restore();
}

/** Água do dilúvio (desenhada por cima de quem está dentro). */
export function water(ctx: Ctx, y: number, t: number) {
  if (y >= H) return;
  ctx.save();
  ctx.fillStyle = 'rgba(70,140,200,0.5)';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + Math.sin(t * 3 + x * 0.02) * 6);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { const yy = y + Math.sin(t * 3 + x * 0.02) * 6; if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
  ctx.stroke(); ctx.restore();
}
