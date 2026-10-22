/* Motor do jogo "Casa na Rocha": a TV é a dona do jogo (física, fases, desafios, poderes e pontos). */

import type { BuzzMsg, ChState, FinState, Mode, PowerId, StateMsg, TaskId } from './net';
import {
  C, CHARS, FONT, GROUND, H, ITEM_EMOJI, ITEM_LABEL, NO_FIN, PLATS, POWERS, STORY2, THEME_GRANDE, THEME_ROCHA, bear, water, QTY_STYLE, ROCK, TASK, TASKS, TAU, W,
  ant, balloon, bee, bolt, boulder, drawDebris, finishBack, houseDebris, fitText, glow, house, item, panel, person, platform, powerBubble, rr, scaffold, scenery, trampoline,
  type Ctx, type Debris, type FinProg, type HouseTheme, type HouseProg, type ItemType, type Plat,
} from './draw';

// espaçamento entre letras (nem todo navegador tem; sem ele só fica junto)
const ls = (ctx: CanvasRenderingContext2D, px: number) => { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`; };
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const MAX_PLAYERS = 12;
const LOBBY_TIME = 20;
const FINALE_TIME = 11;   // casa de pé: versículo fica mais tempo na tela
const FINALE_FALL = 11.5;  // quando a casa não aguenta: versículo e desmoronamento
const COLLAPSE_AT = 4.2;
const RESULTS_TIME = 30;

const GRAV = 2600, JUMP = -1130, CUT = -420, MAXV = 430, TRAMP_V = -1720;
// degraus invisíveis no andaime (ajudam a subir da rocha)
const STEPS: Plat[] = [{ x: 1128, y: 718, w: 76 }, { x: 1128, y: 618, w: 76 }];
// entrega só valendo dentro da casa (abaixo do telhado), nunca de cima da plataforma do topo
const ZONE = { x0: 790, x1: 1130 };
const QUOTA = 60;     // toques da parte de cada um no acabamento
const CH_TAPS = 20;   // toques por jogador para vencer um desafio de toque
/** Pontos por entrega: pacote maior vale mais. */
const DELIVER_PTS: Record<number, number> = { 1: 2, 4: 6, 10: 12 };

/* ---------------- telas (fases do jogo) ---------------- */
interface MoverDef { x: number; y: number; w: number; vertical: boolean; rail?: [number, number] }
interface Level {
  id: 1 | 2; name: string; plats: Plat[]; tramps: { x: number; w: number }[]; movers: (t: number) => MoverDef[];
  stories: 1 | 2; theme: HouseTheme; dusk: boolean; playTime: number; powers: PowerId[]; needMul: Record<ItemType, number>;
  lightSpots: [number, number][]; bag: EventType[]; slots: number[]; fixed: { at: number; type: EventType; dur: number }[];
}
const BASE_POWERS: PowerId[] = ['freeze', 'speed', 'giant', 'shrink', 'fire', 'magnet', 'shield'];
export const LEVELS: Record<1 | 2, Level> = {
  1: {
    id: 1, name: 'Casa na Rocha', plats: PLATS, tramps: [{ x: 36, w: 116 }, { x: 1768, w: 116 }],
    movers: (a) => [
      { x: 1290 + ((Math.sin(a * 0.5) + 1) / 2) * 340, y: 330, w: 170, vertical: false, rail: [1290, 1800] },
      { x: 18, y: 475 + Math.sin(a * 0.65) * 150, w: 112, vertical: true },
    ],
    stories: 1, theme: THEME_ROCHA, dusk: false, playTime: 240, powers: BASE_POWERS,
    needMul: { stone: 1, brick: 1, tile: 1, wood: 1, glass: 1 },
    lightSpots: [[960, 338], [1350, 520], [640, 500], [910, 338], [1420, 520], [700, 500]],
    bag: ['drizzle', 'wind', 'boulders', 'ants', 'bees', 'fog', 'lightning', 'quake', 'boulders', 'bees', 'ants'],
    slots: [16, 32, 47, 63, 80, 114, 152, 169, 184, 200, 214],
    fixed: [{ at: 98, type: 'quake', dur: 7 }, { at: 132, type: 'rain', dur: 14 }],
  },
  2: {
    id: 2, name: 'Casa Grande', tramps: [{ x: 590, w: 110 }, { x: 1232, w: 110 }],
    plats: [
      { x: 80, y: 780, w: 200 }, { x: 330, y: 660, w: 220 }, { x: 120, y: 520, w: 200 }, { x: 420, y: 400, w: 220 },
      { x: 1250, y: 680, w: 220 }, { x: 1460, y: 540, w: 200 }, { x: 1180, y: 420, w: 220 }, { x: 1600, y: 790, w: 220 }, { x: 1660, y: 380, w: 200 },
    ],
    movers: (a) => [
      { x: 1200 + ((Math.sin(a * 0.6) + 1) / 2) * 420, y: 280, w: 150, vertical: false, rail: [1200, 1770] },
      { x: 18, y: 460 + Math.sin(a * 0.7) * 170, w: 100, vertical: true },
    ],
    stories: 2, theme: THEME_GRANDE, dusk: true, playTime: 270, powers: [...BASE_POWERS, 'wings', 'double', 'wings', 'double'],
    needMul: { stone: 1.2, brick: 1.7, tile: 1, wood: 1, glass: 1.6 },
    lightSpots: [[530, 400], [1290, 420], [220, 520], [1560, 540], [440, 660], [1360, 680]],
    bag: ['drizzle', 'wind', 'boulders', 'ants', 'bees', 'fog', 'lightning', 'bear', 'bear', 'boulders', 'quake', 'bees', 'wind'],
    slots: [14, 28, 42, 56, 70, 84, 112, 150, 166, 182, 198, 214, 232],
    fixed: [{ at: 98, type: 'quake', dur: 7 }, { at: 126, type: 'flood', dur: 22 }],
  },
};

/** Altura do chão da rocha em x (rampa dos lados, topo reto), ou null fora dela. */
export function rockSurface(x: number): number | null {
  if (x < ROCK.x0 || x > ROCK.x1) return null;
  if (x < 790) return 905 + ((x - ROCK.x0) / (790 - ROCK.x0)) * (ROCK.top - 905);
  if (x <= 1130) return ROCK.top;
  return ROCK.top + ((x - 1130) / (ROCK.x1 - 1130)) * (900 - ROCK.top);
}

export type Sfx =
  | 'jump' | 'jump2' | 'boing' | 'pick' | 'gold' | 'deliver' | 'deliverBig' | 'phase' | 'stomp' | 'join' | 'alert' | 'wind' | 'quake' | 'rain'
  | 'thunder' | 'tap' | 'chWin' | 'chFail' | 'part' | 'task' | 'finished' | 'storm' | 'standing' | 'fall' | 'results' | 'beep' | 'go' | 'balloon' | 'ant'
  | 'power' | 'zap' | 'jolt' | 'crack' | 'freeze' | 'fire' | 'grow' | 'shrink' | 'speed' | 'shield' | 'block' | 'magnet' | 'bees' | 'boulder' | 'crash' | 'lightning' | 'ouch' | 'fog' | 'drizzle';

interface Input { l: boolean; r: boolean; j: boolean }
type Fx = { frozen: number; fast: number; giant: number; tiny: number; burn: number; magnet: number; shield: number; slow: number; wings: number; double: number };
const NO_FX = (): Fx => ({ frozen: 0, fast: 0, giant: 0, tiny: 0, burn: 0, magnet: 0, shield: 0, slow: 0, wings: 0, double: 0 });
export interface Player {
  id: string; slot: number; name: string; bot?: boolean;
  x: number; y: number; vx: number; vy: number; onGround: boolean; coyote: number; face: 1 | -1;
  jumps: number; boost: boolean; mover: number;
  input: Input; prevJ: boolean; carry: Item | null; pts: number; picks: number; delivered: number;
  dizzy: number; walk: number; lastSeen: number; happy: number;
  task: TaskId | null; helping: boolean; mine: number; taps: number; budget: number; budgetT: number; work: number; chTaps: number;
  power: PowerId | null; powerT: number; fx: Fx; size: number; hitCd: number;
}
interface Item { id: number; type: ItemType; qty: number; x: number; y: number; vx: number; vy: number; rest: boolean; age: number; onGroundFloor: boolean; mover: number; float?: boolean; power?: PowerId; pulled?: boolean }
interface Ant { x: number; dir: 1 | -1; carry: Item | null; flee: boolean }
interface Floater { x: number; y: number; text: string; color: string; t: number }
interface Mover { x: number; y: number; w: number; px: number; py: number; vertical: boolean; rail?: [number, number] }
interface Balloon { x: number; y: number; dir: 1 | -1; item: Item | null }
interface Shot { x: number; y: number; from: string; to: string; power: PowerId; t: number }
interface Swarm { x: number; y: number; target: string | null; t: number }
interface Boulder { x: number; dir: 1 | -1; rot: number }
interface Bolt { x: number; y: number; t: number; hit: boolean }
type Ghost = Pick<Player, 'x' | 'y' | 'pts' | 'picks' | 'delivered' | 'task' | 'helping' | 'mine' | 'taps' | 'slot' | 'power'>;
type EventType = 'wind' | 'quake' | 'rain' | 'ants' | 'drizzle' | 'fog' | 'bees' | 'boulders' | 'lightning' | 'bear' | 'flood';
interface GameEvent { at: number; type: EventType; dur: number; dir?: 1 | -1; started?: boolean }
interface TapCh { kind: 'quake' | 'leak' | 'drain'; at: number; dur: number; need: number; have: number; started?: boolean; ended?: boolean; ok?: boolean }

const PHASES: { types: ItemType[]; title: string }[] = [
  { types: ['stone'], title: 'Fundação na rocha!' },
  { types: ['brick'], title: 'Levantem as paredes!' },
  { types: ['tile'], title: 'Hora do telhado!' },
  { types: ['wood', 'glass'], title: 'Porta e janelas!' },
];
const FINISH_TITLE = 'Acabamento!';
const EVENT_INFO: Record<EventType, { soon: string; now: string; emoji: string; dur: number; sfx: Sfx }> = {
  wind: { soon: 'Ventania chegando! Segurem firme!', now: 'Ventania!', emoji: '💨', dur: 7, sfx: 'wind' },
  quake: { soon: 'Terremoto chegando!', now: 'Terremoto! Tudo tremendo!', emoji: '🌋', dur: 7, sfx: 'quake' },
  rain: { soon: 'Vem chuva aí… chão escorregadio!', now: 'Chuva! Cuidado para não escorregar!', emoji: '🌧️', dur: 14, sfx: 'rain' },
  ants: { soon: 'Formigas à vista!', now: 'Formigas! Pulem nelas, não deixem encostar', emoji: '🐜', dur: 14, sfx: 'ant' },
  drizzle: { soon: 'Garoa chegando…', now: 'Garoa! Todo mundo mais lento', emoji: '🌦️', dur: 9, sfx: 'drizzle' },
  fog: { soon: 'Neblina chegando!', now: 'Neblina! Quase não dá para ver', emoji: '🌫️', dur: 10, sfx: 'fog' },
  bees: { soon: 'Abelhas à vista!', now: 'Abelhas! Fujam delas', emoji: '🐝', dur: 11, sfx: 'bees' },
  boulders: { soon: 'Pedras rolando!', now: 'Pedras rolando! Pulem por cima', emoji: '🪨', dur: 10, sfx: 'boulder' },
  lightning: { soon: 'Raios chegando!', now: 'Raios! Saiam do círculo vermelho', emoji: '⚡', dur: 10, sfx: 'thunder' },
  bear: { soon: 'Tem um urso vindo!', now: 'Urso! Pule na cabeça dele para espantar', emoji: '🐻', dur: 14, sfx: 'boulder' },
  flood: { soon: 'Vem um dilúvio!', now: 'Dilúvio! Subam nas plataformas', emoji: '🌊', dur: 18, sfx: 'rain' },
};
const CH_INFO: Record<TapCh['kind'], { title: string; emoji: string; ok: string; fail: string }> = {
  quake: { title: 'Segurem a casa!', emoji: '🌋', ok: 'A casa ficou firme! 💪', fail: 'Caiu um pedaço… 😬' },
  leak: { title: 'Tapem as goteiras!', emoji: '💧', ok: 'Goteiras tapadas! 🙌', fail: 'A água estragou material… 😬' },
  drain: { title: 'Cliquem para escoar a água!', emoji: '🌊', ok: 'Água escoada! 🙌', fail: 'A água levou material… 😬' },
};
/** Quanto material cada fase pede: cresce com o número de jogadores (mesmo quem entra no meio). */
const needFor = (n: number): Record<ItemType, number> => ({ stone: 15 + 8 * n, brick: 26 + 13 * n, tile: 20 + 10 * n, wood: 8 + 5 * n, glass: 5 + 3 * n });
/** Pacote sorteado: a maioria x1, alguns x4 e poucos x10. */
const rollQty = () => { const r = Math.random(); return r < 0.08 ? 10 : r < 0.36 ? 4 : 1; };

export interface Result { id: string; slot: number; name: string; pts: number; delivered: number; suggest: number }

export class Game {
  mode: Mode = 'attract';
  players = new Map<string, Player>();
  items: Item[] = [];
  ants: Ant[] = [];
  floaters: Floater[] = [];
  rain: { x: number; y: number; light?: boolean }[] = [];
  sparks: { x: number; y: number; vx: number; vy: number; t: number; c: string }[] = [];
  movers: Mover[] = [];
  tramp = [0, 0];
  balloon: Balloon | null = null;
  balloonT = 0;
  powerT = 0;
  shots: Shot[] = [];
  swarms: Swarm[] = [];
  boulders: Boulder[] = [];
  bolts: Bolt[] = [];
  boulderT = 0;
  boltT = 0;
  fogCv: HTMLCanvasElement | null = null;
  t = 0;            // relógio geral
  modeT = 0;        // tempo no modo atual
  countdown = 0;
  phase = 0;
  need: Record<ItemType, number> = { stone: 0, brick: 0, tile: 0, wood: 0, glass: 0 };
  have: Record<ItemType, number> = { stone: 0, brick: 0, tile: 0, wood: 0, glass: 0 };
  fin: Record<TaskId, { need: number; have: number }> = { paint: { need: 0, have: 0 }, light: { need: 0, have: 0 }, garden: { need: 0, have: 0 }, decor: { need: 0, have: 0 } };
  events: GameEvent[] = [];
  chs: TapCh[] = [];
  spawnT = 0;
  nextItem = 1;
  complete = false;   // estrutura pronta (aguenta a tempestade)
  finished = false;   // acabamento pronto
  finishedAt = 0;
  peak = 0;
  ghosts = new Map<string, Ghost>();
  banner: { text: string; t: number; color: string } | null = null;
  results: Result[] = [];
  shake = 0;
  level: 1 | 2 = 1;
  bears: { x: number; dir: 1 | -1; scared: boolean }[] = [];
  get lv() { return LEVELS[this.level]; }
  private solid() { return [...this.lv.plats, ...STEPS]; }
  /** Altura da água do dilúvio (abaixo da tela = sem água). */
  waterY() {
    const e = this.active('flood');
    if (!e) return H + 50;
    const k = this.modeT - e.at;
    let amt = Math.max(0, Math.min(1, k / 4, (e.dur - k) / 4));
    // os toques do desafio "escoar a água" baixam o nível
    const d = this.chs.find((c) => c.kind === 'drain' && c.started);
    if (d) amt *= 1 - 0.92 * (d.ok ? 1 : clamp(d.have / Math.max(1, d.need)));
    return GROUND + 40 - (GROUND + 40 - 470) * amt; // sobe até um pouco mais da metade da tela
  }
  /** Modo foto: no resultado, esconde o placar para ver (e fotografar) a casa. */
  photo = false;
  groupName = '';
  debris: Debris[] = [];
  shakeAmp = 16;
  quakeT = 0;
  screenFx: { c: string; t: number; d: number; a: number; vig: boolean }[] = [];
  fired = new Set<string>();
  room = '';
  gameQR: HTMLImageElement | null = null;
  onBuzz: (id: string, kind: BuzzMsg['kind']) => void = () => {};
  onSfx: (s: Sfx) => void = () => {};

  constructor() { this.updateMovers(); this.updateMovers(); }

  private sfx(s: Sfx) { this.onSfx(s); }
  /** Pisca a tela inteira (ou só as bordas) de uma cor. */
  private screen(c: string, d: number, a: number, vig = false) { this.screenFx.push({ c, t: 0, d, a, vig }); }
  private buzzAll(kind: BuzzMsg['kind']) { this.players.forEach((p) => this.onBuzz(p.id, kind)); }
  private once(key: string, fn: () => void) { if (!this.fired.has(key)) { this.fired.add(key); fn(); } }
  private setMode(m: Mode) { this.mode = m; this.modeT = 0; this.fired.clear(); this.photo = false; }
  togglePhoto() { if (this.mode === 'results') this.photo = !this.photo; }
  private clearHazards() { this.bears = []; this.items = []; this.ants = []; this.balloon = null; this.shots = []; this.swarms = []; this.boulders = []; this.bolts = []; }

  /* ---------------- jogadores ---------------- */

  addPlayer(id: string, name: string, bot = false): Player | null {
    const ex = this.players.get(id);
    if (ex) { ex.name = name || ex.name; ex.lastSeen = this.t; return ex; }
    if (this.players.size >= MAX_PLAYERS) return null;
    const used = new Set(Array.from(this.players.values()).map((p) => p.slot));
    // quem caiu e voltou continua de onde parou (mesmo lugar, mesmos pontos e, se der, a mesma cor)
    const g = this.ghosts.get(id);
    let slot = 0;
    if (g && !used.has(g.slot)) slot = g.slot; else while (used.has(slot)) slot++;
    const sx = 120 + Math.random() * 520;
    const p: Player = {
      id, slot, name: (name || `Jogador ${slot + 1}`).slice(0, 12), bot,
      x: g?.x ?? (Math.random() < 0.5 ? sx : W - sx), y: g ? g.y - 2 : -60, vx: 0, vy: 0, onGround: false, coyote: 0, face: 1,
      jumps: 0, boost: false, mover: -1,
      input: { l: false, r: false, j: false }, prevJ: false, carry: null, pts: g?.pts ?? 0, picks: g?.picks ?? 0, delivered: g?.delivered ?? 0,
      dizzy: 0, walk: 0, lastSeen: this.t, happy: 0,
      task: g?.task ?? null, helping: g?.helping ?? false, mine: g?.mine ?? 0, taps: g?.taps ?? 0, budget: 20, budgetT: this.t, work: 0, chTaps: 0,
      power: g?.power ?? null, powerT: this.t, fx: NO_FX(), size: 1, hitCd: 0,
    };
    this.ghosts.delete(id);
    this.players.set(id, p);
    this.float(p.x, Math.max(200, p.y - 200), g ? `${p.name} voltou!` : `${p.name} entrou!`, CHARS[slot].color);
    this.sfx('join');
    if (this.mode === 'attract') this.toLobby();
    else if (this.mode === 'lobby') this.countdown = Math.max(this.countdown, 10);
    else if (this.mode === 'play') {
      // entrou no meio: a casa pede mais material e, no acabamento, ganha uma tarefa
      this.peak = Math.max(this.peak, this.players.size);
      this.scaleNeeds();
      if (this.phase >= PHASES.length && !p.task) this.assign(p, this.neediest() ?? 'paint');
    }
    return p;
  }

  removePlayer(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.carry) this.drop(p);
    if (this.mode === 'play' || this.mode === 'finale' || this.mode === 'results') {
      const { x, y, pts, picks, delivered, task, helping, mine, taps, slot, power } = p;
      this.ghosts.set(id, { x, y: Math.min(y, GROUND), pts, picks, delivered, task, helping, mine, taps, slot, power });
    }
    this.players.delete(id);
    if (!this.players.size && this.mode !== 'results' && this.mode !== 'finale') this.toAttract();
  }

  setInput(id: string, inp: Input) {
    const p = this.players.get(id);
    if (!p) return;
    p.input = inp; p.lastSeen = this.t;
  }
  touch(id: string) { const p = this.players.get(id); if (p) p.lastSeen = this.t; }

  /** Toques rápidos no celular: desafio de toque ativo ou acabamento. */
  tap(id: string, n: number) {
    const p = this.players.get(id);
    if (!p || this.mode !== 'play') return;
    p.lastSeen = this.t;
    // limite humano (~15 toques por segundo)
    p.budget = Math.min(20, p.budget + (this.t - p.budgetT) * 15); p.budgetT = this.t;
    const k = Math.min(Math.floor(p.budget), Math.max(0, Math.floor(n)));
    if (k <= 0) return;
    p.budget -= k;
    // congelado: tocar rápido quebra o gelo mais cedo
    if (p.fx.frozen > 0) {
      p.fx.frozen = Math.max(0, p.fx.frozen - 0.11 * k);
      for (let i = 0; i < k; i++) this.sparks.push({ x: p.x + (Math.random() - 0.5) * 60, y: p.y - 80 * p.size, vx: (Math.random() - 0.5) * 400, vy: -200 - Math.random() * 200, t: 0.2, c: Math.random() < 0.5 ? '#ffffff' : '#BFE9FA' });
      if (p.fx.frozen <= 0) { this.float(p.x, p.y - 200 * p.size, 'Quebrou o gelo! 💥', '#4FB8E8'); this.sfx('crack'); this.onBuzz(p.id, 'crack'); }
      else if (Math.random() < 0.5) this.sfx('tap');
      return;
    }
    const c = this.activeCh();
    if (c) {
      c.have += k; p.chTaps += k; p.work = 1;
      if (Math.random() < 0.4) this.sfx('tap');
      return;
    }
    if (this.phase >= PHASES.length && !this.finished) this.finishTaps(p, k);
  }

  /* ---------------- poderes ---------------- */

  /** Usa o poder guardado: os de ajuda valem para quem usa; os de atrapalhar vão no jogador mais perto. */
  usePower(id: string) {
    const p = this.players.get(id);
    if (!p || !p.power || this.mode !== 'play') return;
    const pw = p.power, P = POWERS[pw];
    p.lastSeen = this.t;
    if (P.self) {
      p.power = null;
      this.applyPower(p, pw);
      this.float(p.x, p.y - 210 * p.size, `${P.emoji} ${P.label}!`, P.color);
      return;
    }
    let best: Player | null = null, bd = Infinity;
    this.players.forEach((q) => { if (q !== p) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } } });
    if (!best) { this.float(p.x, p.y - 210, 'Ninguém por perto…', C.muted); return; }
    p.power = null;
    const target = best as Player;
    this.shots.push({ x: p.x, y: p.y - 90 * p.size, from: p.id, to: target.id, power: pw, t: 0 });
    this.sfx('zap'); this.onBuzz(p.id, 'zap');
  }

  private applyPower(q: Player, pw: PowerId, from?: Player) {
    const f = q.fx, P = POWERS[pw];
    if (!P.self && f.shield > 0) {
      this.float(q.x, q.y - 200 * q.size, 'Bloqueado! 🛡️', '#2F8FD0'); this.sfx('block'); this.onBuzz(q.id, 'block');
      return;
    }
    const buzz: Record<PowerId, BuzzMsg['kind']> = { freeze: 'freeze', fire: 'burn', shrink: 'shrink', speed: 'speed', giant: 'giant', magnet: 'magnet', shield: 'shield', wings: 'speed', double: 'gold' };
    this.onBuzz(q.id, buzz[pw]);
    this.screen(P.color, 0.6, pw === 'freeze' || pw === 'fire' ? 0.4 : 0.25, true);
    if (pw === 'freeze') for (let i = 0; i < 24; i++) { const a = Math.random() * TAU, v = 150 + Math.random() * 350; this.sparks.push({ x: q.x, y: q.y - 80 * q.size, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, t: 0, c: Math.random() < 0.5 ? '#ffffff' : '#9fdcf6' }); }
    if (pw === 'fire') for (let i = 0; i < 20; i++) this.sparks.push({ x: q.x + (Math.random() - 0.5) * 70, y: q.y - Math.random() * 140 * q.size, vx: (Math.random() - 0.5) * 120, vy: -300 - Math.random() * 300, t: 0, c: pickOne(['#F26B1D', '#F2C230', '#E25B45']) });
    switch (pw) {
      case 'freeze': f.frozen = P.dur; q.vx = 0; this.dropFrom(q); this.sfx('freeze'); break;
      case 'fire': f.burn = P.dur; this.dropFrom(q); this.sfx('fire'); break;
      case 'shrink': f.tiny = P.dur; f.giant = 0; this.sfx('shrink'); break;
      case 'speed': f.fast = P.dur; this.sfx('speed'); break;
      case 'giant': f.giant = P.dur; f.tiny = 0; this.sfx('grow'); break;
      case 'magnet': f.magnet = P.dur; this.sfx('magnet'); break;
      case 'shield': f.shield = P.dur; f.frozen = 0; f.burn = 0; f.tiny = 0; f.slow = 0; this.sfx('shield'); break;
      case 'wings': f.wings = P.dur; this.sfx('speed'); break;
      case 'double': f.double = P.dur; this.sfx('gold'); break;
    }
    if (from) {
      from.pts += 1;
      this.float(q.x, q.y - 200 * q.size, `${P.emoji} ${P.label}!`, P.color);
    }
    this.burst(q.x, q.y - 80 * q.size, P.color, 16);
  }

  /** Algum perigo acertou o jogador (abelha, pedra, raio, formiga). */
  private ouch(p: Player, opts: { slow?: number; lose?: number; dizzy?: number; knock?: number; text?: string; buzz?: BuzzMsg['kind'] }) {
    if (p.fx.shield > 0 || p.hitCd > 0) return false;
    p.hitCd = 1.2;
    if (opts.slow) p.fx.slow = Math.max(p.fx.slow, opts.slow);
    if (opts.dizzy) p.dizzy = Math.max(p.dizzy, opts.dizzy);
    if (opts.lose) { const l = Math.min(p.pts, opts.lose); p.pts -= l; }
    if (opts.knock) { p.vx = opts.knock; p.vy = -560; p.onGround = false; p.mover = -1; }
    this.dropFrom(p);
    this.float(p.x, p.y - 200 * p.size, opts.text ?? 'Ai!', C.terra);
    this.onBuzz(p.id, opts.buzz ?? 'stomped'); this.sfx('ouch');
    return true;
  }

  /* ---------------- modos ---------------- */

  /** Limpa tudo da partida anterior: casa, entulho, efeitos e posição dos bonecos. */
  private wipe() {
    this.clearHazards(); this.resetHouse();
    this.debris = []; this.rain = []; this.sparks = []; this.floaters = []; this.screenFx = []; this.shake = 0; this.banner = null; this.results = [];
    this.events = []; this.chs = [];
    this.players.forEach((p) => {
      const sx = 120 + Math.random() * 520;
      Object.assign(p, { x: Math.random() < 0.5 ? sx : W - sx, y: -60, vx: 0, vy: 0, onGround: false, mover: -1, jumps: 0, carry: null, dizzy: 0, happy: 0,
        pts: 0, picks: 0, delivered: 0, task: null, helping: false, mine: 0, taps: 0, chTaps: 0, power: null, fx: NO_FX(), size: 1, work: 0 });
    });
  }
  toAttract() { this.setMode('attract'); this.wipe(); this.ghosts.clear(); }
  toLobby(sec = LOBBY_TIME) { this.setMode('lobby'); this.countdown = sec; this.wipe(); }
  /** Troca de tela (só antes de começar). */
  setLevel(n: number) {
    const lv = (n === 2 ? 2 : 1) as 1 | 2;
    if (this.level === lv || (this.mode !== 'lobby' && this.mode !== 'attract')) return;
    this.level = lv; this.movers = []; this.updateMovers(); this.updateMovers();
    this.wipe(); this.sfx('join');
    if (this.mode === 'lobby') this.countdown = Math.max(this.countdown, 10);
  }
  startNow() { if (this.mode === 'lobby' || this.mode === 'attract') this.startPlay(); }

  private resetHouse() {
    this.phase = 0; this.complete = false; this.finished = false;
    (Object.keys(this.have) as ItemType[]).forEach((k) => (this.have[k] = 0));
    TASKS.forEach((t) => (this.fin[t.id] = { need: 0, have: 0 }));
  }

  startPlay() {
    if (!this.players.size) return;
    this.setMode('play'); this.clearHazards(); this.resetHouse(); this.ghosts.clear();
    this.peak = this.players.size;
    this.need = this.needs(this.peak); this.debris = [];
    this.players.forEach((p) => { p.pts = 0; p.picks = 0; p.delivered = 0; p.carry = null; p.task = null; p.helping = false; p.mine = 0; p.taps = 0; p.chTaps = 0; p.power = null; p.fx = NO_FX(); });
    // desafios: terremoto e chuva fixos (têm desafio de toque); os outros sorteados nos demais horários
    const bag = [...this.lv.bag].sort(() => Math.random() - 0.5);
    const slots = this.lv.slots;
    const dirs = () => (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
    this.events = [
      ...slots.map((at, i) => ({ at, type: bag[i], dur: EVENT_INFO[bag[i]].dur, dir: dirs() })),
      ...this.lv.fixed,
    ].sort((a, b) => a.at - b.at);
    this.chs = [
      { kind: 'quake', at: 98, dur: 7, need: 0, have: 0 },
      this.level === 2 ? { kind: 'drain', at: 131, dur: 10, need: 0, have: 0 } : { kind: 'leak', at: 136, dur: 7, need: 0, have: 0 },
    ];
    this.spawnT = 0.5; this.balloonT = 16; this.powerT = 9;
    this.sfx('go');
  }

  private toFinale() {
    this.setMode('finale');
    this.debris = [];
    this.players.forEach((p) => { p.carry = null; p.work = 0; p.fx = NO_FX(); p.power = null; });
    this.clearHazards();
    this.sfx('storm'); this.buzzAll('storm');
  }

  private toResults() {
    this.setMode('results');
    this.rain = [];
    const bonus = this.finished ? 5 : this.complete ? 3 : 0;
    this.results = Array.from(this.players.values())
      .map((p) => ({ id: p.id, slot: p.slot, name: p.name, pts: p.pts, delivered: p.delivered, suggest: Math.min(30, Math.round(p.pts / 4)) + bonus }))
      .sort((a, b) => b.pts - a.pts);
    this.sfx('results');
  }

  get team() { let s = 0; this.players.forEach((p) => (s += p.pts)); return s; }
  get timeLeft() { return Math.max(0, this.lv.playTime - this.modeT); }
  private needs(n: number): Record<ItemType, number> {
    const b = needFor(Math.max(2, n)), m = this.lv.needMul;
    return { stone: Math.round(b.stone * m.stone), brick: Math.round(b.brick * m.brick), tile: Math.round(b.tile * m.tile), wood: Math.round(b.wood * m.wood), glass: Math.round(b.glass * m.glass) };
  }

  progress(): HouseProg {
    const q = (k: ItemType) => (this.need[k] ? Math.min(1, this.have[k] / this.need[k]) : 0);
    if (this.mode === 'lobby' || this.mode === 'attract') return { stone: 0, brick: 0, tile: 0, wood: 0, glass: 0 };
    return { stone: q('stone'), brick: q('brick'), tile: q('tile'), wood: q('wood'), glass: q('glass') };
  }
  finProg(): FinProg {
    if (this.mode === 'lobby' || this.mode === 'attract') return NO_FIN;
    const q = (k: TaskId) => (this.fin[k].need ? Math.min(1, this.fin[k].have / this.fin[k].need) : 0);
    return { paint: q('paint'), light: q('light'), garden: q('garden'), decor: q('decor') };
  }
  housePct() {
    const p = this.progress(), f = this.finProg();
    const s = (p.stone + p.brick + p.tile + (p.wood + p.glass) / 2) / 4;
    return Math.round((s * 0.8 + ((f.paint + f.light + f.garden + f.decor) / 4) * 0.2) * 100);
  }

  ranking() { return Array.from(this.players.values()).sort((a, b) => b.pts - a.pts); }

  private fxText(p: Player): string | undefined {
    const f = p.fx;
    if (f.frozen > 0) return 'Você está congelado! ❄️';
    if (f.burn > 0) return 'Pegando fogo! Mais lento 🔥';
    if (f.tiny > 0) return 'Você está minúsculo! 🔻';
    if (f.giant > 0) return 'Você está gigante! 🍄';
    if (f.fast > 0) return 'Turbo ligado! ⚡';
    if (f.shield > 0) return 'Escudo ativo 🛡️';
    if (f.magnet > 0) return 'Ímã puxando material 🧲';
    if (f.wings > 0) return 'Asas! Pule quantas vezes quiser 🕊️';
    if (f.double > 0) return 'Entregas valendo o dobro 💎';
    if (f.slow > 0) return 'Mais lento por um tempinho 🐌';
    return undefined;
  }

  stateFor(id: string): StateMsg | null {
    const p = this.players.get(id);
    if (!p) return null;
    const rk = this.ranking().findIndex((x) => x.id === id) + 1;
    const r = this.results.find((x) => x.id === id);
    const play = this.mode === 'play';
    const c = this.activeCh();
    let ch: ChState | undefined;
    if (c) ch = { kind: c.kind, title: CH_INFO[c.kind].title, emoji: CH_INFO[c.kind].emoji, prog: clamp(c.have / c.need), per: 1 / c.need, left: Math.max(0, Math.ceil(c.at + c.dur - this.modeT)) };
    let fin: FinState | undefined;
    if (play && this.phase >= PHASES.length && p.task) {
      const f = this.fin[p.task];
      fin = { task: p.task, helping: p.helping, prog: p.helping ? clamp(f.have / f.need) : clamp(p.mine / QUOTA), per: p.helping ? 1 / Math.max(1, f.need) : 1 / QUOTA, done: this.finished };
    }
    return {
      mode: this.mode, slot: p.slot, pts: p.pts, rank: rk, team: this.team, players: this.players.size,
      countdown: this.mode === 'lobby' ? Math.ceil(this.countdown) : undefined,
      timeLeft: play ? Math.ceil(this.timeLeft) : undefined,
      phase: play ? (PHASES[this.phase]?.title ?? FINISH_TITLE) : undefined,
      suggest: this.mode === 'results' ? r?.suggest : undefined,
      complete: this.complete, fin, ch,
      power: play && p.power ? p.power : undefined,
      powerLeft: play && p.power ? Math.max(0, Math.ceil(30 - (this.t - p.powerT))) : undefined,
      fx: play ? this.fxText(p) : undefined,
      level: this.level,
      fxs: play ? (Object.keys(p.fx) as (keyof Fx)[]).filter((k) => p.fx[k] > 0) : undefined,
      env: play ? this.events.filter((e) => this.modeT >= e.at && this.modeT < e.at + e.dur && this.phase < PHASES.length).map((e) => e.type) : this.mode === 'finale' && this.modeT < (this.complete ? 4.6 : 8) ? ['storm'] : undefined,
    };
  }

  /* ---------------- lógica ---------------- */

  step(dt: number) {
    this.t += dt; this.modeT += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.shakeAmp += (16 - this.shakeAmp) * Math.min(1, dt * 3);
    this.screenFx.forEach((f) => (f.t += dt)); this.screenFx = this.screenFx.filter((f) => f.t < f.d);
    this.updateMovers();
    this.tramp = this.tramp.map((v) => Math.max(0, v - dt * 5));
    // quem sumiu (celular fechou) sai depois de um tempo
    this.players.forEach((p) => { if (!p.bot && this.t - p.lastSeen > (this.mode === 'play' ? 25 : 12)) this.removePlayer(p.id); });

    if (this.mode === 'lobby') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== before && now <= 5 && now > 0) this.sfx('beep');
      if (this.countdown <= 0) this.startPlay();
    } else if (this.mode === 'play') {
      const before = Math.ceil(this.timeLeft + dt);
      if (this.phase < PHASES.length) {
        this.stepEvents(dt); this.stepChallenges(); this.stepSpawn(dt); this.stepBalloon(dt); this.stepPowers(dt);
        this.stepHazards(dt);
      }
      const tl = Math.ceil(this.timeLeft);
      if (tl !== before && tl <= 10 && tl > 0) this.sfx('beep');
      if (this.modeT >= this.lv.playTime || (this.finished && this.t - this.finishedAt > 3.5)) this.toFinale();
    } else if (this.mode === 'finale') {
      for (const k of [1.5, 2.6, 3.7]) if (this.modeT >= k) this.once(`th${k}`, () => this.sfx('thunder'));
      if (this.complete) {
        if (this.modeT >= 4.6) this.once('end', () => this.sfx('standing'));
        if (this.modeT >= FINALE_TIME) this.toResults();
      } else {
        // a casa não estava na rocha: primeiro o versículo, depois ela despedaça
        if (this.modeT >= COLLAPSE_AT) this.once('collapse', () => {
          this.debris = houseDebris(this.progress(), this.lv.stories, this.lv.theme);
          this.sfx('fall'); this.sfx('jolt'); this.buzzAll('quake');
          this.shake = 1.2; this.shakeAmp = 34; this.screen('#ffffff', 0.35, 0.4);
        });
        this.stepDebris(dt);
        if (this.modeT >= FINALE_FALL) this.toResults();
      }
    } else if (this.mode === 'results') {
      if (this.photo) this.modeT -= dt; // enquanto tiram foto, o placar espera
      if (this.modeT >= RESULTS_TIME) { if (this.players.size) this.toLobby(15); else this.toAttract(); }
    }

    if (this.mode !== 'attract') {
      const finishing = this.mode === 'play' && this.phase >= PHASES.length;
      this.players.forEach((p) => {
        if (p.bot) this.botThink(p);
        p.work = Math.max(0, p.work - dt * 4);
        // poder guardado some depois de 30s sem usar (para dar lugar a outro)
        if (p.power && this.t - p.powerT > 30) { p.power = null; this.float(p.x, p.y - 200 * p.size, 'O poder sumiu…', C.muted); }
        p.hitCd = Math.max(0, p.hitCd - dt);
        (Object.keys(p.fx) as (keyof Fx)[]).forEach((k) => (p.fx[k] = Math.max(0, p.fx[k] - dt)));
        const target = p.fx.giant > 0 ? 1.55 : p.fx.tiny > 0 ? 0.55 : 1;
        p.size += (target - p.size) * Math.min(1, dt * 8);
        if (p.fx.burn > 0 && Math.random() < dt * 14) this.sparks.push({ x: p.x + (Math.random() - 0.5) * 40 * p.size, y: p.y - 120 * p.size, vx: (Math.random() - 0.5) * 60, vy: -260, t: 0.2, c: Math.random() < 0.5 ? '#F26B1D' : '#F2C230' });
        if (finishing && p.task) this.stepStation(p, dt); else this.stepPlayer(p, dt);
      });
      this.stepStomps();
      this.stepItems(dt);
      this.stepAnts(dt);
    }
    this.floaters.forEach((f) => (f.t += dt)); this.floaters = this.floaters.filter((f) => f.t < 1.4);
    this.sparks.forEach((s) => { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; }); this.sparks = this.sparks.filter((s) => s.t < 0.9);
    if (this.banner && this.t - this.banner.t > 2.8) this.banner = null;
  }

  /** Plataformas que se movem: uma vai e volta no alto à direita, um elevador sobe e desce à esquerda. */
  private updateMovers() {
    const a = this.t;
    const now = this.lv.movers(a);
    this.movers = now.map((m, i) => ({ ...m, px: this.movers[i]?.x ?? m.x, py: this.movers[i]?.y ?? m.y }));
  }

  private active(type: EventType) {
    if (this.mode !== 'play' || this.phase >= PHASES.length) return null;
    return this.events.find((e) => e.type === type && this.modeT >= e.at && this.modeT < e.at + e.dur) ?? null;
  }
  private activeCh() {
    if (this.mode !== 'play') return null;
    return this.chs.find((c) => c.started && !c.ended) ?? null;
  }
  private bannerEvent() {
    if (this.mode !== 'play' || this.phase >= PHASES.length) return null;
    for (const e of this.events) {
      if (this.modeT >= e.at - 3 && this.modeT < e.at) return { e, soon: true };
      if (this.modeT >= e.at && this.modeT < e.at + e.dur) return { e, soon: false };
    }
    return null;
  }

  private stepEvents(dt: number) {
    for (const e of this.events) {
      if (!e.started && this.modeT >= e.at - 3) this.once(`soon${e.at}`, () => this.sfx('alert'));
      if (!e.started && this.modeT >= e.at) {
        e.started = true;
        // quem está carregando pode deixar cair
        const chance = e.type === 'wind' ? 0.3 : e.type === 'quake' ? 0.4 : 0;
        this.players.forEach((p) => { if (p.carry && Math.random() < chance) { this.drop(p); this.float(p.x, p.y - 170, 'Ops!', C.terra); } });
        if (e.type === 'ants') this.ants.push({ x: -40, dir: 1, carry: null, flee: false }, { x: W + 40, dir: -1, carry: null, flee: false });
        if (e.type === 'bees') { const n = this.players.size > 4 ? 2 : 1; for (let i = 0; i < n; i++) this.swarms.push({ x: i ? W + 60 : -60, y: 300, target: null, t: 0 }); }
        if (e.type === 'boulders') this.boulderT = 0;
        if (e.type === 'bear') this.bears.push({ x: -90, dir: 1, scared: false }, { x: W + 90, dir: -1, scared: false }); // um de cada lado
        if (e.type === 'lightning') this.boltT = 0.6;
        this.sfx(EVENT_INFO[e.type].sfx);
        if (e.type === 'quake') { this.buzzAll('storm'); this.quakeT = 0.4; }
      }
    }
    const q = this.active('quake');
    if (q) {
      // terremoto: a tela chacoalha o tempo todo e, a cada tranco, bonecos e materiais voam para outros lugares
      this.shake = Math.max(this.shake, 0.25); this.shakeAmp = Math.max(this.shakeAmp, 22);
      this.quakeT -= dt;
      if (this.quakeT <= 0) {
        this.quakeT = 1.1 + Math.random() * 0.7;
        this.shake = 0.5; this.shakeAmp = 46;
        this.players.forEach((p) => {
          this.onBuzz(p.id, 'quake');
          if (p.fx.shield > 0) return;
          p.vy = -650 - Math.random() * 500; p.vx = (Math.random() - 0.5) * 1100; p.onGround = false; p.mover = -1; p.boost = true;
          if (p.carry && Math.random() < 0.5) this.drop(p);
        });
        this.items.forEach((it) => { if (it.power) return; it.rest = false; it.mover = -1; it.vy = -650 - Math.random() * 750; it.vx = (Math.random() - 0.5) * 1500; it.age = Math.min(it.age, 18); });
        for (let x = 40; x < W; x += 120) this.burst(x, GROUND, pickOne(['#b9a690', '#a9a398', '#8f887d']), 3);
        this.screen('#6b5643', 0.35, 0.18);
        this.sfx('jolt');
      }
    }
    if (this.active('rain')) {
      for (let i = 0; i < 6; i++) this.rain.push({ x: Math.random() * (W + 300), y: -20 });
      if (Math.random() < dt * 0.25) this.sfx('thunder');
    }
    if (this.active('drizzle') && Math.random() < 0.6) this.rain.push({ x: Math.random() * (W + 300), y: -20, light: true });
    this.rain.forEach((d) => { d.y += (d.light ? 900 : 1500) * dt; d.x -= (d.light ? 120 : 300) * dt; });
    this.rain = this.rain.filter((d) => d.y < H);
  }

  /** Abelhas, pedras rolando e raios. */
  private stepHazards(dt: number) {
    const live = Array.from(this.players.values());
    // urso: anda do seu lado da rocha; encostar dói (-3), pular na cabeça espanta (+3)
    const bearOn = !!this.active('bear');
    for (const b of this.bears) {
      if (!bearOn) b.scared = true;
      b.x += b.dir * (b.scared ? 430 : 165) * dt;
      if (!b.scared) {
        const left = b.x < 960, lo = left ? 60 : ROCK.x1 + 80, hi = left ? ROCK.x0 - 80 : W - 60;
        if (b.x > hi && b.dir > 0 && (left || b.x < W)) b.dir = -1;
        if (b.x < lo && b.dir < 0 && (!left || b.x > 0)) b.dir = 1;
      }
      for (const p of live) {
        const dx = Math.abs(p.x - b.x);
        if (b.scared || dx > 80) continue;
        if (p.vy > 100 && p.y > GROUND - 150 && p.y < GROUND - 80) {
          b.scared = true; b.dir = (p.x < b.x ? 1 : -1) as 1 | -1; p.vy = -950; p.jumps = 1; p.pts += 3;
          this.float(p.x, p.y - 190, 'Urso espantado! +3', CHARS[p.slot].color); this.onBuzz(p.id, 'stomp'); this.sfx('stomp');
        } else if (p.y > GROUND - 70 && dx < 64) {
          const had = p.carry;
          if (this.ouch(p, { knock: (p.x < b.x ? -1 : 1) * 900, lose: 3, dizzy: 1.4, text: 'Urso! -3 🐻', buzz: 'rock' }) && had) this.items = this.items.filter((i) => i !== had);
        }
      }
    }
    this.bears = this.bears.filter((b) => !b.scared || (b.x > -160 && b.x < W + 160));
    // abelhas: perseguem o jogador mais perto (mais devagar que quem corre)
    const beesOn = !!this.active('bees');
    for (const s of this.swarms) {
      s.t += dt;
      if (!beesOn) { s.y -= 300 * dt; s.x += (s.x < W / 2 ? -1 : 1) * 300 * dt; continue; }
      let tg = live.find((p) => p.id === s.target);
      if (!tg || Math.random() < dt * 0.3) {
        let bd = Infinity; tg = undefined;
        for (const p of live) { const d = Math.hypot(p.x - s.x, p.y - 80 - s.y); if (d < bd && p.hitCd <= 0) { bd = d; tg = p; } }
        s.target = tg?.id ?? null;
      }
      if (tg) {
        const dx = tg.x - s.x, dy = tg.y - 80 * tg.size - s.y, d = Math.hypot(dx, dy) || 1;
        const sp = 250 + Math.sin(s.t * 3) * 40;
        s.x += (dx / d) * sp * dt + Math.sin(s.t * 9) * 2; s.y += (dy / d) * sp * dt + Math.cos(s.t * 7) * 2;
        if (d < 55 * tg.size) { if (this.ouch(tg, { slow: 2.5, lose: 2, dizzy: 0.8, text: 'Picada! -2 🐝', buzz: 'sting' })) s.target = null; }
      }
    }
    this.swarms = this.swarms.filter((s) => s.y > -200 && s.x > -200 && s.x < W + 200);
    // pedras rolando pelo chão (dos dois lados até a rocha)
    if (this.active('boulders')) {
      this.boulderT -= dt;
      if (this.boulderT <= 0) { this.boulderT = 1.6 + Math.random() * 1.2; const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1; this.boulders.push({ x: dir > 0 ? -40 : W + 40, dir, rot: 0 }); this.sfx('boulder'); }
    }
    for (const b of this.boulders) {
      b.x += b.dir * 520 * dt; b.rot += b.dir * 520 * dt / 34;
      for (const p of live) if (Math.abs(p.x - b.x) < 40 * Math.max(1, p.size) && p.y > GROUND - 50 && p.y <= GROUND + 2) this.ouch(p, { knock: b.dir * 650, dizzy: 1, lose: 1, text: 'Pedrada! -1', buzz: 'rock' }) && this.screen('#6b5643', 0.3, 0.2, true);
    }
    this.boulders = this.boulders.filter((b) => {
      const hitRock = (b.dir > 0 && b.x > ROCK.x0 - 30) || (b.dir < 0 && b.x < ROCK.x1 + 30);
      if (hitRock) { this.burst(b.x, GROUND - 30, '#8f887d', 14); this.sfx('crash'); }
      return !hitRock && b.x > -80 && b.x < W + 80;
    });
    // raios: marcam um círculo vermelho embaixo de alguém e caem 1,1s depois
    if (this.active('lightning')) {
      this.boltT -= dt;
      if (this.boltT <= 0 && live.length) {
        this.boltT = 1.1 + Math.random() * 0.8;
        const p = pickOne(live);
        this.bolts.push({ x: p.x, y: p.onGround ? p.y : GROUND, t: 0, hit: false });
        this.onBuzz(p.id, 'bolt');
      }
    }
    for (const b of this.bolts) {
      b.t += dt;
      if (!b.hit && b.t >= 1.1) {
        b.hit = true; this.shake = 0.3; this.shakeAmp = 24; this.sfx('lightning'); this.screen('#ffffff', 0.3, 0.85); this.screen('#FFF6B0', 0.7, 0.3);
        for (const p of live) if (Math.abs(p.x - b.x) < 62 && p.y > b.y - 260 && p.y <= b.y + 4) this.ouch(p, { dizzy: 1.2, lose: 1, text: 'Raio! -1 ⚡', buzz: 'strike' });
      }
    }
    this.bolts = this.bolts.filter((b) => b.t < 1.4);
    // tiros de poder
    for (const s of this.shots) {
      const q = this.players.get(s.to);
      if (!q) { s.t = 99; continue; }
      s.t += dt;
      const tx = q.x, ty = q.y - 80 * q.size, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
      const sp = 1500 * dt;
      if (d <= sp + 30) { s.t = 99; this.applyPower(q, s.power, this.players.get(s.from)); }
      else { s.x += (dx / d) * sp; s.y += (dy / d) * sp; }
    }
    this.shots = this.shots.filter((s) => s.t < 3);
  }

  /** Desafios de toque: todo mundo toca rápido no celular para salvar a obra. */
  private stepChallenges() {
    for (const c of this.chs) {
      if (!c.started && this.modeT >= c.at) {
        c.started = true; c.need = CH_TAPS * Math.max(1, this.players.size); c.have = 0;
        this.players.forEach((p) => (p.chTaps = 0));
        this.buzzAll('alert'); this.sfx('alert');
      }
      if (c.started && !c.ended && (c.have >= c.need || this.modeT >= c.at + c.dur)) {
        c.ended = true; c.ok = c.have >= c.need;
        const info = CH_INFO[c.kind];
        if (c.ok) {
          this.players.forEach((p) => { if (p.chTaps > 0) { p.pts += 3; p.happy = 1.2; this.float(p.x, p.y - 190, '+3', CHARS[p.slot].color); } });
          this.flash(info.ok, C.olive); this.burst(960, ROCK.top - 260, C.olive, 36); this.sfx('chWin'); this.screen(C.olive, 0.6, 0.3, true);
        } else {
          PHASES[this.phase]?.types.forEach((k) => (this.have[k] = Math.max(0, this.have[k] - Math.ceil(this.need[k] * 0.15))));
          this.flash(info.fail, C.terra); this.shake = 0.6; this.shakeAmp = 30; this.sfx('chFail'); this.screen(C.terra, 0.7, 0.35, true);
        }
      }
    }
  }

  private currentTypes(): ItemType[] {
    const ph = PHASES[this.phase];
    return ph ? ph.types.filter((k) => this.have[k] < this.need[k]) : [];
  }

  /** Jogador novo no meio da partida: as fases que ainda faltam pedem mais material. */
  private scaleNeeds() {
    const nn = this.needs(this.peak);
    PHASES.forEach((ph, i) => {
      if (i < this.phase) return;
      ph.types.forEach((k) => { if (this.have[k] < this.need[k] || i > this.phase) this.need[k] = Math.max(this.need[k], nn[k]); });
    });
  }

  private spots(): [number, number][] {
    return [[160, 660], [1250, 1760], ...this.lv.plats.map((p) => [p.x + 24, p.x + p.w - 24] as [number, number]),
      ...this.lv.tramps.map((t) => [t.x + 20, t.x + t.w - 20] as [number, number]),
      ...this.movers.map((m) => [m.x + 20, m.x + m.w - 20] as [number, number])];
  }

  private stepSpawn(dt: number) {
    const n = Math.max(1, this.players.size);
    this.spawnT -= dt;
    const cap = Math.min(16, 4 + n);
    if (this.spawnT > 0 || this.items.filter((i) => !i.power).length >= cap) return;
    this.spawnT = Math.max(0.45, 2.2 / Math.sqrt(n)) * (0.7 + Math.random() * 0.6);
    const types = this.currentTypes();
    if (!types.length) return;
    const [a, b] = pickOne(this.spots());
    this.items.push({ id: this.nextItem++, type: pickOne(types), qty: rollQty(), x: a + Math.random() * (b - a), y: -40, vx: 0, vy: 0, rest: false, age: 0, onGroundFloor: false, mover: -1 });
  }

  /** Bolhas de poder caem de tempos em tempos (no máximo 2 na tela). */
  private stepPowers(dt: number) {
    this.powerT -= dt;
    if (this.powerT > 0) return;
    this.powerT = 9 + Math.random() * 7;
    if (this.items.filter((i) => i.power).length >= 2) return;
    const [a, b] = pickOne(this.spots());
    this.items.push({ id: this.nextItem++, type: 'stone', qty: 0, power: pickOne(this.lv.powers), x: a + Math.random() * (b - a), y: -40, vx: 0, vy: 0, rest: false, age: 0, onGroundFloor: false, mover: -1 });
  }

  /** De tempos em tempos um balão cruza o céu com um pacote x10 pendurado. */
  private stepBalloon(dt: number) {
    if (!this.balloon) {
      this.balloonT -= dt;
      const types = this.currentTypes();
      if (this.balloonT > 0 || !types.length) return;
      const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
      const x = dir > 0 ? -80 : W + 80;
      this.balloon = { x, y: 236, dir, item: { id: this.nextItem++, type: pickOne(types), qty: 10, x, y: 340, vx: 0, vy: 0, rest: false, age: 0, onGroundFloor: false, mover: -1, float: true } };
      this.balloonT = 24; this.sfx('balloon');
      return;
    }
    const b = this.balloon;
    b.x += b.dir * 150 * dt;
    if (!b.item) b.y -= 260 * dt; else b.y = 236 + Math.sin(this.t * 2) * 8;
    if (b.item) { b.item.x = b.x; b.item.y = b.y + 104; }
    if (b.x < -140 || b.x > W + 140 || b.y < -160) this.balloon = null;
  }

  /** Onde algo que está caindo pousa (plataformas, plataformas móveis, rocha, chão). */
  private land(x: number, prevY: number, y: number, vy: number) {
    if (vy < 0) return null;
    const r = { y: Infinity, m: -1, tramp: -1 };
    const take = (py: number, m: number) => { if (py < r.y) { r.y = py; r.m = m; } };
    for (const p of this.solid()) if (x > p.x - 14 && x < p.x + p.w + 14 && prevY <= p.y + 1 && y >= p.y) take(p.y, -1);
    this.movers.forEach((m, i) => { if (x > m.x - 10 && x < m.x + m.w + 10 && prevY <= Math.max(m.py, m.y) + 1 && y >= m.y) take(m.y, i); });
    const rs = rockSurface(x);
    if (rs != null && prevY <= rs + 1 && y >= rs) take(rs, -1);
    if (y >= GROUND) take(GROUND, -1);
    if (r.y === Infinity) return null;
    if (r.y === GROUND && r.m === -1) r.tramp = this.lv.tramps.findIndex((t) => x > t.x && x < t.x + t.w);
    return r;
  }

  private stepPlayer(p: Player, dt: number) {
    const rain = !!this.active('rain');
    const wind = this.active('wind');
    const f = p.fx;
    const frozen = f.frozen > 0;
    const dir = frozen ? 0 : (p.input.r ? 1 : 0) - (p.input.l ? 1 : 0);
    const stunned = p.dizzy > 0 || frozen;
    p.dizzy = Math.max(0, p.dizzy - dt); p.happy = Math.max(0, p.happy - dt);
    const wy = this.waterY(), wet = p.y > wy + 20, swim = p.y > wy + 40 && !p.onGround;
    const spd = (f.fast > 0 ? 1.6 : 1) * (f.burn > 0 ? 0.55 : 1) * (f.tiny > 0 ? 0.8 : 1) * (f.slow > 0 ? 0.6 : 1) * (this.active('drizzle') ? 0.72 : 1) * (wet ? 0.55 : 1);
    const acc = (p.onGround ? (rain ? 900 : 3400) : 1900) * Math.max(0.7, spd);
    if (dir && !stunned) { p.vx += dir * acc * dt; p.face = dir as 1 | -1; }
    else if (p.onGround || frozen) { const dec = (rain && !frozen ? 500 : 3800) * dt; p.vx = Math.abs(p.vx) <= dec ? 0 : p.vx - Math.sign(p.vx) * dec; }
    if (wind && !frozen) p.vx += (wind.dir ?? 1) * 1500 * dt * (f.giant > 0 ? 0.4 : f.tiny > 0 ? 1.4 : 1);
    const lim = MAXV * spd + (wind ? 160 : 0);
    p.vx = Math.max(-lim, Math.min(lim, p.vx));
    // pulo (com tolerância na borda), pulo duplo no ar e pulo mais baixo se soltar cedo
    const jm = (f.fast > 0 ? 1.08 : 1) * (f.tiny > 0 ? 0.88 : 1) * (f.giant > 0 ? 1.06 : 1);
    p.coyote = p.onGround ? 0.09 : Math.max(0, p.coyote - dt);
    if (p.input.j && !p.prevJ && !stunned && p.y > wy + 40) {
      // nadando: cada toque é uma braçada; perto da superfície, pula para fora
      p.vy = p.y - wy < 140 ? -980 : -560; p.onGround = false; p.jumps = 1; p.mover = -1; p.boost = true;
      for (let i = 0; i < 5; i++) this.sparks.push({ x: p.x + (Math.random() - 0.5) * 40, y: p.y - 90, vx: (Math.random() - 0.5) * 80, vy: -160, t: 0.3, c: 'rgba(255,255,255,0.9)' });
      this.sfx('jump');
    } else if (p.input.j && !p.prevJ && !stunned) {
      if (p.onGround || p.coyote > 0) { p.vy = JUMP * jm; p.onGround = false; p.coyote = 0; p.jumps = 1; p.boost = false; p.mover = -1; this.sfx('jump'); }
      else if (p.jumps < 2 || f.wings > 0) { if (f.wings > 0) for (let i = 0; i < 6; i++) this.sparks.push({ x: p.x + (Math.random() - 0.5) * 60, y: p.y - 60, vx: (Math.random() - 0.5) * 200, vy: 120, t: 0.3, c: '#E9F5C8' }); p.vy = JUMP * 0.9 * jm; p.jumps = 2; p.boost = false; this.puff(p.x, p.y); this.sfx('jump2'); }
    }
    if (!p.input.j && !p.boost && p.vy < CUT) p.vy = CUT;
    if (p.vy >= 0) p.boost = false;
    p.prevJ = p.input.j;
    // em cima de plataforma que se move: vai junto
    if (p.onGround && p.mover >= 0) { const m = this.movers[p.mover]; p.x += m.x - m.px; p.y = m.y; }
    p.vy += GRAV * (swim ? 0.2 : 1) * dt;
    if (swim) { p.vy = Math.min(p.vy, 160) * (1 - 1.2 * dt); if (Math.random() < dt * 3) this.sparks.push({ x: p.x, y: p.y - 120, vx: 0, vy: -120, t: 0.4, c: 'rgba(255,255,255,0.8)' }); }
    const prevY = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = Math.max(30, Math.min(W - 30, p.x));
    const land = this.land(p.x, prevY, p.y, p.vy);
    if (land) {
      p.y = land.y; p.vy = 0; p.onGround = true; p.mover = land.m; p.jumps = 0;
      if (land.tramp >= 0 && !frozen) { // cama elástica: lá vai para o alto
        p.vy = TRAMP_V; p.onGround = false; p.boost = true; p.jumps = 1; p.mover = -1;
        this.tramp[land.tramp] = 1; this.sfx('boing'); this.onBuzz(p.id, 'boing');
      }
    } else { p.onGround = false; p.mover = -1; }
    // rocha: dá para subir a rampa andando; se bater de lado, para na parede
    const rs = rockSurface(p.x);
    if (rs != null && p.y > rs + 2) {
      if (p.y - rs <= 36 && p.vy >= 0) { p.y = rs; p.vy = 0; p.onGround = true; p.jumps = 0; p.mover = -1; }
      else { p.x = p.x < (ROCK.x0 + ROCK.x1) / 2 ? ROCK.x0 - 18 : ROCK.x1 + 18; p.vx = 0; }
    }
    p.walk = p.onGround && Math.abs(p.vx) > 30 ? p.walk + dt * 14 * Math.min(1.6, spd) : 0;
    if (f.fast > 0 && Math.abs(p.vx) > 200 && Math.random() < 0.5) this.sparks.push({ x: p.x - p.face * 30, y: p.y - 60 * p.size - Math.random() * 60, vx: -p.face * 200, vy: -40, t: 0.4, c: '#ffffff' });

    if (this.mode !== 'play') return;
    const reach = 44 * Math.max(1, p.size), tall = 120 * Math.max(0.7, p.size);
    const near = (i: Item) => Math.abs(i.x - p.x) < reach && i.y > p.y - tall && i.y < p.y + 20;
    // pegar poder (fica guardado; não ocupa as mãos)
    if (!p.power && !frozen) {
      const pw = this.items.find((i) => i.power && near(i));
      if (pw) {
        this.items = this.items.filter((i) => i !== pw);
        p.power = pw.power!; p.powerT = this.t;
        const P = POWERS[p.power];
        this.float(p.x, p.y - 200 * p.size, `${P.emoji} ${P.label}`, P.color);
        this.onBuzz(p.id, 'power'); this.sfx('power');
      }
    }
    // pegar material (também o do balão)
    if (!p.carry && !stunned) {
      const b = this.balloon;
      let it: Item | undefined;
      if (b?.item && near(b.item)) { it = b.item; b.item = null; it.float = false; }
      else { it = this.items.find((i) => !i.power && near(i)); if (it) this.items = this.items.filter((i) => i !== it); }
      if (it) {
        p.carry = it; p.pts += 1; p.picks++;
        this.float(p.x, p.y - 190 * p.size, it.qty > 1 ? `+1 · x${it.qty}` : '+1', CHARS[p.slot].color);
        if (it.qty >= 10) this.burst(p.x, p.y - 150, '#F3C64A', 22);
        this.onBuzz(p.id, it.qty >= 4 ? 'gold' : 'pick'); this.sfx(it.qty >= 4 ? 'gold' : 'pick');
      }
    }
    // entregar na obra (o bonequinho continua onde está)
    if (p.carry && p.x > ZONE.x0 && p.x < ZONE.x1 && p.y <= ROCK.top + 2 && p.y > ROCK.top - 340 - (this.lv.stories === 2 ? STORY2 : 0)) {
      const it = p.carry; p.carry = null;
      const types = this.currentTypes();
      const type = types.includes(it.type) ? it.type : types[0];
      if (type) this.have[type] = Math.min(this.need[type], this.have[type] + it.qty);
      const pts = (DELIVER_PTS[it.qty] ?? 2) * (p.fx.double > 0 ? 2 : 1);
      p.pts += pts; p.delivered += it.qty; p.happy = 1;
      this.float(p.x, p.y - 190 * p.size, `+${pts}${it.qty > 1 ? ` (${it.qty} de uma vez!)` : ''}`, CHARS[p.slot].color);
      this.burst(960, ROCK.top - 200, it.qty >= 10 ? '#F3C64A' : it.qty >= 4 ? '#4FA3DD' : C.terra, 10 + it.qty * 2);
      this.onBuzz(p.id, it.qty >= 4 ? 'deliverBig' : 'deliver'); this.sfx(it.qty >= 4 ? 'deliverBig' : 'deliver');
      if (it.qty >= 10) this.screen('#F3C64A', 0.5, 0.3, true);
      this.checkPhase();
    }
  }

  private checkPhase() {
    while (this.phase < PHASES.length && PHASES[this.phase].types.every((k) => this.have[k] >= this.need[k])) {
      this.phase++;
      this.burst(960, ROCK.top - 300, C.amber, 40); this.screen('#ffffff', 0.4, 0.35);
      const next = PHASES[this.phase];
      // material que sobrou da fase anterior vira o da próxima
      if (next) {
        this.items = this.items.filter((i) => i.power || next.types.includes(i.type));
        this.players.forEach((p) => { if (p.carry && !next.types.includes(p.carry.type)) p.carry.type = next.types[0]; });
        if (this.balloon?.item && !next.types.includes(this.balloon.item.type)) this.balloon.item.type = next.types[0];
        this.flash(`${next.title}`, C.terra); this.sfx('phase');
      } else { this.complete = true; this.startFinish(); }
    }
  }

  /* ---------------- acabamento (fase 5) ---------------- */

  private startFinish() {
    this.clearHazards(); this.rain = [];
    this.chs.forEach((c) => { c.started = true; c.ended = true; });
    TASKS.forEach((t) => (this.fin[t.id] = { need: 0, have: 0 }));
    Array.from(this.players.values()).sort((a, b) => a.slot - b.slot).forEach((p, i) => { p.carry = null; p.fx = NO_FX(); p.power = null; this.assign(p, TASKS[i % TASKS.length].id); });
    // com menos de 4 jogadores, as equipes sem ninguém ficam para quem terminar primeiro
    TASKS.forEach((t) => { if (!this.fin[t.id].need) this.fin[t.id].need = 40; });
    this.flash('Acabamento! Toquem rápido no celular 📱', C.terra);
    this.sfx('phase'); this.buzzAll('alert');
  }
  private assign(p: Player, task: TaskId) { p.task = task; p.helping = false; p.mine = 0; this.fin[task].need += QUOTA; }
  private neediest(): TaskId | null {
    let best: TaskId | null = null, bd = 0;
    for (const t of TASKS) { const r = this.fin[t.id].need - this.fin[t.id].have; if (r > bd) { bd = r; best = t.id; } }
    return best;
  }

  private finishTaps(p: Player, n: number) {
    for (let i = 0; i < n; i++) {
      if (!p.task) return;
      let f = this.fin[p.task];
      if (f.have >= f.need) { const nx = this.neediest(); if (!nx) break; p.task = nx; p.helping = true; f = this.fin[nx]; }
      f.have++; p.taps++;
      if (p.taps % 4 === 0) p.pts += 1;
      if (!p.helping) {
        p.mine++;
        if (p.mine >= QUOTA) { p.helping = true; p.pts += 5; p.happy = 1.2; this.float(p.x, p.y - 200, 'Parte pronta! +5', CHARS[p.slot].color); this.onBuzz(p.id, 'part'); this.sfx('part'); }
      }
      if (f.have === f.need) { const T = TASK[p.task]; this.flash(`${T.emoji} ${T.done}`, T.color); this.burst(960, ROCK.top - 260, T.color, 30); this.sfx('task'); }
    }
    p.work = 1;
    const T = TASK[p.task ?? 'paint'];
    const cols: Record<TaskId, string[]> = { paint: ['#FBF1E1', '#E26D9A', '#F2DFC4'], light: ['#FFE28A', '#F2A541', '#fff'], garden: ['#5E8C3A', '#8FBF5A', '#E25B45'], decor: ['#E26D9A', '#F2A541', '#7B3FA0', '#2F8FD0'] };
    for (let i = 0; i < 3; i++) { const c = cols[T.id]; this.sparks.push({ x: p.x + p.face * 40, y: p.y - 100, vx: (Math.random() - 0.5) * 300, vy: -200 - Math.random() * 300, t: 0, c: pickOne(c) }); }
    if (Math.random() < 0.35) this.sfx('tap');
    if (TASKS.every((t) => this.fin[t.id].have >= this.fin[t.id].need)) {
      this.finished = true; this.finishedAt = this.t;
      this.flash('Casa pronta! ✨', C.olive);
      for (let i = 0; i < 4; i++) this.burst(700 + i * 170, 400 + (i % 2) * 120, [C.amber, C.terra, C.olive, '#E26D9A'][i], 34);
      this.players.forEach((q) => (q.happy = 3));
      this.sfx('finished'); this.buzzAll('finish'); this.screen('#F3C64A', 1.2, 0.35, true); this.screen('#ffffff', 0.3, 0.5);
    }
  }

  /** No acabamento cada um vai para o seu posto de trabalho em volta da casa. */
  private station(p: Player): [number, number] {
    const crew = Array.from(this.players.values()).filter((q) => q.task === p.task).sort((a, b) => a.slot - b.slot);
    const i = Math.max(0, crew.indexOf(p));
    const pick = (s: [number, number][]) => s[i % s.length];
    switch (p.task) {
      case 'paint': return pick([[846, ROCK.top], [1078, ROCK.top], [884, ROCK.top], [1040, ROCK.top], [810, ROCK.top], [1112, ROCK.top]]);
      case 'light': return pick(this.lv.lightSpots);
      case 'garden': return pick([[520, GROUND], [1430, GROUND], [380, GROUND], [1570, GROUND], [260, GROUND], [1690, GROUND]]);
      default: return pick([[672, GROUND], [1252, GROUND], [600, GROUND], [1320, GROUND], [560, GROUND], [1380, GROUND]]);
    }
  }
  private stepStation(p: Player, dt: number) {
    const [sx, sy] = this.station(p);
    const dx = sx - p.x, dy = sy - p.y, k = Math.min(1, dt * 3);
    p.x += dx * k; p.y += dy * k; p.vx = 0; p.vy = 0; p.mover = -1; p.carry = null;
    p.onGround = Math.abs(dy) < 8;
    p.walk = Math.abs(dx) > 8 ? p.walk + dt * 14 : 0;
    p.face = Math.abs(dx) > 8 ? (Math.sign(dx) as 1 | -1) : p.x < 960 ? 1 : -1;
    p.happy = Math.max(0, p.happy - dt); p.dizzy = 0;
  }

  private stepStomps() {
    if (this.mode !== 'play' || this.phase >= PHASES.length) return;
    const arr = Array.from(this.players.values());
    for (const a of arr) {
      if (a.vy < 150 || a.fx.frozen > 0) continue;
      for (const b of arr) {
        if (a === b || b.dizzy > 0) continue;
        const head = 150 * b.size, w = 36 * Math.max(a.size, b.size);
        if (Math.abs(a.x - b.x) < w && a.y > b.y - head && a.y < b.y - head + 50) {
          a.vy = -800; a.jumps = 1;
          if (b.fx.shield > 0) { this.float(b.x, b.y - 200, 'Bloqueado! 🛡️', '#2F8FD0'); this.sfx('block'); continue; }
          a.pts += 1;
          if (b.carry) this.drop(b, a.face);
          b.dizzy = a.size > 1.3 ? 1.8 : 1.1;
          this.float(a.x, a.y - 190, '+1', CHARS[a.slot].color);
          this.onBuzz(a.id, 'stomp'); this.onBuzz(b.id, 'stomped'); this.sfx('stomp');
        }
      }
    }
  }

  /** Pedaços da casa caindo: telhado primeiro, depois as paredes, rolando pela rocha até o chão. */
  private stepDebris(dt: number) {
    const k = this.modeT - COLLAPSE_AT;
    for (const d of this.debris) {
      if (k < d.delay) { if (Math.random() < dt * 2) d.rot = (Math.random() - 0.5) * 0.06; continue; }
      if (d.hits === 0 && d.vy === 0 && d.vx === 0) {
        // solta: espalha para os lados e gira
        d.vx = (d.x - 960) * 1.1 + (Math.random() - 0.5) * 260; d.vy = -60 - Math.random() * 260; d.vr = (Math.random() - 0.5) * 9;
        if (Math.random() < 0.15) this.sfx('crash');
      }
      if (d.hits >= 3) continue;
      d.vy += GRAV * 0.75 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      const floor = (rockSurface(d.x) ?? GROUND) - Math.min(d.w, d.h) / 2;
      if (d.y >= floor) {
        d.y = floor; d.hits++;
        if (d.hits === 1) { for (let i = 0; i < 3; i++) this.sparks.push({ x: d.x, y: d.y, vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 160, t: 0.2, c: '#b9a690' }); this.shake = Math.max(this.shake, 0.15); }
        if (Math.abs(d.vy) > 220 && d.hits < 3) { d.vy = -d.vy * 0.32; d.vx *= 0.6; d.vr *= 0.5; } else { d.hits = 3; d.vr = 0; }
      }
    }
  }

  private dropFrom(p: Player) { if (p.carry) { this.drop(p); } }
  private drop(p: Player, dir: number = p.face) {
    const it = p.carry; if (!it) return;
    p.carry = null;
    it.x = p.x; it.y = p.y - 150 * p.size; it.vx = dir * (180 + Math.random() * 200); it.vy = -520; it.rest = false; it.age = 0; it.mover = -1; it.float = false;
    this.items.push(it);
  }

  private stepItems(dt: number) {
    const wind = this.active('wind');
    // ímã: puxa o material por perto
    const magnets = Array.from(this.players.values()).filter((p) => p.fx.magnet > 0 && !p.carry);
    for (const it of this.items) {
      it.pulled = false;
      if (it.power) continue;
      for (const p of magnets) {
        const tx = p.x, ty = p.y - 60, dx = tx - it.x, dy = ty - it.y, d = Math.hypot(dx, dy);
        if (d < 380 && d > 4) { const s = Math.min(d, 620 * dt); it.x += (dx / d) * s; it.y += (dy / d) * s; it.rest = false; it.mover = -1; it.vx = 0; it.vy = 0; it.pulled = true; it.age = Math.min(it.age, 20); break; }
      }
    }
    for (const it of this.items) {
      it.age += dt;
      if (it.pulled) continue;
      if (it.rest && it.mover >= 0) { // indo junto com a plataforma
        const m = this.movers[it.mover];
        it.x += m.x - m.px; it.y = m.y;
        if (it.x < m.x - 6 || it.x > m.x + m.w + 6) { it.rest = false; it.mover = -1; }
        continue;
      }
      const wy = this.waterY();
      if (it.y > wy - 4 && wy < H) { // boia no dilúvio e vai com a correnteza
        it.rest = false; it.mover = -1; it.vy = 0; it.y = wy + Math.sin(this.t * 3 + it.id) * 4; it.x += Math.sin(this.t * 0.7 + it.id) * 40 * dt;
        const rs0 = rockSurface(it.x); if (rs0 != null && it.y > rs0) it.x = it.x < 965 ? ROCK.x0 - 10 : ROCK.x1 + 10;
        continue;
      }
      if (wind && it.rest) { it.vx += (wind.dir ?? 1) * 260 * dt; it.rest = Math.abs(it.vx) < 5; }
      if (!it.rest) {
        it.vy += GRAV * 0.8 * dt;
        const prevY = it.y;
        it.x += it.vx * dt; it.y += it.vy * dt; it.vx *= 1 - 1.5 * dt;
        if (it.x < 30 || it.x > W - 30) { it.x = Math.max(30, Math.min(W - 30, it.x)); it.vx = -it.vx * 0.5; }
        const land = this.land(it.x, prevY, it.y, it.vy);
        if (land && land.tramp >= 0) { it.y = land.y - 1; it.vy = -1100; this.tramp[land.tramp] = 0.7; }
        else if (land) { it.y = land.y; it.vy = 0; it.vx *= 0.5; it.mover = land.m; if (Math.abs(it.vx) < 20) { it.vx = 0; it.rest = true; } it.onGroundFloor = land.y === GROUND; }
        const rs = rockSurface(it.x);
        if (rs != null && it.y > rs + 2) { it.x = it.x < 965 ? ROCK.x0 - 10 : ROCK.x1 + 10; it.vx = -it.vx * 0.4; }
      }
    }
    // material esquecido some depois de um tempo
    this.items = this.items.filter((it) => it.age < 28);
  }

  private stepAnts(dt: number) {
    for (const a of this.ants) {
      a.x += a.dir * (a.flee ? 260 : 120) * dt;
      if (!a.carry && !a.flee) {
        const it = this.items.find((i) => !i.power && i.rest && i.onGroundFloor && Math.abs(i.x - a.x) < 22);
        if (it) { this.items = this.items.filter((i) => i !== it); a.carry = it; }
      }
      this.players.forEach((p) => {
        const onFloor = p.y > GROUND - 50 && p.y <= GROUND + 2;
        // pular na formiga solta o material
        if (!a.flee && p.vy > 100 && Math.abs(p.x - a.x) < 40 * Math.max(1, p.size) && onFloor) {
          a.flee = true; p.vy = -700; p.jumps = 1; p.pts += 1; this.float(p.x, p.y - 190, '+1', CHARS[p.slot].color); this.onBuzz(p.id, 'stomp'); this.sfx('stomp');
          if (a.carry) { const it = a.carry; a.carry = null; it.x = a.x; it.y = GROUND - 60; it.vy = -400; it.vx = 0; it.rest = false; it.age = 0; it.mover = -1; this.items.push(it); }
          a.dir = (a.dir * -1) as 1 | -1;
        } else if (!a.flee && p.onGround && onFloor && Math.abs(p.x - a.x) < 34 && p.vy >= 0) {
          // se a formiga encosta: mordida, fica lento e ela leva o que você carregava
          const had = p.carry;
          if (this.ouch(p, { slow: 2.5, text: 'Formiga mordeu! 🐜', buzz: 'bite' }) && had && !a.carry) { this.items = this.items.filter((i) => i !== had); a.carry = had; }
        }
      });
    }
    this.ants = this.ants.filter((a) => a.x > -80 && a.x < W + 80);
    const ev = this.active('ants');
    if (ev && this.ants.length < 3 && Math.random() < dt * 0.6) this.ants.push(Math.random() < 0.5 ? { x: -40, dir: 1, carry: null, flee: false } : { x: W + 40, dir: -1, carry: null, flee: false });
  }

  private botThink(p: Player) {
    p.lastSeen = this.t;
    if (this.mode === 'play' && (this.activeCh() || (this.phase >= PHASES.length && !this.finished))) {
      if (Math.random() < 0.11) this.tap(p.id, 1);
      if (this.phase >= PHASES.length) return;
    }
    if (p.power && Math.random() < 0.006) this.usePower(p.id);
    let tx: number, ty: number;
    if (p.carry) { tx = 960; ty = ROCK.top; }
    else {
      let best: Item | null = null, bd = 1e9;
      const pool = this.balloon?.item ? [...this.items, this.balloon.item] : this.items;
      for (const it of pool) { if (it.power && p.power) continue; const d = Math.abs(it.x - p.x) + Math.abs(it.y - p.y) * 1.5 - it.qty * 20; if (d < bd) { bd = d; best = it; } }
      if (!best) { tx = 400 + ((p.slot * 137) % 1100); ty = GROUND; } else { tx = best.x; ty = best.y; }
    }
    const dx = tx - p.x;
    const wantUp = ty < p.y - 60;
    p.input = { l: dx < -20, r: dx > 20, j: (wantUp && Math.random() < 0.08) || (p.onGround && Math.abs(p.vx) < 5 && Math.abs(dx) > 30 && Math.random() < 0.05) ? true : p.input.j && Math.random() < 0.8 };
  }

  private float(x: number, y: number, text: string, color: string) { this.floaters.push({ x, y, text, color, t: 0 }); }
  private flash(text: string, color: string) { this.banner = { text, t: this.t, color }; }
  private burst(x: number, y: number, c: string, n = 18) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 200 + Math.random() * 400; this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300, t: 0, c }); }
  }
  private puff(x: number, y: number) {
    for (let i = 0; i < 8; i++) this.sparks.push({ x: x + (Math.random() - 0.5) * 30, y: y - 6, vx: (Math.random() - 0.5) * 260, vy: 60 + Math.random() * 120, t: 0.3, c: '#ffffff' });
  }

  /* ---------------- desenho ---------------- */

  render(ctx: Ctx) {
    const finale = this.mode === 'finale';
    const fk = finale ? this.modeT : 0;
    const dark = finale ? Math.min(1, fk / 1.2) * (this.complete ? Math.max(0, 1 - (fk - 4.5) / 1.5) : 1) : this.active('rain') ? 0.35 : this.active('drizzle') ? 0.15 : this.active('lightning') ? 0.4 : 0;
    const fin = this.finProg();
    ctx.save();
    if (this.shake > 0) {
      const a = this.shakeAmp;
      ctx.translate(W / 2, H / 2); ctx.rotate((Math.random() - 0.5) * 0.0006 * a); ctx.translate(-W / 2, -H / 2);
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a * 0.75);
    }
    if (finale && fk > 1 && fk < 4.5) ctx.translate((Math.random() - 0.5) * 8, 0);
    scenery(ctx, this.t, dark, this.lv.dusk);
    finishBack(ctx, fin, this.t);
    const quake = !!this.active('quake');
    this.lv.plats.forEach((pl, i) => platform(ctx, pl, quake ? Math.sin(this.t * 40 + i) * 4 : 0));
    // plataformas que se movem (trilho e cabos)
    for (const m of this.movers) {
      if (m.vertical) { ctx.strokeStyle = 'rgba(43,33,24,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(m.x + 12, 0); ctx.lineTo(m.x + 12, m.y); ctx.moveTo(m.x + m.w - 12, 0); ctx.lineTo(m.x + m.w - 12, m.y); ctx.stroke(); }
      else if (m.rail) { ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(43,33,24,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.rail[0], m.y + 13); ctx.lineTo(m.rail[1], m.y + 13); ctx.stroke(); ctx.restore(); }
    }
    this.movers.forEach((m) => platform(ctx, m, 0, true));
    this.lv.tramps.forEach((t, i) => trampoline(ctx, t.x, t.w, this.tramp[i] ?? 0));
    // a casa
    const prog = this.progress();
    if (this.debris.length) {
      // desmoronando: só o contorno do que era e os pedaços caindo
      house(ctx, { stone: 0, brick: 0, tile: 0, wood: 0, glass: 0 }, this.t, { fin, stories: this.lv.stories, theme: this.lv.theme });
      this.debris.forEach((d) => drawDebris(ctx, d));
    } else {
      const shaking = finale && fk > 1 ? (this.complete ? 0.5 : 1 + Math.min(2.5, (fk - 1) * 0.9)) : quake ? 1 : 0;
      house(ctx, prog, this.t, { wobble: shaking, fin, stories: this.lv.stories, theme: this.lv.theme });
    }
    if (fin.decor < 1) scaffold(ctx);
    if (this.mode === 'lobby') this.lobbyOverlay(ctx); // por cima da casa e das plataformas, atrás dos bonequinhos
    // avisos de raio (no chão, atrás de todo mundo)
    this.bolts.forEach((b) => { if (b.t < 1.1) bolt(ctx, b.x, b.y, b.t / 1.1, this.t); });
    // materiais e poderes
    for (const it of this.items) {
      if (it.age > 23 && Math.floor(it.age * 6) % 2) continue;
      const bob = it.rest ? Math.sin(this.t * 3 + it.id) * 2 : 0;
      if (it.power) { powerBubble(ctx, it.power, it.x, it.y - 30 + bob, this.t); continue; }
      glow(ctx, it.x, it.y - 18 + bob, it.qty >= 4 ? 58 : 44, it.qty >= 4 ? 1 : 0.8, QTY_STYLE[it.qty]?.glow);
      item(ctx, it.type, it.x, it.y - 18 + bob, it.qty);
    }
    if (this.balloon) {
      const b = this.balloon;
      balloon(ctx, b.x, b.y, this.t, !!b.item);
      if (b.item) { glow(ctx, b.item.x, b.item.y - 18, 58, 1, QTY_STYLE[10].glow); item(ctx, b.item.type, b.item.x, b.item.y - 18, 10); }
    }
    this.ants.forEach((a) => ant(ctx, a.x, GROUND + 4, a.dir, this.t, a.carry?.type));
    this.bears.forEach((b) => bear(ctx, b.x, GROUND + 2, b.dir, this.t, b.scared));
    this.boulders.forEach((b) => boulder(ctx, b.x, GROUND - 34, 34, b.rot));
    // jogadores (de trás para frente)
    const finishing = this.phase >= PHASES.length && this.mode === 'play';
    const arr = Array.from(this.players.values()).sort((a, b) => a.y - b.y);
    for (const p of arr) {
      const working = finishing && p.task;
      const f = p.fx, s = p.size;
      if (f.burn > 0) glow(ctx, p.x, p.y - 60 * s, 90 * s, 0.55 + 0.2 * Math.sin(this.t * 20), '255,140,50');
      if (f.frozen > 0) glow(ctx, p.x, p.y - 70 * s, 90 * s, 0.6, '170,225,250');
      if (f.fast > 0) glow(ctx, p.x, p.y - 70 * s, 70 * s, 0.4, '255,230,90');
      if (f.magnet > 0) { ctx.save(); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.t * 8); ctx.strokeStyle = POWERS.magnet.color; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.arc(p.x, p.y - 70 * s, 110 + Math.sin(this.t * 6) * 10, 0, TAU); ctx.stroke(); ctx.restore(); }
      person(ctx, p.x, p.y, p.slot, {
        face: p.face, walk: p.walk, air: !p.onGround, carry: p.carry?.type ?? null, carryQty: p.carry?.qty,
        happy: p.happy > 0 || (finale && this.complete && fk > 5), dizzy: p.dizzy > 0, name: p.name, scale: s,
        tool: working ? TASK[p.task as TaskId].tool : undefined, work: working ? Math.abs(Math.sin(p.work * Math.PI * 2)) : 0,
      });
      if (f.frozen > 0) {
        ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#BFE9FA'; rr(ctx, p.x - 40 * s, p.y - 150 * s, 80 * s, 152 * s, 14); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x - 24 * s, p.y - 130 * s); ctx.lineTo(p.x - 8 * s, p.y - 110 * s); ctx.stroke(); ctx.restore();
      }
      if (f.shield > 0) { ctx.save(); ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.t * 6); ctx.strokeStyle = '#4FA3DD'; ctx.fillStyle = 'rgba(120,190,255,0.15)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(p.x, p.y - 75 * s, 62 * s, 92 * s, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
      const icon = f.frozen > 0 ? '❄️' : f.burn > 0 ? '🔥' : f.fast > 0 ? '⚡' : f.slow > 0 ? '🐌' : '';
      if (icon) { ctx.font = `26px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(icon, p.x + 44 * s, p.y - 140 * s); }
      if (p.power && this.mode === 'play') { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(p.x - 44 * s, p.y - 150 * s, 17, 0, TAU); ctx.fill(); ctx.strokeStyle = POWERS[p.power].color; ctx.lineWidth = 3; ctx.stroke(); ctx.font = `18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(POWERS[p.power].emoji, p.x - 44 * s, p.y - 149 * s); ctx.restore(); }
      if (p.dizzy > 0) { ctx.fillStyle = C.amber; ctx.font = `900 22px ${FONT}`; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { const a = this.t * 6 + (i * TAU) / 3; ctx.fillText('★', p.x + Math.cos(a) * 30 * s, p.y - 140 * s + Math.sin(a) * 8); } }
    }
    // abelhas, tiros de poder e raios caindo
    this.swarms.forEach((sw) => { for (let i = 0; i < 6; i++) bee(ctx, sw.x + Math.cos(this.t * 5 + i) * 30, sw.y + Math.sin(this.t * 7 + i * 2) * 22, this.t, i); });
    this.shots.forEach((s) => { const P = POWERS[s.power]; glow(ctx, s.x, s.y, 46, 1, P.rgb); ctx.font = `34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(P.emoji, s.x, s.y); ctx.textBaseline = 'alphabetic'; });
    this.bolts.forEach((b) => { if (b.t >= 1.1) bolt(ctx, b.x, b.y, 1 + (b.t - 1.1), this.t); });
    // efeitos
    this.sparks.forEach((s) => { ctx.globalAlpha = Math.max(0, 1 - s.t / 0.9); ctx.fillStyle = s.c; ctx.fillRect(s.x - 5, s.y - 5, 10, 10); }); ctx.globalAlpha = 1;
    const wind = this.active('wind');
    if (wind) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const yy = 220 + ((i * 97) % 700), len = 120 + (i % 3) * 60;
        const xx = (((this.t * 1400 + i * 400) % (W + 600)) - 300);
        const x0 = (wind.dir ?? 1) > 0 ? xx : W - xx;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + (wind.dir ?? 1) * len, yy); ctx.stroke();
      }
    }
    const raining = finale && fk < (this.complete ? 5 : 9);
    if (this.rain.length || raining) {
      if (raining) for (let i = 0; i < 10; i++) this.rain.push({ x: Math.random() * (W + 300), y: -20 });
      this.rain.forEach((d) => { ctx.strokeStyle = d.light ? 'rgba(220,235,250,0.55)' : 'rgba(200,225,245,0.75)'; ctx.lineWidth = d.light ? 2 : 3; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - (d.light ? 3 : 8), d.y + (d.light ? 14 : 26)); ctx.stroke(); });
      if (finale) this.rain.forEach((d) => { d.y += 1500 / 60; d.x -= 5; });
      this.rain = this.rain.filter((d) => d.y < H);
    }
    water(ctx, this.waterY(), this.t);
    if (this.active('fog')) this.drawFog(ctx);
    if (finale && fk > 1.4 && fk < (this.complete ? 4.2 : 7) && Math.floor(fk * 7) % 9 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, 0, W, H); }
    this.floaters.forEach((f) => {
      ctx.save(); ctx.globalAlpha = 1 - f.t / 1.4; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = '#fff';
      const y = f.y - f.t * 60; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y); ctx.restore();
    });
    ctx.restore();

    // o QR do saguão fica sempre por cima, para ninguém tampar na hora de escanear
    if (this.mode === 'lobby' && this.gameQR) { const x = W / 2 - 450; ctx.fillStyle = '#fff'; rr(ctx, x + 26, 116, 248, 248, 18); ctx.fill(); ctx.drawImage(this.gameQR, x + 36, 126, 228, 228); }
    if (this.mode === 'play') this.hud(ctx);
    if (this.banner && this.mode === 'play') this.bannerFlash(ctx);
    if (finale) this.finaleOverlay(ctx, fk);
    if (this.mode === 'results') { if (this.photo) this.photoCaption(ctx); else this.resultsOverlay(ctx); }
    if (this.mode !== 'play' && this.mode !== 'results') this.scoreStrip(ctx, this.mode === 'finale');
    // flashes de tela (raio, poderes, entrega dourada…)
    for (const f of this.screenFx) {
      const k = 1 - f.t / f.d, a = f.a * k * k;
      if (a <= 0.01) continue;
      ctx.save();
      if (f.vig) {
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, f.c);
        ctx.globalAlpha = Math.min(1, a * 2.2); ctx.fillStyle = g;
      } else { ctx.globalAlpha = a; ctx.fillStyle = f.c; }
      ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }

  /** Neblina: só dá para ver em volta de cada bonequinho. */
  private drawFog(ctx: Ctx) {
    if (typeof document === 'undefined') return;
    const e = this.events.find((x) => x.type === 'fog' && this.modeT >= x.at && this.modeT < x.at + x.dur);
    const k = e ? Math.min(1, (this.modeT - e.at) / 1.2, (e.at + e.dur - this.modeT) / 1.2) : 0;
    this.fogCv ??= Object.assign(document.createElement('canvas'), { width: W / 4, height: H / 4 });
    const f = this.fogCv.getContext('2d')!;
    f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, W / 4, H / 4);
    f.fillStyle = `rgba(236,236,232,${0.93 * k})`; f.fillRect(0, 0, W / 4, H / 4);
    f.globalCompositeOperation = 'destination-out';
    this.players.forEach((p) => {
      const x = p.x / 4, y = (p.y - 80) / 4, r = 55 * Math.max(1, p.size);
      const g = f.createRadialGradient(x, y, r * 0.4, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.beginPath(); f.arc(x, y, r, 0, TAU); f.fill();
    });
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.fogCv, 0, 0, W, H); ctx.restore();
  }

  private bannerFlash(ctx: Ctx) {
    const b = this.banner!; const k = this.t - b.t;
    const a = Math.min(1, k * 5) * Math.min(1, (2.8 - k) * 3);
    const s = 0.85 + 0.15 * Math.min(1, k * 6);
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(W / 2, 300); ctx.scale(s, s);
    ctx.font = `900 46px ${FONT}`; const bw = Math.min(W - 200, ctx.measureText(b.text).width + 90);
    ctx.fillStyle = b.color; rr(ctx, -bw / 2, -46, bw, 86, 43); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; fitText(ctx, b.text, 0, 14, bw - 70, 900, 46);
    ctx.restore();
  }

  private hud(ctx: Ctx) {
    const M = 64;
    const finishing = this.phase >= PHASES.length;
    // fase e materiais
    panel(ctx, M, 44, 640, 156);
    ctx.textAlign = 'left'; ctx.fillStyle = C.terra; ctx.font = `900 19px ${FONT}`; ls(ctx, 4);
    ctx.fillText(`FASE ${Math.min(this.phase + 1, 5)} DE 5${this.level === 2 ? ' · TELA 2' : ''}`, M + 34, 90); ls(ctx, 0);
    const pct = this.housePct();
    ctx.fillStyle = '#efe4d2'; rr(ctx, M + 450, 77, 150, 14, 7); ctx.fill(); ctx.fillStyle = C.terra; rr(ctx, M + 450, 77, Math.max(14, 150 * pct / 100), 14, 7); ctx.fill();
    ctx.fillStyle = C.muted; ctx.font = `800 17px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`casa ${pct}%`, M + 440, 90); ctx.textAlign = 'left';
    ctx.fillStyle = C.ink; fitText(ctx, finishing ? FINISH_TITLE : PHASES[this.phase].title, M + 34, 136, 570, 900, 38);
    if (finishing) {
      // barrinhas das 4 equipes
      const f = this.finProg();
      TASKS.forEach((t, i) => {
        const x = M + 34 + i * 146, v = f[t.id];
        ctx.fillStyle = C.ink; ctx.font = `22px ${FONT}`; ctx.fillText(t.emoji, x, 180);
        ctx.fillStyle = '#efe4d2'; rr(ctx, x + 34, 164, 92, 14, 7); ctx.fill();
        ctx.fillStyle = v >= 1 ? C.olive : t.color; rr(ctx, x + 34, 164, Math.max(14, 92 * v), 14, 7); ctx.fill();
      });
    } else {
      // só o material da fase atual em destaque; os outros pequenos
      const kinds = ['stone', 'brick', 'tile', 'wood', 'glass'] as ItemType[];
      const parts = kinds.map((k) => ({ k, txt: `${ITEM_EMOJI[k]} ${this.have[k]}/${this.need[k]}${this.have[k] >= this.need[k] ? ' ✓' : ''}` }));
      ctx.font = `800 21px ${FONT}`;
      const total = parts.reduce((a, p) => a + ctx.measureText(p.txt).width, 0) + 18 * (parts.length - 1);
      const sc = Math.min(1, 572 / total);
      ctx.save(); ctx.translate(M + 34, 176); ctx.scale(sc, 1);
      let x = 0;
      parts.forEach(({ k, txt }) => {
        const done = this.have[k] >= this.need[k];
        ctx.fillStyle = done ? C.olive : PHASES[this.phase]?.types.includes(k) ? C.ink : '#b9a690';
        ctx.fillText(txt, x, 0); x += ctx.measureText(txt).width + 18;
      });
      ctx.restore();
    }
    // relógio
    const tl = Math.ceil(this.timeLeft);
    ctx.fillStyle = tl <= 20 ? C.terra : C.ink; rr(ctx, W / 2 - 100, 44, 200, 84, 42); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `900 50px ${FONT}`;
    ctx.fillText(`${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`, W / 2, 104);
    // desafio de toque (tem prioridade sobre o aviso)
    const c = this.activeCh();
    if (c) {
      const info = CH_INFO[c.kind], v = clamp(c.have / c.need), left = Math.max(0, Math.ceil(c.at + c.dur - this.modeT));
      const pulse = 1 + Math.sin(this.t * 12) * 0.02;
      ctx.save(); ctx.translate(W / 2, 282); ctx.scale(pulse, pulse);
      panel(ctx, -330, -50, 660, 118, 34, '#FFF4E0');
      ctx.textAlign = 'center'; ctx.fillStyle = C.ink; fitText(ctx, `${info.emoji} ${info.title} Toquem no celular! 📱`, 0, -6, 600, 900, 30);
      ctx.fillStyle = '#efe4d2'; rr(ctx, -290, 20, 520, 26, 13); ctx.fill();
      ctx.fillStyle = v >= 1 ? C.olive : C.terra; rr(ctx, -290, 20, Math.max(26, 520 * v), 26, 13); ctx.fill();
      ctx.fillStyle = C.ink; ctx.font = `900 26px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(`${left}s`, 248, 43);
      ctx.restore();
    } else if (!finishing) {
      const be = this.bannerEvent();
      if (be) {
        const info = EVENT_INFO[be.e.type];
        const msg = `${info.emoji} ${be.soon ? info.soon : info.now}`;
        ctx.font = `900 28px ${FONT}`; const bw = Math.min(700, ctx.measureText(msg).width + 64);
        ctx.save(); ctx.translate(W / 2, 176); ctx.rotate(-0.012); const pulse = be.soon ? 1 + Math.sin(this.t * 10) * 0.03 : 1; ctx.scale(pulse, pulse);
        ctx.fillStyle = '#c98a1f'; rr(ctx, -bw / 2, -24, bw, 60, 30); ctx.fill();
        ctx.fillStyle = be.soon ? C.amber : '#ff9a3c'; rr(ctx, -bw / 2, -30, bw, 60, 30); ctx.fill();
        ctx.fillStyle = C.ink; ctx.textAlign = 'center'; fitText(ctx, msg, 0, 10, bw - 50, 900, 28); ctx.restore();
      }
    }
    this.qrPanel(ctx);
    this.scoreStrip(ctx);
  }

  private qrPanel(ctx: Ctx) {
    const M = 64;
    panel(ctx, W - M - 430, 44, 430, 156);
    if (this.gameQR) ctx.drawImage(this.gameQR, W - M - 414, 60, 124, 124);
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; fitText(ctx, 'Escaneie e entre já!', W - M - 272, 92, 236, 900, 25);
    ctx.fillStyle = C.olive; fitText(ctx, `${this.players.size} de ${MAX_PLAYERS} jogando · sala ${this.room}`, W - M - 272, 120, 236, 800, 19);
    ctx.fillStyle = C.cream; rr(ctx, W - M - 272, 136, 236, 46, 23); ctx.fill();
    ctx.fillStyle = C.muted; ctx.font = `800 17px ${FONT}`; ctx.fillText('EQUIPE', W - M - 254, 165);
    ctx.fillStyle = C.terra; ctx.font = `900 26px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`${this.team} pts`, W - M - 52, 168);
  }

  private scoreStrip(ctx: Ctx, compact = false) {
    const list = this.ranking();
    if (!list.length) return;
    ctx.font = `900 21px ${FONT}`;
    const chips = list.map((p, i) => ({ p, i, w: ctx.measureText(`${p.name}  ${p.pts}`).width + 58 }));
    const gap = 10;
    // se não couber numa linha, encolhe
    const total = chips.reduce((a, c) => a + c.w, 0) + gap * (chips.length - 1) + 40;
    const sc = Math.min(1, (W - 120) / total);
    ctx.save(); ctx.translate(W / 2, 978); ctx.scale(sc, sc);
    const sx = -total / 2, sy = 0;
    panel(ctx, sx, sy, total, 66, 33);
    let cx = sx + 20;
    chips.forEach(({ p, i, w }) => {
      ctx.fillStyle = i === 0 && p.pts > 0 ? '#FFF1D6' : C.cream; rr(ctx, cx, sy + 12, w, 42, 21); ctx.fill();
      if (i === 0 && p.pts > 0 && !compact) { ctx.font = `20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('👑', cx + 22, sy + 40); }
      else { ctx.fillStyle = CHARS[p.slot].color; ctx.beginPath(); ctx.arc(cx + 22, sy + 33, 10, 0, TAU); ctx.fill(); }
      ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `900 21px ${FONT}`; ctx.fillText(p.name, cx + 40, sy + 41);
      const nw = ctx.measureText(p.name).width;
      ctx.fillStyle = C.terra; ctx.fillText(String(p.pts), cx + 48 + nw, sy + 41);
      cx += w + gap;
    });
    ctx.restore();
  }

  private lobbyOverlay(ctx: Ctx) {
    const cw = 900, ch = 300, x = W / 2 - cw / 2, y = 90;
    panel(ctx, x, y, cw, ch, 40);
    if (this.gameQR) ctx.drawImage(this.gameQR, x + 36, y + 36, 228, 228);
    ctx.textAlign = 'left'; ctx.fillStyle = C.terra; ctx.font = `900 22px ${FONT}`; ls(ctx, 5); ctx.fillText(`TELA ${this.level} · ${this.lv.name.toUpperCase()}${this.level === 2 ? ' · DIFÍCIL' : ''}`, x + 300, y + 80); ls(ctx, 0);
    ctx.fillStyle = C.ink; ctx.font = `900 54px ${FONT}`; ctx.fillText('Escaneie e entre!', x + 300, y + 140);
    ctx.fillStyle = C.brown; fitText(ctx, `${this.players.size} de ${MAX_PLAYERS} jogadores · sala ${this.room}`, x + 300, y + 184, cw - 340, 800, 26);
    const cd = Math.max(0, Math.ceil(this.countdown));
    ctx.fillStyle = C.ink; rr(ctx, x + 300, y + 210, 300, 60, 30); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`Começa em ${cd}s`, x + 450, y + 251);
    // escolha da tela (no celular ou teclas 1/2 da TV), dentro do quadro
    let ox = x + 620;
    for (const n of [1, 2] as const) {
      const on = this.level === n, wv = n === 1 ? 108 : 132;
      ctx.fillStyle = on ? C.terra : '#efe4d2'; rr(ctx, ox, y + 214, wv, 52, 26); ctx.fill();
      ctx.fillStyle = on ? '#fff' : C.brown; ctx.textAlign = 'center'; fitText(ctx, `${on ? '✓ ' : ''}Tela ${n}`, ox + wv / 2, y + 249, wv - 20, 900, 22);
      ox += wv + 12;
    }
  }

  private finaleOverlay(ctx: Ctx, fk: number) {
    let title = 'Vem a tempestade…', sub = 'Será que a casa aguenta?';
    if (this.complete && fk > 4.6) { title = 'A casa na rocha ficou de pé! 🙌'; sub = '“Se o Senhor não edificar a casa, em vão trabalham os que a edificam.” · Sl 127:1'; }
    if (!this.complete && fk > 1.3 && fk <= COLLAPSE_AT) { title = 'A casa não ficou pronta na rocha…'; sub = '“Caiu a chuva, transbordaram os rios, sopraram os ventos e deram contra aquela casa…”'; }
    if (!this.complete && fk > COLLAPSE_AT) { title = '“…e ela caiu. E foi grande a sua queda.”'; sub = 'Mateus 7:27 · Faltou pouco! Bora de novo?'; }
    ctx.save(); ctx.font = `900 30px ${FONT}`; const sw = ctx.measureText(sub).width;
    ctx.font = `900 60px ${FONT}`; const tw = ctx.measureText(title).width;
    const bw = Math.min(W - 120, Math.max(tw, sw) + 100);
    panel(ctx, W / 2 - bw / 2, 80, bw, 190, 40);
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink; fitText(ctx, title, W / 2, 168, bw - 80, 900, 60);
    ctx.fillStyle = C.brown; fitText(ctx, sub, W / 2, 226, bw - 80, 800, 30); ctx.restore();
  }

  private photoCaption(ctx: Ctx) {
    const date = new Date().toLocaleDateString('pt-BR');
    const title = this.finished ? 'Casa na Rocha ✨' : this.complete ? 'Casa na Rocha 🏠' : 'Casa na Rocha';
    const sub = [this.groupName, date, `${this.results.length} construtores · ${this.results.reduce((a, r) => a + r.pts, 0)} pts`].filter(Boolean).join(' · ');
    ctx.save(); ctx.font = `900 54px ${FONT}`; const tw = ctx.measureText(title).width; ctx.font = `800 26px ${FONT}`; const sw = ctx.measureText(sub).width;
    const bw = Math.min(W - 200, Math.max(tw, sw) + 100);
    panel(ctx, W / 2 - bw / 2, 60, bw, 150, 40);
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink; fitText(ctx, title, W / 2, 132, bw - 80, 900, 54);
    ctx.fillStyle = C.brown; fitText(ctx, sub, W / 2, 178, bw - 80, 800, 26);
    ctx.restore();
  }

  private resultsOverlay(ctx: Ctx) {
    ctx.fillStyle = 'rgba(43,33,24,0.35)'; ctx.fillRect(0, 0, W, H);
    const list = this.results;
    const rowH = list.length > 8 ? 46 : 54, cw = 1100, ch = 272 + Math.max(1, list.length) * rowH, x = W / 2 - cw / 2, y = Math.max(40, H / 2 - ch / 2);
    panel(ctx, x, y, cw, ch, 44);
    ctx.textAlign = 'left'; ctx.fillStyle = C.terra; ctx.font = `900 22px ${FONT}`; ls(ctx, 5); ctx.fillText('RESULTADO', x + 60, y + 70); ls(ctx, 0);
    ctx.fillStyle = C.ink; ctx.font = `900 50px ${FONT}`; ctx.fillText(this.finished ? 'Casa pronta! ✨' : this.complete ? 'Casa de pé! 🏠' : 'Quase lá!', x + 60, y + 128);
    ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = `800 22px ${FONT}`; ctx.fillText('EQUIPE', x + cw - 60, y + 76);
    ctx.fillStyle = C.terra; ctx.font = `900 48px ${FONT}`; ctx.fillText(`${this.results.reduce((a, r) => a + r.pts, 0)} pts`, x + cw - 60, y + 128);
    // cabeçalho da tabela
    const ty = y + 180;
    ctx.fillStyle = C.muted; ctx.font = `800 18px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('JOGADOR', x + 130, ty);
    ctx.textAlign = 'right'; ctx.fillText('MATERIAL', x + 640, ty); ctx.fillText('PONTOS', x + 820, ty); ctx.fillText('SUGESTÃO APP', x + cw - 60, ty);
    list.forEach((r, i) => {
      const yy = ty + 22 + i * rowH;
      ctx.fillStyle = i % 2 ? '#fff' : C.cream; rr(ctx, x + 40, yy, cw - 80, rowH - 6, 16); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.font = `900 24px ${FONT}`; ctx.fillText(i === 0 ? '👑' : `${i + 1}º`, x + 82, yy + rowH / 2 + 8);
      ctx.fillStyle = CHARS[r.slot].color; ctx.beginPath(); ctx.arc(x + 130, yy + rowH / 2 - 3, 11, 0, TAU); ctx.fill();
      ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(r.name, x + 152, yy + rowH / 2 + 8);
      ctx.textAlign = 'right'; ctx.fillStyle = C.brown; ctx.font = `800 24px ${FONT}`; ctx.fillText(String(r.delivered), x + 640, yy + rowH / 2 + 8);
      ctx.fillStyle = C.ink; ctx.font = `900 24px ${FONT}`; ctx.fillText(String(r.pts), x + 820, yy + rowH / 2 + 8);
      ctx.fillStyle = C.olive; ctx.fillText(`+${r.suggest} pts`, x + cw - 60, yy + rowH / 2 + 8);
    });
    ctx.fillStyle = C.muted; ctx.textAlign = 'center';
    const left = Math.max(0, Math.ceil(RESULTS_TIME - this.modeT));
    fitText(ctx, `Adm: lance a sugestão em Adm → Ajustar pontos · nova partida em ${left}s`, W / 2, y + ch - 30, cw - 100, 800, 20);
  }
}

export { PHASES, ITEM_LABEL };
