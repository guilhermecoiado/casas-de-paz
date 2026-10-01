'use client';

import { useMemo } from 'react';
import { useGroup } from '@/lib/group-context';
import { addDays } from '@/lib/game';
import { Avatar } from './ui';

interface Card {
  id: string;
  icon: string;
  title: string;
  desc: string;
  unit: (n: number) => string;
  value: (uid: string) => number;
  bg: string;
}

/** Destaques da semana: várias formas de brilhar além do total de pontos. */
export function Highlights({ onSelect }: { onSelect: (uid: string) => void }) {
  const { members, profiles, stats, look, posts, comments, reactions, today, me } = useGroup();
  const week = stats.week;

  const data = useMemo(() => {
    const lastWeek = new Map<string, number>();
    const thisWeek = new Map<string, number>();
    posts.forEach((p) => {
      if (p.status === 'cancelled') return;
      if (p.week === week) thisWeek.set(p.user_id, (thisWeek.get(p.user_id) ?? 0) + p.points);
      if (p.week === week - 1) lastWeek.set(p.user_id, (lastWeek.get(p.user_id) ?? 0) + p.points);
    });
    // carinho no feed: comentários e reações nos posts dos outros nos últimos 7 dias
    const since = addDays(today, -6);
    const ownerOf = new Map(posts.map((p) => [p.id, p.user_id]));
    const care = new Map<string, number>();
    comments.forEach((c) => {
      if (c.created_at.slice(0, 10) >= since && ownerOf.get(c.post_id) !== c.user_id) care.set(c.user_id, (care.get(c.user_id) ?? 0) + 1);
    });
    reactions.forEach((r) => {
      if ((r.created_at || '').slice(0, 10) >= since && ownerOf.get(r.post_id) !== r.user_id) care.set(r.user_id, (care.get(r.user_id) ?? 0) + 1);
    });
    return { lastWeek, thisWeek, care };
  }, [posts, comments, reactions, week, today]);

  const cards: Card[] = [
    { id: 'week', icon: '🚀', title: 'Mais pontos na semana', desc: `Semana ${week}`, unit: (n) => `${n} pts`, value: (u) => data.thisWeek.get(u) ?? 0, bg: 'from-[#fff1dc] to-[#ffe0b8]' },
    ...(week > 1 ? [{ id: 'grow', icon: '📈', title: 'Quem mais cresceu', desc: `comparado à semana ${week - 1}`, unit: (n: number) => `+${n} pts`, value: (u: string) => (data.thisWeek.get(u) ?? 0) - (data.lastWeek.get(u) ?? 0), bg: 'from-[#e9f5df] to-[#d3ebc0]' }] : []),
    { id: 'guests', icon: '🙌', title: 'Mais convidados', desc: 'trouxe gente nova nesta semana', unit: (n) => `${n} convidado${n === 1 ? '' : 's'}`, value: (u) => stats.byUser[u]?.weekGuests ?? 0, bg: 'from-[#e5f1fb] to-[#cfe6f5]' },
    { id: 'streak', icon: '🔥', title: 'Maior sequência', desc: 'dias seguidos postando', unit: (n) => `${n} dia${n === 1 ? '' : 's'}`, value: (u) => stats.byUser[u]?.streak ?? 0, bg: 'from-[#ffe3d3] to-[#ffc7a8]' },
    { id: 'days', icon: '📅', title: 'Mais constante', desc: 'dias com post nesta semana', unit: (n) => `${n} de 7 dias`, value: (u) => stats.byUser[u]?.weekDays ?? 0, bg: 'from-[#f3ecfb] to-[#e3d2f4]' },
    { id: 'care', icon: '💬', title: 'Mais encorajador', desc: 'comentários e reações nos posts dos outros', unit: (n) => `${n} interaç${n === 1 ? 'ão' : 'ões'}`, value: (u) => data.care.get(u) ?? 0, bg: 'from-[#fdeef2] to-[#f9d6e0]' },
  ];

  return (
    <div className="space-y-3 px-4 pb-6 pt-4">
      {cards.map((c) => {
        const ranked = members.map((m) => ({ id: m.user_id, v: c.value(m.user_id) })).filter((r) => r.v > 0).sort((a, b) => b.v - a.v);
        const top = ranked[0];
        const tied = top ? ranked.filter((r) => r.v === top.v) : [];
        const runners = ranked.filter((r) => r.v !== top?.v).slice(0, 2);
        const mine = ranked.findIndex((r) => r.id === me);
        return (
          <section key={c.id} className={`overflow-hidden rounded-3xl bg-gradient-to-br ${c.bg} p-4`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{c.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-extrabold leading-tight">{c.title}</p>
                <p className="text-xs font-bold text-[#8A6F57]">{c.desc}</p>
              </div>
            </div>
            {top ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tied.slice(0, 4).map((t) => (
                    <button key={t.id} onClick={() => onSelect(t.id)} className={`flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/80 p-2.5 text-left ${tied.length > 1 ? 'basis-[calc(50%-4px)]' : 'flex-1'}`}>
                      <Avatar url={profiles[t.id]?.avatar_url} name={profiles[t.id]?.name} size={tied.length > 1 ? 36 : 44} frame={look(t.id).avatarFrame} />
                      <div className="min-w-0">
                        <p className="truncate font-extrabold leading-tight">{profiles[t.id]?.name?.split(' ')[0]}{t.id === me ? ' (você)' : ''}</p>
                        <p className="text-sm font-black text-terra">{c.unit(t.v)}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {runners.length > 0 && (
                  <p className="mt-2 text-xs font-bold text-[#8A6F57]">
                    Logo atrás: {runners.map((r) => `${profiles[r.id]?.name?.split(' ')[0]} (${c.unit(r.v)})`).join(' · ')}
                  </p>
                )}
                {mine > 0 && !tied.some((t) => t.id === me) && (
                  <p className="mt-1 text-xs font-extrabold text-[#6b5643]">Você: {c.unit(ranked[mine].v)}</p>
                )}
              </>
            ) : (
              <p className="mt-3 rounded-2xl bg-white/60 p-3 text-sm font-bold text-[#8A6F57]">Ninguém ainda. Que tal ser o primeiro?</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
