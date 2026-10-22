'use client';

import { WhaleBelly } from './WhaleBelly';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CHARS, POWERS, TASK, person } from '@/lib/jogo/draw';
import { channel, lobbyName, newId, playerChan, type BuzzMsg, type InputMsg, type StateMsg, type WelcomeMsg } from '@/lib/jogo/net';

/* Controle no celular: o jogador digita o nome e o celular (deitado) vira o joystick do bonequinho na TV. */

export default function Controle() {
  return <Suspense><Pad /></Suspense>;
}

type Step = 'room' | 'name' | 'joining' | 'full' | 'play';

// vibração de cada acontecimento (Android; no iPhone o navegador não deixa vibrar)
const BUZZ: Record<BuzzMsg['kind'], number | number[]> = {
  pick: 25, gold: [30, 30, 30, 30, 90], deliver: [40, 40, 90], deliverBig: [50, 40, 50, 40, 50, 40, 220],
  stomp: [30, 20, 60], stomped: [150, 50, 150], boing: [15, 15, 15, 15, 80],
  part: [60, 40, 60, 40, 160], finish: [100, 60, 100, 60, 100, 60, 400], alert: [200, 100, 200],
  storm: [400, 120, 250, 80, 500, 120, 300, 80, 600], quake: [120, 40, 220, 40, 120, 40, 260],
  power: [20, 20, 20, 20, 20, 20, 120], hit: [250, 80, 150], zap: [60, 30, 20], block: [20, 40, 20],
  freeze: [500], burn: [40, 25, 40, 25, 40, 25, 40, 25, 120], shrink: [100, 40, 60, 40, 30, 40, 15],
  speed: [15, 15, 15, 15, 15, 15, 15, 15, 15], giant: [60, 40, 120, 40, 260], shield: [120, 60, 120],
  magnet: [40, 40, 40, 40, 40, 40], crack: [30, 20, 30, 20, 90],
  bolt: [30, 30, 30, 30, 30, 30, 30], strike: [450], sting: [60, 25, 60, 25, 60], rock: [280], bite: [50, 30, 50],
};
const FLASH: Partial<Record<BuzzMsg['kind'], string>> = {
  pick: 'Pegou! +1', gold: 'Pacote grande! ✨', power: 'Ganhou um poder! ✨', zap: 'Poder lançado! 💥', block: 'Bloqueado! 🛡️',
  deliver: 'Entregue! 🧱', deliverBig: 'Entrega grande! 🎉', stomp: 'Boing! +1', stomped: 'Ai! 💫', boing: 'Lá vai! 🚀',
  part: 'Sua parte está pronta! +5', finish: 'Casa pronta! ✨', storm: 'Segura! 🌩️', quake: 'Terremoto! 🌋',
  freeze: 'Congelaram você! ❄️', burn: 'Pegando fogo! 🔥', shrink: 'Encolheram você! 🔻', speed: 'Turbo! ⚡', giant: 'Gigante! 🍄',
  shield: 'Escudo ligado! 🛡️', magnet: 'Ímã ligado! 🧲', crack: 'Quebrou o gelo! 💥',
  bolt: '⚡ Raio vindo em você! Saia daí!', strike: 'Raio! -1 ⚡', sting: 'Picada! -2 🐝', rock: 'Pedrada! -1 🪨', bite: 'Formiga mordeu! 🐜',
};
// toques que fazem o controle tremer/balançar na hora
const SHAKE_KINDS = new Set<BuzzMsg['kind']>(['quake', 'rock', 'strike', 'storm']);
const WOBBLE_KINDS = new Set<BuzzMsg['kind']>(['stomped', 'sting', 'bite', 'hit', 'shrink']);
const vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch {} };

/** Deita a tela (Android, em tela cheia). No iPhone aparece o aviso para girar. */
async function goLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {}
}

function Pad() {
  const params = useSearchParams();
  const [room, setRoom] = useState((params.get('r') || '').toUpperCase());
  const [step, setStep] = useState<Step>(room ? 'name' : 'room');
  const [name, setName] = useState('');
  const [slot, setSlot] = useState(-1);
  const [st, setSt] = useState<StateMsg | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pulse, setPulse] = useState<{ k: BuzzMsg['kind']; n: number } | null>(null);
  const [lost, setLost] = useState(false);
  const [extra, setExtra] = useState(0); // toques ainda não confirmados pela TV (barrinha anda na hora)
  const idRef = useRef('');
  const chRef = useRef<RealtimeChannel | null>(null);
  const inRef = useRef<InputMsg>({ l: false, r: false, j: false });
  const tapsRef = useRef(0);
  const lastSt = useRef(0);

  useEffect(() => {
    try { setName(localStorage.getItem('cdp-jogo-nome') || ''); } catch {}
    try { idRef.current = sessionStorage.getItem('cdp-jogo-id') || newId(); sessionStorage.setItem('cdp-jogo-id', idRef.current); } catch { idRef.current = newId(); }
  }, []);

  const send = useCallback((event: string, payload: object) => {
    chRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  // entrar na sala: abre o canal próprio, pede vaga no saguão e espera a resposta da TV
  const join = useCallback(() => {
    const nm = name.trim().slice(0, 12);
    if (!nm || !room) return;
    try { localStorage.setItem('cdp-jogo-nome', nm); } catch {}
    setStep((s) => (s === 'play' ? s : 'joining'));
    const id = idRef.current;
    if (!chRef.current) {
      const own = channel(playerChan(room, id));
      own.on('broadcast', { event: 'st' }, ({ payload }) => { setSt(payload as StateMsg); setExtra(0); lastSt.current = Date.now(); setLost(false); })
        .on('broadcast', { event: 'buzz' }, ({ payload }) => {
          const k = (payload as BuzzMsg).kind;
          vibrate(BUZZ[k] ?? 30);
          const f = FLASH[k];
          if (f) { setFlash(f); setTimeout(() => setFlash(null), k === 'part' || k === 'finish' || k === 'bolt' ? 1500 : 700); }
          const n = Date.now(); setPulse({ k, n }); setTimeout(() => setPulse((x) => (x?.n === n ? null : x)), 900);
        })
        .subscribe();
      chRef.current = own;
    }
    const lobby = channel(lobbyName(room));
    let done = false;
    lobby.on('broadcast', { event: 'welcome' }, ({ payload }) => {
      const w = payload as WelcomeMsg;
      if (w.id !== id) return;
      if (w.full) { done = true; setStep('full'); lobby.unsubscribe(); return; }
      done = true; setSlot(w.slot); setStep('play'); lastSt.current = Date.now();
      setTimeout(() => lobby.unsubscribe(), 500);
    }).subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      const ask = () => { if (!done) { lobby.send({ type: 'broadcast', event: 'join', payload: { id, name: nm } }); setTimeout(ask, 1500); } };
      ask();
    });
  }, [name, room]);

  // comandos: manda quando muda e a cada segundo (para a TV saber que ainda estou aqui)
  const press = (k: keyof InputMsg, v: boolean) => {
    if (inRef.current[k] === v) return;
    inRef.current = { ...inRef.current, [k]: v };
    send('in', inRef.current);
    if (v) vibrate(k === 'j' ? 18 : 8);
  };
  const tap = (per: number) => {
    tapsRef.current++;
    setExtra((e) => e + per);
    vibrate(12);
  };
  useEffect(() => {
    if (step !== 'play') return;
    const iv = setInterval(() => {
      send('in', inRef.current);
      // a TV parou de responder: tenta entrar de novo (volta de onde parou)
      if (Date.now() - lastSt.current > 7000) { setLost(true); lastSt.current = Date.now(); join(); }
    }, 1000);
    // toques rápidos vão em pacotinhos
    const tv = setInterval(() => { const n = tapsRef.current; if (n > 0) { tapsRef.current = 0; send('tap', { n }); } }, 120);
    const bye = () => send('bye', {});
    window.addEventListener('pagehide', bye);
    // tela sempre acesa
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => { clearInterval(iv); clearInterval(tv); window.removeEventListener('pagehide', bye); lock?.release().catch(() => {}); };
  }, [step, send, join]);

  const tapMode = st?.mode === 'play' && !!(st.ch || st.fin);
  // ao entrar num desafio de toque, solta os botões de andar
  useEffect(() => {
    if (tapMode) { inRef.current = { l: false, r: false, j: false }; send('in', inRef.current); }
  }, [tapMode, send]);

  // pegando fogo: o celular fica vibrando de leve enquanto durar
  const burning = !!st?.fxs?.includes('burn');
  useEffect(() => {
    if (!burning) return;
    const iv = setInterval(() => vibrate([30, 20, 30, 20, 30]), 650);
    return () => clearInterval(iv);
  }, [burning]);

  const color = slot >= 0 ? CHARS[slot % CHARS.length].color : '#C8553D';

  if (step !== 'play') {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-cream px-6 py-8 text-center" style={{ touchAction: 'manipulation' }}>
        <p className="whitespace-nowrap text-xs font-black uppercase tracking-[0.25em] text-terra">Jogo · Casa na Rocha</p>
        <h1 className="mt-2 whitespace-nowrap font-display text-[30px] font-extrabold leading-tight">Bora construir! 🏠</h1>
        <div className="mt-6 w-full max-w-xs space-y-3">
          {step === 'room' ? (
            <>
              <input className="input text-center text-2xl font-black uppercase tracking-[0.3em]" maxLength={4} value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} placeholder="SALA" />
              <button className="btn-primary w-full" disabled={room.length !== 4} onClick={() => setStep('name')}>Continuar</button>
            </>
          ) : (
            <>
              <input className="input text-center text-xl font-extrabold" maxLength={12} value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoFocus={step === 'name'}
                onKeyDown={(e) => { if (e.key === 'Enter') { goLandscape(); join(); } }} enterKeyHint="go" />
              <button className="btn-primary w-full" disabled={!name.trim() || step === 'joining'} onClick={() => { goLandscape(); join(); }}>
                {step === 'joining' ? 'Entrando…' : 'Entrar no jogo'}
              </button>
              {step === 'full' && <p className="font-bold text-terra">Sala cheia: 12 jogadores.</p>}
              <p className="whitespace-nowrap text-sm font-bold text-[#a8927a]">Sala {room} · não precisa ter conta</p>
            </>
          )}
        </div>
      </main>
    );
  }

  const fxs = new Set(st?.mode === 'play' ? st.fxs ?? [] : []);
  const env = new Set(st?.env ?? []);
  const padScale = fxs.has('tiny') ? 0.72 : fxs.has('giant') ? 1.05 : 1;
  const tl = st?.timeLeft ?? 0;
  const status = !st ? 'Conectando à TV…'
    : st.mode === 'lobby' ? `Começa em ${st.countdown}s · treine aí!`
      : st.mode === 'play' ? `⏱ ${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')} · ${st.phase ?? ''}`
        : st.mode === 'finale' ? 'Vem a tempestade… 🌩️'
          : st.mode === 'results' ? `Você fez ${st.pts} pts · sugestão +${st.suggest ?? 0} no app`
            : 'Aguardando a próxima partida';

  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-cream" style={{ touchAction: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
      <style>{FX_CSS}</style>
      {/* tudo que treme fica aqui dentro (com um leve zoom, para as bordas nunca aparecerem) */}
      <div
        className="absolute inset-0 flex flex-col bg-cream"
        style={{
          animation: pulse && SHAKE_KINDS.has(pulse.k) ? 'cdp-shakeall .12s linear infinite' : env.has('quake') || env.has('storm') ? 'cdp-shakeall .3s linear infinite'
            : pulse && WOBBLE_KINDS.has(pulse.k) ? 'cdp-wobbleall .45s ease-in-out 2' : undefined,
        }}
      >
      <header className="flex shrink-0 items-center gap-4 py-3 text-white" style={{ background: color, paddingTop: 'max(env(safe-area-inset-top), 12px)', paddingLeft: 'max(env(safe-area-inset-left), 28px)', paddingRight: 'max(env(safe-area-inset-right), 28px)' }}>
        <Avatar slot={slot} />
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.2em] text-white/80">Jogador {slot + 1}</p>
          <p className="truncate font-display text-2xl font-extrabold leading-tight">Você é {name.trim()}</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <div className="rounded-2xl bg-white/20 px-3 py-1.5 text-center">
            <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-white/85">Seus pontos</p>
            <p className="whitespace-nowrap text-xl font-black leading-tight">{st?.pts ?? 0}{st?.rank ? ` · ${st.rank}º` : ''}</p>
          </div>
          <div className="rounded-2xl bg-white/20 px-3 py-1.5 text-center">
            <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-white/85">Equipe</p>
            <p className="whitespace-nowrap text-xl font-black leading-tight">{st?.team ?? 0}</p>
          </div>
        </div>
      </header>
      <p className={`shrink-0 truncate px-6 pt-2 text-center text-[14px] font-extrabold ${lost || st?.fx ? 'text-terra' : 'text-[#6b5643]'}`}>{lost ? 'Reconectando…' : st?.fx ?? status}</p>
      {st?.mode === 'lobby' && (
        <div className="flex shrink-0 justify-center gap-2 px-6 pt-2">
          {([[1, 'Tela 1 · Casa na Rocha'], [2, 'Tela 2 · Vale do Rio']] as const).map(([n, label]) => (
            <button
              key={n}
              type="button"
              onClick={() => { send('lvl', { n }); vibrate(15); setSt((x) => (x ? { ...x, level: n } : x)); }}
              className={`chip whitespace-nowrap !px-4 !py-2 !text-sm ${(st.level ?? 1) === n ? 'bg-terra text-white' : 'bg-white text-[#6b5643]'}`}
            >
              {(st.level ?? 1) === n ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1" style={{ paddingLeft: 'max(env(safe-area-inset-left), 28px)', paddingRight: 'max(env(safe-area-inset-right), 28px)', paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
        {st?.mode === 'play' && st.ch ? (
          <TapScreen
            title={`${st.ch.emoji} ${st.ch.title}`} sub={`Toque rápido! A equipe toda junta · ${st.ch.left}s`} button="TOCA! 👆"
            prog={Math.min(1, st.ch.prog + extra)} color="#C8553D" onTap={() => tap(st.ch!.per)}
          />
        ) : st?.mode === 'play' && st.fin ? (
          st.fin.done ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="whitespace-nowrap font-display text-4xl font-extrabold">Casa pronta! ✨</p>
              <p className="whitespace-nowrap text-lg font-bold text-[#6b5643]">Olha a TV 📺</p>
            </div>
          ) : (
            <TapScreen
              title={`${TASK[st.fin.task].emoji} ${st.fin.helping ? `Ajudando: ${TASK[st.fin.task].label}` : `Sua parte: ${TASK[st.fin.task].label}`}`}
              sub={st.fin.helping ? 'Sua parte está pronta! Ajude quem falta' : 'Toque bem rápido para encher a barrinha'}
              button={`${TASK[st.fin.task].verb} ${TASK[st.fin.task].emoji}`}
              prog={Math.min(1, st.fin.prog + extra)} color={TASK[st.fin.task].color} onTap={() => tap(st.fin!.per)}
            />
          )
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pt-1 transition-transform duration-300" style={{ transform: `scale(${padScale})`, filter: fxs.has('slow') ? 'saturate(.35)' : undefined }}>
            <div className="flex shrink-0 gap-3">
              <PadButton label="◀" onChange={(v) => press('l', v)} className="text-white" style={{ background: color }} />
              <PadButton label="▶" onChange={(v) => press('r', v)} className="text-white" style={{ background: color }} />
            </div>
            {st?.mode === 'play' && st.power ? (
              <button
                type="button"
                onPointerDown={(e) => { e.preventDefault(); send('pw', {}); vibrate(40); setSt((x) => (x ? { ...x, power: undefined } : x)); }}
                className="flex h-[min(16.5vw,36vh)] w-[min(16.5vw,36vh)] shrink-0 animate-pulse flex-col items-center justify-center rounded-full border-4 bg-white shadow-[0_8px_0_rgba(43,33,24,0.18)]"
                style={{ borderColor: POWERS[st.power].color, touchAction: 'none' }}
              >
                <span className="text-[min(7vw,12vh)] leading-none">{POWERS[st.power].emoji}</span>
                <span className="mt-1 whitespace-nowrap text-[min(2.6vw,4.4vh)] font-black" style={{ color: POWERS[st.power].color }}>{POWERS[st.power].label}</span>
                {st.powerLeft != null && <span className="whitespace-nowrap text-[min(2.2vw,3.6vh)] font-bold text-[#a8927a]">{st.powerLeft}s</span>}
              </button>
            ) : (
              <p className="min-w-0 flex-1 truncate text-center text-xs font-bold text-[#c4b29c]">Pegue bolhas ✨ e ganhe poderes</p>
            )}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <PadButton label="PULAR" big onChange={(v) => press('j', v)} className="text-white" style={{ background: color }} />
              <p className="whitespace-nowrap text-xs font-bold text-[#a8927a]">2x no ar: pulo duplo</p>
            </div>
          </div>
        )}
      </div>
      </div>
      {/* efeitos e clima: tela inteira, por cima de tudo e sem tremer junto */}
      <FxLayer fxs={fxs} env={env} onBreak={() => tap(0)} />
      {st?.eaten != null && <WhaleBelly left={st.eaten} />}
      {flash && (
        <div className="pointer-events-none absolute inset-x-0 top-1 z-50 text-center">
          <span className="inline-block whitespace-nowrap rounded-full bg-ink px-5 py-1.5 text-xl font-black text-white">{flash}</span>
        </div>
      )}

      {pulse?.k === 'strike' && <div key={pulse.n} className="pointer-events-none fixed inset-0 z-40 bg-white" style={{ animation: 'cdp-flash .45s ease-out forwards' }} />}
      {pulse?.k === 'bolt' && <div key={pulse.n} className="pointer-events-none fixed inset-0 z-40" style={{ boxShadow: 'inset 0 0 0 10px #E25B45, inset 0 0 120px rgba(226,91,69,.6)', animation: 'cdp-glow .2s linear infinite' }} />}
      {pulse && ['deliverBig', 'gold', 'finish', 'part'].includes(pulse.k) && <div key={pulse.n} className="pointer-events-none fixed inset-0 z-40" style={{ boxShadow: 'inset 0 0 140px 30px rgba(243,198,74,.85)', animation: 'cdp-flash .8s ease-out forwards' }} />}
      {/* celular em pé: pede para deitar (o controle funciona deitado) */}
      <div className="fixed inset-0 z-50 hidden flex-col items-center justify-center gap-4 bg-cream px-8 text-center portrait:flex" onClick={goLandscape}>
        <div className="text-7xl" style={{ animation: 'cdp-rot 2.4s ease-in-out infinite' }}>📱</div>
        <p className="whitespace-nowrap font-display text-3xl font-extrabold">Deite o celular</p>
        <p className="whitespace-nowrap text-base font-bold text-[#6b5643]">Funciona de lado, como um joystick 🎮</p>
        <p className="whitespace-nowrap text-sm font-bold text-[#a8927a]">Toque aqui se a tela não girar</p>
        <style>{'@keyframes cdp-rot{0%,20%{transform:rotate(0)}50%,80%{transform:rotate(-90deg)}100%{transform:rotate(0)}}'}</style>
      </div>
    </main>
  );
}

function TapScreen({ title, sub, button, prog, color, onTap }: { title: string; sub: string; button: string; prog: number; color: string; onTap: () => void }) {
  const [down, setDown] = useState(false);
  return (
    <div className="flex flex-1 items-center gap-6 pt-1">
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[26px] font-extrabold leading-tight">{title}</p>
        <p className="mt-1 truncate text-[15px] font-bold text-[#6b5643]">{sub}</p>
        <div className="mt-4 h-7 w-full overflow-hidden rounded-full bg-[#efe4d2]">
          <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${Math.max(4, prog * 100)}%`, background: prog >= 1 ? '#5E8C3A' : color }} />
        </div>
        <p className="mt-1.5 whitespace-nowrap text-sm font-black text-[#6b5643]">{Math.round(prog * 100)}%</p>
      </div>
      <button
        type="button"
        onPointerDown={(e) => { e.preventDefault(); setDown(true); onTap(); }}
        onPointerUp={() => setDown(false)} onPointerCancel={() => setDown(false)} onPointerLeave={() => setDown(false)}
        className={`flex h-[min(42vw,60vh)] w-[min(42vw,60vh)] shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-center text-[min(5vw,6.5vh)] font-black leading-tight text-white shadow-[0_10px_0_rgba(43,33,24,0.2)] transition-transform duration-75 ${down ? 'translate-y-2 scale-95 shadow-[0_2px_0_rgba(43,33,24,0.2)]' : ''}`}
        style={{ background: color, touchAction: 'none' }}
      >
        {button}
      </button>
    </div>
  );
}

function PadButton({ label, onChange, className = '', big = false, style }: { label: string; onChange: (v: boolean) => void; className?: string; big?: boolean; style?: React.CSSProperties }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => { setDown(v); onChange(v); };
  const size = big ? 'h-[min(26vw,54vh)] w-[min(26vw,54vh)] text-[min(5.6vw,8vh)]' : 'h-[min(18.5vw,42vh)] w-[min(18.5vw,42vh)] text-[min(7vw,11vh)]';
  return (
    <button
      type="button"
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(true); }}
      onPointerUp={() => set(false)} onPointerCancel={() => set(false)} onLostPointerCapture={() => set(false)}
      className={`flex shrink-0 items-center justify-center rounded-full font-black shadow-[0_10px_0_rgba(43,33,24,0.18)] transition-transform ${size} ${down ? 'translate-y-2 shadow-[0_2px_0_rgba(43,33,24,0.18)]' : ''} ${className}`}
      style={{ ...style, touchAction: 'none' }}
    >
      {label}
    </button>
  );
}

function Avatar({ slot }: { slot: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || slot < 0) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(60, 60, 58, 0, Math.PI * 2); ctx.fill();
    person(ctx, 60, 112, slot, { scale: 0.62, happy: true });
  }, [slot]);
  return <canvas ref={ref} width={120} height={120} className="h-12 w-12 shrink-0" />;
}

const FX_CSS = `
@keyframes cdp-shake{0%{transform:translate(0,0) rotate(0)}20%{transform:translate(-7px,4px) rotate(-1deg)}40%{transform:translate(7px,-4px) rotate(1deg)}60%{transform:translate(-5px,-5px) rotate(-.6deg)}80%{transform:translate(6px,4px) rotate(.7deg)}100%{transform:translate(0,0) rotate(0)}}
@keyframes cdp-shakeall{0%{transform:translate(0,0) rotate(0) scale(1.05)}20%{transform:translate(-7px,4px) rotate(-.8deg) scale(1.05)}40%{transform:translate(7px,-4px) rotate(.8deg) scale(1.05)}60%{transform:translate(-5px,-5px) rotate(-.5deg) scale(1.05)}80%{transform:translate(6px,4px) rotate(.6deg) scale(1.05)}100%{transform:translate(0,0) rotate(0) scale(1.05)}}
@keyframes cdp-wobbleall{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-1.4deg) scale(1.07)}75%{transform:rotate(1.4deg) scale(1.07)}}
@keyframes cdp-drop{from{transform:translate(0,-12vh) rotate(12deg)}to{transform:translate(-22vh,112vh) rotate(12deg)}}
@keyframes cdp-splash{0%,70%{transform:scale(.2);opacity:0}80%{opacity:.8}100%{transform:scale(1.3);opacity:0}}
@keyframes cdp-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-2.5deg) scale(.98)}75%{transform:rotate(2.5deg) scale(.98)}}
@keyframes cdp-flame{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14px) scale(1.18)}}
@keyframes cdp-rain{from{background-position:0 0}to{background-position:-60px 240px}}
@keyframes cdp-streak{from{transform:translateX(0)}to{transform:translateX(-140vw)}}
@keyframes cdp-glow{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes cdp-flash{from{opacity:.95}to{opacity:0}}
@keyframes cdp-float{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(40px,-20px) rotate(10deg)}50%{transform:translate(80px,6px) rotate(0)}75%{transform:translate(36px,18px) rotate(-10deg)}100%{transform:translate(0,0) rotate(0)}}
@keyframes cdp-snow{0%,100%{transform:rotate(0) scale(1)}50%{transform:rotate(20deg) scale(1.15)}}
`;

/** Camada de efeitos por cima do controle: gelo, fogo, turbo, escudo… e o clima da TV (chuva, neblina, vento). */
function FxLayer({ fxs, env, onBreak }: { fxs: Set<string>; env: Set<string>; onBreak: () => void }) {
  const badge = (emoji: string, color: string) => (
    <div className="absolute right-3 top-[86px] flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl shadow" style={{ border: `3px solid ${color}`, animation: 'cdp-glow 1s ease-in-out infinite' }}>{emoji}</div>
  );
  return (
    <>
      {/* clima */}
      {(env.has('rain') || env.has('storm')) ? <Rain light={false} /> : env.has('drizzle') ? <Rain light /> : null}
      {env.has('wind') && <Streaks color="rgba(255,255,255,.9)" n={7} speed={0.7} />}
      {env.has('fog') && <div className="pointer-events-none absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(240,240,236,.15), rgba(240,240,236,.75))' }} />}
      {env.has('lightning') && <div className="pointer-events-none absolute inset-0 z-10" style={{ background: 'rgba(40,50,70,.14)' }} />}
      {env.has('bees') && ['18%', '46%', '72%'].map((l, i) => <span key={l} className="pointer-events-none absolute z-10 text-3xl" style={{ left: l, top: `${20 + i * 22}%`, animation: `cdp-float ${1.4 + i * 0.3}s ease-in-out infinite` }}>🐝</span>)}

      {/* efeitos no próprio bonequinho */}
      {fxs.has('burn') && (
        <div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 150px 40px rgba(242,107,29,.8)', animation: 'cdp-glow .35s ease-in-out infinite' }}>
          <div className="absolute inset-x-0 bottom-0 flex justify-around">
            {Array.from({ length: 9 }, (_, i) => <span key={i} className="text-5xl" style={{ animation: `cdp-flame ${0.4 + (i % 3) * 0.12}s ease-in-out infinite`, animationDelay: `${i * 0.07}s` }}>🔥</span>)}
          </div>
        </div>
      )}
      {fxs.has('fast') && <div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 90px rgba(255,214,70,.75)' }}><Streaks color="rgba(242,180,40,.85)" n={9} speed={0.35} />{badge('⚡', '#E8A12E')}</div>}
      {fxs.has('shield') && <div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 0 6px #4FA3DD, inset 0 0 90px rgba(79,163,221,.6)', animation: 'cdp-glow 1.2s ease-in-out infinite' }}>{badge('🛡️', '#2F8FD0')}</div>}
      {fxs.has('magnet') && <div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 0 5px rgba(200,85,61,.8), inset 0 0 80px rgba(200,85,61,.45)', animation: 'cdp-glow .6s ease-in-out infinite' }}>{badge('🧲', '#C8553D')}</div>}
      {fxs.has('giant') && <div className="pointer-events-none absolute inset-0 z-20">{badge('🍄', '#E25B45')}</div>}
      {fxs.has('tiny') && <div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 80px rgba(123,63,160,.45)' }}>{badge('🔻', '#7B3FA0')}</div>}
      {fxs.has('slow') && <div className="pointer-events-none absolute inset-0 z-20">{badge('🐌', '#8A6F57')}</div>}
      {fxs.has('wings') && <div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 80px rgba(200,230,140,.6)' }}>{badge('🕊️', '#8C9C2E')}</div>}
      {fxs.has('double') && <div className="pointer-events-none absolute inset-0 z-20" style={{ boxShadow: 'inset 0 0 80px rgba(170,120,230,.55)', animation: 'cdp-glow 1s ease-in-out infinite' }}>{badge('💎', '#7B3FA0')}</div>}
      {fxs.has('frozen') && (
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onBreak(); }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(220,244,252,.82), rgba(170,222,245,.72))', boxShadow: 'inset 0 0 140px 40px rgba(120,200,240,.95)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', touchAction: 'none' }}
        >
          {[['6%', '10%'], ['88%', '14%'], ['10%', '70%'], ['84%', '68%'], ['48%', '6%'], ['30%', '82%'], ['66%', '80%']].map(([l, t], i) => (
            <span key={i} className="pointer-events-none absolute text-4xl" style={{ left: l, top: t, animation: `cdp-snow ${1.2 + i * 0.2}s ease-in-out infinite` }}>❄️</span>
          ))}
          <span className="whitespace-nowrap font-display text-4xl font-extrabold text-[#1d5a7a]">Congelado! 🧊</span>
          <span className="mt-2 whitespace-nowrap text-lg font-black text-[#2f6f9f]" style={{ animation: 'cdp-glow .6s ease-in-out infinite' }}>Toque rápido para quebrar o gelo!</span>
        </button>
      )}
    </>
  );
}

/** Chuva de verdade: gotas caindo inclinadas em velocidades diferentes, respingos no chão e o céu mais escuro. Garoa = poucas gotas finas e lentas. */
function Rain({ light }: { light: boolean }) {
  const n = light ? 44 : 64;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" style={{ background: light ? 'linear-gradient(rgba(150,170,190,.18), rgba(150,170,190,.08))' : 'linear-gradient(rgba(60,80,110,.32), rgba(60,80,110,.14))' }}>
      {Array.from({ length: n }, (_, i) => {
        const r = (i * 61) % 100, dur = light ? 1.4 + (i % 5) * 0.18 : 0.55 + (i % 5) * 0.08;
        return (
          <span key={i} className="absolute top-0 rounded-full" style={{
            left: `${(i * 37) % 118}%`, width: light ? 2.5 : 3.5, height: light ? `${3 + (i % 3)}vh` : `${7 + (i % 4) * 2}vh`,
            background: light ? 'linear-gradient(rgba(90,140,195,0), rgba(90,140,195,.75))' : 'linear-gradient(rgba(70,120,180,0), rgba(70,120,180,.9))',
            animation: `cdp-drop ${dur}s linear infinite`, animationDelay: `${-(r / 100) * dur}s`,
          }} />
        );
      })}
      {Array.from({ length: light ? 6 : 14 }, (_, i) => (
        <span key={`s${i}`} className="absolute rounded-[50%] border-2 border-[#5a8cc3]/70" style={{ left: `${(i * 53) % 96}%`, bottom: `${2 + ((i * 29) % 30)}%`, width: 26, height: 8, animation: `cdp-splash ${light ? 1.6 : 0.9}s ease-out infinite`, animationDelay: `${(i * 0.23) % 1}s` }} />
      ))}
    </div>
  );
}

/** Riscos atravessando a tela (vento, turbo). */
function Streaks({ color, n, speed }: { color: string; n: number; speed: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="absolute h-[3px] rounded-full" style={{ left: '105%', top: `${8 + ((i * 37) % 84)}%`, width: `${80 + ((i * 53) % 90)}px`, background: color, animation: `cdp-streak ${speed + (i % 3) * 0.12}s linear infinite`, animationDelay: `${(i * 0.13) % speed}s` }} />
      ))}
    </div>
  );
}
