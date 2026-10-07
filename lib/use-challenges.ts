'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Challenge, Post } from './types';

// cache curto por grupo: vários cards do feed usam a mesma lista
const cache = new Map<string, { at: number; p: Promise<Challenge[]> }>();

export function useGroupChallenges(groupId: string, enabled = true) {
  const [list, setList] = useState<Challenge[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let hit = cache.get(groupId);
    if (!hit || Date.now() - hit.at > 30_000) {
      const p = Promise.resolve(
        supabase.from('challenges').select('*').eq('group_id', groupId).eq('archived', false).order('created_at', { ascending: false }).limit(300),
      ).then(({ data }) => (data ?? []) as Challenge[]).catch(() => [] as Challenge[]);
      hit = { at: Date.now(), p };
      cache.set(groupId, hit);
    }
    let alive = true;
    hit.p.then((l) => { if (alive) setList(l); });
    return () => { alive = false; };
  }, [groupId, enabled]);
  return list;
}

/** Desafio ligado a um post de pontos do desafio (quem lançou ou quem decifrou). */
export function challengeOfPost(list: Challenge[], post: Post) {
  if (post.type === 'challenge') return list.find((c) => c.user_id === post.user_id && c.local_date === post.local_date) ?? null;
  if (post.type === 'riddle')
    return list.find((c) => c.solved_by === post.user_id && c.local_date === post.local_date && (!post.description || post.description.includes(c.emojis)))
      ?? list.find((c) => c.solved_by === post.user_id && c.local_date === post.local_date) ?? null;
  return null;
}
