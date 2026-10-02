'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { errMsg, supabase } from '@/lib/supabase';
import { useToast } from './Providers';
import { Sheet, Spinner } from './ui';

/** Perfil: a pessoa troca a própria senha (ex.: depois de receber uma senha temporária). */
export function ChangePassword() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (pw.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres', 'error');
    if (pw !== pw2) return toast('As duas senhas não são iguais', 'error');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    toast('Senha trocada!');
    setPw(''); setPw2(''); setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-white p-3 text-left font-extrabold shadow-sm">
        <KeyRound size={20} className="text-terra" /> Trocar senha
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Trocar senha">
        <div className="space-y-3">
          <div>
            <label className="label">Nova senha</label>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="mínimo 6 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Repita a nova senha</label>
            <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="btn-primary w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Salvar nova senha'}</button>
        </div>
      </Sheet>
    </>
  );
}
