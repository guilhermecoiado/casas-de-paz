'use client';

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
  pick: 30, gold: [30, 40, 30, 40, 60], deliver: [40, 50, 80], stomp: 50, stomped: [120, 60, 120], boing: [20, 30, 60],
  part: [60, 40, 60, 40, 120], finish: [100, 60, 100, 60, 300], alert: [200, 100, 200],
  storm: [400, 120, 250, 80, 500, 120, 300, 80, 600],
  power: [30, 30, 30, 30, 80], hit: [250, 80, 150], zap: 40,
};
const FLASH: Partial<Record<BuzzMsg['kind'], string>> = {
  pick: 'Pegou! +1', gold: 'Pacote grande! ✨', power: 'Ganhou um poder! ✨', hit: 'Te acertaram! 😵', zap: 'Poder lançado! 💥', deliver: 'Entregue! 🧱', stomp: 'Boing! +1', stomped: 'Ai! 💫', boing: 'Lá vai! 🚀',
  part: 'Sua parte está pronta! +5', finish: 'Casa pronta! ✨', storm: 'Segura! 🌩️',
};
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
          if (f) { setFlash(f); setTimeout(() => setFlash(null), k === 'part' || k === 'finish' ? 1600 : 450); }
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

  const tl = st?.timeLeft ?? 0;
  const status = !st ? 'Conectando à TV…'
    : st.mode === 'lobby' ? `Começa em ${st.countdown}s · treine aí!`
      : st.mode === 'play' ? `⏱ ${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')} · ${st.phase ?? ''}`
        : st.mode === 'finale' ? 'Vem a tempestade… 🌩️'
          : st.mode === 'results' ? `Você fez ${st.pts} pts · sugestão +${st.suggest ?? 0} no app`
            : 'Aguardando a próxima partida';

  return (
    <main className="fixed inset-0 flex select-none flex-col bg-cream" style={{ touchAction: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
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
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pt-1">
            <div className="flex shrink-0 gap-3">
              <PadButton label="◀" onChange={(v) => press('l', v)} className="bg-white text-ink" />
              <PadButton label="▶" onChange={(v) => press('r', v)} className="bg-white text-ink" />
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
        {flash && (
          <div className="pointer-events-none absolute inset-x-0 top-1 text-center">
            <span className="inline-block whitespace-nowrap rounded-full bg-ink px-5 py-1.5 text-xl font-black text-white">{flash}</span>
          </div>
        )}
      </div>

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
