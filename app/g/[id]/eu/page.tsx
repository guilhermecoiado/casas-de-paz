'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Check, Lock, LogOut, Pencil, Settings } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { useAuth, useToast } from '@/components/Providers';
import { Avatar, PhotoPicker, ProgressBar, Sheet, Spinner } from '@/components/ui';
import { MemberTile } from '@/components/Tile';
import { PushToggle } from '@/components/PushToggle';
import { REWARDS, REWARD_KIND_LABEL, isRewardUnlocked, rewardThreshold, type RewardKind } from '@/lib/game';
import { errMsg, supabase, uploadImage } from '@/lib/supabase';
import { squareAvatar } from '@/lib/image';

const KINDS: RewardKind[] = ['title', 'avatar_frame', 'tile_color', 'tile_frame', 'tile_anim'];
const FIELD: Record<RewardKind, 'title' | 'avatar_frame' | 'tile_frame' | 'tile_color' | 'tile_anim'> = {
  title: 'title', avatar_frame: 'avatar_frame', tile_frame: 'tile_frame', tile_color: 'tile_color', tile_anim: 'tile_anim',
};

export default function Eu() {
  const router = useRouter();
  const toast = useToast();
  const { signOut, refreshProfile } = useAuth();
  const { group, me, members, profiles, stats, look, myPoints, maxInd, unlocked, isAdmin, reloadProfiles } = useGroup();
  const member = members.find((m) => m.user_id === me);
  const prof = profiles[me];
  const l = look(me);
  const [saving, setSaving] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const nextReward = useMemo(
    () => REWARDS.filter((r) => !isRewardUnlocked(group, r, myPoints)).sort((a, b) => a.pct - b.pct)[0],
    [group, myPoints],
  );

  const equip = async (kind: RewardKind, id: string) => {
    if (!member) return;
    const field = FIELD[kind];
    const current = member[field];
    const nextVal = kind === 'title' ? id : current === id ? null : id;
    const payload = {
      p_group: group.id,
      p_title: member.title, p_avatar_frame: member.avatar_frame, p_tile_frame: member.tile_frame,
      p_tile_color: member.tile_color, p_tile_anim: member.tile_anim,
      [`p_${field}`]: nextVal,
    };
    setSaving(id);
    const { error } = await supabase.rpc('set_cosmetics', payload);
    setSaving(null);
    if (error) toast(errMsg(error), 'error');
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      const upd: { name: string; bio: string; avatar_url?: string } = { name: name.trim() || prof?.name || '', bio: bio.trim() };
      if (photo) upd.avatar_url = await uploadImage(me, await squareAvatar(photo), 'avatar');
      const { error } = await supabase.from('profiles').update(upd).eq('id', me);
      if (error) throw error;
      await Promise.all([reloadProfiles(), refreshProfile()]);
      setEdit(false);
      toast('Perfil atualizado');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-safe">
      <header className="flex items-center justify-between px-4 pt-3">
        <h1 className="font-display text-[26px] font-extrabold">Meu perfil</h1>
        <div className="flex gap-2">
          {isAdmin && <Link href={`/g/${group.id}/admin`} className="rounded-full bg-sand p-2.5" aria-label="Administração"><Settings size={20} /></Link>}
          <Link href="/grupos" className="rounded-full bg-sand p-2.5" aria-label="Trocar grupo"><ArrowLeftRight size={20} /></Link>
          <button onClick={async () => { await signOut(); router.replace('/entrar'); }} className="rounded-full bg-sand p-2.5" aria-label="Sair"><LogOut size={20} /></button>
        </div>
      </header>

      <section className="mx-4 mt-4 flex gap-4">
        <div className="w-[118px] shrink-0">
          <MemberTile profile={prof} stats={stats.byUser[me]} look={l} alive={unlocked.has('tile_anim')} isAdmin={isAdmin} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Avatar url={prof?.avatar_url} name={prof?.name} size={44} frame={l.avatarFrame} />
            <button onClick={() => { setName(prof?.name ?? ''); setBio(prof?.bio ?? ''); setPhoto(null); setEdit(true); }} className="chip bg-sand text-[#6b5643]">
              <Pencil size={12} /> Editar
            </button>
          </div>
          <p className="mt-2 truncate font-extrabold">{prof?.name}</p>
          <p className="truncate text-sm font-bold text-[#a8927a]">@{prof?.username}</p>
          {prof?.bio && <p className="mt-1 line-clamp-3 text-sm text-[#6b5643]">{prof.bio}</p>}
        </div>
      </section>

      <section className="card mx-4 mt-4 p-4">
        <div className="flex items-end justify-between">
          <p className="font-display text-3xl font-extrabold">{myPoints} <span className="text-base text-[#a8927a]">/ {maxInd} pts</span></p>
          {(stats.byUser[me]?.pending ?? 0) > 0 && <span className="chip bg-amber/20 text-[#9a5b00]">{stats.byUser[me]!.pending} em votação</span>}
        </div>
        <div className="mt-2"><ProgressBar value={myPoints} max={maxInd} color="bg-amber" /></div>
        <p className="mt-2 text-sm font-bold text-[#6b5643]">
          {nextReward
            ? <>Próximo prêmio: <span className="text-terra">{nextReward.name}</span> ({REWARD_KIND_LABEL[nextReward.kind].toLowerCase()}) em {rewardThreshold(group, nextReward) - myPoints} pts</>
            : 'Todos os prêmios desbloqueados! 👑'}
        </p>
      </section>

      <div className="mx-4 mt-4"><PushToggle /></div>

      {KINDS.map((kind) => (
        <section key={kind} className="mx-4 mt-6">
          <h2 className="mb-2 font-display text-lg font-bold">{REWARD_KIND_LABEL[kind]}</h2>
          <div className="grid grid-cols-3 gap-2">
            {REWARDS.filter((r) => r.kind === kind).map((r) => {
              const ok = isRewardUnlocked(group, r, myPoints);
              const active = kind === 'title' ? l.title === r.id : member?.[FIELD[kind]] === r.id;
              return (
                <button
                  key={r.id}
                  disabled={!ok || saving !== null}
                  onClick={() => equip(kind, r.id)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2.5 text-center transition active:scale-95 ${
                    active ? 'border-terra bg-white' : 'border-transparent bg-white/70'
                  } ${ok ? '' : 'opacity-60'}`}
                >
                  <RewardPreview kind={kind} id={r.id} url={prof?.avatar_url} name={prof?.name} />
                  <span className="text-xs font-extrabold leading-tight">{r.name}</span>
                  {!ok && <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#a8927a]"><Lock size={10} /> {rewardThreshold(group, r)} pts</span>}
                  {active && <span className="absolute right-1.5 top-1.5 rounded-full bg-terra p-0.5 text-white"><Check size={10} strokeWidth={4} /></span>}
                  {saving === r.id && <Spinner className="absolute h-4 w-4 text-terra" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <Sheet open={edit} onClose={() => setEdit(false)} title="Editar perfil">
        <div className="space-y-4">
          <PhotoPicker value={photo} onChange={setPhoto} round />
          <div>
            <label className="label">Nome</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input min-h-[90px] resize-none" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} />
          </div>
          <button className="btn-primary w-full" onClick={saveProfile} disabled={busy}>{busy ? <Spinner /> : 'Salvar'}</button>
        </div>
      </Sheet>
    </div>
  );
}

function RewardPreview({ kind, id, url, name }: { kind: RewardKind; id: string; url?: string | null; name?: string }) {
  if (kind === 'title') return <span className="flex h-12 items-center text-2xl">🏅</span>;
  if (kind === 'avatar_frame') return <Avatar url={url} name={name} size={40} frame={id} />;
  const cls = kind === 'tile_color' ? id : kind === 'tile_frame' ? `tc-default ${id}` : `tc-amber ${id}`;
  return <span className={`block h-12 w-10 rounded-xl ${cls}`} style={{ boxShadow: kind === 'tile_frame' ? undefined : 'inset 0 0 0 1px rgba(0,0,0,.06)' }} />;
}
