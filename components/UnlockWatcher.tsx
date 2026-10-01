'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Frame, Lock, Sparkles } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { GROUP_UNLOCKS, REWARDS, REWARD_KIND_LABEL, isRewardUnlocked } from '@/lib/game';
import { Confetti } from './Confetti';
import { House } from './House';

interface Popup { key: string; title: string; subtitle: string; kind: 'group' | 'reward' | 'house' | 'max'; }

/** Observa a pontuação e comemora cada novo desbloqueio (individual ou da equipe). */
export function UnlockWatcher() {
  const { group, unlocked, myPoints, maxInd, me } = useGroup();
  const [queue, setQueue] = useState<Popup[]>([]);

  const current = useMemo(() => {
    const keys: Popup[] = [];
    GROUP_UNLOCKS.forEach((u) => {
      if (unlocked.has(u.id))
        keys.push({
          key: `g:${u.id}`,
          title: u.id === 'complete' ? 'A Casa de Paz está completa!' : u.name,
          subtitle: u.desc,
          kind: u.id === 'complete' ? 'house' : 'group',
        });
    });
    REWARDS.forEach((r) => {
      if (r.pct > 0 && isRewardUnlocked(group, r, myPoints))
        keys.push({ key: `r:${r.id}`, title: r.name, subtitle: `Novo item em ${REWARD_KIND_LABEL[r.kind]}`, kind: 'reward' });
    });
    if (myPoints >= maxInd && maxInd > 0)
      keys.push({ key: 'max', title: 'Pontuação máxima!', subtitle: 'Você alcançou todos os pontos possíveis. Todos os prêmios liberados!', kind: 'max' });
    return keys;
  }, [group, unlocked, myPoints, maxInd]);

  useEffect(() => {
    const storeKey = `cdp-seen-${group.id}-${me}`;
    let seen: string[] | null = null;
    try { seen = JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch {}
    if (!seen) {
      // primeira visita: apresenta a moldura (primeiro desbloqueio) e marca o resto como visto
      const first = current.filter((c) => c.key === 'g:frame');
      try { localStorage.setItem(storeKey, JSON.stringify(current.map((c) => c.key))); } catch {}
      if (first.length) setQueue(first);
      return;
    }
    const fresh = current.filter((c) => !seen!.includes(c.key));
    if (!fresh.length) return;
    try { localStorage.setItem(storeKey, JSON.stringify([...seen, ...fresh.map((f) => f.key)])); } catch {}
    // a casa completa e o máximo individual vêm por último, com mais destaque
    const order = { group: 0, reward: 1, max: 2, house: 3 };
    setQueue((q) => [...q, ...fresh.sort((a, b) => order[a.kind] - order[b.kind])]);
  }, [current, group.id, me]);

  const top = queue[0];
  if (!top) return null;
  const big = top.kind === 'house' || top.kind === 'max';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 px-6 anim-fade" onClick={() => setQueue((q) => q.slice(1))}>
      <Confetti key={top.key} duration={big ? 6000 : 3200} />
      <div className="card w-full max-w-sm p-6 text-center anim-pop" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-terra">
          {top.kind === 'reward' ? 'Desbloqueio pessoal' : top.kind === 'max' ? 'Conquista' : 'Desbloqueio da equipe'}
        </p>
        <div className="mx-auto my-4 flex justify-center">
          {top.kind === 'house' ? (
            <House parts={new Set(GROUP_UNLOCKS.map((u) => u.part ?? u.id))} className="w-full" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber/20 text-terra">
              {top.key === 'g:frame' ? <Frame size={40} /> : top.kind === 'reward' ? <Award size={40} /> : top.kind === 'max' ? <Sparkles size={40} /> : <Lock size={40} className="rotate-12" />}
            </div>
          )}
        </div>
        <h2 className="font-display text-2xl font-extrabold">{top.title}</h2>
        <p className="mt-2 text-[#6b5643]">{top.subtitle}</p>
        <button className="btn-primary mt-6 w-full" onClick={() => setQueue((q) => q.slice(1))}>
          {queue.length > 1 ? `Próximo (${queue.length - 1})` : 'Glória a Deus! 🙌'}
        </button>
      </div>
    </div>
  );
}
