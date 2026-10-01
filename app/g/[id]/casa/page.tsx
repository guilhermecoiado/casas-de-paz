'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, Lock, PartyPopper, Share2 } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { GROUP_UNLOCKS, groupThreshold, totalWeeks } from '@/lib/game';
import { House } from '@/components/House';
import { ProgressBar, Sheet, Spinner } from '@/components/ui';
import { useToast } from '@/components/Providers';
import { houseShareImage, shareImage } from '@/lib/image';
import { errMsg } from '@/lib/supabase';
import { Confetti } from '@/components/Confetti';

export default function Casa() {
  const { group, stats, unlocked, maxGrp, posts, members } = useGroup();
  const [party, setParty] = useState(0);
  const houseRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // última foto em grupo registrada (cai para o último check-in com foto)
  const lastPhoto = useMemo(() => {
    const ok = posts.filter((p) => p.photo_url && (p.status === 'ok' || p.status === 'voting'));
    const pick = ok.find((p) => p.type === 'group') ?? ok.find((p) => p.type === 'checkin');
    return pick ?? null;
  }, [posts]);

  const openShare = async () => {
    const svg = houseRef.current?.querySelector('svg');
    if (!svg) return;
    setShareOpen(true);
    if (blob) return;
    setBusy(true);
    try {
      const date = lastPhoto ? new Date(`${lastPhoto.local_date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : undefined;
      const b = await houseShareImage(svg, {
        groupName: group.name,
        points: stats.groupPoints,
        members: members.length,
        groupPhoto: lastPhoto?.photo_url ?? null,
        photoDate: date,
      });
      setBlob(b);
      setPreview(URL.createObjectURL(b));
    } catch (e) {
      toast(errMsg(e), 'error');
      setShareOpen(false);
    } finally {
      setBusy(false);
    }
  };
  const parts = useMemo(() => new Set(GROUP_UNLOCKS.filter((u) => unlocked.has(u.id)).map((u) => u.part ?? u.id)), [unlocked]);
  const pct = maxGrp ? Math.min(100, Math.round((stats.groupPoints / maxGrp) * 100)) : 0;
  const complete = unlocked.has('complete');

  return (
    <div className="pt-safe">
      {party > 0 && <Confetti key={party} duration={5000} />}
      <header className="px-4 pt-3">
        <h1 className="font-display text-[26px] font-extrabold">Nossa Casa</h1>
        <p className="text-sm font-bold text-[#8A6F57]">Cada ponto da equipe constrói um pedaço.</p>
      </header>

      <div ref={houseRef} className="mx-4 mt-4 overflow-hidden rounded-[28px] shadow-lg">
        <House parts={parts} className="w-full" />
      </div>

      <div className="card mx-4 mt-4 p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#a8927a]">Equipe</p>
            <p className="font-display text-3xl font-extrabold">{stats.groupPoints.toLocaleString('pt-BR')} <span className="text-base text-[#a8927a]">pts</span></p>
          </div>
          <p className="font-display text-4xl font-extrabold text-terra">{pct}%</p>
        </div>
        <div className="mt-3"><ProgressBar value={stats.groupPoints} max={maxGrp} height={18} /></div>
        <p className="mt-2 text-xs font-bold text-[#a8927a]">
          Meta: {maxGrp.toLocaleString('pt-BR')} pts · até {stats.teamWeekCap.toLocaleString('pt-BR')}/semana em {totalWeeks(group)} semanas
        </p>
        {complete && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-primary w-full" onClick={openShare}><Share2 size={18} /> Compartilhar</button>
            <button className="btn-soft w-full" onClick={() => setParty((p) => p + 1)}><PartyPopper size={18} /> Comemorar</button>
          </div>
        )}
      </div>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="Compartilhar a casa">
        <div className="relative mx-auto w-full max-w-[300px]">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Casa completa com moldura" className="w-full rounded-2xl shadow-xl" />
          ) : (
            <div className="aspect-[4/5] w-full rounded-2xl bg-sand" />
          )}
          {busy && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/40"><Spinner className="h-7 w-7 text-terra" /></div>}
        </div>
        <button className="btn-primary mt-4 w-full" disabled={!blob || busy} onClick={() => blob && shareImage(blob, 'casa-de-paz-completa.jpg')}>
          <Share2 size={18} /> Compartilhar no Instagram
        </button>
      </Sheet>

      <ol className="relative mx-4 mt-6 space-y-3 border-l-2 border-dashed border-[#e2cfb6] pl-5">
        {GROUP_UNLOCKS.map((u) => {
          const ok = unlocked.has(u.id);
          const need = groupThreshold(maxGrp, u);
          return (
            <li key={u.id} className="relative">
              <span className={`absolute -left-[33px] top-3 flex h-6 w-6 items-center justify-center rounded-full ${ok ? 'bg-olive text-white' : 'bg-sand text-[#a8927a]'}`}>
                {ok ? <Check size={14} strokeWidth={3} /> : <Lock size={12} />}
              </span>
              <div className={`rounded-2xl p-3 ${ok ? 'bg-white' : 'bg-white/50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-extrabold ${ok ? '' : 'text-[#8A6F57]'}`}>{u.name}</p>
                  <span className={`chip ${ok ? 'bg-olive/15 text-olive' : 'bg-sand text-[#8A6F57]'}`}>{need.toLocaleString('pt-BR')} pts</span>
                </div>
                <p className="text-sm text-[#8A6F57]">{u.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
