'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Plus, Users, LogIn } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { Avatar, FullLoader, Sheet, Spinner } from '@/components/ui';
import { InstallHint } from '@/components/InstallHint';
import { errMsg, supabase } from '@/lib/supabase';

interface MyGroup { id: string; name: string; admin_id: string; }

export default function Grupos() {
  const router = useRouter();
  const toast = useToast();
  const { ready, userId, profile, signOut } = useAuth();
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [mode, setMode] = useState<'join' | 'create' | null>(null);
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!userId) return router.replace('/entrar');
    supabase
      .from('group_members')
      .select('groups(id,name,admin_id)')
      .eq('user_id', userId)
      .then(({ data }) => {
        const list = (data ?? []).map((r) => (r as unknown as { groups: MyGroup }).groups).filter(Boolean);
        setGroups(list);
      });
  }, [ready, userId, router]);

  const open = (id: string) => {
    try { localStorage.setItem('cdp-last-group', id); } catch {}
    router.push(`/g/${id}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create' && pw !== pw2) return toast('As senhas não conferem', 'error');
    setBusy(true);
    const { data, error } = await supabase.rpc(mode === 'create' ? 'create_group' : 'join_group', { p_name: name, p_password: pw });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    toast(mode === 'create' ? 'Grupo criado! Você é o administrador.' : 'Você entrou no grupo!');
    open(data as string);
  };

  if (!ready || groups === null) return <FullLoader />;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md px-5 pt-safe pb-safe">
      <header className="flex items-center gap-3 py-4">
        <Avatar url={profile?.avatar_url} name={profile?.name} size={44} />
        <div className="flex-1">
          <p className="text-sm text-[#8A6F57]">Olá,</p>
          <p className="font-extrabold leading-tight">{profile?.name}</p>
        </div>
        <button onClick={async () => { await signOut(); router.replace('/entrar'); }} className="rounded-full bg-sand p-2.5" aria-label="Sair">
          <LogOut size={18} />
        </button>
      </header>

      <h1 className="mt-4 font-display text-3xl font-extrabold">Seus grupos</h1>
      <p className="mt-1 text-[#6b5643]">Escolha o grupo da Casa de Paz.</p>

      <div className="mt-6 space-y-3">
        {groups.map((g) => (
          <button key={g.id} onClick={() => open(g.id)} className="card flex w-full items-center gap-4 p-4 text-left active:scale-[0.98]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terra/10 text-terra"><Users /></div>
            <div className="flex-1">
              <p className="font-extrabold">{g.name}</p>
              {g.admin_id === userId && <p className="text-xs font-bold text-terra">Administrador</p>}
            </div>
            <ChevronRight className="text-[#b9a690]" />
          </button>
        ))}
        {groups.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-[#e2cfb6] p-6 text-center text-[#8A6F57]">
            Você ainda não está em nenhum grupo.
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="btn-primary" onClick={() => { setMode('join'); setName(''); setPw(''); }}><LogIn size={18} /> Entrar</button>
        <button className="btn-soft" onClick={() => { setMode('create'); setName(''); setPw(''); setPw2(''); }}><Plus size={18} /> Criar grupo</button>
      </div>

      <div className="mt-8"><InstallHint /></div>

      <Sheet open={mode !== null} onClose={() => setMode(null)} title={mode === 'create' ? 'Criar novo grupo' : 'Entrar em um grupo'}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Nome do grupo</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={40} placeholder="Ex.: Casa de Paz Jardins" />
          </div>
          <div>
            <label className="label">Senha do grupo</label>
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={4} autoComplete="off" />
          </div>
          {mode === 'create' && (
            <div>
              <label className="label">Confirmar senha</label>
              <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={4} autoComplete="off" />
              <p className="mt-2 text-xs text-[#8A6F57]">Compartilhe o nome e a senha com os membros. Você poderá configurar datas, pontos e limites no painel do administrador.</p>
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : mode === 'create' ? 'Criar grupo' : 'Entrar'}</button>
        </form>
      </Sheet>
    </main>
  );
}
