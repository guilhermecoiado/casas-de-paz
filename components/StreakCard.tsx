'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Flame, Zap } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { formatDate } from '@/lib/game';
import { STREAK_TIERS, doubleUntil, nextTier, tierOf } from '@/lib/streak';
import { Sheet } from './ui';

/** Sequência de dias + intensivo em níveis (7/14/21/28). Card claro: chama, progresso até o próximo nível e trilha. */
export function StreakCard({ userId, celebrate = false }: { userId?: string; celebrate?: boolean }) {
  const { me, stats, awards, posts, today } = useGroup();
  const uid = userId ?? me;
  const s = stats.byUser[uid];
  const streak = s?.streak ?? 0;
  const best = s?.bestStreak ?? 0;
  const posted = !!s?.postedToday;
  const tier = tierOf(streak);
  const next = nextTier(streak);
  const dbl = doubleUntil(awards, uid, today, streak, posted);
  const [help, setHelp] = useState(false);

  // bônus do intensivo creditado hoje (aparece na tela de sucesso)
  const bonusToday = useMemo(
    () => posts.find((p) => p.user_id === uid && p.type === 'streak' && p.local_date === today && p.status !== 'cancelled'),
    [posts, uid, today],
  );
  const reached = (days: number) => awards.some((a) => a.user_id === uid && a.level === days) || best >= days;

  const flameColor = tier?.swatch ?? (streak > 0 ? '#F2A541' : '#d9c9b4');
  const status = celebrate && posted ? 'Fogo aceso! Volte amanhã.'
    : posted ? (tier ? `${tier.name} acesa` : 'Fogo aceso hoje')
    : streak > 0 ? 'Poste hoje para não apagar!' : 'Poste hoje para acender o fogo.';

  return (
    <div className="card relative overflow-hidden p-4">
      {/* brilho suave da cor do nível */}
      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full opacity-25 blur-2xl" style={{ background: flameColor }} />

      <div className="relative flex items-center gap-3">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${posted ? 'flame-pulse' : ''}`}
          style={{ background: posted || streak > 0 ? flameColor : '#f1e7d8', boxShadow: posted && tier ? `0 6px 18px -6px ${flameColor}` : undefined }}>
          <Flame size={30} strokeWidth={2.2} className={posted ? 'flame-flicker' : ''}
            color={tier?.days === 14 ? '#2b2118' : posted || streak > 0 ? '#fff' : '#b9a690'} fill={tier?.days === 14 ? '#2b211833' : posted || streak > 0 ? '#ffffff55' : 'none'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#a8927a]">Intensivo</p>
          <p className="font-display text-[26px] font-extrabold leading-none">
            {streak} <span className="text-[15px] font-bold text-[#6b5643]">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          </p>
          <p className={`mt-1 text-[13px] font-bold leading-snug ${!posted && streak > 0 ? 'text-terra' : 'text-[#8A6F57]'}`}>{status}</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-cream px-2.5 py-1.5 text-center">
          <p className="font-display text-lg font-extrabold leading-none">{best}</p>
          <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#a8927a]">recorde</p>
        </div>
      </div>

      {celebrate && bonusToday && (
        <div className="relative mt-3 rounded-2xl bg-amber px-3 py-2 text-center text-sm font-extrabold text-ink anim-pop">
          🎉 {bonusToday.description?.replace(' 🔥', '')}! +{bonusToday.points} pts de bônus
        </div>
      )}
      {dbl && (
        <div className="relative mt-3 flex items-center gap-2 rounded-2xl bg-amber/15 px-3 py-2 text-sm font-extrabold text-[#9a5b00]">
          <Zap size={16} className="shrink-0 text-amber" fill="currentColor" /> Pontos em dobro até {formatDate(dbl, { weekday: 'short', day: '2-digit', month: '2-digit' })}{posted ? '' : ' (poste hoje!)'}
        </div>
      )}

      {/* trilha 7 · 14 · 21 · 28 */}
      <div className="relative mt-4 px-1">
        <div className="absolute left-[12.5%] right-[12.5%] top-[17px] h-1.5 rounded-full bg-sand" />
        <div className="absolute left-[12.5%] top-[17px] h-1.5 rounded-full transition-all"
          style={{ width: `${Math.min(1, streak / 28) * 75}%`, background: `linear-gradient(90deg, #ff4b3a, ${flameColor})` }} />
        <div className="relative grid grid-cols-4">
          {STREAK_TIERS.map((t) => {
            const ok = reached(t.days);
            const cur = next?.days === t.days;
            const dark = t.days === 14;
            return (
              <div key={t.days} className="flex flex-col items-center">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full border-[3px] font-display text-[15px] font-extrabold ${cur ? 'bg-white' : ''}`}
                  style={ok ? { background: t.swatch, borderColor: t.swatch, color: dark ? '#2b2118' : '#fff' }
                    : cur ? { borderColor: t.swatch, color: '#2b2118' } : { background: '#fbf6ee', borderColor: '#f1e7d8', color: '#b9a690' }}>
                  {ok ? <Check size={18} strokeWidth={3.5} /> : t.days}
                </span>
                <p className={`mt-1 text-[11px] font-extrabold leading-tight ${ok || cur ? 'text-ink' : 'text-[#b9a690]'}`}>{t.days} dias</p>
                <p className="text-[10px] font-bold leading-tight text-[#a8927a]">{t.title ? 'título' : t.double ? '+ dobro' : `+${t.bonus}`}</p>
              </div>
            );
          })}
        </div>
      </div>

      {next && (
        <div className="relative mt-3 rounded-2xl bg-cream px-3 py-2 leading-snug">
          <p className="truncate whitespace-nowrap text-[13px] font-bold text-[#6b5643]">
            Faltam <b className="text-ink">{next.days - streak} {next.days - streak === 1 ? 'dia' : 'dias'}</b> ·{' '}
            <b style={{ color: next.days === 14 ? '#c99400' : next.swatch }}>{next.name}</b>
          </p>
          <p className="truncate whitespace-nowrap text-[12px] font-bold text-[#8A6F57]">
            +{next.bonus} pts{next.double ? ' · pontos em dobro' : ''}{next.title ? ` · título ${next.title}` : ''}
          </p>
        </div>
      )}

      <button onClick={() => setHelp(true)} className="relative mt-2 flex items-center gap-1 text-[13px] font-extrabold text-terra">
        Como funciona o intensivo <ChevronRight size={15} />
      </button>

      <IntensivoHelp open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

export function IntensivoHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Intensivo 🔥">
      <p className="truncate text-[15px] font-bold text-ink">Poste pelo menos 1 coisa por dia 🔥</p>
      <p className="truncate text-[14px] text-[#6b5643]">Cada nível acende uma chama no tile e dá prêmios:</p>
      <div className="mt-3 space-y-2">
        {STREAK_TIERS.map((t) => (
          <div key={t.days} className="flex items-center gap-3 rounded-2xl bg-white p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-extrabold text-white"
              style={{ background: t.swatch, boxShadow: `0 0 12px ${t.swatch}`, color: t.days === 14 ? '#2b2118' : '#fff' }}>{t.days}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold leading-tight">{t.name}</p>
              <p className="truncate text-[13px] leading-snug text-[#6b5643]">+{t.bonus} pts{t.double ? ' · dobro por 7 dias' : ''}</p>
              {t.title && <p className="truncate text-[13px] font-bold leading-snug text-[#7b3fa0]">título {t.title}</p>}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-1.5 text-[13px] leading-snug text-[#6b5643] [&>li]:truncate">
        <li>• Bônus e dobro <b>não contam</b> no limite da semana</li>
        <li>• O dobro vale 7 dias depois de cada nível</li>
        <li>• Cada nível vale 1 vez na temporada</li>
        <li>• Quebrou a sequência? O fogo recomeça do zero</li>
        <li>• A chama fica fraquinha até você postar hoje</li>
      </ul>
    </Sheet>
  );
}
