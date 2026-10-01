'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Share2, Sparkles, Star, X } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { daysBetween, formatDate } from '@/lib/game';
import { weekSummary } from '@/lib/recap';
import { recapShareImage, shareImage } from '@/lib/image';
import { errMsg } from '@/lib/supabase';
import { useToast } from './Providers';
import { Avatar, Spinner } from './ui';

/** Card do fechamento da semana: aparece nos 3 primeiros dias da semana nova (ou vindo da notificação). */
export function WeekRecap({ houseRef }: { houseRef: React.RefObject<HTMLElement> }) {
  const { group, members, posts, profiles, look, stats, today } = useGroup();
  const toast = useToast();
  const asked = Number(useSearchParams()?.get('recap') ?? 0);
  const prev = asked || stats.week - 1;
  const dayOfWeek = daysBetween(group.start_date, today) % 7;
  const key = `cdp-recap-${group.id}-${prev}`;
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(key) === '1'; } catch { /* sem storage */ }
    setHidden(!asked && (dismissed || dayOfWeek > 2));
  }, [key, asked, dayOfWeek]);

  const s = useMemo(() => (prev >= 1 ? weekSummary(group, members, posts, prev) : null), [group, members, posts, prev]);
  if (!s || hidden || !s.posters || today < group.start_date) return null;

  const dates = `${formatDate(s.from)} – ${formatDate(s.to)}`;
  const starName = (id: string) => profiles[id]?.name?.split(' ')[0] ?? '…';

  const share = async () => {
    setBusy(true);
    try {
      const b = await recapShareImage({
        groupName: group.name, week: s.week, dates, teamPoints: s.teamPoints, checkins: s.checkins, guests: s.guests,
        posters: s.posters, members: s.members,
        star: s.top.length ? `${s.top.map((t) => starName(t.id)).join(' e ')} · ${s.top[0].points} pts` : null,
        houseSvg: houseRef.current?.querySelector('svg') ?? null,
      });
      await shareImage(b, `semana-${s.week}.jpg`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b2118] to-[#5a3a26] p-4 text-white shadow-lg anim-rise">
      <button
        onClick={() => { try { localStorage.setItem(key, '1'); } catch { /* ok */ } setHidden(true); }}
        className="absolute right-3 top-3 rounded-full bg-white/10 p-1.5" aria-label="Fechar"
      >
        <X size={16} />
      </button>
      <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-amber"><Sparkles size={14} /> Fechamento</p>
      <h2 className="font-display text-2xl font-extrabold">Semana {s.week} fechada!</h2>
      <p className="text-xs font-bold text-white/60">{dates}</p>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          [s.teamPoints.toLocaleString('pt-BR'), 'pts da equipe'],
          [s.checkins, 'check-ins'],
          [s.guests, 'convidados'],
          [`${s.posters}/${s.members}`, 'postaram'],
        ].map(([v, l]) => (
          <div key={l as string} className="rounded-2xl bg-white/10 px-1 py-2">
            <p className="font-display text-lg font-extrabold leading-none">{v}</p>
            <p className="mt-1 text-[10px] font-bold leading-tight text-white/70">{l}</p>
          </div>
        ))}
      </div>

      {s.top.length > 0 && (
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white/10 p-2.5">
          <div className="flex -space-x-2">
            {s.top.map((t) => <span key={t.id} className="rounded-full ring-2 ring-[#3d2a1c]"><Avatar url={profiles[t.id]?.avatar_url} name={profiles[t.id]?.name} size={36} frame={look(t.id).avatarFrame} /></span>)}
          </div>
          <p className="min-w-0 flex-1 text-sm font-bold leading-snug">
            <Star size={14} className="-mt-0.5 mr-1 inline text-amber" fill="currentColor" />Destaque: <b>{s.top.map((t) => starName(t.id)).join(' e ')}</b> com {s.top[0].points} pts
            {s.topGuests && <><br /><span className="text-white/75">🙌 Mais convidados: {starName(s.topGuests.id)} ({s.topGuests.guests})</span></>}
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={share} disabled={busy} className="btn !min-h-[44px] bg-amber !text-sm text-ink">{busy ? <Spinner /> : <><Share2 size={16} /> Compartilhar</>}</button>
        <Link href={`/g/${group.id}/ranking?tab=destaques`} className="btn !min-h-[44px] bg-white/15 !text-sm text-white">Ver destaques</Link>
      </div>
    </section>
  );
}
