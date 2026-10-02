'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, Keyboard, QrCode } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { errMsg, supabase } from '@/lib/supabase';
import { useToast } from './Providers';
import { Spinner } from './ui';

/**
 * Antes da foto do check-in: escanear o QR code fixado na Casa de Paz.
 * O servidor confere o código e libera o check-in só para hoje.
 */
export function CheckinGate({ onPass }: { onPass: () => void }) {
  const { group, me, today } = useGroup();
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const [checking, setChecking] = useState(true);
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting');
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [ok, setOk] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const succeed = useCallback(() => {
    stop();
    setOk(true);
    if (navigator.vibrate) navigator.vibrate(60);
    setTimeout(onPass, 900);
  }, [onPass, stop]);

  const claim = useCallback(async (text: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const { error } = await supabase.rpc('claim_checkin_pass', { p_group: group.id, p_code: text });
    if (error) {
      toast(errMsg(error), 'error');
      // espera um pouco antes de tentar de novo (evita repetir o mesmo QR errado)
      setTimeout(() => { busyRef.current = false; }, 2500);
      return false;
    }
    succeed();
    return true;
  }, [group.id, succeed, toast]);

  // já escaneou hoje (ou o adm desligou o QR)? segue direto
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!group.checkin_qr) { onPass(); return; }
      // sem resposta em 4s (sinal fraco no local), mostra o leitor mesmo assim
      const q = supabase.from('checkin_passes').select('local_date').eq('group_id', group.id).eq('user_id', me).eq('local_date', today).maybeSingle();
      const res = await Promise.race([q, new Promise<{ data: null }>((r) => setTimeout(() => r({ data: null }), 4000))]);
      const data = res?.data;
      if (!alive) return;
      if (data) onPass();
      else setChecking(false);
    })();
    return () => { alive = false; };
  }, [group.id, group.checkin_qr, me, today, onPass]);

  // câmera + leitura contínua do QR
  useEffect(() => {
    if (checking || manual || ok) return;
    let raf = 0;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        setCamera('on');
        const c = canvasRef.current!;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        const tick = () => {
          if (cancelled) return;
          if (v.readyState === v.HAVE_ENOUGH_DATA && !busyRef.current) {
            // lê uma versão reduzida do quadro (mais rápido no celular)
            const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480) || 480;
            c.width = w; c.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            if (found?.data) claim(found.data);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setCamera('off');
        setManual(true);
      }
    })();
    return () => { cancelled = true; cancelAnimationFrame(raf); stop(); };
  }, [checking, manual, ok, claim, stop]);

  if (checking) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8 text-terra" /></div>;

  if (ok)
    return (
      <div className="flex flex-col items-center py-14 text-center anim-pop">
        <CheckCircle2 size={72} className="text-olive" />
        <p className="mt-3 font-display text-2xl font-extrabold">Você está na Casa de Paz!</p>
        <p className="text-sm font-bold text-[#8A6F57]">Agora é só tirar a foto do check-in.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="card p-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-terra/10 text-terra"><QrCode size={26} /></span>
        <p className="mt-2 font-display text-xl font-bold">Escaneie o QR code da Casa de Paz</p>
        <p className="text-sm leading-snug text-[#8A6F57]">Ele está impresso no local do encontro. Depois de escanear, libera a foto do check-in, e o seu check-in ainda sorteia um item surpresa 🎁</p>
      </div>

      {!manual ? (
        <>
          <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-3xl bg-ink">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {/* mira */}
            <div className="pointer-events-none absolute inset-[14%] rounded-3xl border-4 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]">
              <span className="scan-line absolute left-3 right-3 h-0.5 rounded-full bg-amber shadow-[0_0_12px_#F2A541]" />
            </div>
            {camera === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                <Camera size={30} />
                <p className="text-sm font-bold">Abrindo a câmera…</p>
              </div>
            )}
          </div>
          <button onClick={() => { stop(); setManual(true); }} className="btn-soft w-full"><Keyboard size={18} /> Digitar o código</button>
        </>
      ) : (
        <div className="card space-y-3 p-4">
          {camera === 'off' && <p className="text-sm font-bold text-[#9a5b00]">Não foi possível abrir a câmera. Digite o código que aparece embaixo do QR.</p>}
          <label className="label !mb-0">Código do QR (6 letras/números)</label>
          <input
            className="input text-center font-mono text-2xl font-extrabold uppercase tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="••••••"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button className="btn-primary w-full" disabled={code.length < 6} onClick={() => { busyRef.current = false; claim(code); }}>Liberar check-in</button>
          {camera !== 'off' && (
            <button className="btn-soft w-full" onClick={() => { setCamera('starting'); setManual(false); }}><Camera size={18} /> Voltar para a câmera</button>
          )}
        </div>
      )}
    </div>
  );
}
