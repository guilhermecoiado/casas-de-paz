'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { AvatarOrnaments } from './Cosmetics';

/* ---------------- Avatar com moldura ---------------- */

export function Avatar({
  url, name, size = 48, frame,
}: { url?: string | null; name?: string; size?: number; frame?: string | null }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  const inner = (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full bg-sand font-extrabold text-[#8A6F57]"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name || ''} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials
      )}
    </div>
  );
  if (!frame) return inner;
  const pad = Math.max(2, size * 0.06);
  return (
    // tamanho fixo: dentro de linhas flex (ex.: comentários) o wrapper não estica e os enfeites ficam colados na foto
    <div className="relative shrink-0" style={{ width: size + 2 * pad + 4, height: size + 2 * pad + 4 }}>
      <div className={`af-ring ${frame}`} style={{ padding: pad }}>
        <div className="af-inner rounded-full bg-white p-[2px]">{inner}</div>
      </div>
      <AvatarOrnaments frame={frame} size={size} />
    </div>
  );
}

/* ---------------- Bottom sheet ---------------- */

export function Sheet({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-ink/45 anim-fade" onClick={onClose} />
      <div className="relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-cream px-5 pt-3 anim-sheet pb-safe">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#dccbb5]" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-bold">{title}</h3>
            <button onClick={onClose} className="rounded-full bg-sand p-2.5" aria-label="Fechar"><X size={19} /></button>
          </div>
        )}
        <div className="pb-6">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Seletor de foto (câmera / galeria) ---------------- */

export function PhotoPicker({
  value, onChange, cameraOnly = false, round = false, label = 'Adicionar foto',
}: {
  value: Blob | null;
  onChange: (f: Blob | null) => void;
  cameraOnly?: boolean;
  round?: boolean;
  label?: string;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return setPreview(null);
    const u = URL.createObjectURL(value);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onChange(f);
    e.target.value = '';
  };

  return (
    <div>
      <input ref={camRef} type="file" accept="image/*" capture={round ? 'user' : 'environment'} className="hidden" onChange={pick} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      {preview ? (
        <div className={`relative mx-auto overflow-hidden bg-sand ${round ? 'h-36 w-36 rounded-full' : 'aspect-[4/5] w-full rounded-3xl'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-ink/70 p-2 text-white"
            aria-label="Remover foto"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[#e2cfb6] bg-white/60 ${round ? 'mx-auto h-36 w-36 rounded-full' : 'aspect-[4/5] w-full rounded-3xl'}`}>
          {!round && <p className="text-sm font-bold text-[#8A6F57]">{label}</p>}
          <div className={`flex ${round ? 'flex-col gap-1' : 'gap-3'}`}>
            <button type="button" onClick={() => camRef.current?.click()} className={round ? 'flex items-center gap-1 text-sm font-extrabold text-terra' : 'btn-primary'}>
              <Camera size={round ? 16 : 20} /> Câmera
            </button>
            {!cameraOnly && (
              <button type="button" onClick={() => galRef.current?.click()} className={round ? 'flex items-center gap-1 text-sm font-extrabold text-[#8A6F57]' : 'btn-soft'}>
                <ImagePlus size={round ? 16 : 20} /> Galeria
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function FullLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <Spinner className="h-8 w-8 text-terra" />
    </div>
  );
}

export function ProgressBar({ value, max, color = 'bg-terra', height = 14 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-sand" style={{ height }}>
      <div className={`relative h-full overflow-hidden rounded-full ${color} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }}>
        <div className="bar-shine absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      </div>
    </div>
  );
}
