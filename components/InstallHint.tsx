'use client';

import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/** Convite para instalar o app (Android: botão nativo; iOS: instruções do Safari). */
export function InstallHint() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try { dismissed = localStorage.getItem('cdp-install-dismissed') === '1'; } catch {}
    if (standalone || dismissed) return;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    if (isIos) { setIos(true); setHidden(false); }
    const onBip = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setHidden(false); };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem('cdp-install-dismissed', '1'); } catch {}
  };

  if (hidden) return null;
  return (
    <div className="card relative mb-4 p-4 anim-rise">
      <button onClick={dismiss} className="absolute right-3 top-3 text-[#b9a690]" aria-label="Fechar"><X size={18} /></button>
      <p className="pr-6 font-extrabold">Instale o app no seu celular</p>
      {ios ? (
        <p className="mt-1 text-sm leading-relaxed text-[#6b5643]">
          No Safari, toque em <Share size={15} className="inline -mt-1" /> <b>Compartilhar</b> e depois em{' '}
          <SquarePlus size={15} className="inline -mt-1" /> <b>Adicionar à Tela de Início</b>.
        </p>
      ) : (
        <button
          className="btn-primary mt-3 w-full"
          onClick={async () => {
            if (!deferred) return;
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            setHidden(true);
          }}
        >
          <Download size={18} /> Instalar Casas de Paz
        </button>
      )}
    </div>
  );
}
