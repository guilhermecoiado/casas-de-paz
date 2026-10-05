'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Share, SquarePlus, X } from 'lucide-react';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push-client';
import { errMsg } from '@/lib/supabase';
import { useToast } from './Providers';
import { Spinner } from './ui';

/**
 * compact: banner no início, só aparece enquanto as notificações estão desligadas.
 * full: cartão no perfil, sempre visível, com opção de desligar.
 */
export function PushToggle({ variant = 'full' }: { variant?: 'compact' | 'full' }) {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
    // "fechar" esconde o convite por 2 dias (depois ele volta: notificações fazem muita diferença no engajamento)
    try {
      const t = Number(localStorage.getItem('cdp-push-dismissed-at') || 0);
      setDismissed(Date.now() - t < 2 * 86400_000);
    } catch {}
  }, []);

  const on = async () => {
    setBusy(true);
    try {
      const s = await enablePush();
      setState(s);
      if (s === 'on') toast('Notificações ativadas! 🔔');
      else if (s === 'denied') toast('Permissão negada. Libere nas configurações do celular.', 'error');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const off = async () => {
    setBusy(true);
    try { setState(await disablePush()); toast('Notificações desativadas', 'info'); }
    catch (e) { toast(errMsg(e), 'error'); }
    finally { setBusy(false); }
  };

  if (!state || state === 'no-key') return null;

  if (variant === 'compact') {
    if (dismissed || state === 'on' || state === 'unsupported') return null;
    const close = () => { setDismissed(true); try { localStorage.setItem('cdp-push-dismissed-at', String(Date.now())); } catch {} };
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-terra to-[#e07a4f] p-4 text-white shadow-lg anim-rise">
        <button className="absolute right-1.5 top-1.5 rounded-full p-2.5 text-white/80" aria-label="Fechar" onClick={close}><X size={16} /></button>
        <div className="flex items-start gap-3 pr-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20"><BellRing size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-tight">
              {state === 'denied' ? 'Notificações bloqueadas' : 'Ative as notificações'}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/90">
              {state === 'denied'
                ? 'Libere nas configurações do celular (Notificações → este app) para receber os avisos do grupo.'
                : 'Lembrete do encontro, aviso antes de perder a sequência 🔥 e quem comentou nos seus posts.'}
            </p>
          </div>
        </div>
        {state === 'off' && (
          <button onClick={on} disabled={busy} className="btn mt-3 w-full bg-white !min-h-[44px] text-terra">
            {busy ? <Spinner className="h-4 w-4" /> : <><Bell size={17} /> Ativar agora</>}
          </button>
        )}
        {state === 'ios-install' && (
          <div className="mt-3 space-y-1.5 rounded-2xl bg-white/15 p-3 text-[13px] font-bold leading-snug">
            <p>No iPhone, as notificações só funcionam com o app instalado:</p>
            <p>1. Toque em <Share size={13} className="-mt-0.5 inline" /> <b>Compartilhar</b> (barra do Safari)</p>
            <p>2. Escolha <SquarePlus size={13} className="-mt-0.5 inline" /> <b>Adicionar à Tela de Início</b></p>
            <p>3. Abra o app pelo ícone e toque em <b>Ativar</b></p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${state === 'on' ? 'bg-olive/15 text-olive' : 'bg-sand text-[#8A6F57]'}`}>
          {state === 'on' ? <BellRing size={22} /> : <BellOff size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">Notificações</p>
          <p className="text-sm leading-snug text-[#8A6F57]">
            {state === 'on' && 'Ativadas neste celular.'}
            {state === 'off' && 'Lembrete no dia do encontro e avisos do adm.'}
            {state === 'denied' && 'Bloqueadas. Libere nas configurações do celular para este app.'}
            {state === 'unsupported' && 'Este navegador não suporta notificações.'}
            {state === 'ios-install' && 'No iPhone, primeiro instale o app na Tela de Início e abra por lá.'}
          </p>
        </div>
        {state === 'off' && <button className="btn-primary !min-h-[40px] !px-4 !text-sm" onClick={on} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Ativar'}</button>}
        {state === 'on' && <button className="btn-soft !min-h-[40px] !px-4 !text-sm" onClick={off} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : 'Desativar'}</button>}
      </div>
    </div>
  );
}
