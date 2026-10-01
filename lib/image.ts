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
export async function compressImage(file: Blob, max = 1440): Promise<Blob> {
  const img = await fileToImage(file);
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return canvasToBlob(c);
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

  // fundo creme com leve textura
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#FBF6EE');
  bg.addColorStop(1, '#F3E6D2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faixa superior
  drawHouseIcon(ctx, 60, 52, 84, '#C8553D');
  ctx.fillStyle = '#2B2118';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 64px Fraunces, Georgia, serif';
  ctx.fillText('Casa de Paz', 164, 112);
  ctx.font = '600 30px Nunito, system-ui, sans-serif';
  ctx.fillStyle = '#8A6F57';
  ctx.fillText(o.groupName.toUpperCase(), 166, 152);

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
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#F2A541';
  roundRect(ctx, px, py, pw, ph, 40);
  ctx.stroke();

  // selo do tipo
  ctx.font = '800 30px Nunito, system-ui, sans-serif';
  const tw = ctx.measureText(o.label.toUpperCase()).width;
  ctx.fillStyle = 'rgba(43,33,24,0.78)';
  roundRect(ctx, px + 28, py + 28, tw + 48, 60, 30);
  ctx.fill();
  ctx.fillStyle = '#FFD56B';
  ctx.fillText(o.label.toUpperCase(), px + 52, py + 69);

  // rodapé
  ctx.fillStyle = '#2B2118';
  ctx.font = '700 36px Nunito, system-ui, sans-serif';
  ctx.fillText(`@${o.username}`, 60, 1222);
  ctx.textAlign = 'right';
  ctx.font = '600 32px Nunito, system-ui, sans-serif';
  ctx.fillStyle = '#8A6F57';
  ctx.fillText(o.dateLabel, W - 60, 1222);
  ctx.textAlign = 'center';
  ctx.font = 'italic 500 30px Fraunces, Georgia, serif';
  ctx.fillStyle = '#C8553D';
  ctx.fillText('“Paz seja nesta casa.” — Lucas 10:5', W / 2, 1296);
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
