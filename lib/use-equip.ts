'use client';

import { useCallback, useState } from 'react';
import { useGroup } from './group-context';
import { useToast } from '@/components/Providers';
import { errMsg, supabase } from './supabase';
import { fieldOf, kitItems, type PathId, type Reward } from './rewards';

type Field = 'title' | 'avatar_frame' | 'tile_frame' | 'tile_color' | 'tile_anim';

/** Equipar/tirar itens do perfil (usado no "Meu perfil" e na tela de desbloqueio). */
export function useEquip() {
  const toast = useToast();
  const { group, me, members, look } = useGroup();
  const member = members.find((m) => m.user_id === me);
  const [saving, setSaving] = useState<string | null>(null);

  const save = useCallback(async (patch: Partial<Record<Field, string | null>>, key: string) => {
    if (!member) return false;
    const cur = { title: member.title, avatar_frame: member.avatar_frame, tile_frame: member.tile_frame, tile_color: member.tile_color, tile_anim: member.tile_anim, ...patch };
    setSaving(key);
    const { error } = await supabase.rpc('set_cosmetics', {
      p_group: group.id, p_title: cur.title, p_avatar_frame: cur.avatar_frame, p_tile_frame: cur.tile_frame,
      p_tile_color: cur.tile_color, p_tile_anim: cur.tile_anim,
    });
    setSaving(null);
    if (error) { toast(errMsg(error), 'error'); return false; }
    return true;
  }, [member, group.id, toast]);

  const isWorn = useCallback((r: Reward) => {
    if (r.kind === 'phrase' || !member) return false;
    return r.kind === 'title' ? look(me).titleId === r.id : member[fieldOf(r.kind)] === r.id;
  }, [member, look, me]);

  /** Toca para usar; toca de novo para tirar. */
  const equip = useCallback(async (r: Reward) => {
    if (r.kind === 'phrase' || !member) return false;
    return save({ [fieldOf(r.kind)]: isWorn(r) ? null : r.id }, r.id);
  }, [member, save, isWorn]);

  /** Só coloca (não tira se já estiver usando). */
  const wear = useCallback(async (r: Reward) => {
    if (r.kind === 'phrase' || !member || isWorn(r)) return true;
    return save({ [fieldOf(r.kind)]: r.id }, r.id);
  }, [member, save, isWorn]);

  const equipKit = useCallback(async (path: PathId) => {
    const patch: Partial<Record<Field, string>> = {};
    kitItems(path).forEach((r) => { if (r.kind !== 'phrase') patch[fieldOf(r.kind)] = r.id; });
    return save(patch, `kit:${path}`);
  }, [save]);

  return { member, saving, save, equip, wear, equipKit, isWorn };
}
