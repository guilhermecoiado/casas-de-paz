'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, LogOut, Pencil, Settings } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { useAuth, useToast } from '@/components/Providers';
import { Avatar, PhotoPicker, ProgressBar, Sheet, Spinner } from '@/components/ui';
import { MemberTile } from '@/components/Tile';
import { PushToggle } from '@/components/PushToggle';
import { KIND_LABEL, fieldOf, kitItems, nextPathReward, rewardThreshold, type PathInfo, type Reward } from '@/lib/rewards';
import { Collection, EvolutionLine, Phrases } from '@/components/Evolution';
import { errMsg, supabase, uploadImage } from '@/lib/supabase';
import { squareAvatar } from '@/lib/image';


export default function Eu() {
  const router = useRouter();
  const toast = useToast();
  const { signOut, refreshProfile } = useAuth();
  const { group, me, members, profiles, stats, look, progress, myPoints, maxInd, unlocked, isAdmin, reloadProfiles } = useGroup();
  const member = members.find((m) => m.user_id === me);
  const prof = profiles[me];
  const l = look(me);
  const [saving, setSaving] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const nextReward = useMemo(() => nextPathReward(group, progress(me)), [group, progress, me]);

  const save = async (patch: Partial<Record<'title' | 'avatar_frame' | 'tile_frame' | 'tile_color' | 'tile_anim', string | null>>, key: string) => {
    if (!member) return;
    const cur = { title: member.title, avatar_frame: member.avatar_frame, tile_frame: member.tile_frame, tile_color: member.tile_color, tile_anim: member.tile_anim, ...patch };
    setSaving(key);
    const { error } = await supabase.rpc('set_cosmetics', {
      p_group: group.id, p_title: cur.title, p_avatar_frame: cur.avatar_frame, p_tile_frame: cur.tile_frame,
      p_tile_color: cur.tile_color, p_tile_anim: cur.tile_anim,
    });
    setSaving(null);
    if (error) toast(errMsg(error), 'error');
  };

  /** Toca para usar; toca de novo para tirar. */
  const equip = async (r: Reward) => {
    if (r.kind === 'phrase' || !member) return;
    const field = fieldOf(r.kind);
    const worn = r.kind === 'title' ? l.titleId === r.id : member[field] === r.id;
    await save({ [field]: worn ? null : r.id }, r.id);
  };

  const equipKit = async (path: PathInfo) => {
    const patch: Record<string, string> = {};
    kitItems(path.id).forEach((r) => { if (r.kind !== 'phrase') patch[fieldOf(r.kind)] = r.id; });
    await save(patch, `kit:${path.id}`);
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
          <MemberTile profile={prof} stats={stats.byUser[me]} look={l} alive={unlocked.has("tile_anim")} isAdmin={isAdmin} forcePosted />
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
            ? <>Próximo na evolução: <span className="text-terra">{nextReward.icon} {nextReward.name}</span> ({KIND_LABEL[nextReward.kind].toLowerCase()}) em {rewardThreshold(group, nextReward) - myPoints} pts</>
            : 'Linha da evolução completa! 👑'}
        </p>
      </section>

      <div className="mx-4 mt-4"><PushToggle /></div>

      <EvolutionLine member={member} titleId={l.titleId} kit={l.kit} onEquip={equip} onEquipKit={equipKit} saving={saving} />
      <Collection member={member} titleId={l.titleId} kit={l.kit} onEquip={equip} onEquipKit={equipKit} saving={saving} />
      <Phrases />

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
