'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Game } from '@/lib/jogo/engine';
import { renderAttract, type AttractAssets } from '@/lib/jogo/attract';
import { GameAudio } from '@/lib/jogo/audio';
import { H, W } from '@/lib/jogo/draw';
import { channel, lobbyName, newRoom, playerChan, type BuzzMsg, type InputMsg, type JoinMsg, type TapMsg } from '@/lib/jogo/net';

/* Tela da TV: animação de boas-vindas com os QR codes e, quando alguém entra, o jogo Casa na Rocha. */

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const qr = (text: string) => QRCode.toDataURL(text, { width: 600, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2B2118', light: '#FFFFFF' } }).then(loadImg);

export default function JogoTV() {
  return <Suspense><TV /></Suspense>;
}

function TV() {
  const params = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hint, setHint] = useState(true);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext('2d')!;
    const room = (params.get('sala') || newRoom()).toUpperCase();
    const groupId = params.get('g');
    const bots = Math.min(12, Number(params.get('bots') || 0));
    const game = new Game();
    game.room = room;
    if (bots) (window as unknown as { __game?: Game }).__game = game; // só no modo de teste
    const assets: AttractAssets = { checkinQR: null, checkinCode: null, gameQR: null, room, groupName: 'Growth' };
    let alive = true;
    // som: o navegador só deixa tocar depois de um clique ou tecla na TV
    const audio = new GameAudio();
    game.onSfx = (s) => audio.play(s);
    const unlock = () => { audio.unlock(); setTimeout(() => setSoundOn(audio.ready), 300); };
    window.addEventListener('pointerdown', unlock);
    unlock();

    // QR do jogo (abre o controle no celular)
    const joinUrl = `${location.origin}/jogo/c?r=${room}`;
    qr(joinUrl).then((img) => { assets.gameQR = img; game.gameQR = img; });
    // QR do check-in: só se esta TV estiver logada como adm do grupo
    if (groupId) {
      supabase.from('groups').select('name').eq('id', groupId).maybeSingle().then(({ data }) => { if (data?.name) assets.groupName = data.name as string; });
      supabase.rpc('admin_checkin_code', { p_group: groupId, p_rotate: false }).then(async ({ data }) => {
        if (!data) return;
        assets.checkinCode = data as string;
        assets.checkinQR = await qr(`CASADEPAZ:${groupId}:${data}`);
      });
    }

    /* ---------- rede ---------- */
    const chans = new Map<string, RealtimeChannel>();
    const lobby = channel(lobbyName(room));
    const openPlayer = (id: string) => {
      if (chans.has(id)) return;
      const ch = channel(playerChan(room, id));
      ch.on('broadcast', { event: 'in' }, ({ payload }) => game.setInput(id, payload as InputMsg))
        .on('broadcast', { event: 'tap' }, ({ payload }) => game.tap(id, Number((payload as TapMsg)?.n) || 0))
        .on('broadcast', { event: 'pw' }, () => game.usePower(id))
        .on('broadcast', { event: 'ping' }, () => game.touch(id))
        .on('broadcast', { event: 'bye' }, () => { game.removePlayer(id); closePlayer(id); })
        .subscribe();
      chans.set(id, ch);
    };
    const closePlayer = (id: string) => { const ch = chans.get(id); if (ch) { ch.unsubscribe(); chans.delete(id); } };
    lobby.on('broadcast', { event: 'join' }, ({ payload }) => {
      const m = payload as JoinMsg;
      if (!m?.id) return;
      const p = game.addPlayer(m.id, String(m.name || '').trim());
      if (!p) { lobby.send({ type: 'broadcast', event: 'welcome', payload: { id: m.id, slot: -1, full: true, name: m.name } }); return; }
      openPlayer(m.id);
      lobby.send({ type: 'broadcast', event: 'welcome', payload: { id: m.id, slot: p.slot, name: p.name } });
    }).subscribe();
    game.onBuzz = (id: string, kind: BuzzMsg['kind']) => { chans.get(id)?.send({ type: 'broadcast', event: 'buzz', payload: { kind } }); };
    // placar para cada celular, 2x por segundo
    const stTimer = setInterval(() => {
      chans.forEach((ch, id) => {
        const st = game.stateFor(id);
        if (!st) { closePlayer(id); return; }
        ch.send({ type: 'broadcast', event: 'st', payload: st });
      });
    }, 500);

    // jogadores de teste (?bots=6)
    if (bots) setTimeout(() => { for (let i = 0; i < bots; i++) game.addPlayer(`bot${i}`, ['Ana', 'Beto', 'Caio', 'Davi', 'Elis', 'Fabi', 'Gabi', 'Hugo', 'Iara', 'Juca', 'Kika', 'Lia'][i], true); }, 800);

    /* ---------- desenho em tela cheia (quadro 1920×1080 com bordas) ---------- */
    let scale = 1, ox = 0, oy = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(window.innerWidth * dpr); cv.height = Math.round(window.innerHeight * dpr);
      cv.style.width = `${window.innerWidth}px`; cv.style.height = `${window.innerHeight}px`;
      scale = Math.min(cv.width / W, cv.height / H); ox = (cv.width - W * scale) / 2; oy = (cv.height - H * scale) / 2;
    };
    resize(); window.addEventListener('resize', resize);

    let last = performance.now(), acc = 0, raf = 0;
    const frame = (now: number) => {
      if (!alive) return;
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= 1 / 60) { game.step(1 / 60); acc -= 1 / 60; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#F7F0E4'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      audio.setTrack(game.mode === 'play' ? 'play' : game.mode === 'finale' ? 'none' : 'calm');
      if (game.mode === 'attract') renderAttract(ctx, game.t, assets); else game.render(ctx);
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    Promise.all(["700 60px 'Dancing Script'", '800 30px Nunito', '900 30px Nunito'].map((f) => document.fonts.load(f).catch(() => null))).finally(() => { raf = requestAnimationFrame(frame); });

    // teclado da TV/notebook: Enter começa já, F = tela cheia
    const onKey = (e: KeyboardEvent) => {
      unlock();
      if (e.key.toLowerCase() === 'm') audio.toggleMute();
      if (e.key === 'Enter' || e.key === ' ') game.startNow();
      if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener('keydown', onKey);
    // tela sempre acesa
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    const t = setTimeout(() => setHint(false), 8000);

    return () => {
      alive = false; cancelAnimationFrame(raf); audio.dispose(); window.removeEventListener('pointerdown', unlock); clearInterval(stTimer); clearTimeout(t);
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey);
      chans.forEach((ch) => ch.unsubscribe()); lobby.unsubscribe(); lock?.release().catch(() => {});
    };
  }, [params]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-cream" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
      <canvas ref={canvasRef} className="block" />
      {(hint || !soundOn) && (
        <div className="pointer-events-none absolute left-4 top-4 whitespace-nowrap rounded-full bg-ink/70 px-4 py-2 text-sm font-bold text-white">
          {soundOn ? 'Clique para tela cheia · Enter começa na hora · M liga/desliga o som' : '🔊 Clique na tela para ligar o som e a tela cheia'}
        </div>
      )}
    </div>
  );
}
