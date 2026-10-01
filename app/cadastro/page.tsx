'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { PhotoPicker, Spinner } from '@/components/ui';
import { errMsg, normalizeUsername, supabase, uploadImage, usernameToEmail } from '@/lib/supabase';
import { squareAvatar } from '@/lib/image';

export default function Cadastro() {
  const router = useRouter();
  const toast = useToast();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const uname = normalizeUsername(username);
  const validUser = /^[a-z0-9_.]{3,24}$/.test(uname);

  const next = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validUser) return toast('Use 3 a 24 letras minúsculas, números, _ ou .', 'error');
    if (password.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres', 'error');
    setBusy(true);
    const { data, error } = await supabase.rpc('username_available', { p_username: uname });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    if (!data) return toast('Esse @usuário já existe', 'error');
    setStep(2);
  };

  const finish = async () => {
    if (!photo) return toast('Adicione uma foto de perfil', 'error');
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: usernameToEmail(uname),
        password,
        options: { data: { username: uname, name: name.trim() } },
      });
      if (error) throw error;
      if (!data.session) throw new Error('Conta criada, mas sem sessão. Desative "Confirm email" no Supabase (veja o README).');
      const uid = data.session.user.id;
      const avatar_url = await uploadImage(uid, await squareAvatar(photo), 'avatar');
      const { error: e2 } = await supabase.from('profiles').update({ avatar_url, bio: bio.trim() }).eq('id', uid);
      if (e2) throw e2;
      await refreshProfile();
      toast('Bem-vindo(a)! 🎉');
      router.replace('/grupos');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md px-6 pt-safe pb-safe">
      <div className="flex items-center gap-3 py-3">
        {step === 1 ? (
          <Link href="/entrar" className="rounded-full bg-sand p-2.5" aria-label="Voltar"><ArrowLeft size={20} /></Link>
        ) : (
          <button onClick={() => setStep(1)} className="rounded-full bg-sand p-2.5" aria-label="Voltar"><ArrowLeft size={20} /></button>
        )}
        <div className="flex flex-1 gap-1.5">
          <div className="h-1.5 flex-1 rounded-full bg-terra" />
          <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? 'bg-terra' : 'bg-sand'}`} />
        </div>
      </div>

      {step === 1 ? (
        <form onSubmit={next} className="anim-rise">
          <h1 className="mt-4 font-display text-3xl font-extrabold">Criar conta</h1>
          <p className="mt-1 text-[#6b5643]">Seus dados de acesso.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Nome</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como te chamam" required maxLength={60} autoComplete="name" />
            </div>
            <div>
              <label className="label">Usuário</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#b9a690]">@</span>
                <input
                  className="input pl-9" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="seu.usuario" required autoCapitalize="none" autoCorrect="off" autoComplete="username" maxLength={25}
                />
              </div>
              {username && !validUser && <p className="mt-1 text-xs font-bold text-terra">3 a 24 caracteres: letras, números, _ ou .</p>}
            </div>
            <div>
              <label className="label">Senha</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" required autoComplete="new-password" />
            </div>
          </div>
          <button className="btn-primary mt-8 w-full" disabled={busy}>{busy ? <Spinner /> : 'Continuar'}</button>
        </form>
      ) : (
        <div className="anim-rise">
          <h1 className="mt-4 font-display text-3xl font-extrabold">Seu perfil</h1>
          <p className="mt-1 text-[#6b5643]">Essa foto aparece no seu tile do grupo.</p>
          <div className="mt-6"><PhotoPicker value={photo} onChange={setPhoto} round /></div>
          <div className="mt-6">
            <label className="label">Bio</label>
            <textarea className="input min-h-[96px] resize-none" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} placeholder="Uma frase sobre você" />
            <p className="mt-1 text-right text-xs text-[#b9a690]">{bio.length}/160</p>
          </div>
          <button className="btn-primary mt-6 w-full" onClick={finish} disabled={busy}>{busy ? <Spinner /> : 'Criar conta'}</button>
        </div>
      )}
    </main>
  );
}
