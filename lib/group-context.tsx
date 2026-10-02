'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { computeStats, groupUnlocked, maxGroup, maxIndividual, todayIn, type Stats } from './game';
import { emptyProgress, equipped, type Look, type Progress } from './rewards';
import type { AppNotification, Comment, Group, Member, MemberItem, Poll, PollAnswer, Post, Profile, Reaction, Vote } from './types';

export interface GroupData {
  group: Group;
  members: Member[];
  profiles: Record<string, Profile>;
  posts: Post[];
  votes: Vote[];
  polls: Poll[];
  answers: PollAnswer[];
  reactions: Reaction[];
  comments: Comment[];
  notifications: AppNotification[];
  items: MemberItem[];
  unread: number;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  today: string;
  stats: Stats;
  unlocked: Set<string>;
  isAdmin: boolean;
  me: string;
  myPoints: number;
  maxInd: number;
  maxGrp: number;
  look: (userId: string) => Look;
  progress: (userId: string) => Progress;
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
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [items, setItems] = useState<MemberItem[]>([]);
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
    const [g, m, p, v, pl, a, rx, cm, nt, it] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('group_members').select('*').eq('group_id', groupId),
      supabase.from('posts').select('*').eq('group_id', groupId).not('status', 'in', '(archived,removed)').order('created_at', { ascending: false }).limit(5000),
      supabase.from('post_votes').select('*').eq('group_id', groupId),
      supabase.from('polls').select('*').eq('group_id', groupId).eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('poll_answers').select('*').eq('group_id', groupId),
      supabase.from('post_reactions').select('*').eq('group_id', groupId),
      supabase.from('post_comments').select('*').eq('group_id', groupId).order('created_at').limit(5000),
      supabase.from('notifications').select('*').eq('group_id', groupId).eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
      supabase.from('member_items').select('*').eq('group_id', groupId),
    ]);
    if (!g.data) return onMissing();
    setGroup(g.data as Group);
    setMembers((m.data ?? []) as Member[]);
    setPosts((p.data ?? []) as Post[]);
    setVotes((v.data ?? []) as Vote[]);
    setPolls((pl.data ?? []) as Poll[]);
    setAnswers((a.data ?? []) as PollAnswer[]);
    setReactions((rx.data ?? []) as Reaction[]);
    setComments((cm.data ?? []) as Comment[]);
    setNotifications((nt.data ?? []) as AppNotification[]);
    setItems((it.data ?? []) as MemberItem[]);
    await reloadProfiles();
  }, [groupId, userId, onMissing, reloadProfiles]);

  useEffect(() => {
    reload();
    const f = `group_id=eq.${groupId}`;
    const ch = supabase
      .channel(`group-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: f }, (pl) => {
        const st = (pl.new as Post | undefined)?.status;
        // removidos e arquivados (temporada zerada) saem da tela na hora
        if (st === 'removed' || st === 'archived') setPosts((l) => l.filter((x) => x.id !== (pl.new as Post).id));
        else setPosts((l) => applyChange(l, pl, (r) => r.id, true));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_votes', filter: f }, (pl) =>
        setVotes((l) => applyChange(l, pl, (r) => `${r.post_id}:${r.user_id}`)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: f }, (pl) => {
        if ((pl.new as Poll | undefined)?.archived) setPolls((l) => l.filter((x) => x.id !== (pl.new as Poll).id));
        else setPolls((l) => applyChange(l, pl, (r) => r.id, true));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_answers', filter: f }, (pl) =>
        setAnswers((l) => applyChange(l, pl, (r) => `${r.poll_id}:${r.user_id}`)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: f }, (pl) => {
        setMembers((l) => applyChange(l, pl, (r) => r.user_id));
        if (pl.eventType === 'INSERT') reloadProfiles();
        if (pl.eventType === 'DELETE' && (pl.old as Member).user_id === userId) onMissing();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${groupId}` }, (pl) =>
        setGroup(pl.new as Group))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions', filter: f }, (pl) =>
        setReactions((l) => applyChange(l, pl, (r) => `${r.post_id}:${r.user_id}:${r.emoji}`)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_items', filter: f }, (pl) =>
        setItems((l) => applyChange(l, pl, (r) => r.post_id)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: f }, (pl) =>
        setComments((l) => applyChange(l, pl, (r) => String(r.id))))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (pl) => {
        const row = (pl.new ?? {}) as AppNotification;
        if (pl.eventType !== 'DELETE' && row.group_id !== groupId) return;
        setNotifications((l) => applyChange(l, pl, (r) => String(r.id), true));
      })
      .subscribe();

    // ao voltar para o app (PWA em segundo plano), sincroniza tudo
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      supabase.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [groupId, userId, reload, reloadProfiles, onMissing]);

  // contador no ícone do app (Android/iOS instalados)
  const unread = useMemo(() => notifications.filter((n) => !n.read_at).length, [notifications]);
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      if (unread > 0) nav.setAppBadge?.(unread)?.catch(() => {});
      else nav.clearAppBadge?.()?.catch(() => {});
    } catch { /* sem suporte */ }
  }, [unread]);

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
    // surpresas do check-in: só contam se o check-in continua válido
    const valid = new Map(posts.map((p) => [p.id, p.status]));
    const ownedBy = new Map<string, string[]>();
    items.forEach((i) => {
      const st = valid.get(i.post_id);
      if (!st || st === 'cancelled') return;
      ownedBy.set(i.user_id, [...(ownedBy.get(i.user_id) ?? []), i.item_id]);
    });
    const prog = (uid: string) => ({ ...(stats.byUser[uid] ?? emptyProgress()), owned: ownedBy.get(uid) ?? [] });
    return {
      group, members, profiles, posts, votes, polls, answers, reactions, comments, notifications, items, unread, setNotifications, today, stats,
      unlocked: groupUnlocked(maxGroup(group, members.length), stats.groupPoints),
      isAdmin: group.admin_id === userId,
      me: userId,
      myPoints: stats.byUser[userId]?.points ?? 0,
      maxInd: maxIndividual(group),
      maxGrp: maxGroup(group, members.length),
      look: (uid: string) => equipped(group, memberMap.get(uid), prog(uid)),
      progress: prog,
      reload, reloadProfiles,
    };
  }, [group, members, profiles, posts, votes, polls, answers, reactions, comments, notifications, items, unread, today, userId, reload, reloadProfiles]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
