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
    try { setDismissed(localStorage.getItem('cdp-push-dismissed') === '1'); } catch {}
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
    if (dismissed || state === 'on' || state === 'unsupported' || state === 'denied') return null;
    return (
      <div className="card relative flex items-center gap-3 p-4 anim-rise">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber/20 text-terra"><BellRing size={22} /></span>
        <div className="min-w-0 flex-1 pr-4">
          <p className="font-extrabold leading-tight">Receba o lembrete do encontro</p>
          {state === 'ios-install' ? (
            <p className="text-xs leading-snug text-[#8A6F57]">No iPhone, instale o app: <Share size={12} className="inline -mt-0.5" /> Compartilhar → <SquarePlus size={12} className="inline -mt-0.5" /> Tela de Início</p>
          ) : (
            <button onClick={on} disabled={busy} className="mt-1 flex items-center gap-1 text-sm font-extrabold text-terra">
              {busy ? <Spinner className="h-4 w-4" /> : <Bell size={15} />} Ativar notificações
            </button>
          )}
        </div>
        <button
          className="absolute right-3 top-3 text-[#b9a690]"
          aria-label="Fechar"
          onClick={() => { setDismissed(true); try { localStorage.setItem('cdp-push-dismissed', '1'); } catch {} }}
        >
          <X size={16} />
        </button>
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
