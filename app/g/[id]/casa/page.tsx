'use client';

import { useMemo, useState } from 'react';
import { Check, Lock, PartyPopper } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { GROUP_UNLOCKS, groupThreshold, totalWeeks } from '@/lib/game';
import { House } from '@/components/House';
import { ProgressBar } from '@/components/ui';
import { Confetti } from '@/components/Confetti';

export default function Casa() {
  const { group, stats, unlocked, maxGrp } = useGroup();
  const [party, setParty] = useState(0);
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

      <div className="mx-4 mt-4 overflow-hidden rounded-[28px] shadow-lg">
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
          Meta: {maxGrp.toLocaleString('pt-BR')} pts · até {group.weekly_group_cap}/semana em {totalWeeks(group)} semanas
        </p>
        {complete && (
          <button className="btn-primary mt-4 w-full" onClick={() => setParty((p) => p + 1)}><PartyPopper size={18} /> Comemorar de novo</button>
        )}
      </div>

      <ol className="relative mx-4 mt-6 space-y-3 border-l-2 border-dashed border-[#e2cfb6] pl-5">
        {GROUP_UNLOCKS.map((u) => {
          const ok = unlocked.has(u.id);
          const need = groupThreshold(group, u);
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
