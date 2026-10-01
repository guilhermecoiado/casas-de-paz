'use client';

import { useGroup } from '@/lib/group-context';
import { streakLevel } from '@/lib/game';
import { REWARDS } from '@/lib/rewards';

const STREAK_REWARDS = REWARDS.filter((r) => r.req?.stat === 'bestStreak').sort((a, b) => a.req!.n - b.req!.n);
const MILESTONES = Array.from(new Set(STREAK_REWARDS.map((r) => r.req!.n)));

/** Sequência de dias seguidos postando, com o próximo prêmio do intensivo. */
export function StreakCard({ userId, celebrate = false }: { userId?: string; celebrate?: boolean }) {
  const { me, stats } = useGroup();
  const s = stats.byUser[userId ?? me];
  const streak = s?.streak ?? 0;
  const best = s?.bestStreak ?? 0;
  const posted = !!s?.postedToday;
  const lv = posted ? streakLevel(streak) : 0;
  const nextN = MILESTONES.find((n) => n > best);
  const nextItems = nextN ? STREAK_REWARDS.filter((r) => r.req!.n === nextN) : [];
  const target = nextN ?? best;
  const dots = Math.min(Math.max(nextN ?? 7, 7), 28);
  const shown = Math.min(streak, dots);

  return (
    <div className={`streak-hero lv-${lv} rounded-3xl p-4 ${lv >= 3 ? 'bg-gradient-to-br from-[#ff9a4a] to-[#e8562e] text-white' : lv >= 1 ? 'bg-[#fff1dc]' : 'bg-white'}`}>
      {lv >= 3 && [12, 30, 55, 78, 90].map((x, i) => <span key={i} className="ember" style={{ left: `${x}%`, animationDelay: `${i * 0.45}s` }} />)}
      <div className="relative flex items-center gap-3">
        <span className={`big-flame text-[44px] leading-none ${posted ? '' : 'opacity-40 grayscale'}`}>🔥</span>
        <div className="min-w-0 flex-1">
          <p className={`font-display text-[28px] font-extrabold leading-none ${lv >= 3 ? '' : 'text-ink'}`}>
            {streak} <span className="text-base">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          </p>
          <p className={`mt-1 text-[13px] font-bold leading-snug ${lv >= 3 ? 'text-white/90' : 'text-[#8A6F57]'}`}>
            {celebrate && posted
              ? streak === 1 ? 'Sequência começou! Volte amanhã para manter o fogo.' : 'Fogo aceso! Volte amanhã para manter.'
              : posted ? 'Fogo aceso hoje ✓'
              : streak > 0 ? 'Poste hoje para não perder a sequência!' : 'Poste hoje para acender o fogo.'}
          </p>
        </div>
        <div className={`shrink-0 text-right text-[11px] font-extrabold leading-tight ${lv >= 3 ? 'text-white/85' : 'text-[#a8927a]'}`}>
          recorde<br /><span className="font-display text-lg">{best}</span>
        </div>
      </div>
      {nextN && (
        <div className="relative mt-3">
          <div className="flex gap-[3px]">
            {Array.from({ length: dots }, (_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i < shown ? (lv >= 3 ? 'bg-white' : 'bg-[#ff7a3a]') : lv >= 3 ? 'bg-white/30' : 'bg-[#f0dcc4]'}`} />
            ))}
          </div>
          <p className={`mt-1.5 text-[12px] font-bold ${lv >= 3 ? 'text-white/90' : 'text-[#6b5643]'}`}>
            {nextN === 7 ? 'Intensivo: ' : ''}{target} dias seguidos libera {nextItems.map((r) => `${r.icon} ${r.name}`).join(' + ')}
          </p>
        </div>
      )}
    </div>
  );
}
