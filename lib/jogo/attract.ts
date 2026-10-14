/* Tela de espera da TV: logo → "Que bom que você veio!" → QR do check-in e do jogo, em loop. */

import { C, FONT, H, TAU, W, fitText, panel, rr, type Ctx } from './draw';

export const LOOP = 20;
const HOUSE = '#F3DCC4', ROOF = '#D9483B', SKY = '#4FA3DD', OLIVE = '#5E8C3A';
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const ls = (ctx: Ctx, px: number) => { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`; };

export interface AttractAssets {
  checkinQR: HTMLImageElement | null;  // só aparece se a TV estiver logada como adm
  checkinCode: string | null;
  gameQR: HTMLImageElement | null;
  room: string;
  groupName: string;
}

function background(ctx: Ctx, t: number) {
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);
  const k = (t / LOOP) * TAU;
  const blob = (x: number, y: number, r: number, rgb: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  };
  blob(120 + Math.sin(k) * 30, 80 + Math.cos(k) * 20, 520, '94,140,58', 0.2);
  blob(1820 + Math.cos(k) * 30, 1000 + Math.sin(k) * 25, 560, '79,163,221', 0.2);
  blob(1700 + Math.sin(k + 1) * 40, 120, 380, '242,165,65', 0.12);
  blob(260, 980 + Math.sin(k + 2) * 30, 380, '200,85,61', 0.1);
  ctx.fillStyle = 'rgba(43,33,24,0.045)';
  for (let y = 40; y < H; y += 56) for (let x = 40 + ((y / 56) % 2) * 28; x < W; x += 56) { ctx.beginPath(); ctx.arc(x, y + Math.sin(k + x * 0.004) * 3, 2.2, 0, TAU); ctx.fill(); }
}

function heartPath(ctx: Ctx, cx: number, cy: number, s: number) {
  ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.7, cy - s * 0.2, cx - s * 0.65, cy - s * 1.35, cx, cy - s * 0.42);
  ctx.bezierCurveTo(cx + s * 0.65, cy - s * 1.35, cx + s * 1.7, cy - s * 0.2, cx, cy + s * 0.9);
}

function logo(ctx: Ctx, t: number, groupName: string) {
  const a = 0.15, out = 3.7;
  if (t < a || t > out + 0.7) return;
  const pin = backOut(prog(t, a, a + 0.9)), pout = easeInOut(prog(t, out, out + 0.6));
  const s = 1.25 * (0.6 + 0.4 * pin) * (1 - 0.25 * pout);
  const alpha = prog(t, a, a + 0.4) * (1 - pout);
  const fl = Math.sin((t - a) * 2.2) * 8 * (1 - pout);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(W / 2, H / 2 - 30 + fl - pout * 30); ctx.scale(s, s);
  ctx.save(); ctx.globalAlpha *= 0.18; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, 230 - fl / s, 170, 22, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.shadowColor = 'rgba(200,85,61,0.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.fillStyle = C.terra; rr(ctx, -180, -180, 360, 360, 92); ctx.fill(); ctx.shadowColor = 'transparent';
  const ph = easeOut(prog(t, a + 0.35, a + 1.1));
  ctx.save(); rr(ctx, -180, -180, 360, 360, 92); ctx.clip();
  ctx.translate(0, (1 - ph) * 80); ctx.globalAlpha *= ph;
  ctx.fillStyle = '#FAF5EC'; ctx.beginPath();
  ctx.moveTo(-122, -6); ctx.lineTo(-8, -102); ctx.quadraticCurveTo(0, -108, 8, -102); ctx.lineTo(122, -6);
  ctx.quadraticCurveTo(126, 2, 118, 2); ctx.lineTo(90, 2); ctx.lineTo(90, 118); ctx.quadraticCurveTo(90, 124, 84, 124);
  ctx.lineTo(-84, 124); ctx.quadraticCurveTo(-90, 124, -90, 118); ctx.lineTo(-90, 2); ctx.lineTo(-118, 2); ctx.quadraticCurveTo(-126, 2, -122, -6); ctx.fill();
  const hb = 1 + Math.max(0, Math.sin((t - a - 1) * 5.2)) * 0.12 * prog(t, a + 1, a + 1.3);
  ctx.fillStyle = C.terra; heartPath(ctx, 0, 52, 34 * hb * easeOut(prog(t, a + 0.7, a + 1.2))); ctx.fill();
  ctx.restore();
  const ps = backOut(prog(t, a + 0.9, a + 1.4));
  if (ps > 0) { ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(108, -105, 26 * ps, 0, TAU); ctx.fill(); }
  ctx.restore();
  const pn = easeOut(prog(t, a + 1.0, a + 1.7));
  ctx.save(); ctx.globalAlpha = pn * (1 - pout); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.font = `900 64px ${FONT}`;
  ctx.fillText('Casas de Paz', W / 2, H / 2 + 330 + (1 - pn) * 20 + fl * 0.5 - pout * 30);
  ctx.font = `800 26px ${FONT}`; ctx.fillStyle = C.terra; ls(ctx, 8);
  ctx.fillText(groupName.toUpperCase(), W / 2, H / 2 + 380 + (1 - pn) * 20 + fl * 0.5 - pout * 30); ls(ctx, 0);
  ctx.restore();
}

function smileyHouse(ctx: Ctx, x: number, y: number, s: number, smile: number, t: number, alpha: number) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(s, s);
  ctx.save(); ctx.globalAlpha *= 0.14; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(0, 250, 230, 24, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = HOUSE; rr(ctx, -200, -40, 400, 280, 60); ctx.fill();
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ROOF; ctx.lineWidth = 46;
  ctx.beginPath(); ctx.moveTo(-235, 10); ctx.lineTo(0, -190); ctx.lineTo(235, 10); ctx.stroke();
  ctx.fillStyle = HOUSE; ctx.beginPath(); ctx.moveTo(-190, 0); ctx.lineTo(0, -160); ctx.lineTo(190, 0); ctx.lineTo(190, 40); ctx.lineTo(-190, 40); ctx.fill(); ctx.restore();
  const c = (t * 1000) % 3400, blink = c < 120 ? 1 - Math.sin((c / 120) * Math.PI) : 1;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.fillStyle = C.ink;
  for (const ex of [-78, 78]) {
    ctx.beginPath();
    if (smile > 0.5) { ctx.arc(ex, 62, 26, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke(); }
    else { ctx.ellipse(ex, 60, 9, Math.max(1, 13 * blink), 0, 0, TAU); ctx.fill(); }
  }
  const bl = easeOut(clamp(smile * 1.4));
  ctx.fillStyle = `rgba(232,140,120,${0.25 + 0.35 * bl})`;
  for (const bx of [-125, 125]) { ctx.beginPath(); ctx.ellipse(bx, 128, 36 + 6 * bl, 26 + 4 * bl, 0, 0, TAU); ctx.fill(); }
  const m = easeOut(smile);
  ctx.fillStyle = '#5a2a22';
  if (m > 0.05) {
    ctx.beginPath(); ctx.moveTo(-48, 112); ctx.quadraticCurveTo(0, 112 + 80 * m + 14, 48, 112); ctx.quadraticCurveTo(0, 116, -48, 112); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#e8564f'; ctx.beginPath(); ctx.ellipse(0, 112 + 70 * m, 30, 22 * m, 0, 0, TAU); ctx.fill(); ctx.restore();
  } else { ctx.strokeStyle = C.ink; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(-40, 116); ctx.quadraticCurveTo(0, 150, 40, 116); ctx.stroke(); }
  ctx.restore();
}

function sparkles(ctx: Ctx, x: number, y: number, s: number, p: number, t: number) {
  if (p <= 0) return;
  const lines: [number, number, number, string][] = [[-300, -40, -40, OLIVE], [-320, 60, 0, OLIVE], [-290, 160, 35, OLIVE], [290, -60, 220, SKY], [320, 50, 180, SKY], [285, 160, 145, OLIVE]];
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineWidth = 16;
  lines.forEach(([lx, ly, ang, c], i) => {
    const q = easeOut(clamp(p * 1.6 - i * 0.08)), wob = 1 + Math.sin(t * 3 + i) * 0.06;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate((ang * Math.PI) / 180); ctx.globalAlpha = q; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(-34 * q * wob, 0); ctx.lineTo(34 * q * wob, 0); ctx.stroke(); ctx.restore();
  });
  const hp = easeOut(clamp(p * 1.3 - 0.2));
  ctx.save(); ctx.globalAlpha = hp; ctx.translate(230, -230 - hp * 30 + Math.sin(t * 2) * 10); ctx.rotate(0.2 + Math.sin(t * 1.6) * 0.06);
  ctx.fillStyle = ROOF; heartPath(ctx, 0, 0, 46 * (0.6 + 0.4 * hp)); ctx.fill(); ctx.restore();
  ctx.restore();
}

const PHRASE = 'Que bom que você veio!';
let off: HTMLCanvasElement | null = null;
function writeText(ctx: Ctx, x: number, y: number, p: number, alpha: number) {
  if (p <= 0 || alpha <= 0) return;
  off ??= Object.assign(document.createElement('canvas'), { width: 1400, height: 320 });
  const o = off.getContext('2d')!;
  o.clearRect(0, 0, off.width, off.height);
  o.font = "700 124px 'Dancing Script', cursive"; o.textBaseline = 'middle'; o.fillStyle = C.ink;
  const w = o.measureText(PHRASE).width;
  o.fillText(PHRASE, 30, 160);
  const edge = 30 + (w + 60) * p;
  o.globalCompositeOperation = 'destination-in';
  const g = o.createLinearGradient(edge - 70, 0, edge, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = g; o.fillRect(0, 0, off.width, off.height); o.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(off, x - 30, y - 160); ctx.restore();
  const u = easeOut(prog(p, 0.85, 1));
  if (u > 0) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = C.terra; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 10, y + 95); ctx.quadraticCurveTo(x + w * 0.5, y + 120, x + 10 + (w - 20) * u, y + 92 + 6 * u); ctx.stroke(); ctx.restore();
  }
}

function welcome(ctx: Ctx, t: number) {
  const a = 4.25, out = 10.3;
  if (t < a || t > out + 0.8) return;
  const pin = easeOut(prog(t, a, a + 0.9)), pout = easeInOut(prog(t, out, out + 0.7));
  const smile = easeInOut(prog(t, 7.5, 8.1));
  const bob = Math.sin((t - a) * 2.4) * 10 + (smile > 0 ? Math.sin(prog(t, 7.5, 8.3) * Math.PI) * -26 : 0);
  const hx = 470, hy = 560, sc = 0.9 * (0.85 + 0.15 * pin) * (1 - 0.15 * pout);
  smileyHouse(ctx, hx, hy + (1 - pin) * 80 + bob + pout * 40, sc, smile, t, pin * (1 - pout));
  sparkles(ctx, hx, hy + bob, sc, prog(t, 7.6, 8.6) * (1 - pout), t);
  writeText(ctx, 850, 545, easeInOut(prog(t, a + 0.7, 7.5)), 1 - pout);
}

function phoneIcon(ctx: Ctx, x: number, y: number, s: number, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
  rr(ctx, -22, -38, 44, 76, 10); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, 28); ctx.lineTo(6, 28); ctx.stroke();
  ctx.strokeStyle = OLIVE; ctx.globalAlpha *= 0.5 + 0.5 * (Math.sin(t * 4) * 0.5 + 0.5);
  for (const [x1, y1, x2, y2] of [[-38, -22, -48, -30], [-40, 0, -52, 0], [-38, 22, -48, 30], [38, -22, 48, -30], [40, 0, 52, 0], [38, 22, 48, 30]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  ctx.restore();
}

/** QR do check-in (grande) + cartão do jogo (menor). Sem o QR do check-in, o do jogo fica grande. */
function qrScene(ctx: Ctx, t: number, A: AttractAssets) {
  const a = 11.0, out = 18.7;
  if (t < a || t > out + 0.8) return;
  const pout = easeInOut(prog(t, out, out + 0.7)), K = 1 - pout;
  const breath = 1 + Math.sin((t - a) * 1.6) * 0.012;
  const big = A.checkinQR ?? A.gameQR;
  const pq = backOut(prog(t, a, a + 0.9));
  const qx = 560, qy = 540, qs = 560;
  ctx.save(); ctx.globalAlpha = prog(t, a, a + 0.4) * K; ctx.translate(qx, qy - pout * 30); const sc = (0.8 + 0.2 * pq) * breath; ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(43,33,24,0.18)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#fff'; rr(ctx, -qs / 2 - 40, -qs / 2 - 40, qs + 80, qs + 80, 56); ctx.fill(); ctx.shadowColor = 'transparent';
  if (big) ctx.drawImage(big, -qs / 2, -qs / 2, qs, qs);
  ctx.restore();
  const pl = easeOut(prog(t, a + 0.5, a + 1.2));
  ctx.save(); ctx.globalAlpha = pl * K; ctx.lineCap = 'round'; ctx.lineWidth = 12;
  ([[-400, -150, -30, OLIVE], [-420, 0, 0, OLIVE], [-400, 150, 30, SKY], [400, -150, 210, OLIVE], [420, 0, 180, OLIVE], [400, 150, 150, SKY]] as [number, number, number, string][]).forEach(([lx, ly, ang, c], i) => {
    const w = 26 + Math.sin(t * 3 + i) * 4;
    ctx.save(); ctx.translate(qx + lx * 0.92, qy + ly); ctx.rotate((ang * Math.PI) / 180); ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(-w * pl, 0); ctx.lineTo(w * pl, 0); ctx.stroke(); ctx.restore();
  });
  ctx.restore();
  const tx = 1000;
  const p1 = easeOut(prog(t, a + 0.35, a + 1.1)), p2 = easeOut(prog(t, a + 0.6, a + 1.35)), p3 = easeOut(prog(t, a + 0.9, a + 1.6)), p4 = prog(t, a + 1.2, a + 2.2), p5 = easeOut(prog(t, a + 1.5, a + 2.3));
  ctx.save(); ctx.textAlign = 'left';
  if (A.checkinQR) {
    ctx.globalAlpha = p1 * K; ctx.fillStyle = C.terra; ctx.font = `800 30px ${FONT}`; ls(ctx, 6); ctx.fillText('CHECK-IN DA CASA DE PAZ', tx, 200 + (1 - p1) * 20); ls(ctx, 0);
    ctx.globalAlpha = p2 * K; ctx.fillStyle = C.ink; ctx.font = `900 80px ${FONT}`;
    ctx.fillText('Escaneie e faça', tx, 296 + (1 - p2) * 24); ctx.fillText('seu check-in!', tx, 386 + (1 - p2) * 24);
    // código
    ctx.globalAlpha = p3 * K; ctx.translate(0, (1 - p3) * 24);
    ctx.fillStyle = '#EFE3CF'; rr(ctx, tx, 430, 760, 150, 75); ctx.fill();
    phoneIcon(ctx, tx + 85, 505, 1.05, t);
    ctx.strokeStyle = 'rgba(43,33,24,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx + 160, 465); ctx.lineTo(tx + 160, 545); ctx.stroke();
    ctx.fillStyle = C.brown; ctx.font = `800 28px ${FONT}`; ctx.fillText('Sem câmera? Digite o código:', tx + 195, 482);
    ctx.font = `900 60px ${FONT}`; ls(ctx, 22); let cx = tx + 195;
    [...(A.checkinCode ?? '')].forEach((chr, i) => { const q = easeOut(clamp(p4 * 2 - i * 0.15)); ctx.save(); ctx.globalAlpha = q * p3 * K; ctx.fillStyle = C.ink; ctx.fillText(chr, cx, 550 + (1 - q) * 14); ctx.restore(); cx += ctx.measureText(chr).width; });
    ls(ctx, 0); ctx.translate(0, -(1 - p3) * 24);
    // cartão do jogo
    ctx.globalAlpha = p5 * K; ctx.translate(0, (1 - p5) * 30);
    panel(ctx, tx, 630, 760, 230, 40);
    if (A.gameQR) ctx.drawImage(A.gameQR, tx + 26, 656, 178, 178);
    ctx.fillStyle = C.terra; ctx.font = `900 22px ${FONT}`; ls(ctx, 5); ctx.fillText('JOGO · CASA NA ROCHA', tx + 236, 700); ls(ctx, 0);
    ctx.fillStyle = C.ink; fitText(ctx, 'Escaneie para jogar 🎮', tx + 236, 760, 500, 900, 48);
    ctx.fillStyle = C.brown; fitText(ctx, `até 12 jogadores · sala ${A.room}`, tx + 236, 808, 500, 800, 26);
  } else {
    ctx.globalAlpha = p1 * K; ctx.fillStyle = C.terra; ctx.font = `800 30px ${FONT}`; ls(ctx, 6); ctx.fillText('JOGO · CASA NA ROCHA', tx, 280 + (1 - p1) * 20); ls(ctx, 0);
    ctx.globalAlpha = p2 * K; ctx.fillStyle = C.ink; ctx.font = `900 84px ${FONT}`;
    ctx.fillText('Escaneie e', tx, 380 + (1 - p2) * 24); ctx.fillText('venha jogar! 🎮', tx, 476 + (1 - p2) * 24);
    ctx.globalAlpha = p3 * K; ctx.fillStyle = C.brown; ctx.font = `800 34px ${FONT}`;
    ctx.fillText('Seu celular vira o controle.', tx, 560); ctx.fillText(`Até 12 jogadores · sala ${A.room}`, tx, 610);
  }
  ctx.restore();
}

/** Cantinho fixo com o QR do jogo nas outras cenas (dá para entrar a qualquer momento). */
function corner(ctx: Ctx, t: number, A: AttractAssets) {
  const a = t < 10.9 ? prog(t, 0.6, 1.2) : 1 - prog(t, 10.9, 11.4);
  if (a <= 0.01 || !A.gameQR) return;
  ctx.save(); ctx.globalAlpha = a;
  panel(ctx, W - 64 - 420, H - 64 - 150, 420, 150, 32);
  ctx.drawImage(A.gameQR, W - 64 - 404, H - 64 - 134, 118, 118);
  ctx.textAlign = 'left'; ctx.fillStyle = C.ink; fitText(ctx, 'Escaneie para jogar', W - 64 - 270, H - 64 - 86, 240, 900, 28);
  ctx.fillStyle = C.brown; fitText(ctx, `Casa na Rocha · sala ${A.room}`, W - 64 - 270, H - 64 - 50, 240, 800, 22);
  ctx.restore();
}

export function renderAttract(ctx: Ctx, time: number, A: AttractAssets) {
  const t = time % LOOP;
  background(ctx, t);
  logo(ctx, t, A.groupName);
  welcome(ctx, t);
  qrScene(ctx, t, A);
  corner(ctx, t, A);
}
