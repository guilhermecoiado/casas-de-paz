'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CalendarDays, CircleHelp, HandHeart, Lock, MessageCircle, Settings, UserPlus } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { GROUP_UNLOCKS, WEEKDAYS, daysLeft, formatDate, groupThreshold, nextGroupUnlock, totalWeeks, weekdayOf } from '@/lib/game';
import { Avatar, ProgressBar } from '@/components/ui';
import { MemberTile } from '@/components/Tile';
import { House } from '@/components/House';
import { PollCard } from '@/components/PollCard';
import { MemberSheet } from '@/components/MemberSheet';
import { PushToggle } from '@/components/PushToggle';
import { WeekRecap } from '@/components/WeekRecap';
import { WelcomeSheet } from '@/components/WelcomeSheet';

export default function GroupHome() {
  const g = useGroup();
  const { group, members, profiles, stats, unlocked, today, me, isAdmin, polls, look, maxGrp, unread } = g;
  const [sel, setSel] = useState<string | null>(null);
  const houseRef = useRef<HTMLAnchorElement>(null);

  const parts = useMemo(() => new Set(GROUP_UNLOCKS.filter((u) => unlocked.has(u.id)).map((u) => u.part ?? u.id)), [unlocked]);
  const next = nextGroupUnlock(maxGrp, stats.groupPoints);
  const todayPolls = polls.filter((p) => p.poll_date === today);
  const postedCount = members.filter((m) => stats.byUser[m.user_id]?.postedToday).length;
  const sorted = [...members].sort((a, b) => {
    const sa = stats.byUser[a.user_id], sb = stats.byUser[b.user_id];
    return Number(!!sb?.postedToday) - Number(!!sa?.postedToday) || (sb?.points ?? 0) - (sa?.points ?? 0);
  });
  const bg = unlocked.has('background') && group.background_url;
  const isHouseDay = weekdayOf(today) === group.house_weekday;
  const myWeek = stats.byUser[me]?.weekPoints ?? 0;
  const before = today < group.start_date;
  const after = today > group.end_date;
  const left = daysLeft(group, today);

  return (
    <div>
      {/* topo */}
      <header className="relative overflow-hidden pt-safe">
        {bg && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={group.background_url!} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-cream" />
          </>
        )}
        <div className={`relative px-5 pb-4 ${bg ? 'text-white' : ''}`}>
          <div className="flex items-center gap-2 pt-2">
            <Link href="/grupos" className="flex-1 min-w-0">
              <p className={`text-xs font-extrabold uppercase tracking-[0.18em] ${bg ? 'text-white/80' : 'text-terra'}`}>Casa de Paz</p>
              <h1 className="truncate font-display text-[26px] font-extrabold leading-tight">{group.name}</h1>
            </Link>
            {isAdmin && (
              <Link href={`/g/${group.id}/admin`} className={`rounded-full p-2.5 ${bg ? 'bg-white/20 backdrop-blur' : 'bg-sand'}`} aria-label="Administração">
                <Settings size={20} />
              </Link>
            )}
            <Link
              href={unlocked.has('chat') ? `/g/${group.id}/chat` : '#'}
              onClick={(e) => { if (!unlocked.has('chat')) e.preventDefault(); }}
              className={`relative rounded-full p-2.5 ${bg ? 'bg-white/20 backdrop-blur' : 'bg-sand'} ${unlocked.has('chat') ? '' : 'opacity-60'}`}
              aria-label="Chat"
            >
              <MessageCircle size={20} />
              {!unlocked.has('chat') && <Lock size={11} className="absolute bottom-1.5 right-1.5" />}
            </Link>
            <Link href={`/g/${group.id}/avisos`} className={`relative rounded-full p-2.5 ${bg ? 'bg-white/20 backdrop-blur' : 'bg-sand'}`} aria-label={unread ? `Notificações, ${unread} não lidas` : 'Notificações'}>
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terra px-1 text-[10px] font-extrabold text-white ring-2 ring-cream">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link href={`/g/${group.id}/eu`} aria-label="Meu perfil">
              <Avatar url={profiles[me]?.avatar_url} name={profiles[me]?.name} size={40} frame={look(me).avatarFrame} />
            </Link>
          </div>
          <p className={`mt-2 flex items-center gap-1.5 text-sm font-bold ${bg ? 'text-white/90' : 'text-[#8A6F57]'}`}>
            <CalendarDays size={15} />
            {before
              ? `Começa ${formatDate(group.start_date)}`
              : `${after ? `Semana ${stats.week} (extra)` : `Semana ${stats.week} de ${totalWeeks(group)} · ${left <= 1 ? 'último dia! 🏁' : `faltam ${left} dias`}`} · ${isHouseDay ? 'Hoje é dia de Casa de Paz! 🏠' : `Casa de Paz às ${WEEKDAYS[group.house_weekday].toLowerCase()}s`}`}
          </p>
        </div>
      </header>

      <div className="space-y-4 px-4">
        {/* progresso da casa */}
        <Link ref={houseRef} href={`/g/${group.id}/casa`} className="card block overflow-hidden active:scale-[0.99]">
          <div className="flex items-center gap-3 p-4 pb-2">
            <House parts={parts} className="h-[86px] w-[106px] shrink-0 drop-shadow-sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#a8927a]">Pontos da equipe</p>
              <p className="font-display text-3xl font-extrabold leading-none text-ink">
                {stats.groupPoints.toLocaleString('pt-BR')}
                <span className="text-base font-bold text-[#a8927a]"> / {maxGrp.toLocaleString('pt-BR')}</span>
              </p>
              {next ? (
                <p className="mt-1 text-sm font-bold leading-snug text-[#6b5643]">
                  Próximo: <span className="text-terra">{next.name}</span> em {Math.max(0, groupThreshold(maxGrp, next) - stats.groupPoints)} pts
                </p>
              ) : (
                <p className="mt-1 text-sm font-extrabold text-olive">Casa completa! 🎉</p>
              )}
            </div>
          </div>
          <div className="px-4 pb-4">
            <ProgressBar value={stats.groupPoints} max={maxGrp} height={16} />
            <div className="mt-2 flex justify-between text-[11px] font-bold text-[#a8927a]">
              <span>Equipe na semana: {stats.groupWeekPoints}/{stats.teamWeekCap}</span>
              <span>Você na semana: {myWeek}/{group.weekly_user_cap}</span>
            </div>
          </div>
        </Link>

        <WeekRecap houseRef={houseRef} />

        {/* atalhos */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: `/g/${group.id}/oracao`, Icon: HandHeart, label: 'Mural de oração', tone: 'text-olive' },
            { href: `/g/${group.id}/convidados`, Icon: UserPlus, label: 'Convidados', tone: 'text-[#2F8FD0]' },
            { href: `/g/${group.id}/como-funciona`, Icon: CircleHelp, label: 'Como funciona', tone: 'text-terra' },
          ].map(({ href, Icon, label, tone }) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 rounded-2xl bg-white px-2 py-3 text-center shadow-sm active:scale-95">
              <Icon size={22} className={tone} />
              <span className="text-[12px] font-extrabold leading-tight text-[#6b5643]">{label}</span>
            </Link>
          ))}
        </div>

        <PushToggle variant="compact" />

        {todayPolls.map((p) => <PollCard key={p.id} poll={p} />)}

        {/* tiles */}
        <section>
          <div className="mb-2.5 mt-2 flex items-end justify-between px-1">
            <h2 className="font-display text-xl font-bold">Hoje</h2>
            <p className="text-sm font-extrabold text-[#8A6F57]">
              <span className="text-olive">{postedCount}</span> de {members.length} postaram
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {sorted.map((m) => (
              <MemberTile
                key={m.user_id}
                profile={profiles[m.user_id]}
                stats={stats.byUser[m.user_id]}
                look={look(m.user_id)}
                alive={unlocked.has('tile_anim')}
                isAdmin={group.admin_id === m.user_id}
                onClick={() => setSel(m.user_id)}
              />
            ))}
          </div>
        </section>
      </div>

      <MemberSheet userId={sel} onClose={() => setSel(null)} />
      <WelcomeSheet />
    </div>
  );
}
