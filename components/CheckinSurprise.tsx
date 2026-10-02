'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { KIND_LABEL, RARITY, fieldOf, rewardById } from '@/lib/rewards';
import { errMsg, supabase } from '@/lib/supabase';
import { RewardPreview } from './Evolution';
import { Confetti } from './Confetti';
import { useToast } from './Providers';
import { Spinner } from './ui';

/** Caixa surpresa do check-in: toque para abrir e descobrir o item sorteado. */
export function CheckinSurprise({ postId }: { postId: string }) {
  const { group, me, members, profiles, items } = useGroup();
  const toast = useToast();
  const [itemId, setItemId] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [using, setUsing] = useState(false);
  const [used, setUsed] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t); }, []);

  // o sorteio acontece no servidor junto com o check-in
  useEffect(() => {
    const local = items.find((i) => i.post_id === postId);
    if (local) { setItemId(local.item_id); return; }
    let alive = true;
    supabase.from('member_items').select('item_id').eq('post_id', postId).maybeSingle().then(({ data }) => {
      if (alive) setItemId(data?.item_id ?? null);
    });
    return () => { alive = false; };
  }, [postId, items]);

  const r = itemId ? rewardById(itemId) : undefined;
  if (itemId === undefined)
    return slow ? (
      <div className="rounded-3xl bg-white p-4 text-center text-sm font-bold text-[#6b5643]">🎁 Seu item surpresa já está guardado: veja em Meu perfil → Surpresas do check-in.</div>
    ) : <div className="flex justify-center py-6"><Spinner className="h-6 w-6 text-terra" /></div>;
  if (!r)
    return (
      <div className="rounded-3xl bg-white p-4 text-center">
        <p className="font-display text-lg font-bold">🎁 Coleção completa!</p>
        <p className="text-sm text-[#8A6F57]">Você já tem todas as surpresas do check-in. Que fidelidade!</p>
      </div>
    );

  const rar = RARITY[r.drop ?? 'comum'];
  const member = members.find((m) => m.user_id === me);

  const use = async () => {
    if (!member || r.kind === 'phrase') return;
    setUsing(true);
    const cur = { title: member.title, avatar_frame: member.avatar_frame, tile_frame: member.tile_frame, tile_color: member.tile_color, tile_anim: member.tile_anim, [fieldOf(r.kind)]: r.id };
    const { error } = await supabase.rpc('set_cosmetics', {
      p_group: group.id, p_title: cur.title, p_avatar_frame: cur.avatar_frame, p_tile_frame: cur.tile_frame, p_tile_color: cur.tile_color, p_tile_anim: cur.tile_anim,
    });
    setUsing(false);
    if (error) return toast(errMsg(error), 'error');
    setUsed(true);
  };

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-3xl bg-gradient-to-br from-[#2b2118] to-[#5a3a26] p-5 text-center text-white shadow-lg active:scale-[0.98]">
        <span className="gift-shake inline-block text-6xl">🎁</span>
        <p className="mt-2 font-display text-xl font-bold">O que seu check-in liberou hoje?</p>
        <p className="text-sm font-bold text-amber">Toque para abrir</p>
      </button>
    );

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b2118] to-[#5a3a26] p-5 text-center text-white shadow-lg">
      {r.drop !== 'comum' && <Confetti duration={r.drop === 'lendario' ? 5000 : 2500} />}
      <div className="rays pointer-events-none absolute -inset-1/2 opacity-60" />
      <div className="relative">
        <span className={`chip ${rar.cls}`}>{rar.label}</span>
        <div className="reveal-burst mx-auto mt-3 flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-ink shadow-xl [&>*]:scale-[1.6]">
          <RewardPreview r={r} url={profiles[me]?.avatar_url} name={profiles[me]?.name} />
        </div>
        <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.18em] text-white/70">{KIND_LABEL[r.kind]}</p>
        <p className="font-display text-2xl font-extrabold">{r.icon} {r.name}</p>
        {r.kind === 'phrase' ? (
          <p className="mt-2 text-sm text-white/80">Nova frase para usar sobre as suas fotos ao compartilhar.</p>
        ) : (
          <button onClick={use} disabled={using || used} className="btn mt-4 w-full bg-amber text-ink">
            {using ? <Spinner /> : used ? <><Check size={18} /> Em uso!</> : 'Usar agora'}
          </button>
        )}
        <p className="mt-3 text-[11px] font-bold text-white/60">Cada check-in sorteia um item diferente. Volte no próximo encontro!</p>
      </div>
    </div>
  );
}
