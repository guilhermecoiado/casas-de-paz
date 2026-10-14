/* Motor do jogo "Casa na Rocha": a TV é a dona do jogo (física, fases, desafios e pontos). */

import type { BuzzMsg, Mode, StateMsg } from './net';

// espaçamento entre letras (nem todo navegador tem; sem ele só fica junto)
const ls = (ctx: CanvasRenderingContext2D, px: number) => { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`; };
import {
  C, CHARS, FONT, GROUND, H, ITEM_EMOJI, ITEM_LABEL, PLATS, ROCK, TAU, W, ant, glow, house, item, panel, person, platform, rr, scaffold, scenery,
  type Ctx, type HouseProg, type ItemType, type Plat,
  fitText,
} from './draw';

export const MAX_PLAYERS = 12;
const PLAY_TIME = 210;      // 3min30
const LOBBY_TIME = 20;
const FINALE_TIME = 8;
const RESULTS_TIME = 30;

const GRAV = 2600, JUMP = -1130, CUT = -420, MAXV = 430;
// degraus invisíveis no andaime (ajudam a subir da rocha)
const SOLID_PLATS: Plat[] = [...PLATS, { x: 1128, y: 718, w: 76 }, { x: 1128, y: 618, w: 76 }];
const ZONE = { x0: 790, x1: 1130, top: ROCK.top - 520 };

interface Input { l: boolean; r: boolean; j: boolean }
export interface Player {
  id: string; slot: number; name: string; bot?: boolean;
  x: number; y: number; vx: number; vy: number; onGround: boolean; coyote: number; face: 1 | -1;
  input: Input; prevJ: boolean; carry: Item | null; pts: number; picks: number; delivered: number;
  dizzy: number; walk: number; lastSeen: number; happy: number;
}
interface Item { id: number; type: ItemType; gold: boolean; x: number; y: number; vx: number; vy: number; rest: boolean; age: number; onGroundFloor: boolean }
interface Ant { x: number; dir: 1 | -1; carry: Item | null; flee: boolean }
interface Floater { x: number; y: number; text: string; color: string; t: number }
type EventType = 'wind' | 'quake' | 'rain' | 'ants';
interface GameEvent { at: number; type: EventType; dur: number; dir?: 1 | -1; started?: boolean }

const PHASES: { types: ItemType[]; title: string }[] = [
  { types: ['stone'], title: 'Fundação na rocha!' },
  { types: ['brick'], title: 'Levantem as paredes!' },
  { types: ['tile'], title: 'Hora do telhado!' },
  { types: ['wood', 'glass'], title: 'Porta e janelas!' },
];
const EVENT_INFO: Record<EventType, { soon: string; now: string; emoji: string }> = {
  wind: { soon: 'Ventania chegando! Segurem firme!', now: 'Ventania!', emoji: '💨' },
  quake: { soon: 'Terremoto chegando!', now: 'Terremoto! Tudo tremendo!', emoji: '🌋' },
  rain: { soon: 'Vem chuva aí… chão escorregadio!', now: 'Chuva! Cuidado para não escorregar!', emoji: '🌧️' },
  ants: { soon: 'Formigas à vista!', now: 'Formigas levando material! Pulem nelas!', emoji: '🐜' },
};

export interface Result { id: string; slot: number; name: string; pts: number; delivered: number; suggest: number }

export class Game {
  mode: Mode = 'attract';
  players = new Map<string, Player>();
  items: Item[] = [];
  ants: Ant[] = [];
  floaters: Floater[] = [];
  rain: { x: number; y: number }[] = [];
  sparks: { x: number; y: number; vx: number; vy: number; t: number; c: string }[] = [];
  t = 0;            // relógio geral
  modeT = 0;        // tempo no modo atual
  countdown = 0;
  phase = 0;
  need: Record<ItemType, number> = { stone: 0, brick: 0, tile: 0, wood: 0, glass: 0 };
  have: Record<ItemType, number> = { stone: 0, brick: 0, tile: 0, wood: 0, glass: 0 };
  events: GameEvent[] = [];
  spawnT = 0;
  nextItem = 1;
  complete = false;
  results: Result[] = [];
  shake = 0;
  room = '';
  gameQR: HTMLImageElement | null = null;
  onBuzz: (id: string, kind: BuzzMsg['kind']) => void = () => {};

  /* ---------------- jogadores ---------------- */

  addPlayer(id: string, name: string, bot = false): Player | null {
    const ex = this.players.get(id);
    if (ex) { ex.name = name || ex.name; ex.lastSeen = this.t; return ex; }
    if (this.players.size >= MAX_PLAYERS) return null;
    const used = new Set(Array.from(this.players.values()).map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const x = 120 + Math.random() * 520;
    const p: Player = {
      id, slot, name: (name || `Jogador ${slot + 1}`).slice(0, 12), bot,
      x: Math.random() < 0.5 ? x : W - x, y: -60, vx: 0, vy: 0, onGround: false, coyote: 0, face: 1,
      input: { l: false, r: false, j: false }, prevJ: false, carry: null, pts: 0, picks: 0, delivered: 0,
      dizzy: 0, walk: 0, lastSeen: this.t, happy: 0,
    };
    this.players.set(id, p);
    this.float(p.x, 200, `${p.name} entrou!`, CHARS[slot].color);
    if (this.mode === 'attract') this.toLobby();
    else if (this.mode === 'lobby') this.countdown = Math.max(this.countdown, 10);
    return p;
  }

  removePlayer(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.carry) this.drop(p);
    this.players.delete(id);
    if (!this.players.size && this.mode !== 'results' && this.mode !== 'finale') this.toAttract();
  }

  setInput(id: string, inp: Input) {
    const p = this.players.get(id);
    if (!p) return;
    p.input = inp; p.lastSeen = this.t;
  }
  touch(id: string) { const p = this.players.get(id); if (p) p.lastSeen = this.t; }

  /* ---------------- modos ---------------- */

  toAttract() { this.mode = 'attract'; this.modeT = 0; this.items = []; this.ants = []; }
  toLobby(sec = LOBBY_TIME) { this.mode = 'lobby'; this.modeT = 0; this.countdown = sec; this.items = []; this.ants = []; this.resetHouse(); }
  startNow() { if (this.mode === 'lobby' || this.mode === 'attract') this.startPlay(); }

  private resetHouse() {
    this.phase = 0; this.complete = false;
    (Object.keys(this.have) as ItemType[]).forEach((k) => (this.have[k] = 0));
  }

  startPlay() {
    if (!this.players.size) return;
    this.mode = 'play'; this.modeT = 0; this.items = []; this.ants = []; this.resetHouse();
    const n = Math.max(2, this.players.size);
    this.need = { stone: 8 + n, brick: 14 + 3 * n, tile: 10 + 2 * n, wood: 4 + n, glass: 3 + Math.ceil(n / 2) };
    this.players.forEach((p) => { p.pts = 0; p.picks = 0; p.delivered = 0; p.carry = null; });
    const dirs = () => (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
    this.events = [
      { at: 35, type: 'wind', dur: 7, dir: dirs() },
      { at: 70, type: 'ants', dur: 14 },
      { at: 105, type: 'quake', dur: 5 },
      { at: 140, type: 'rain', dur: 12 },
      { at: 178, type: 'wind', dur: 7, dir: dirs() },
    ];
    this.spawnT = 0.5;
  }

  private toFinale() {
    this.mode = 'finale'; this.modeT = 0;
    this.players.forEach((p) => { if (p.carry) { p.carry = null; } });
    this.items = []; this.ants = [];
  }

  private toResults() {
    this.mode = 'results'; this.modeT = 0;
    this.results = Array.from(this.players.values())
      .map((p) => ({ id: p.id, slot: p.slot, name: p.name, pts: p.pts, delivered: p.delivered, suggest: Math.min(30, Math.round(p.pts / 4)) + (this.complete ? 5 : 0) }))
      .sort((a, b) => b.pts - a.pts);
  }

  get team() { let s = 0; this.players.forEach((p) => (s += p.pts)); return s; }
  get timeLeft() { return Math.max(0, PLAY_TIME - this.modeT); }

  progress(): HouseProg {
    const q = (k: ItemType) => (this.need[k] ? Math.min(1, this.have[k] / this.need[k]) : 0);
    if (this.mode === 'lobby' || this.mode === 'attract') return { stone: 0, brick: 0, tile: 0, wood: 0, glass: 0 };
    return { stone: q('stone'), brick: q('brick'), tile: q('tile'), wood: q('wood'), glass: q('glass') };
  }
  housePct() {
    const p = this.progress();
    return Math.round(((p.stone + p.brick + p.tile + (p.wood + p.glass) / 2) / 4) * 100);
  }

  ranking() { return Array.from(this.players.values()).sort((a, b) => b.pts - a.pts); }

  stateFor(id: string): StateMsg | null {
    const p = this.players.get(id);
    if (!p) return null;
    const rk = this.ranking().findIndex((x) => x.id === id) + 1;
    const r = this.results.find((x) => x.id === id);
    return {
      mode: this.mode, slot: p.slot, pts: p.pts, rank: rk, team: this.team, players: this.players.size,
      countdown: this.mode === 'lobby' ? Math.ceil(this.countdown) : undefined,
      timeLeft: this.mode === 'play' ? Math.ceil(this.timeLeft) : undefined,
      phase: this.mode === 'play' ? PHASES[this.phase]?.title : undefined,
      suggest: this.mode === 'results' ? r?.suggest : undefined,
      complete: this.complete,
    };
  }

  /* ---------------- lógica ---------------- */

  step(dt: number) {
    this.t += dt; this.modeT += dt;
    this.shake = Math.max(0, this.shake - dt);
    // quem sumiu (celular fechou) sai depois de um tempo
    this.players.forEach((p) => { if (!p.bot && this.t - p.lastSeen > (this.mode === 'play' ? 25 : 12)) this.removePlayer(p.id); });

    if (this.mode === 'lobby') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.startPlay();
    } else if (this.mode === 'play') {
      this.stepEvents(dt);
      this.stepSpawn(dt);
      if (this.modeT >= PLAY_TIME || this.complete) this.toFinale();
    } else if (this.mode === 'finale') {
      if (this.modeT >= FINALE_TIME) this.toResults();
    } else if (this.mode === 'results') {
      if (this.modeT >= RESULTS_TIME) { if (this.players.size) this.toLobby(15); else this.toAttract(); }
    }

    if (this.mode !== 'attract') {
      this.players.forEach((p) => { if (p.bot) this.botThink(p); this.stepPlayer(p, dt); });
      this.stepStomps();
      this.stepItems(dt);
      this.stepAnts(dt);
    }
    this.floaters.forEach((f) => (f.t += dt)); this.floaters = this.floaters.filter((f) => f.t < 1.4);
    this.sparks.forEach((s) => { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt; }); this.sparks = this.sparks.filter((s) => s.t < 0.9);
  }

  private active(type: EventType) {
    if (this.mode !== 'play') return null;
    return this.events.find((e) => e.type === type && this.modeT >= e.at && this.modeT < e.at + e.dur) ?? null;
  }
  private bannerEvent() {
    if (this.mode !== 'play') return null;
    for (const e of this.events) {
      if (this.modeT >= e.at - 3 && this.modeT < e.at) return { e, soon: true };
      if (this.modeT >= e.at && this.modeT < e.at + e.dur) return { e, soon: false };
    }
    return null;
  }

  private stepEvents(dt: number) {
    for (const e of this.events) {
      if (!e.started && this.modeT >= e.at) {
        e.started = true;
        // quem está carregando pode deixar cair
        const chance = e.type === 'wind' ? 0.3 : e.type === 'quake' ? 0.4 : 0;
        this.players.forEach((p) => { if (p.carry && Math.random() < chance) { this.drop(p); this.float(p.x, p.y - 170, 'Ops!', C.terra); } });
        if (e.type === 'ants') this.ants.push({ x: -40, dir: 1, carry: null, flee: false }, { x: W + 40, dir: -1, carry: null, flee: false });
      }
    }
    const q = this.active('quake');
    if (q) {
      this.shake = 0.2;
      if (Math.random() < dt * 3) this.players.forEach((p) => { if (p.onGround && Math.random() < 0.5) { p.vy = -380; p.onGround = false; } });
      if (Math.random() < dt * 2) this.items.forEach((it) => { if (it.rest && Math.random() < 0.4) { it.rest = false; it.vy = -300; it.vx = (Math.random() - 0.5) * 300; } });
    }
    const r = this.active('rain');
    if (r) for (let i = 0; i < 6; i++) this.rain.push({ x: Math.random() * (W + 300), y: -20 });
    this.rain.forEach((d) => { d.y += 1500 * dt; d.x -= 300 * dt; });
    this.rain = this.rain.filter((d) => d.y < H);
  }

  private currentTypes(): ItemType[] {
    const ph = PHASES[this.phase];
    return ph ? ph.types.filter((k) => this.have[k] < this.need[k]) : [];
  }

  private stepSpawn(dt: number) {
    const n = Math.max(1, this.players.size);
    this.spawnT -= dt;
    const cap = Math.min(16, 4 + n);
    if (this.spawnT > 0 || this.items.length >= cap) return;
    this.spawnT = Math.max(0.45, 2.2 / Math.sqrt(n)) * (0.7 + Math.random() * 0.6);
    const types = this.currentTypes();
    if (!types.length) return;
    const type = types[Math.floor(Math.random() * types.length)];
    // onde cair: em cima de uma plataforma ou no chão, fora da obra
    const spots: [number, number][] = [[60, 660], [1250, 1860], ...PLATS.map((p) => [p.x + 24, p.x + p.w - 24] as [number, number])];
    const [a, b] = spots[Math.floor(Math.random() * spots.length)];
    this.items.push({ id: this.nextItem++, type, gold: Math.random() < 0.08, x: a + Math.random() * (b - a), y: -40, vx: 0, vy: 0, rest: false, age: 0, onGroundFloor: false });
  }

  private landY(x: number, prevY: number, y: number, vy: number): number | null {
    if (vy < 0) return null;
    let best: number | null = null;
    for (const p of SOLID_PLATS) {
      if (x > p.x - 14 && x < p.x + p.w + 14 && prevY <= p.y + 1 && y >= p.y) best = best == null ? p.y : Math.min(best, p.y);
    }
    if (x > ROCK.x0 + 14 && x < ROCK.x1 - 14 && prevY <= ROCK.top + 1 && y >= ROCK.top) best = best == null ? ROCK.top : Math.min(best, ROCK.top);
    if (y >= GROUND) best = best == null ? GROUND : Math.min(best, GROUND);
    return best;
  }

  private stepPlayer(p: Player, dt: number) {
    const rain = !!this.active('rain');
    const wind = this.active('wind');
    const dir = (p.input.r ? 1 : 0) - (p.input.l ? 1 : 0);
    const stunned = p.dizzy > 0;
    p.dizzy = Math.max(0, p.dizzy - dt); p.happy = Math.max(0, p.happy - dt);
    const acc = p.onGround ? (rain ? 900 : 3400) : 1900;
    if (dir && !stunned) { p.vx += dir * acc * dt; p.face = dir as 1 | -1; }
    else if (p.onGround) { const dec = (rain ? 500 : 3800) * dt; p.vx = Math.abs(p.vx) <= dec ? 0 : p.vx - Math.sign(p.vx) * dec; }
    if (wind) p.vx += (wind.dir ?? 1) * 1500 * dt;
    const lim = MAXV + (wind ? 160 : 0);
    p.vx = Math.max(-lim, Math.min(lim, p.vx));
    // pulo (com tolerância na borda e pulo mais baixo se soltar cedo)
    p.coyote = p.onGround ? 0.09 : Math.max(0, p.coyote - dt);
    if (p.input.j && !p.prevJ && (p.onGround || p.coyote > 0) && !stunned) { p.vy = JUMP; p.onGround = false; p.coyote = 0; }
    if (!p.input.j && p.vy < CUT) p.vy = CUT;
    p.prevJ = p.input.j;
    p.vy += GRAV * dt;
    const prevY = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    // paredes da rocha
    if (p.y > ROCK.top + 4 && p.x > ROCK.x0 - 18 && p.x < ROCK.x1 + 18) {
      p.x = p.x < (ROCK.x0 + ROCK.x1) / 2 ? ROCK.x0 - 18 : ROCK.x1 + 18; p.vx = 0;
    }
    p.x = Math.max(30, Math.min(W - 30, p.x));
    const land = this.landY(p.x, prevY, p.y, p.vy);
    if (land != null) { p.y = land; p.vy = 0; p.onGround = true; } else p.onGround = false;
    p.walk = p.onGround && Math.abs(p.vx) > 30 ? p.walk + dt * 14 : 0;

    if (this.mode !== 'play') return;
    // pegar material
    if (!p.carry && !stunned) {
      const it = this.items.find((i) => Math.abs(i.x - p.x) < 44 && i.y > p.y - 120 && i.y < p.y + 20);
      if (it) {
        this.items = this.items.filter((i) => i !== it);
        p.carry = it; p.pts += 1; p.picks++;
        this.float(p.x, p.y - 190, '+1', CHARS[p.slot].color);
        this.onBuzz(p.id, it.gold ? 'gold' : 'pick');
      }
    }
    // entregar na obra
    if (p.carry && p.x > ZONE.x0 && p.x < ZONE.x1 && p.y <= ROCK.top + 2 && p.y > ZONE.top) {
      const it = p.carry; p.carry = null;
      const types = this.currentTypes();
      const type = types.includes(it.type) ? it.type : types[0];
      const val = it.gold ? 3 : 1;
      if (type) this.have[type] = Math.min(this.need[type], this.have[type] + val);
      p.pts += 2 * val; p.delivered += val; p.happy = 1;
      this.float(p.x, p.y - 190, `+${2 * val}`, CHARS[p.slot].color);
      this.burst(960, ROCK.top - 200, it.gold ? '#F3C64A' : C.terra);
      this.onBuzz(p.id, 'deliver');
      this.checkPhase();
    }
  }

  private checkPhase() {
    while (this.phase < PHASES.length && PHASES[this.phase].types.every((k) => this.have[k] >= this.need[k])) {
      this.phase++;
      this.burst(960, ROCK.top - 300, C.amber, 40);
      const next = PHASES[this.phase];
      // material que sobrou da fase anterior vira o da próxima
      if (next) {
        this.items = this.items.filter((i) => next.types.includes(i.type));
        this.players.forEach((p) => { if (p.carry && !next.types.includes(p.carry.type)) p.carry.type = next.types[0]; });
      } else this.complete = true;
    }
  }

  private stepStomps() {
    if (this.mode !== 'play') return;
    const arr = Array.from(this.players.values());
    for (const a of arr) {
      if (a.vy < 150) continue;
      for (const b of arr) {
        if (a === b || b.dizzy > 0) continue;
        if (Math.abs(a.x - b.x) < 36 && a.y > b.y - 150 && a.y < b.y - 100) {
          a.vy = -800; a.pts += 1;
          if (b.carry) this.drop(b, a.face);
          b.dizzy = 1.1;
          this.float(a.x, a.y - 190, '+1', CHARS[a.slot].color);
          this.onBuzz(a.id, 'stomp'); this.onBuzz(b.id, 'stomped');
        }
      }
    }
  }

  private drop(p: Player, dir: number = p.face) {
    const it = p.carry; if (!it) return;
    p.carry = null;
    it.x = p.x; it.y = p.y - 150; it.vx = dir * (180 + Math.random() * 200); it.vy = -520; it.rest = false; it.age = 0;
    this.items.push(it);
  }

  private stepItems(dt: number) {
    const wind = this.active('wind');
    for (const it of this.items) {
      it.age += dt;
      if (wind && it.rest) { it.vx += (wind.dir ?? 1) * 260 * dt; it.rest = Math.abs(it.vx) < 5; }
      if (!it.rest) {
        it.vy += GRAV * 0.8 * dt;
        const prevY = it.y;
        it.x += it.vx * dt; it.y += it.vy * dt; it.vx *= 1 - 1.5 * dt;
        if (it.y > ROCK.top && it.x > ROCK.x0 - 10 && it.x < ROCK.x1 + 10) { it.x = it.x < 965 ? ROCK.x0 - 10 : ROCK.x1 + 10; it.vx = -it.vx * 0.4; }
        if (it.x < 30 || it.x > W - 30) { it.x = Math.max(30, Math.min(W - 30, it.x)); it.vx = -it.vx * 0.5; }
        const land = this.landY(it.x, prevY, it.y, it.vy);
        if (land != null) { it.y = land; it.vy = 0; it.vx *= 0.5; if (Math.abs(it.vx) < 20) { it.vx = 0; it.rest = true; } it.onGroundFloor = land === GROUND; }
      }
    }
    // material esquecido some depois de um tempo (e o que cair na obra conta como entregue para ninguém)
    this.items = this.items.filter((it) => it.age < 28);
  }

  private stepAnts(dt: number) {
    for (const a of this.ants) {
      a.x += a.dir * (a.flee ? 260 : 120) * dt;
      if (!a.carry && !a.flee) {
        const it = this.items.find((i) => i.rest && i.onGroundFloor && Math.abs(i.x - a.x) < 22);
        if (it) { this.items = this.items.filter((i) => i !== it); a.carry = it; }
      }
      // pular na formiga solta o material
      this.players.forEach((p) => {
        if (!a.flee && p.vy > 100 && Math.abs(p.x - a.x) < 40 && p.y > GROUND - 50 && p.y <= GROUND + 2) {
          a.flee = true; p.vy = -700; p.pts += 1; this.float(p.x, p.y - 190, '+1', CHARS[p.slot].color); this.onBuzz(p.id, 'stomp');
          if (a.carry) { const it = a.carry; a.carry = null; it.x = a.x; it.y = GROUND - 60; it.vy = -400; it.vx = 0; it.rest = false; it.age = 0; this.items.push(it); }
          a.dir = (a.dir * -1) as 1 | -1;
        }
      });
    }
    this.ants = this.ants.filter((a) => a.x > -80 && a.x < W + 80);
    const ev = this.active('ants');
    if (ev && this.ants.length < 2 && Math.random() < dt * 0.6) this.ants.push(Math.random() < 0.5 ? { x: -40, dir: 1, carry: null, flee: false } : { x: W + 40, dir: -1, carry: null, flee: false });
  }

  private botThink(p: Player) {
    let tx: number, ty: number;
    if (p.carry) { tx = 960; ty = ROCK.top; }
    else {
      let best: Item | null = null, bd = 1e9;
      for (const it of this.items) { const d = Math.abs(it.x - p.x) + Math.abs(it.y - p.y) * 1.5; if (d < bd) { bd = d; best = it; } }
      if (!best) { tx = 400 + ((p.slot * 137) % 1100); ty = GROUND; } else { tx = best.x; ty = best.y; }
    }
    const dx = tx - p.x;
    const wantUp = ty < p.y - 60;
    p.input = { l: dx < -20, r: dx > 20, j: (wantUp && Math.random() < 0.08) || (p.onGround && Math.abs(p.vx) < 5 && Math.abs(dx) > 30 && Math.random() < 0.05) ? true : p.input.j && Math.random() < 0.8 };
    p.lastSeen = this.t;
  }

  private float(x: number, y: number, text: string, color: string) { this.floaters.push({ x, y, text, color, t: 0 }); }
  private burst(x: number, y: number, c: string, n = 18) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 200 + Math.random() * 400; this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300, t: 0, c }); }
  }

  /* ---------------- desenho ---------------- */

  render(ctx: Ctx) {
    const finale = this.mode === 'finale';
    const fk = finale ? this.modeT : 0;
    const dark = finale ? Math.min(1, fk / 1.2) * (this.complete ? Math.max(0, 1 - (fk - 4.5) / 1.5) : 1) : this.active('rain') ? 0.35 : 0;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 12);
    if (finale && fk > 1 && fk < 4.5) ctx.translate((Math.random() - 0.5) * 8, 0);
    scenery(ctx, this.t, dark);
    if (this.mode === 'lobby') this.lobbyOverlay(ctx); // atrás dos bonequinhos
    const quake = !!this.active('quake');
    PLATS.forEach((pl, i) => platform(ctx, pl, quake ? Math.sin(this.t * 40 + i) * 4 : 0));
    // a casa
    const prog = this.progress();
    const fall = finale && !this.complete ? Math.max(0, Math.min(1, (fk - 3.2) / 1.6)) : 0;
    house(ctx, prog, this.t, { wobble: finale && fk > 1 ? (this.complete ? 0.5 : 2) : quake ? 1 : 0, fall });
    scaffold(ctx);
    // materiais
    for (const it of this.items) {
      if (it.age > 23 && Math.floor(it.age * 6) % 2) continue;
      const bob = it.rest ? Math.sin(this.t * 3 + it.id) * 2 : 0;
      glow(ctx, it.x, it.y - 18 + bob, 44, it.gold ? 1 : 0.8);
      item(ctx, it.type, it.x, it.y - 18 + bob, it.gold);
    }
    this.ants.forEach((a) => ant(ctx, a.x, GROUND + 4, a.dir, this.t, a.carry?.type));
    // jogadores (de trás para frente)
    const arr = Array.from(this.players.values()).sort((a, b) => a.y - b.y);
    for (const p of arr) {
      person(ctx, p.x, p.y, p.slot, {
        face: p.face, walk: p.walk, air: !p.onGround, carry: p.carry?.type ?? null, carryGold: p.carry?.gold,
        happy: p.happy > 0 || (finale && this.complete && fk > 5), dizzy: p.dizzy > 0, name: p.name,
      });
      if (p.dizzy > 0) { ctx.fillStyle = C.amber; ctx.font = `900 22px ${FONT}`; ctx.textAlign = 'center'; for (let i = 0; i < 3; i++) { const a = this.t * 6 + (i * TAU) / 3; ctx.fillText('★', p.x + Math.cos(a) * 30, p.y - 140 + Math.sin(a) * 8); } }
    }
    // efeitos
    this.sparks.forEach((s) => { ctx.globalAlpha = 1 - s.t / 0.9; ctx.fillStyle = s.c; ctx.fillRect(s.x - 5, s.y - 5, 10, 10); }); ctx.globalAlpha = 1;
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
    if (this.rain.length || (finale && fk < 5)) {
      if (finale && fk < 5) for (let i = 0; i < 10; i++) this.rain.push({ x: Math.random() * (W + 300), y: -20 });
      ctx.strokeStyle = 'rgba(200,225,245,0.75)'; ctx.lineWidth = 3;
      this.rain.forEach((d) => { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 8, d.y + 26); ctx.stroke(); });
      if (finale) this.rain.forEach((d) => { d.y += 1500 / 60; d.x -= 5; });
      this.rain = this.rain.filter((d) => d.y < H);
    }
    if (finale && fk > 1.4 && fk < 4.2 && Math.floor(fk * 7) % 9 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, 0, W, H); }
    this.floaters.forEach((f) => {
      ctx.save(); ctx.globalAlpha = 1 - f.t / 1.4; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = '#fff';
      const y = f.y - f.t * 60; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y); ctx.restore();
    });
    ctx.restore();

    // o QR do saguão fica sempre por cima, para ninguém tampar na hora de escanear
    if (this.mode === 'lobby' && this.gameQR) { const x = W / 2 - 450; ctx.fillStyle = '#fff'; rr(ctx, x + 26, 116, 248, 248, 18); ctx.fill(); ctx.drawImage(this.gameQR, x + 36, 126, 228, 228); }
    if (this.mode === 'play') this.hud(ctx);
    if (finale) this.finaleOverlay(ctx, fk);
    if (this.mode === 'results') this.resultsOverlay(ctx);
    if (this.mode !== 'play' && this.mode !== 'results') this.scoreStrip(ctx, this.mode === 'finale');
  }

  private hud(ctx: Ctx) {
    const M = 64;
    // fase e materiais
    panel(ctx, M, 44, 640, 156);
    ctx.textAlign = 'left'; ctx.fillStyle = C.terra; ctx.font = `900 19px ${FONT}`; ls(ctx, 4);
    ctx.fillText(`FASE ${Math.min(this.phase + 1, 4)} DE 4`, M + 34, 90); ls(ctx, 0);
    const pct = this.housePct();
    ctx.fillStyle = '#efe4d2'; rr(ctx, M + 450, 77, 150, 14, 7); ctx.fill(); ctx.fillStyle = C.terra; rr(ctx, M + 450, 77, Math.max(14, 150 * pct / 100), 14, 7); ctx.fill();
    ctx.fillStyle = C.muted; ctx.font = `800 17px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(`casa ${pct}%`, M + 440, 90); ctx.textAlign = 'left';
    ctx.fillStyle = C.ink; ctx.font = `900 38px ${FONT}`; ctx.fillText(PHASES[Math.min(this.phase, 3)].title, M + 34, 136);
    ctx.font = `800 21px ${FONT}`;
    let x = M + 34;
    (['stone', 'brick', 'tile', 'wood', 'glass'] as ItemType[]).forEach((k) => {
      const done = this.have[k] >= this.need[k];
      const txt = `${ITEM_EMOJI[k]} ${this.have[k]}/${this.need[k]}${done ? ' ✓' : ''}`;
      ctx.fillStyle = done ? C.olive : PHASES[this.phase]?.types.includes(k) ? C.ink : '#b9a690';
      ctx.fillText(txt, x, 176); x += ctx.measureText(txt).width + 22;
    });
    // relógio
    const tl = Math.ceil(this.timeLeft);
    ctx.fillStyle = tl <= 20 ? C.terra : C.ink; rr(ctx, W / 2 - 100, 44, 200, 84, 42); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `900 50px ${FONT}`;
    ctx.fillText(`${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`, W / 2, 104);
    // aviso do desafio
    const be = this.bannerEvent();
    if (be) {
      const info = EVENT_INFO[be.e.type];
      const msg = `${info.emoji} ${be.soon ? info.soon : info.now}`;
      ctx.font = `900 28px ${FONT}`; const bw = ctx.measureText(msg).width + 64;
      ctx.save(); ctx.translate(W / 2, 176); ctx.rotate(-0.012); const pulse = be.soon ? 1 + Math.sin(this.t * 10) * 0.03 : 1; ctx.scale(pulse, pulse);
      ctx.fillStyle = '#c98a1f'; rr(ctx, -bw / 2, -24, bw, 60, 30); ctx.fill();
      ctx.fillStyle = be.soon ? C.amber : '#ff9a3c'; rr(ctx, -bw / 2, -30, bw, 60, 30); ctx.fill();
      ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(msg, 0, 10); ctx.restore();
    }
    this.qrPanel(ctx);
    this.scoreStrip(ctx);
  }

  private qrPanel(ctx: Ctx) {
    const M = 64;
    panel(ctx, W - M - 430, 44, 430, 156);
    if (this.gameQR) ctx.drawImage(this.gameQR, W - M - 414, 60, 124, 124);
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; fitText(ctx, 'Escaneie para jogar', W - M - 272, 92, 236, 900, 25);
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
    let total = chips.reduce((a, c) => a + c.w, 0) + gap * (chips.length - 1) + 40;
    const sc = Math.min(1, (W - 120) / total);
    ctx.save(); ctx.translate(W / 2, 978); ctx.scale(sc, sc); total = total;
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
    ctx.textAlign = 'left'; ctx.fillStyle = C.terra; ctx.font = `900 22px ${FONT}`; ls(ctx, 5); ctx.fillText('CASA NA ROCHA', x + 300, y + 80); ls(ctx, 0);
    ctx.fillStyle = C.ink; ctx.font = `900 54px ${FONT}`; ctx.fillText('Escaneie e entre!', x + 300, y + 140);
    ctx.fillStyle = C.brown; fitText(ctx, `${this.players.size} de ${MAX_PLAYERS} jogadores · sala ${this.room}`, x + 300, y + 184, cw - 340, 800, 26);
    const cd = Math.max(0, Math.ceil(this.countdown));
    ctx.fillStyle = C.ink; rr(ctx, x + 300, y + 210, 300, 60, 30); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 30px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`Começa em ${cd}s`, x + 450, y + 251);
    ctx.textAlign = 'left'; ctx.fillStyle = C.muted; fitText(ctx, 'Já pode treinar!', x + 622, y + 248, cw - 662, 800, 22);
  }

  private finaleOverlay(ctx: Ctx, fk: number) {
    let title = 'Vem a tempestade…', sub = 'Será que a casa aguenta?';
    if (fk > 4.6) {
      if (this.complete) { title = 'A casa na rocha ficou de pé! 🙌'; sub = '“Se o Senhor não edificar a casa, em vão trabalham os que a edificam.” · Sl 127:1'; }
      else { title = 'A tempestade levou parte da casa…'; sub = 'Faltou pouco! Bora de novo?'; }
    }
    ctx.save(); ctx.font = `900 30px ${FONT}`; const sw = ctx.measureText(sub).width;
    ctx.font = `900 60px ${FONT}`; const tw = ctx.measureText(title).width;
    const bw = Math.max(tw, sw) + 100;
    panel(ctx, W / 2 - bw / 2, 80, bw, 190, 40);
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.fillText(title, W / 2, 168);
    ctx.font = `800 30px ${FONT}`; ctx.fillStyle = C.brown; ctx.fillText(sub, W / 2, 226); ctx.restore();
  }

  private resultsOverlay(ctx: Ctx) {
    ctx.fillStyle = 'rgba(43,33,24,0.35)'; ctx.fillRect(0, 0, W, H);
    const list = this.results;
    const rowH = list.length > 8 ? 46 : 54, cw = 1100, ch = 272 + Math.max(1, list.length) * rowH, x = W / 2 - cw / 2, y = Math.max(40, H / 2 - ch / 2);
    panel(ctx, x, y, cw, ch, 44);
    ctx.textAlign = 'left'; ctx.fillStyle = C.terra; ctx.font = `900 22px ${FONT}`; ls(ctx, 5); ctx.fillText('RESULTADO', x + 60, y + 70); ls(ctx, 0);
    ctx.fillStyle = C.ink; ctx.font = `900 50px ${FONT}`; ctx.fillText(this.complete ? 'Casa construída! 🏠' : 'Quase lá!', x + 60, y + 128);
    ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = `800 22px ${FONT}`; ctx.fillText('EQUIPE', x + cw - 60, y + 76);
    ctx.fillStyle = C.terra; ctx.font = `900 48px ${FONT}`; ctx.fillText(`${this.results.reduce((a, r) => a + r.pts, 0)} pts`, x + cw - 60, y + 128);
    // cabeçalho da tabela
    const ty = y + 180;
    ctx.fillStyle = C.muted; ctx.font = `800 18px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('JOGADOR', x + 130, ty);
    ctx.textAlign = 'right'; ctx.fillText('ENTREGAS', x + 640, ty); ctx.fillText('PONTOS', x + 820, ty); ctx.fillText('SUGESTÃO APP', x + cw - 60, ty);
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
    ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.font = `800 20px ${FONT}`;
    const left = Math.max(0, Math.ceil(RESULTS_TIME - this.modeT));
    fitText(ctx, `Adm: lance a sugestão em Adm → Ajustar pontos · nova partida em ${left}s`, W / 2, y + ch - 30, cw - 100, 800, 20);
  }

  /** Na tela de espera: os jogadores já conectados aparecem no rodapé. */
  joinedNames() { return this.ranking().map((p) => ({ name: p.name, slot: p.slot })); }
}

export { PHASES, ITEM_LABEL };
