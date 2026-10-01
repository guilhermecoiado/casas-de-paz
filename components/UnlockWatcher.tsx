'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Frame, Lock, Sparkles } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { GROUP_UNLOCKS } from '@/lib/game';
import { KIND_LABEL, PATHS, REWARDS, TEAM_PHRASES, isUnlocked } from '@/lib/rewards';
import { KitFx } from './Cosmetics';
import { Confetti } from './Confetti';
import { House } from './House';

interface Popup { key: string; title: string; subtitle: string; kind: 'group' | 'reward' | 'house' | 'max' | 'path' | 'kit'; icon?: string; kit?: (typeof PATHS)[number]['id']; }

/** Observa a pontuação e comemora cada novo desbloqueio (individual ou da equipe). */
export function UnlockWatcher() {
  const { group, unlocked, myPoints, maxInd, me, progress, look } = useGroup();
  const prog = progress(me);
  const myKit = look(me).kit;
  const [queue, setQueue] = useState<Popup[]>([]);

  const current = useMemo(() => {
    const keys: Popup[] = [];
    GROUP_UNLOCKS.forEach((u) => {
      if (unlocked.has(u.id))
        keys.push({
          key: `g:${u.id}`,
          title: u.id === 'complete' ? 'A Casa de Paz está completa!' : u.name,
          subtitle: u.desc + (TEAM_PHRASES.find((t) => t.unlock === u.id) ? ` · Nova frase para todos: ${TEAM_PHRASES.find((t) => t.unlock === u.id)!.text}` : ''),
          kind: u.id === 'complete' ? 'house' : 'group',
        });
    });
    REWARDS.forEach((r) => {
      if (r.free || (r.path && !r.pct) || !isUnlocked(group, r, prog)) return;
      const from = r.path ? PATHS.find((x) => x.id === r.path)!.name : 'Coleção';
      keys.push({ key: `r:${r.id}`, title: r.name, subtitle: `${KIND_LABEL[r.kind]} · ${from}`, kind: 'reward', icon: r.icon });
    });
    PATHS.forEach((path) => {
      if (REWARDS.filter((r) => r.path === path.id).every((r) => isUnlocked(group, r, prog)))
        keys.push({ key: `p:${path.id}`, title: `${path.name} completo!`, subtitle: 'Use todos os itens do caminho juntos para revelar o kit secreto ✨', kind: 'path', icon: path.icon });
    });
    if (myKit) {
      const k = PATHS.find((x) => x.id === myKit)!;
      keys.push({ key: `k:${k.id}`, title: `Kit secreto: ${k.kit.name}`, subtitle: `${k.kit.desc}. Você descobriu um segredo!`, kind: 'kit', kit: k.id });
    }
    if (myPoints >= maxInd && maxInd > 0)
      keys.push({ key: 'max', title: 'Pontuação máxima!', subtitle: 'Você alcançou todos os pontos possíveis. Todos os prêmios liberados!', kind: 'max' });
    return keys;
  }, [group, unlocked, myPoints, maxInd, prog, myKit]);

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
    const order = { group: 0, reward: 1, path: 2, kit: 3, max: 4, house: 5 };
    setQueue((q) => [...q, ...fresh.sort((a, b) => order[a.kind] - order[b.kind])]);
  }, [current, group.id, me]);

  const top = queue[0];
  if (!top) return null;
  const big = top.kind === 'house' || top.kind === 'max' || top.kind === 'kit';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 px-6 anim-fade" onClick={() => setQueue((q) => q.slice(1))}>
      <Confetti key={top.key} duration={big ? 6000 : 3200} />
      <div className="card w-full max-w-sm p-6 text-center anim-pop" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-terra">
          {top.kind === 'reward' || top.kind === 'path' ? 'Desbloqueio pessoal' : top.kind === 'kit' ? 'Easter egg' : top.kind === 'max' ? 'Conquista' : 'Desbloqueio da equipe'}
        </p>
        <div className="mx-auto my-4 flex justify-center">
          {top.kind === 'house' ? (
            <House parts={new Set(GROUP_UNLOCKS.map((u) => u.part ?? u.id))} className="w-full" />
          ) : top.kind === 'kit' && top.kit ? (
            <div className="relative h-32 w-24 overflow-hidden rounded-[20px] bg-ink"><KitFx kit={top.kit} /></div>
          ) : top.icon ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber/20 text-4xl">{top.icon}</div>
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
