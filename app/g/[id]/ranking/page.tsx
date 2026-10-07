'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChartNoAxesColumn, Crown, Star } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { Avatar } from '@/components/ui';
import { MemberSheet } from '@/components/MemberSheet';
import { rankCompare, type UserStats } from '@/lib/game';
import { REWARDS, isUnlocked } from '@/lib/rewards';
import { Highlights } from '@/components/Highlights';

const METRICS: { id: keyof UserStats; label: string; unit: string }[] = [
  { id: 'points', label: 'Pontos', unit: 'pts' },
  { id: 'weekPoints', label: 'Semana', unit: 'pts' },
  { id: 'checkins', label: 'Check-ins', unit: '' },
  { id: 'guests', label: 'Convidados', unit: '' },
  { id: 'evangelism', label: 'Evangelismo', unit: '' },
  { id: 'streak', label: '🔥 Sequência', unit: 'dias' },
];

export default function Ranking() {
  const { members, profiles, stats, look, me, group, progress } = useGroup();
  const [metric, setMetric] = useState<keyof UserStats>('points');
  const [tab, setTab] = useState<'rank' | 'highlights'>(useSearchParams()?.get('tab') === 'destaques' ? 'highlights' : 'rank');
  const [sel, setSel] = useState<string | null>(null);
  const m = METRICS.find((x) => x.id === metric)!;

  const rows = useMemo(
    () =>
      members
        .map((mm) => {
          const s = stats.byUser[mm.user_id];
          const p = progress(mm.user_id);
          return {
            id: mm.user_id,
            v: Number(s?.[metric] ?? 0),
            pts: s?.points ?? 0,
            s,
            unlocks: REWARDS.filter((r) => !r.free && isUnlocked(group, r, p)).length,
          };
        })
        // empate na métrica → mais pontos → mais fiel (dias postando) → chegou primeiro → mais desbloqueios
        .sort((a, b) => (b.v !== a.v ? b.v - a.v : b.pts !== a.pts ? b.pts - a.pts : rankCompare({ ...a, v: 0 }, { ...b, v: 0 }))),
    [members, stats, metric, group, progress],
  );
  const podium = [rows[1], rows[0], rows[2]];
  const heights = ['h-20', 'h-28', 'h-16'];

  return (
    <div className="pt-safe">
      <header className="px-4 pt-3">
        <h1 className="font-display text-[26px] font-extrabold">Ranking</h1>
        <p className="text-sm font-bold text-[#8A6F57]">Atualiza em tempo real</p>
        <div className="mt-3 grid grid-cols-2 rounded-2xl bg-sand p-1">
          {([['rank', 'Classificação', ChartNoAxesColumn], ['highlights', 'Destaques', Star]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-extrabold transition ${tab === id ? 'bg-white text-ink shadow-sm' : 'text-[#8A6F57]'}`}>
              <Icon size={16} strokeWidth={2.6} className={tab === id ? 'text-terra' : ''} fill={id === 'highlights' && tab === id ? 'currentColor' : 'none'} /> {label}
            </button>
          ))}
        </div>
        {tab === 'rank' && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {METRICS.map((x) => (
              <button key={x.id} onClick={() => setMetric(x.id)} className={`chip shrink-0 !px-3.5 !py-2 !text-sm ${metric === x.id ? 'bg-ink text-white' : 'bg-white text-[#6b5643]'}`}>
                {x.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {tab === 'highlights' ? <Highlights onSelect={setSel} /> : <>

      {/* pódio */}
      <div className="mt-6 flex items-end justify-center gap-3 px-4">
        {podium.map((r, i) => {
          if (!r) return <div key={i} className="w-24" />;
          const place = i === 1 ? 1 : i === 0 ? 2 : 3;
          return (
            <button key={r.id} onClick={() => setSel(r.id)} className="flex w-24 flex-col items-center anim-rise" style={{ animationDelay: `${i * 80}ms` }}>
              {place === 1 && <Crown className="mb-1 text-amber" size={26} fill="#F2A541" />}
              <Avatar url={profiles[r.id]?.avatar_url} name={profiles[r.id]?.name} size={place === 1 ? 72 : 58} frame={look(r.id).avatarFrame} />
              <p className="mt-1 w-full truncate text-center text-sm font-extrabold">{profiles[r.id]?.name?.split(' ')[0]}</p>
              <p className="text-sm font-black text-terra">{r.v} {m.unit}</p>
              <div className={`mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 font-display text-2xl font-extrabold text-white ${heights[i]} ${place === 1 ? 'bg-terra' : place === 2 ? 'bg-[#d58b6f]' : 'bg-[#e4b49b]'}`}>
                {place}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mx-4 -mt-px space-y-2 rounded-3xl bg-white p-2">
        {rows.map((r, i) => (
          <button
            key={r.id}
            onClick={() => setSel(r.id)}
            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${r.id === me ? 'bg-amber/15' : ''}`}
          >
            <span className="w-6 text-center font-black text-[#a8927a]">{i + 1}</span>
            <Avatar url={profiles[r.id]?.avatar_url} name={profiles[r.id]?.name} size={40} frame={look(r.id).avatarFrame} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{profiles[r.id]?.name}{r.id === me ? ' (você)' : ''}</p>
              <p className="truncate text-xs font-bold text-[#a8927a]">{look(r.id).title}</p>
            </div>
            <span className="font-display text-lg font-extrabold">{r.v}<span className="text-xs font-bold text-[#a8927a]"> {m.unit}</span></span>
          </button>
        ))}
      </div>
      <p className="mx-6 mt-3 text-center text-[11px] leading-snug text-[#a8927a]">
        Em caso de empate: vence quem foi mais fiel (mais dias postando), depois quem chegou primeiro à pontuação, depois quem desbloqueou mais itens.
      </p>
      </>}
      <MemberSheet userId={sel} onClose={() => setSel(null)} />
    </div>
  );
}
