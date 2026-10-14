'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { CHARS, person } from '@/lib/jogo/draw';
import { channel, lobbyName, newId, playerChan, type BuzzMsg, type InputMsg, type StateMsg, type WelcomeMsg } from '@/lib/jogo/net';

/* Controle no celular: o jogador digita o nome e o celular vira o joystick do bonequinho na TV. */

export default function Controle() {
  return <Suspense><Pad /></Suspense>;
}

type Step = 'room' | 'name' | 'joining' | 'full' | 'play';

function Pad() {
  const params = useSearchParams();
  const [room, setRoom] = useState((params.get('r') || '').toUpperCase());
  const [step, setStep] = useState<Step>(room ? 'name' : 'room');
  const [name, setName] = useState('');
  const [slot, setSlot] = useState(-1);
  const [st, setSt] = useState<StateMsg | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [lost, setLost] = useState(false);
  const idRef = useRef('');
  const chRef = useRef<RealtimeChannel | null>(null);
  const inRef = useRef<InputMsg>({ l: false, r: false, j: false });
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
    setStep('joining');
    const id = idRef.current;
    if (!chRef.current) {
      const own = channel(playerChan(room, id));
      own.on('broadcast', { event: 'st' }, ({ payload }) => { setSt(payload as StateMsg); lastSt.current = Date.now(); setLost(false); })
        .on('broadcast', { event: 'buzz' }, ({ payload }) => {
          const k = (payload as BuzzMsg).kind;
          const pattern: Record<BuzzMsg['kind'], number | number[]> = { pick: 30, gold: [30, 40, 30, 40, 60], deliver: [40, 50, 80], stomp: 50, stomped: [120, 60, 120] };
          try { navigator.vibrate?.(pattern[k]); } catch {}
          setFlash(k); setTimeout(() => setFlash(null), 350);
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
    if (v) try { navigator.vibrate?.(8); } catch {}
  };
  useEffect(() => {
    if (step !== 'play') return;
    const iv = setInterval(() => {
      send('in', inRef.current);
      // a TV parou de responder: tenta entrar de novo
      if (Date.now() - lastSt.current > 7000) { setLost(true); lastSt.current = Date.now(); join(); }
    }, 1000);
    const bye = () => send('bye', {});
    window.addEventListener('pagehide', bye);
    // tela sempre acesa
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => { clearInterval(iv); window.removeEventListener('pagehide', bye); lock?.release().catch(() => {}); };
  }, [step, send, join]);

  const color = slot >= 0 ? CHARS[slot % CHARS.length].color : '#C8553D';

  if (step === 'room' || step === 'name' || step === 'joining' || step === 'full') {
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
                onKeyDown={(e) => { if (e.key === 'Enter') join(); }} enterKeyHint="go" />
              <button className="btn-primary w-full" disabled={!name.trim() || step === 'joining'} onClick={join}>
                {step === 'joining' ? 'Entrando…' : 'Entrar no jogo'}
              </button>
              {step === 'full' && <p className="font-bold text-terra">Sala cheia: 12 jogadores.</p>}
              <p className="text-sm font-bold text-[#a8927a]">Sala {room} · não precisa ter conta</p>
            </>
          )}
        </div>
      </main>
    );
  }

  const status = !st ? 'Conectando à TV…'
    : st.mode === 'lobby' ? `Começa em ${st.countdown}s · treine aí!`
      : st.mode === 'play' ? `⏱ ${Math.floor((st.timeLeft ?? 0) / 60)}:${String((st.timeLeft ?? 0) % 60).padStart(2, '0')} · ${st.phase ?? ''}`
        : st.mode === 'finale' ? 'Vem a tempestade… 🌩️'
          : st.mode === 'results' ? `Você fez ${st.pts} pts · sugestão +${st.suggest ?? 0} no app`
            : 'Aguardando a próxima partida';

  return (
    <main className="fixed inset-0 flex select-none flex-col bg-cream" style={{ touchAction: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 py-4 text-white" style={{ background: color, paddingTop: 'max(env(safe-area-inset-top), 16px)', paddingLeft: 'max(env(safe-area-inset-left), 24px)', paddingRight: 'max(env(safe-area-inset-right), 24px)' }}>
        <Avatar slot={slot} />
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.2em] text-white/80">Jogador {slot + 1}</p>
          <p className="truncate font-display text-2xl font-extrabold leading-tight">Você é {name.trim()}</p>
        </div>
        <div className="flex shrink-0 gap-3 portrait:w-full">
          <div className="rounded-2xl bg-white/20 px-3 py-1.5 text-center portrait:flex-1">
            <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-white/85">Seus pontos</p>
            <p className="whitespace-nowrap text-xl font-black leading-tight">{st?.pts ?? 0}{st?.rank ? ` · ${st.rank}º` : ''}</p>
          </div>
          <div className="rounded-2xl bg-white/20 px-3 py-1.5 text-center portrait:flex-1">
            <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-white/85">Equipe</p>
            <p className="whitespace-nowrap text-xl font-black leading-tight">{st?.team ?? 0}</p>
          </div>
        </div>
      </header>

      <p className={`shrink-0 truncate px-6 pt-3 text-center text-[15px] font-extrabold ${lost ? 'text-terra' : 'text-[#6b5643]'}`}>{lost ? 'Reconectando…' : status}</p>

      <div className="relative flex flex-1 items-center justify-between gap-4 px-6 pb-6 portrait:flex-col-reverse portrait:justify-center portrait:gap-10" style={{ paddingLeft: 'max(env(safe-area-inset-left), 24px)', paddingRight: 'max(env(safe-area-inset-right), 24px)', paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
        <div className="flex gap-4 portrait:w-full portrait:justify-between">
          <PadButton label="◀" onChange={(v) => press('l', v)} className="bg-white text-ink" />
          <PadButton label="▶" onChange={(v) => press('r', v)} className="bg-white text-ink" />
        </div>
        <PadButton label="PULAR" big onChange={(v) => press('j', v)} className="text-white" style={{ background: color }} />
        {flash && (
          <div className="pointer-events-none absolute inset-x-0 top-0 whitespace-nowrap text-center text-3xl font-black text-ink">
            {flash === 'deliver' ? 'Entregue! +2' : flash === 'gold' ? 'Dourado! ✨' : flash === 'pick' ? 'Pegou! +1' : flash === 'stomp' ? 'Boing! +1' : 'Ai! 💫'}
          </div>
        )}
      </div>
      <p className="hidden shrink-0 pb-4 text-center text-xs font-bold text-[#a8927a] portrait:block">Dica: deite o celular para jogar com os dois dedões</p>
    </main>
  );
}

function PadButton({ label, onChange, className = '', big = false, style }: { label: string; onChange: (v: boolean) => void; className?: string; big?: boolean; style?: React.CSSProperties }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => { setDown(v); onChange(v); };
  const size = big
    ? 'h-[min(42vw,46vh)] w-[min(42vw,46vh)] text-[min(9vw,9vh)] portrait:h-[min(62vw,34vh)] portrait:w-[min(62vw,34vh)] portrait:text-[min(12vw,6vh)]'
    : 'h-[min(28vw,36vh)] w-[min(28vw,36vh)] text-[min(10vw,12vh)] portrait:h-[min(40vw,24vh)] portrait:w-[min(40vw,24vh)]';
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
  return <canvas ref={ref} width={120} height={120} className="h-14 w-14 shrink-0" />;
}
