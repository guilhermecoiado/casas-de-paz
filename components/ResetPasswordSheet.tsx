'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Share2 } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { errMsg, supabase } from '@/lib/supabase';
import { useToast } from './Providers';
import { Sheet, Spinner } from './ui';

const temp = () => `paz${Math.floor(1000 + Math.random() * 9000)}`;

/** Adm cria uma senha temporária para quem esqueceu a senha. */
export function ResetPasswordSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { group, profiles } = useGroup();
  const toast = useToast();
  const [pw, setPw] = useState(temp());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const p = userId ? profiles[userId] : null;

  useEffect(() => { if (userId) { setPw(temp()); setDone(false); } }, [userId]);

  const msg = `Oi, ${p?.name?.split(' ')[0] ?? ''}! Sua senha no app Casas de Paz foi redefinida.\nUsuário: @${p?.username}\nSenha: ${pw}\nDepois de entrar, você pode continuar usando essa senha.`;

  const save = async () => {
    if (pw.trim().length < 6) return toast('Mínimo de 6 caracteres', 'error');
    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ groupId: group.id, userId, password: pw.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Não foi possível redefinir');
      setDone(true);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share({ text: msg }); return; } catch { /* cancelou */ } }
    await navigator.clipboard?.writeText(msg);
    toast('Mensagem copiada');
  };

  return (
    <Sheet open={!!userId} onClose={onClose} title="Redefinir senha">
      {!done ? (
        <div className="space-y-4">
          <p className="text-sm leading-snug text-[#6b5643]">
            Crie uma senha nova para <b>{p?.name}</b> (@{p?.username}). A senha antiga deixa de funcionar na hora.
          </p>
          <div>
            <label className="label">Nova senha</label>
            <div className="flex gap-2">
              <input className="input font-mono" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" />
              <button className="btn-soft shrink-0 !px-4" onClick={() => setPw(temp())}>Gerar</button>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : <><KeyRound size={18} /> Redefinir senha</>}</button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-olive text-white"><Check size={28} strokeWidth={3} /></span>
          <p className="font-display text-xl font-bold">Senha redefinida!</p>
          <div className="rounded-2xl bg-cream p-3 text-left">
            <p className="text-xs font-bold text-[#a8927a]">Usuário</p>
            <p className="font-extrabold">@{p?.username}</p>
            <p className="mt-2 text-xs font-bold text-[#a8927a]">Senha</p>
            <p className="font-mono text-lg font-extrabold">{pw}</p>
          </div>
          <button className="btn-primary w-full" onClick={share}><Share2 size={18} /> Enviar para {p?.name?.split(' ')[0]}</button>
          <button className="btn-soft w-full" onClick={async () => { await navigator.clipboard?.writeText(pw); toast('Senha copiada'); }}><Copy size={16} /> Copiar só a senha</button>
        </div>
      )}
    </Sheet>
  );
}
