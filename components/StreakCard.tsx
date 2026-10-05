'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Zap } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { formatDate, streakLevel } from '@/lib/game';
import { STREAK_TIERS, doubleUntil, nextTier, tierOf } from '@/lib/streak';
import { Sheet } from './ui';

/** Sequência de dias + intensivo em níveis (7/14/21/28). Enxuto; detalhes no botão "Como funciona". */
export function StreakCard({ userId, celebrate = false }: { userId?: string; celebrate?: boolean }) {
  const { me, stats, awards, posts, today } = useGroup();
  const uid = userId ?? me;
  const s = stats.byUser[uid];
  const streak = s?.streak ?? 0;
  const best = s?.bestStreak ?? 0;
  const posted = !!s?.postedToday;
  const lv = posted ? streakLevel(streak) : 0;
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
  const dark = lv >= 3 || !!tier;

  return (
    <div className={`streak-hero lv-${lv} relative overflow-hidden rounded-3xl p-4 ${dark ? 'text-white' : ''}`}
      style={dark ? { background: `linear-gradient(135deg, ${tier?.swatch ?? '#ff9a4a'} -20%, #2b2118 85%)` } : { background: lv >= 1 ? '#fff1dc' : '#ffffff' }}>
      {dark && [12, 30, 55, 78, 90].map((x, i) => <span key={i} className="ember" style={{ left: `${x}%`, animationDelay: `${i * 0.45}s` }} />)}

      <div className="relative flex items-center gap-3">
        <span className={`big-flame text-[42px] leading-none ${posted ? '' : 'opacity-40 grayscale'}`}>🔥</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[27px] font-extrabold leading-none">
            {streak} <span className="text-base">{streak === 1 ? 'dia seguido' : 'dias seguidos'}</span>
          </p>
          <p className={`mt-1 text-[13px] font-bold leading-snug ${dark ? 'text-white/85' : 'text-[#8A6F57]'}`}>
            {tier ? `${tier.name} acesa` : celebrate && posted ? 'Fogo aceso! Volte amanhã.' : posted ? 'Fogo aceso hoje ✓' : streak > 0 ? 'Poste hoje para não perder!' : 'Poste hoje para acender o fogo.'}
            {tier && !posted && ' · poste hoje para manter!'}
          </p>
        </div>
        <div className={`shrink-0 text-right text-[11px] font-extrabold leading-tight ${dark ? 'text-white/75' : 'text-[#a8927a]'}`}>
          recorde<br /><span className="font-display text-lg">{best}</span>
        </div>
      </div>

      {celebrate && bonusToday && (
        <div className="relative mt-3 rounded-2xl bg-amber px-3 py-2 text-center text-sm font-extrabold text-ink anim-pop">
          🎉 {bonusToday.description?.replace(' 🔥', '')}! +{bonusToday.points} pts de bônus
        </div>
      )}
      {dbl && (
        <div className={`relative mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-extrabold ${dark ? 'bg-white/15' : 'bg-amber/20 text-[#9a5b00]'}`}>
          <Zap size={16} className="shrink-0 text-amber" fill="currentColor" /> Pontos em dobro até {formatDate(dbl, { weekday: 'short', day: '2-digit', month: '2-digit' })}{posted ? '' : ' (poste hoje!)'}
        </div>
      )}

      {/* trilha 7 · 14 · 21 · 28 */}
      <div className="relative mt-3 grid grid-cols-4 gap-1.5">
        {STREAK_TIERS.map((t) => {
          const ok = reached(t.days);
          const cur = next?.days === t.days;
          return (
            <div key={t.days} className={`rounded-xl px-1 py-1.5 text-center ${ok ? '' : dark ? 'bg-white/10' : 'bg-[#f6ecdf]'}`}
              style={ok ? { background: t.swatch, color: t.days === 14 ? '#2b2118' : '#fff' } : undefined}>
              <p className={`font-display text-[15px] font-extrabold leading-none ${!ok && !dark ? 'text-[#6b5643]' : ''}`}>
                {ok ? <Check size={13} strokeWidth={3.5} className="-mt-0.5 mr-0.5 inline" /> : null}{t.days}
              </p>
              <p className={`mt-0.5 text-[10px] font-bold leading-none ${ok ? 'opacity-90' : dark ? 'text-white/60' : 'text-[#a8927a]'}`}>{cur ? `faltam ${t.days - streak}` : `+${t.bonus}`}</p>
            </div>
          );
        })}
      </div>

      {next && (
        <p className={`relative mt-2 text-[12.5px] font-bold leading-snug ${dark ? 'text-white/85' : 'text-[#6b5643]'}`}>
          {next.days} dias: <span style={{ color: dark ? undefined : next.swatch }} className={dark ? 'text-amber' : ''}>{next.name.toLowerCase()}</span>, +{next.bonus} pts{next.double ? ' e pontos em dobro' : ''}{next.title ? ` e o título ${next.title}` : ''}
        </p>
      )}

      <button onClick={() => setHelp(true)} className={`relative mt-2 flex items-center gap-1 text-[13px] font-extrabold ${dark ? 'text-white' : 'text-terra'}`}>
        Como funciona o intensivo <ChevronRight size={15} />
      </button>

      <IntensivoHelp open={help} onClose={() => setHelp(false)} />
    </div>
  );
}

export function IntensivoHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Intensivo 🔥">
      <p className="text-[15px] leading-snug text-[#6b5643]">
        Poste <b>pelo menos uma coisa por dia</b> para manter o fogo aceso. A cada nível o seu tile ganha uma chama ao redor e você recebe prêmios:
      </p>
      <div className="mt-3 space-y-2">
        {STREAK_TIERS.map((t) => (
          <div key={t.days} className="flex items-center gap-3 rounded-2xl bg-white p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-extrabold text-white"
              style={{ background: t.swatch, boxShadow: `0 0 12px ${t.swatch}`, color: t.days === 14 ? '#2b2118' : '#fff' }}>{t.days}</span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold leading-tight">{t.name}</p>
              <p className="text-[13px] leading-snug text-[#6b5643]">
                +{t.bonus} pts{t.double ? ' · pontos em dobro por 7 dias' : ''}{t.title ? ` · título ${t.title}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-1.5 text-[13px] leading-snug text-[#6b5643]">
        <li>• O <b>bônus</b> e a parte <b>em dobro</b> não ocupam o limite da semana.</li>
        <li>• O dobro vale nos 7 dias depois de cada nível, enquanto a sequência continuar.</li>
        <li>• Cada nível vale 1 vez na temporada. Se a sequência quebrar, o fogo apaga e recomeça do zero.</li>
        <li>• Ainda não postou hoje? A chama fica fraquinha até você postar.</li>
      </ul>
    </Sheet>
  );
}
