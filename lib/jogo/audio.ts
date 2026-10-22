/* Som do jogo na TV: trilha de fundo e efeitos, tudo sintetizado na hora (Web Audio, sem arquivos). */

import type { Sfx } from './engine';

type Track = 'calm' | 'play' | 'none';
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// progressão C – G – Am – F (alegre, fácil de ouvir em loop)
const ROOTS = [48, 43, 45, 41];
const CHORDS = [[60, 64, 67], [59, 62, 67], [60, 64, 69], [60, 65, 69]];
// melodia em colcheias (8 por compasso, 4 compassos); null = pausa
const MELODY: (number | null)[] = [
  72, 76, 79, 76, 84, null, 79, null,
  74, 79, 83, 79, 86, null, 83, null,
  76, 72, 76, 81, 79, 76, 72, null,
  77, 76, 74, 72, 74, null, 72, null,
];
const MELODY_B: (number | null)[] = [
  84, null, 83, 81, 79, null, 76, 79,
  83, null, 81, 79, 74, null, 79, null,
  81, 79, 76, 79, 81, 84, 81, null,
  77, 81, 79, 77, 76, 74, 72, null,
];
// trilha calma (espera / resultado): sininho em semínimas
const BELL: (number | null)[] = [79, null, 76, null, 74, null, 79, null, 76, null, 72, null, 77, null, 76, 74];

export class GameAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private fx!: GainNode;
  private noise!: AudioBuffer;
  private track: Track = 'none';
  private stepN = 0;
  private nextT = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  muted = false;

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  /** Precisa de um clique/tecla na TV (regra dos navegadores). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.85;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(ctx.destination);
      this.music = ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
      this.fx = ctx.createGain(); this.fx.gain.value = 0.75; this.fx.connect(this.master);
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nextT = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 25);
    }
    this.ctx.resume().catch(() => {});
  }

  toggleMute() { this.muted = !this.muted; if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.05); }

  setTrack(t: Track) {
    if (t === this.track) return;
    this.track = t; this.stepN = 0;
    if (this.ctx) this.nextT = Math.max(this.nextT, this.ctx.currentTime + 0.05);
  }

  dispose() { if (this.timer) clearInterval(this.timer); this.ctx?.close().catch(() => {}); }

  /* ---------------- instrumentos ---------------- */

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, opts: { to?: number; attack?: number; vib?: number } = {}) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    if (opts.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 9; lg.gain.value = opts.vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  private hiss(t: number, dur: number, vol: number, out: AudioNode, filter: { type: BiquadFilterType; f: number; to?: number; q?: number }, attack = 0.005) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filter.type; f.frequency.setValueAtTime(filter.f, t); if (filter.q) f.Q.value = filter.q;
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  private kick(t: number) { this.tone(140, t, 0.22, 'sine', 0.9, this.music, { to: 45 }); }
  private snare(t: number) { this.hiss(t, 0.16, 0.35, this.music, { type: 'highpass', f: 1800 }); this.tone(220, t, 0.08, 'triangle', 0.2, this.music); }
  private hat(t: number, v = 0.12) { this.hiss(t, 0.04, v, this.music, { type: 'highpass', f: 7000 }); }

  /* ---------------- trilha ---------------- */

  private tick() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    if (this.track === 'none') { this.nextT = ctx.currentTime + 0.05; return; }
    const bpm = this.track === 'play' ? 128 : 92;
    const sixteenth = 60 / bpm / 4;
    while (this.nextT < ctx.currentTime + 0.15) {
      if (this.track === 'play') this.playStep(this.stepN, this.nextT, sixteenth); else this.calmStep(this.stepN, this.nextT, sixteenth);
      this.nextT += sixteenth; this.stepN++;
    }
  }

  /** Trilha da partida: animada, mas sem bateria (arpejo saltitante, base suave e melodia). */
  private playStep(n: number, t: number, s: number) {
    const bar = Math.floor(n / 16) % 4, k = n % 16, part = Math.floor(n / 64) % 2;
    const root = ROOTS[bar], ch = CHORDS[bar];
    // base: nota longa e macia no começo e no meio do compasso
    if (k === 0 || k === 8) this.tone(mtof(root), t, s * 8, 'sine', 0.32, this.music, { attack: 0.04 });
    // colchão de acorde bem suave
    if (k === 0) ch.forEach((m) => this.tone(mtof(m), t, s * 16, 'sine', 0.035, this.music, { attack: 0.5 }));
    // arpejo em semicolcheias: dá o movimento sem batida
    const arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2] + 12, ch[0] + 12, ch[2], ch[1]];
    this.tone(mtof(arp[k % 8] + 12), t, s * 2.2, 'triangle', k % 4 === 0 ? 0.05 : 0.032, this.music);
    // melodia (alterna A e B a cada 4 compassos), ligada e com leve vibrato
    if (k % 2 === 0) {
      const mel = part ? MELODY_B : MELODY;
      const m = mel[bar * 8 + k / 2];
      if (m != null) { this.tone(mtof(m), t, s * 2.6, 'sine', 0.085, this.music, { attack: 0.02, vib: 3 }); this.tone(mtof(m), t, s * 2.2, 'triangle', 0.03, this.music, { attack: 0.02 }); }
    }
    // brilho de sininho no começo de cada compasso
    if (k === 0) this.tone(mtof(ch[2] + 24), t, s * 6, 'sine', 0.03, this.music, { attack: 0.01 });
  }

  private calmStep(n: number, t: number, s: number) {
    const bar = Math.floor(n / 16) % 4, k = n % 16;
    const ch = CHORDS[bar];
    if (k === 0) { this.tone(mtof(ROOTS[bar]), t, s * 15, 'triangle', 0.3, this.music, { attack: 0.05 }); ch.forEach((m) => this.tone(mtof(m), t, s * 15, 'sine', 0.06, this.music, { attack: 0.3 })); }
    if (k % 2 === 0) { const arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1], ch[0] + 12, ch[2]][k / 2]; this.tone(mtof(arp + 12), t, s * 3, 'triangle', 0.05, this.music); }
    if (k % 4 === 0) { const m = BELL[(bar * 4 + k / 4) % BELL.length]; if (m != null) this.tone(mtof(m + 12), t, s * 6, 'sine', 0.07, this.music); }
  }

  /* ---------------- efeitos ---------------- */

  play(name: Sfx) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01, o = this.fx;
    const seq = (notes: number[], step: number, type: OscillatorType, vol: number, last = step * 2) =>
      notes.forEach((m, i) => this.tone(mtof(m), t + i * step, i === notes.length - 1 ? last : step * 1.4, type, vol, o));
    switch (name) {
      case 'jump': this.tone(330, t, 0.14, 'square', 0.12, o, { to: 720 }); break;
      case 'jump2': this.tone(560, t, 0.12, 'square', 0.1, o, { to: 1150 }); this.tone(1600, t + 0.05, 0.08, 'sine', 0.08, o); break;
      case 'boing': this.tone(160, t, 0.38, 'sine', 0.4, o, { to: 620, vib: 40 }); break;
      case 'pick': seq([84, 91], 0.06, 'square', 0.12); break;
      case 'gold': seq([84, 88, 91, 96, 100], 0.05, 'triangle', 0.22, 0.3); this.hiss(t, 0.4, 0.05, o, { type: 'highpass', f: 6000 }); break;
      case 'deliver':
        this.tone(170, t, 0.14, 'sine', 0.6, o, { to: 90 }); this.hiss(t, 0.09, 0.25, o, { type: 'lowpass', f: 900 });
        seq([79, 84], 0.08, 'triangle', 0.2, 0.25); break;
      case 'phase': seq([72, 76, 79, 84], 0.11, 'square', 0.12, 0.5); seq([60, 64, 67, 72], 0.11, 'triangle', 0.2, 0.5); break;
      case 'stomp': this.tone(420, t, 0.16, 'square', 0.15, o, { to: 90 }); this.hiss(t, 0.06, 0.2, o, { type: 'bandpass', f: 1200 }); break;
      case 'join': seq([76, 83], 0.07, 'sine', 0.25); break;
      case 'alert': [0, 0.28].forEach((d) => { this.tone(880, t + d, 0.13, 'square', 0.09, o); this.tone(660, t + d + 0.14, 0.13, 'square', 0.09, o); }); break;
      case 'wind': this.hiss(t, 3.2, 0.3, o, { type: 'bandpass', f: 300, to: 1400, q: 2 }, 0.8); break;
      case 'quake': this.hiss(t, 3.5, 0.6, o, { type: 'lowpass', f: 140 }, 0.2); this.tone(48, t, 3.2, 'sine', 0.5, o, { attack: 0.2 }); break;
      case 'rain': this.hiss(t, 5, 0.12, o, { type: 'highpass', f: 2500 }, 1); break;
      case 'thunder': this.hiss(t, 0.15, 0.5, o, { type: 'highpass', f: 1500 }); this.hiss(t + 0.05, 2.4, 0.55, o, { type: 'lowpass', f: 400, to: 80 }, 0.05); break;
      case 'tap': this.tone(1200 + Math.random() * 400, t, 0.04, 'square', 0.05, o); break;
      case 'chWin': seq([72, 76, 79, 84, 88], 0.08, 'square', 0.12, 0.45); seq([60, 64, 67, 72], 0.1, 'triangle', 0.2, 0.5); break;
      case 'chFail': this.tone(392, t, 0.3, 'sawtooth', 0.08, o, { to: 370 }); this.tone(330, t + 0.32, 0.6, 'sawtooth', 0.08, o, { to: 260, vib: 6 }); break;
      case 'part': seq([79, 83, 86, 91], 0.07, 'triangle', 0.2, 0.3); break;
      case 'task': [72, 76, 79, 84].forEach((m) => this.tone(mtof(m), t, 0.7, 'sine', 0.09, o)); seq([88, 91, 96], 0.07, 'triangle', 0.15, 0.4); break;
      case 'finished':
        seq([72, 76, 79, 84, 88, 91, 96], 0.07, 'square', 0.1, 0.6);
        [60, 64, 67, 72, 76].forEach((m) => this.tone(mtof(m), t + 0.5, 1.6, 'triangle', 0.1, o, { attack: 0.05 }));
        this.hiss(t + 0.5, 1.2, 0.06, o, { type: 'highpass', f: 6000 }); break;
      case 'storm': this.hiss(t, 6, 0.3, o, { type: 'highpass', f: 1800 }, 1.2); this.hiss(t, 6, 0.35, o, { type: 'lowpass', f: 220 }, 1.5); break;
      case 'standing':
        [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]].forEach((c, i) => c.forEach((m) => this.tone(mtof(m), t + i * 0.45, i === 3 ? 2.2 : 0.6, 'triangle', 0.09, o, { attack: 0.04 })));
        break;
      case 'fall': this.tone(392, t, 0.4, 'sawtooth', 0.09, o, { to: 380 }); this.tone(370, t + 0.42, 0.4, 'sawtooth', 0.09, o, { to: 350 }); this.tone(349, t + 0.84, 1.1, 'sawtooth', 0.09, o, { to: 250, vib: 8 }); this.hiss(t + 0.3, 1.2, 0.4, o, { type: 'lowpass', f: 300 }); break;
      case 'results': seq([79, 84, 88, 91], 0.12, 'triangle', 0.18, 0.6); break;
      case 'beep': this.tone(880, t, 0.1, 'square', 0.1, o); break;
      case 'go': this.tone(1320, t, 0.45, 'square', 0.12, o); seq([72, 79, 84], 0.06, 'triangle', 0.15, 0.3); break;
      case 'balloon': this.tone(600, t, 0.5, 'sine', 0.12, o, { to: 1200, vib: 20 }); break;
      case 'ant': seq([67, 71, 74], 0.06, 'triangle', 0.15); break;
      case 'deliverBig':
        this.tone(150, t, 0.18, 'sine', 0.7, o, { to: 70 }); this.hiss(t, 0.12, 0.3, o, { type: 'lowpass', f: 900 });
        seq([79, 84, 88, 91], 0.07, 'triangle', 0.22, 0.4); this.hiss(t + 0.1, 0.5, 0.05, o, { type: 'highpass', f: 6000 }); break;
      case 'power': seq([84, 88, 91, 96], 0.04, 'sine', 0.18, 0.2); this.tone(600, t, 0.3, 'triangle', 0.08, o, { to: 1400 }); break;
      case 'zap': this.tone(1400, t, 0.25, 'sawtooth', 0.06, o, { to: 300 }); this.hiss(t, 0.2, 0.12, o, { type: 'bandpass', f: 2500, to: 600 }); break;
      case 'freeze': seq([96, 91, 100, 96], 0.05, 'sine', 0.14, 0.3); this.hiss(t, 0.5, 0.12, o, { type: 'highpass', f: 5000 }); break;
      case 'fire': this.hiss(t, 0.9, 0.35, o, { type: 'bandpass', f: 500, to: 1800, q: 1 }, 0.05); this.tone(120, t, 0.5, 'sawtooth', 0.06, o, { to: 60 }); break;
      case 'shrink': this.tone(900, t, 0.45, 'square', 0.08, o, { to: 1800, vib: 30 }); break;
      case 'grow': this.tone(120, t, 0.6, 'square', 0.1, o, { to: 360, vib: 12 }); seq([60, 67, 72], 0.12, 'triangle', 0.18, 0.4); break;
      case 'speed': this.tone(400, t, 0.35, 'square', 0.08, o, { to: 1600 }); this.hiss(t, 0.4, 0.1, o, { type: 'bandpass', f: 800, to: 4000 }); break;
      case 'shield': [72, 76, 79].forEach((m) => this.tone(mtof(m + 12), t, 0.6, 'sine', 0.08, o, { attack: 0.03 })); break;
      case 'block': this.tone(1800, t, 0.12, 'square', 0.08, o); this.tone(2400, t + 0.06, 0.2, 'sine', 0.08, o); break;
      case 'magnet': this.tone(220, t, 0.6, 'sine', 0.2, o, { vib: 40 }); break;
      case 'bees': this.tone(220, t, 2.2, 'sawtooth', 0.04, o, { vib: 30, attack: 0.2 }); this.tone(233, t, 2.2, 'sawtooth', 0.04, o, { vib: 25, attack: 0.2 }); break;
      case 'boulder': this.hiss(t, 0.8, 0.35, o, { type: 'lowpass', f: 200 }, 0.1); this.tone(70, t, 0.6, 'sine', 0.3, o); break;
      case 'crash': this.hiss(t, 0.4, 0.4, o, { type: 'lowpass', f: 700, to: 120 }); break;
      case 'lightning': this.hiss(t, 0.1, 0.6, o, { type: 'highpass', f: 2500 }); this.hiss(t + 0.05, 1.4, 0.5, o, { type: 'lowpass', f: 600, to: 90 }); break;
      case 'jolt': this.hiss(t, 0.7, 0.7, o, { type: 'lowpass', f: 260, to: 60 }, 0.01); this.tone(55, t, 0.6, 'sine', 0.6, o, { to: 30 }); this.hiss(t, 0.15, 0.3, o, { type: 'bandpass', f: 900 }); break;
      case 'crack': this.hiss(t, 0.25, 0.4, o, { type: 'highpass', f: 3000 }); seq([96, 91, 88], 0.04, 'triangle', 0.14, 0.2); break;
      case 'ouch': this.tone(520, t, 0.18, 'square', 0.1, o, { to: 260 }); break;
      case 'fog': this.tone(196, t, 2, 'sine', 0.1, o, { attack: 0.6 }); this.tone(233, t + 0.3, 1.8, 'sine', 0.08, o, { attack: 0.6 }); break;
      case 'splash': this.hiss(t, 0.9, 0.5, o, { type: 'lowpass', f: 1400, to: 200 }, 0.02); this.tone(140, t, 0.4, 'sine', 0.3, o, { to: 60 }); break;
      case 'gulp': this.tone(300, t, 0.25, 'sine', 0.35, o, { to: 90 }); this.tone(200, t + 0.25, 0.3, 'sine', 0.3, o, { to: 70 }); break;
      case 'drizzle': this.hiss(t, 4, 0.06, o, { type: 'highpass', f: 4000 }, 1); break;
    }
  }
}
