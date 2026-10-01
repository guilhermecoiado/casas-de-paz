'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { computeStats, equipped, groupUnlocked, maxGroup, maxIndividual, todayIn, type Stats } from './game';
import type { Group, Member, Poll, PollAnswer, Post, Profile, Vote } from './types';

export interface GroupData {
  group: Group;
  members: Member[];
  profiles: Record<string, Profile>;
  posts: Post[];
  votes: Vote[];
  polls: Poll[];
  answers: PollAnswer[];
  today: string;
  stats: Stats;
  unlocked: Set<string>;
  isAdmin: boolean;
  me: string;
  myPoints: number;
  maxInd: number;
  maxGrp: number;
  look: (userId: string) => ReturnType<typeof equipped>;
  reload: () => Promise<void>;
  reloadProfiles: () => Promise<void>;
}

const Ctx = createContext<GroupData | null>(null);
export const useGroup = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGroup fora do GroupProvider');
  return v;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { [k: string]: any };

function applyChange<T>(list: T[], payload: RealtimePostgresChangesPayload<Row>, key: (r: T) => string, prepend = false): T[] {
  if (payload.eventType === 'DELETE') {
    const old = payload.old as unknown as T;
    if (!Object.keys(payload.old).length) return list;
    return list.filter((r) => key(r) !== key(old));
  }
  const row = payload.new as unknown as T;
  const i = list.findIndex((r) => key(r) === key(row));
  if (i >= 0) {
    const copy = list.slice();
    copy[i] = row;
    return copy;
  }
  return prepend ? [row, ...list] : [...list, row];
}

export function GroupProvider({ groupId, userId, children, fallback, onMissing }: {
  groupId: string;
  userId: string;
  children: React.ReactNode;
  fallback: React.ReactNode;
  onMissing: () => void;
}) {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [answers, setAnswers] = useState<PollAnswer[]>([]);
  const [today, setToday] = useState('');

  const reloadProfiles = useCallback(async () => {
    const { data } = await supabase.from('group_members').select('user_id, profiles(*)').eq('group_id', groupId);
    const map: Record<string, Profile> = {};
    (data ?? []).forEach((r) => {
      const p = (r as unknown as { profiles: Profile }).profiles;
      if (p) map[p.id] = p;
    });
    setProfiles(map);
  }, [groupId]);

  const reload = useCallback(async () => {
    const [g, m, p, v, pl, a] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('group_members').select('*').eq('group_id', groupId),
      supabase.from('posts').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(5000),
      supabase.from('post_votes').select('*').eq('group_id', groupId),
      supabase.from('polls').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('poll_answers').select('*').eq('group_id', groupId),
    ]);
    if (!g.data) return onMissing();
    setGroup(g.data as Group);
    setMembers((m.data ?? []) as Member[]);
    setPosts((p.data ?? []) as Post[]);
    setVotes((v.data ?? []) as Vote[]);
    setPolls((pl.data ?? []) as Poll[]);
    setAnswers((a.data ?? []) as PollAnswer[]);
    await reloadProfiles();
  }, [groupId, onMissing, reloadProfiles]);

  useEffect(() => {
    reload();
    const f = `group_id=eq.${groupId}`;
    const ch = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: f }, (pl) =>
        setPosts((l) => applyChange(l, pl, (r) => r.id, true)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_votes', filter: f }, (pl) =>
        setVotes((l) => applyChange(l, pl, (r) => `${r.post_id}:${r.user_id}`)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: f }, (pl) =>
        setPolls((l) => applyChange(l, pl, (r) => r.id, true)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_answers', filter: f }, (pl) =>
        setAnswers((l) => applyChange(l, pl, (r) => `${r.poll_id}:${r.user_id}`)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: f }, (pl) => {
        setMembers((l) => applyChange(l, pl, (r) => r.user_id));
        if (pl.eventType === 'INSERT') reloadProfiles();
        if (pl.eventType === 'DELETE' && (pl.old as Member).user_id === userId) onMissing();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, (pl) =>
        setGroup(pl.new as Group))
      .subscribe();

    // ao voltar para o app (PWA em segundo plano), sincroniza tudo
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [groupId, userId, reload, reloadProfiles, onMissing]);

  // "hoje" no fuso do grupo, atualizado a cada minuto
  useEffect(() => {
    if (!group) return;
    const tick = () => setToday(todayIn(group.timezone));
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [group]);

  const value = useMemo<GroupData | null>(() => {
    if (!group || !today) return null;
    const stats = computeStats(group, members, posts, today);
    const memberMap = new Map(members.map((m) => [m.user_id, m]));
    return {
      group, members, profiles, posts, votes, polls, answers, today, stats,
      unlocked: groupUnlocked(group, stats.groupPoints),
      isAdmin: group.admin_id === userId,
      me: userId,
      myPoints: stats.byUser[userId]?.points ?? 0,
      maxInd: maxIndividual(group),
      maxGrp: maxGroup(group),
      look: (uid: string) => equipped(group, memberMap.get(uid), stats.byUser[uid]?.points ?? 0),
      reload, reloadProfiles,
    };
  }, [group, members, profiles, posts, votes, polls, answers, today, userId, reload, reloadProfiles]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
