'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, Frame, Lock, Sparkles } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { GROUP_UNLOCKS } from '@/lib/game';
import { KIND_LABEL, PATHS, REWARDS, TEAM_PHRASES, isUnlocked, kitItems, type PathId, type Reward } from '@/lib/rewards';
import { useEquip } from '@/lib/use-equip';
import { useToast } from './Providers';
import { Avatar, Spinner } from './ui';
import { MemberTile, type TileLook } from './Tile';
import { KitFx } from './Cosmetics';
import { Confetti } from './Confetti';
import { House } from './House';

interface Popup { key: string; title: string; subtitle: string; kind: 'group' | 'reward' | 'house' | 'max' | 'path' | 'kit'; icon?: string; kit?: (typeof PATHS)[number]['id']; reward?: Reward; path?: PathId; }

/** Observa a pontuação e comemora cada novo desbloqueio (individual ou da equipe). */
export function UnlockWatcher() {
  const { group, unlocked, myPoints, maxInd, me, progress, look, profiles, stats } = useGroup();
  const { saving, wear, equipKit, isWorn } = useEquip();
  const toast = useToast();
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
      if (r.free || r.drop || (r.path && !r.pct) || !isUnlocked(group, r, prog)) return;
      const from = r.path ? PATHS.find((x) => x.id === r.path)!.name : r.req ? 'Conquista' : 'Recompensa';
      keys.push({ key: `r:${r.id}`, title: r.name, subtitle: `${KIND_LABEL[r.kind]} · ${from}`, kind: 'reward', icon: r.icon, reward: r });
    });
    PATHS.forEach((path) => {
      if (REWARDS.filter((r) => r.path === path.id).every((r) => isUnlocked(group, r, prog)))
        keys.push({ key: `p:${path.id}`, title: `${path.name} completo!`, subtitle: 'Use todos os itens do caminho juntos para revelar o kit secreto ✨', kind: 'path', icon: path.icon, path: path.id });
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
  const skip = () => setQueue((q) => q.slice(1));
  const nextLabel = queue.length > 1 ? `Próximo (${queue.length - 1})` : 'Glória a Deus! 🙌';

  // prévia do item no próprio perfil/tile, com botão para já usar
  const r = top.reward && top.reward.kind !== 'phrase' ? top.reward : null;
  const worn = r ? isWorn(r) : false;
  const mine = look(me);
  const base: TileLook = { title: mine.title, avatarFrame: mine.avatarFrame, tileFrame: mine.tileFrame, tileColor: mine.tileColor, tileAnim: mine.tileAnim, kit: mine.kit };
  let preview: TileLook | null = null;
  if (r) {
    preview = { ...base, kit: null };
    if (r.kind === 'title') preview.title = r.name;
    if (r.kind === 'avatar_frame') preview.avatarFrame = r.id;
    if (r.kind === 'tile_color') preview.tileColor = r.id;
    if (r.kind === 'tile_frame') preview.tileFrame = r.id;
    if (r.kind === 'tile_anim') preview.tileAnim = r.id;
  } else if (top.kind === 'path' && top.path) {
    preview = { ...base, kit: top.path };
    kitItems(top.path).forEach((it) => {
      if (it.kind === 'title') preview!.title = it.name;
      if (it.kind === 'avatar_frame') preview!.avatarFrame = it.id;
      if (it.kind === 'tile_color') preview!.tileColor = it.id;
      if (it.kind === 'tile_frame') preview!.tileFrame = it.id;
      if (it.kind === 'tile_anim') preview!.tileAnim = it.id;
    });
  }
  const pathOn = top.kind === 'path' && top.path ? mine.kit === top.path : false;
  const use = async () => {
    const ok = r ? await wear(r) : top.path ? await equipKit(top.path) : true;
    if (ok) { toast(r ? 'Pronto! Já está no seu perfil ✨' : 'Caminho completo no seu perfil ✨'); skip(); }
  };
  const busy = !!saving;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 px-6 anim-fade" onClick={skip}>
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
          ) : preview && r?.kind === 'avatar_frame' ? (
            <div className="py-2"><Avatar url={profiles[me]?.avatar_url} name={profiles[me]?.name} size={104} frame={r.id} /></div>
          ) : preview ? (
            <div className="w-[124px]">
              <MemberTile profile={profiles[me]} stats={stats.byUser[me]} look={preview} alive isAdmin={false} forcePosted />
            </div>
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
        {preview && !(r ? worn : pathOn) ? (
          <>
            <button className="btn-primary mt-6 w-full" onClick={use} disabled={busy}>
              {busy ? <Spinner /> : top.kind === 'path' ? 'Usar o caminho completo' : 'Usar agora'}
            </button>
            <button className="mt-2 w-full py-2.5 text-[15px] font-extrabold text-[#8A6F57]" onClick={skip}>
              {queue.length > 1 ? `Agora não · próximo (${queue.length - 1})` : 'Agora não'}
            </button>
          </>
        ) : (
          <>
            {preview && <p className="mt-3 text-sm font-extrabold text-olive">Você já está usando ✓</p>}
            <button className="btn-primary mt-6 w-full" onClick={skip}>{nextLabel}</button>
          </>
        )}
      </div>
    </div>
  );
}
