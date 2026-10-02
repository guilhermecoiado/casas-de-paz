'use client';

import { useState } from 'react';
import { AtSign, Check, KeyRound } from 'lucide-react';
import { errMsg } from '@/lib/supabase';
import { useToast } from './Providers';
import { Sheet, Spinner } from './ui';

/** Tela de login: pede uma senha nova ao adm do grupo (sem e-mail). */
export function ForgotPassword({ initial = '' }: { initial?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Não foi possível enviar o pedido');
      setSent(true);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => { setUsername((u) => u || initial); setSent(false); setOpen(true); }} className="mt-4 w-full text-center text-sm font-extrabold text-terra">
        Esqueci minha senha
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Esqueci minha senha">
        {!sent ? (
          <div className="space-y-4">
            <p className="text-[15px] leading-snug text-[#6b5643]">
              Digite o seu @usuário. O administrador do seu grupo recebe um aviso, cria uma senha nova e manda para você (pelo WhatsApp, por exemplo).
            </p>
            <div className="relative">
              <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a8927a]" />
              <input
                className="input !pl-11"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="seu.usuario"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <button className="btn-primary w-full" onClick={send} disabled={busy || username.replace('@', '').length < 3}>
              {busy ? <Spinner /> : <><KeyRound size={18} /> Pedir senha nova</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive text-white"><Check size={28} strokeWidth={3} /></span>
            <p className="font-display text-xl font-bold">Pedido enviado!</p>
            <p className="text-[15px] leading-snug text-[#6b5643]">O administrador vai criar uma senha nova e mandar para você. Depois de entrar, troque a senha em <b>Meu perfil → Trocar senha</b>.</p>
            <button className="btn-soft w-full" onClick={() => setOpen(false)}>Ok</button>
          </div>
        )}
      </Sheet>
    </>
  );
}
