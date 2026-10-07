'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, CircleHelp, LogOut, Pencil, Settings } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { useAuth, useToast } from '@/components/Providers';
import { Avatar, PhotoPicker, ProgressBar, Sheet, Spinner } from '@/components/ui';
import { MemberTile } from '@/components/Tile';
import { PushToggle } from '@/components/PushToggle';
import { StreakCard } from '@/components/StreakCard';
import { ChangePassword } from '@/components/ChangePassword';
import { rewardById, nextPathReward, rewardThreshold, type PathInfo } from '@/lib/rewards';
import { useEquip } from '@/lib/use-equip';
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
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  const nextReward = useMemo(() => nextPathReward(group, progress(me)), [group, progress, me]);

  const { saving, equip, equipKit: wearKit } = useEquip();
  const equipKit = async (path: PathInfo) => { await wearKit(path.id); };

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

      {/* cabeçalho estilo perfil: uma foto só, com a moldura equipada */}
      <section className="mx-4 mt-4">
        <div className="flex items-center gap-4">
          <Avatar url={prof?.avatar_url} name={prof?.name} size={84} frame={l.avatarFrame} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-2xl font-extrabold leading-tight">{prof?.name}</p>
            <p className="truncate text-sm font-bold text-[#a8927a]">@{prof?.username}</p>
            <span className="chip mt-1.5 bg-amber/20 text-[#9a5b00]">{rewardById(l.titleId)?.icon} {l.title}{isAdmin ? ' · Adm' : ''}</span>
          </div>
        </div>
        {prof?.bio && <p className="mt-3 text-[15px] leading-snug text-[#6b5643]">{prof.bio}</p>}

        <div className="mt-4 grid grid-cols-3 divide-x divide-sand rounded-2xl bg-white py-3 text-center">
          {[
            ['check-ins', stats.byUser[me]?.checkins ?? 0],
            ['convidados', stats.byUser[me]?.guests ?? 0],
            ['evangelismos', stats.byUser[me]?.evangelism ?? 0],
          ].map(([k, v]) => (
            <div key={k as string}>
              <p className="font-display text-xl font-extrabold leading-none">{v}</p>
              <p className="mt-1 text-[11px] font-bold text-[#a8927a]">{k}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setName(prof?.name ?? ''); setBio(prof?.bio ?? ''); setPhoto(null); setEdit(true); }}
          className="btn-soft mt-3 w-full !min-h-[42px] !text-sm"
        >
          <Pencil size={15} /> Editar perfil
        </button>
      </section>

      <div className="mx-4 mt-4"><StreakCard /></div>

      {/* evolução + prévia de como o grupo vê o seu tile */}
      <section className="card mx-4 mt-4 flex gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#a8927a]">Sua evolução</p>
          <p className="font-display text-3xl font-extrabold leading-tight">{myPoints} <span className="text-base text-[#a8927a]">/ {maxInd}</span></p>
          <div className="mt-2"><ProgressBar value={myPoints} max={maxInd} color="bg-amber" /></div>
          {(stats.byUser[me]?.pending ?? 0) > 0 && <span className="chip mt-2 bg-amber/20 text-[#9a5b00]">{stats.byUser[me]!.pending} pts em votação</span>}
          {nextReward ? (
            <>
              <p className="mt-2 truncate whitespace-nowrap text-[13px] font-bold text-[#6b5643]">Próximo: <span className="text-terra">{nextReward.icon} {nextReward.name}</span></p>
              <p className="truncate whitespace-nowrap text-[12px] font-bold text-[#a8927a]">faltam {rewardThreshold(group, nextReward) - myPoints} pts</p>
            </>
          ) : <p className="mt-2 truncate whitespace-nowrap text-[13px] font-bold text-[#6b5643]">Linha da evolução completa! 👑</p>}
        </div>
        <div className="w-[92px] shrink-0">
          <MemberTile profile={prof} stats={stats.byUser[me]} look={l} alive={unlocked.has('tile_anim')} isAdmin={false} forcePosted compact />
          <p className="mt-1.5 whitespace-nowrap text-center text-[10px] font-bold leading-tight text-[#a8927a]">como o grupo vê</p>
        </div>
      </section>

      <div className="mx-4 mt-4"><PushToggle /></div>
      <Link href={`/g/${group.id}/como-funciona`} className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 font-extrabold shadow-sm">
        <CircleHelp size={20} className="text-terra" /> Como funciona a gincana
      </Link>
      <ChangePassword />

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
