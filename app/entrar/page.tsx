'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AtSign, Lock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth, useToast } from '@/components/Providers';
import { Spinner } from '@/components/ui';
import { InstallHint } from '@/components/InstallHint';
import { ForgotPassword } from '@/components/ForgotPassword';
import { errMsg, supabase, usernameToEmail } from '@/lib/supabase';

export default function Entrar() {
  const router = useRouter();
  const toast = useToast();
  const { ready, userId } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && userId) router.replace('/');
  }, [ready, userId, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    router.replace('/');
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="anim-pop"><Logo size={84} /></div>
        <h1 className="mt-6 font-display text-[40px] font-extrabold leading-[1.05]">Casas<br />de Paz</h1>
        <p className="mt-3 text-[17px] text-[#6b5643]">Quatro semanas para encher a casa. Entre e some pontos com o seu grupo.</p>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <div className="relative">
            <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b9a690]" size={20} />
            <input
              className="input pl-12" placeholder="usuario" autoCapitalize="none" autoCorrect="off" autoComplete="username"
              value={username} onChange={(e) => setUsername(e.target.value)} required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b9a690]" size={20} />
            <input
              className="input pl-12" type="password" placeholder="senha" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : 'Entrar'}</button>
        </form>
        <Link href="/cadastro" className="btn-soft mt-3 w-full">Criar minha conta</Link>
        <ForgotPassword initial={username} />
      </div>
      <InstallHint />
    </main>
  );
}
