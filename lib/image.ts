/* Utilitários de imagem: compressão, recorte do avatar, moldura Casa de Paz e compartilhamento. */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem'));
    img.src = src;
  });
}

async function fileToImage(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

const canvasToBlob = (c: HTMLCanvasElement, q = 0.86) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar imagem'))), 'image/jpeg', q));

/** Reduz a foto para no máximo `max` px no maior lado (fotos de celular chegam com 12MP). */
/** Reduz a foto (padrão 1080px, ótimo para Instagram e leve para o plano gratuito). */
export async function compressImage(file: Blob, max = 1080, quality = 0.82): Promise<Blob> {
  const img = await fileToImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return canvasToBlob(c, quality);
}

/** Recorte quadrado central para o avatar. */
export async function squareAvatar(file: Blob, size = 512): Promise<Blob> {
  const img = await fileToImage(file);
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d')!.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
  return canvasToBlob(c, 0.88);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawHouseIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(50, 6);
  ctx.lineTo(96, 46);
  ctx.lineTo(84, 46);
  ctx.lineTo(84, 94);
  ctx.lineTo(16, 94);
  ctx.lineTo(16, 46);
  ctx.lineTo(4, 46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FBF6EE';
  // coração na porta
  ctx.beginPath();
  ctx.moveTo(50, 80);
  ctx.bezierCurveTo(30, 66, 34, 50, 44, 52);
  ctx.bezierCurveTo(48, 53, 50, 57, 50, 58);
  ctx.bezierCurveTo(50, 57, 52, 53, 56, 52);
  ctx.bezierCurveTo(66, 50, 70, 66, 50, 80);
  ctx.fill();
  ctx.restore();
}

export interface FrameOptions {
  groupName: string;
  label: string;
  username: string;
  dateLabel: string;
  phrase?: string | null;
  week?: number; // moldura da semana (1, 2, 3, 4...)
}

/** Tema visual da moldura de cada semana (segue os caminhos da evolução). */
export interface FrameTheme {
  name: string;
  bgTop: string;
  bgBottom: string;
  accent: string;   // borda da foto e selo da semana
  title: string;    // cor do título
  sub: string;      // cor dos textos secundários
  icon: string;     // cor da casinha
  orn: string[];    // ornamentos (emoji) nos cantos
  verse: string;
}

export const FRAME_THEMES: FrameTheme[] = [
  { name: 'Semeadura', bgTop: '#FBF6EE', bgBottom: '#EFE0C6', accent: '#7FA650', title: '#2B2118', sub: '#8A6F57', icon: '#C8553D', orn: ['🌱', '🌾'], verse: '“Paz seja nesta casa.” — Lucas 10:5' },
  { name: 'Pesca', bgTop: '#F1F8FD', bgBottom: '#CFE6F5', accent: '#2F8FD0', title: '#16324A', sub: '#4E6E88', icon: '#2F8FD0', orn: ['🐟', '🌊'], verse: '“Farei de vocês pescadores de gente.” — Mt 4:19' },
  { name: 'Fogo', bgTop: '#FFF6EC', bgBottom: '#FFD9B8', accent: '#E8562E', title: '#3A1A10', sub: '#94573E', icon: '#E8562E', orn: ['🔥', '🕊️'], verse: '“Recebereis poder...” — Atos 1:8' },
  { name: 'Reino', bgTop: '#F8F3FD', bgBottom: '#E3D2F4', accent: '#C9A227', title: '#2E1A47', sub: '#6E5590', icon: '#7B3FA0', orn: ['👑', '✨'], verse: '“Buscai primeiro o Reino de Deus.” — Mt 6:33' },
];

export const frameTheme = (week = 1) => FRAME_THEMES[(Math.max(week, 1) - 1) % FRAME_THEMES.length];

/** Quebra o texto em linhas que cabem na largura. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Frase estilizada sobre a parte de baixo da foto. */
function drawPhrase(ctx: CanvasRenderingContext2D, phrase: string, px: number, py: number, pw: number, ph: number) {
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 40);
  ctx.clip();
  const g = ctx.createLinearGradient(0, py + ph * 0.45, 0, py + ph);
  g.addColorStop(0, 'rgba(20,12,6,0)');
  g.addColorStop(1, 'rgba(20,12,6,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(px, py + ph * 0.45, pw, ph * 0.55);

  let size = phrase.length > 32 ? 64 : phrase.length > 20 ? 76 : 92;
  ctx.font = `italic 700 ${size}px Fraunces, Georgia, serif`;
  let lines = wrapLines(ctx, phrase, pw - 140);
  while (lines.length > 3 && size > 44) {
    size -= 6;
    ctx.font = `italic 700 ${size}px Fraunces, Georgia, serif`;
    lines = wrapLines(ctx, phrase, pw - 140);
  }
  const lh = size * 1.12;
  const bottom = py + ph - 70;
  const top = bottom - lh * (lines.length - 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // ornamento acima da frase
  ctx.fillStyle = '#FFD56B';
  ctx.font = `700 ${Math.round(size * 0.42)}px Nunito, system-ui, sans-serif`;
  ctx.fillText('✦', px + pw / 2, top - size * 0.95);
  ctx.font = `italic 700 ${size}px Fraunces, Georgia, serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#FFFFFF';
  lines.forEach((l, i) => ctx.fillText(l, px + pw / 2, top + i * lh));
  ctx.restore();
}

/** Gera a foto com a moldura "Casa de Paz" em 1080×1350 (formato retrato do Instagram). */
export async function frameImage(source: Blob | string, o: FrameOptions): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  }
  const img = typeof source === 'string' ? await loadImage(source) : await fileToImage(source);
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  const week = Math.max(o.week ?? 1, 1);
  const t = frameTheme(week);

  // fundo do tema da semana
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, t.bgTop);
  bg.addColorStop(1, t.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faixa superior
  drawHouseIcon(ctx, 60, 52, 84, t.icon);
  ctx.fillStyle = t.title;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 64px Fraunces, Georgia, serif';
  ctx.fillText('Casa de Paz', 164, 112);
  ctx.font = '600 30px Nunito, system-ui, sans-serif';
  ctx.fillStyle = t.sub;
  ctx.fillText(o.groupName.toUpperCase(), 166, 152);

  // selo "SEMANA N" no canto superior direito
  const wl = `SEMANA ${week}`;
  ctx.font = '900 30px Nunito, system-ui, sans-serif';
  const ww = ctx.measureText(wl).width;
  ctx.fillStyle = t.accent;
  roundRect(ctx, W - 60 - ww - 44, 66, ww + 44, 62, 31);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(wl, W - 60 - ww - 22, 108);

  // foto
  const px = 54, py = 186, pw = W - 108, ph = 960;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 40);
  ctx.clip();
  const ir = img.naturalWidth / img.naturalHeight;
  const fr = pw / ph;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ir > fr) { sw = sh * fr; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / fr; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, px, py, pw, ph);
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = t.accent;
  roundRect(ctx, px, py, pw, ph, 40);
  ctx.stroke();

  // ornamentos da semana nos cantos de baixo da foto
  ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(t.orn[0], px + 10, py + ph + 18);
  ctx.fillText(t.orn[1], px + pw - 10, py + ph + 18);
  ctx.textAlign = 'left';

  if (o.phrase) drawPhrase(ctx, o.phrase, px, py, pw, ph);

  // selo do tipo
  ctx.font = '800 30px Nunito, system-ui, sans-serif';
  const tw = ctx.measureText(o.label.toUpperCase()).width;
  ctx.fillStyle = 'rgba(43,33,24,0.78)';
  roundRect(ctx, px + 28, py + 28, tw + 48, 60, 30);
  ctx.fill();
  ctx.fillStyle = '#FFD56B';
  ctx.fillText(o.label.toUpperCase(), px + 52, py + 69);

  // rodapé
  ctx.fillStyle = t.title;
  ctx.font = '700 36px Nunito, system-ui, sans-serif';
  ctx.fillText(`@${o.username}`, 100, 1222);
  ctx.textAlign = 'right';
  ctx.font = '600 32px Nunito, system-ui, sans-serif';
  ctx.fillStyle = t.sub;
  ctx.fillText(o.dateLabel, W - 100, 1222);
  ctx.textAlign = 'center';
  ctx.font = 'italic 500 30px Fraunces, Georgia, serif';
  ctx.fillStyle = t.sub;
  ctx.fillText(t.verse, W / 2, 1296);
  return canvasToBlob(c, 0.9);
}

export interface HouseShareOptions {
  groupName: string;
  points: number;
  members: number;
  checkins: number;
  groupPhoto?: string | null; // última foto em grupo (pequena, estilo polaroid)
  photoDate?: string;
}

/** Converte o SVG da casinha (já montada na tela) em imagem. */
async function svgToImage(svg: SVGSVGElement, w: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(Math.round((w * vb.height) / vb.width)));
  clone.removeAttribute('class');
  // sem as animações da tela: tudo no estado final
  clone.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  return fileToImage(blob);
}

/** Imagem da casa completa: casinha montada, moldura do grupo e a última foto em grupo. 1080×1350. */
export async function houseShareImage(svg: SVGSVGElement, o: HouseShareOptions): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  }
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const gold = '#C9A227', title = '#2B2118', sub = '#8A6F57', terra = '#C8553D';

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#FFF6E4');
  bg.addColorStop(1, '#F3DDB4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // cabeçalho igual ao das molduras
  drawHouseIcon(ctx, 60, 52, 84, terra);
  ctx.fillStyle = title;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 64px Fraunces, Georgia, serif';
  ctx.fillText('Casa de Paz', 164, 112);
  ctx.font = '600 30px Nunito, system-ui, sans-serif';
  ctx.fillStyle = sub;
  ctx.fillText(o.groupName.toUpperCase(), 166, 152);

  const badge = 'CASA COMPLETA';
  ctx.font = '900 28px Nunito, system-ui, sans-serif';
  const bw = ctx.measureText(badge).width;
  ctx.fillStyle = gold;
  roundRect(ctx, W - 60 - bw - 44, 66, bw + 44, 62, 31);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(badge, W - 60 - bw - 22, 107);

  // casinha
  const px = 54, py = 186, pw = W - 108;
  const house = await svgToImage(svg, pw * 2);
  const ph = Math.round((pw * house.naturalHeight) / house.naturalWidth);
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 40);
  ctx.clip();
  ctx.drawImage(house, px, py, pw, ph);
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = gold;
  roundRect(ctx, px, py, pw, ph, 40);
  ctx.stroke();

  // texto da conquista (lado esquerdo, abaixo da casa)
  const ty = py + ph + 100;
  const textW = o.groupPhoto ? 540 : W - 200;
  ctx.textAlign = o.groupPhoto ? 'left' : 'center';
  const tx = o.groupPhoto ? 90 : W / 2;
  ctx.fillStyle = title;
  ctx.font = 'italic 700 58px Fraunces, Georgia, serif';
  wrapLines(ctx, 'Construímos juntos!', textW).forEach((l, i) => ctx.fillText(l, tx, ty + i * 70));
  ctx.font = '800 34px Nunito, system-ui, sans-serif';
  ctx.fillStyle = terra;
  ctx.fillText(`${o.points.toLocaleString('pt-BR')} pts · ${o.members} ${o.members === 1 ? 'membro' : 'membros'}`, tx, ty + 68);
  ctx.fillStyle = title;
  ctx.fillText(`📍 ${o.checkins.toLocaleString('pt-BR')} ${o.checkins === 1 ? 'check-in' : 'check-ins'}`, tx, ty + 124);
  ctx.textAlign = 'left';

  // polaroid com a última foto em grupo, sobrepondo a casa
  if (o.groupPhoto) {
    try {
      const img = await loadImage(o.groupPhoto);
      const fw = 340, inner = 300, fh = inner + 88;
      const cx = W - 70 - fw / 2, cy = py + ph + 50;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((5 * Math.PI) / 180);
      ctx.shadowColor = 'rgba(43,33,24,0.35)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.shadowColor = 'transparent';
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, -inner / 2, -fh / 2 + 20, inner, inner);
      ctx.fillStyle = sub;
      ctx.textAlign = 'center';
      ctx.font = 'italic 600 28px Fraunces, Georgia, serif';
      ctx.fillText(o.photoDate ? `nós · ${o.photoDate}` : 'nós', 0, fh / 2 - 26);
      // fita adesiva
      ctx.fillStyle = 'rgba(201,162,39,0.55)';
      ctx.fillRect(-60, -fh / 2 - 18, 120, 38);
      ctx.restore();
    } catch {
      /* sem a foto, a imagem segue só com a casa */
    }
  }

  ctx.textAlign = 'center';
  ctx.font = 'italic 500 30px Fraunces, Georgia, serif';
  ctx.fillStyle = sub;
  ctx.fillText('“Se o Senhor não edificar a casa, em vão trabalham', W / 2, 1288);
  ctx.fillText('os que a edificam.” — Salmos 127:1', W / 2, 1326);
  return canvasToBlob(c, 0.9);
}

/** Compartilha usando o menu nativo (Instagram aparece nele); cai para download se não houver suporte. */
export async function shareImage(blob: Blob, filename = 'casa-de-paz.jpg') {
  const file = new File([blob], filename, { type: 'image/jpeg' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Casa de Paz' });
      return 'shared' as const;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled' as const;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded' as const;
}
