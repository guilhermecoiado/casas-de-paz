// Gera ícones (Android/iOS) e telas de abertura do iOS a partir de SVG.
// Uso: npm run icons
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
mkdirSync('public/splash', { recursive: true });

const house = (scale = 1, cx = 50, cy = 50) => `
  <g transform="translate(${cx} ${cy}) scale(${scale}) translate(-50 -50)">
    <path d="M50 18 L82 45 L74 45 L74 80 L26 80 L26 45 L18 45 Z" fill="#FBF6EE" stroke="#FBF6EE" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 72 C36 62 39 50 46 52 C48.5 52.6 50 55 50 56 C50 55 51.5 52.6 54 52 C61 50 64 62 50 72 Z" fill="#C8553D"/>
    <circle cx="74" cy="24" r="5" fill="#F2A541"/>
  </g>`;

const icon = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="#C8553D"/>${house(1)}</svg>`;

// maskable: conteúdo dentro da zona segura (80%)
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#C8553D"/>${house(0.72)}</svg>`;

const out = async (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);

await out(icon(true), 192, 'public/icons/icon-192.png');
await out(icon(true), 512, 'public/icons/icon-512.png');
await out(maskable, 512, 'public/icons/icon-maskable-512.png');
await out(icon(false), 180, 'public/icons/apple-touch-icon.png');
await out(icon(true), 32, 'public/icons/favicon-32.png');
// badge: silhueta branca em fundo transparente (barra de status do Android)
await out(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 12 L88 45 L78 45 L78 86 L22 86 L22 45 L12 45 Z" fill="#fff"/></svg>`, 96, 'public/icons/badge-96.png');

const SPLASH = [
  [440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
];

for (const [w, h, r] of SPLASH) {
  const W = w * r, H = h * r;
  const s = Math.round(W * 0.3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#FBF6EE"/>
    <g transform="translate(${(W - s) / 2} ${H / 2 - s * 0.75}) scale(${s / 100})">
      <rect width="100" height="100" rx="26" fill="#C8553D"/>${house(1)}
    </g>
    <text x="${W / 2}" y="${H / 2 + s * 0.55}" text-anchor="middle" font-family="Georgia, 'DejaVu Serif', serif" font-weight="700" font-size="${Math.round(W * 0.085)}" fill="#2B2118">Casas de Paz</text>
    <text x="${W / 2}" y="${H / 2 + s * 0.55 + W * 0.075}" text-anchor="middle" font-family="'DejaVu Sans', Arial, sans-serif" font-weight="700" letter-spacing="${W * 0.008}" font-size="${Math.round(W * 0.032)}" fill="#C8553D">PAZ SEJA NESTA CASA</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/splash/splash-${W}x${H}.png`);
}
console.log('Ícones e telas de abertura gerados.');
