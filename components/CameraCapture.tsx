'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X } from 'lucide-react';

/*
 * Câmera dentro do app. Sabemos qual lente está ativa, então a selfie (câmera frontal)
 * sai exatamente como aparece na tela, sem ficar invertida. A câmera traseira não é espelhada.
 */

type Facing = 'user' | 'environment';

export const canUseInAppCamera = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export function CameraCapture({
  facing: initial, onCapture, onClose, onFallback,
}: {
  facing: Facing;
  onCapture: (b: Blob) => void;
  onClose: () => void;
  onFallback: () => void; // abre a câmera do próprio celular
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>(initial);
  const [mirror, setMirror] = useState(initial === 'user');
  const [state, setState] = useState<'loading' | 'on' | 'error'>('loading');
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        // qual lente abriu de verdade (computador sem informação = webcam = frontal)
        const real = stream.getVideoTracks()[0]?.getSettings().facingMode;
        setMirror(real ? real === 'user' : facing === 'user');
        const v = videoRef.current!;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true');
        await v.play();
        if (!cancelled) setState('on');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [facing, stop]);

  useEffect(() => () => stop(), [stop]);

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || busy) return;
    setBusy(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    // selfie: salva igual ao que a pessoa viu na tela (como um espelho)
    if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      setBusy(false);
      if (!b) return;
      stop();
      onCapture(b);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
          style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
        />
        {state === 'loading' && <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/70">Abrindo a câmera…</div>}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="font-display text-2xl font-bold">Não deu para abrir a câmera</p>
            <p className="text-sm text-white/75">Libere o acesso à câmera para o app ou use a câmera do celular.</p>
            <button type="button" className="btn-primary" onClick={() => { stop(); onFallback(); }}>
              <Camera size={20} /> Usar a câmera do celular
            </button>
          </div>
        )}
        {flash && <div className="absolute inset-0 bg-white" />}
        <button
          type="button"
          onClick={() => { stop(); onClose(); }}
          className="absolute left-4 rounded-full bg-black/50 p-3"
          style={{ top: 'max(env(safe-area-inset-top), 16px)' }}
          aria-label="Fechar câmera"
        >
          <X size={22} />
        </button>
      </div>
      <div className="flex shrink-0 items-center justify-between px-10 pt-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
        <span className="w-12" />
        <button
          type="button"
          onClick={shoot}
          disabled={state !== 'on' || busy}
          className="h-[76px] w-[76px] rounded-full border-[5px] border-white bg-white/25 transition-transform active:scale-90 disabled:opacity-40"
          aria-label="Tirar foto"
        />
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15"
          aria-label="Trocar câmera"
        >
          <RefreshCw size={22} />
        </button>
      </div>
    </div>
  );
}
