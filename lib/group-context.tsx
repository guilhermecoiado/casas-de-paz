'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { computeStats, groupUnlocked, maxGroup, maxIndividual, todayIn, type Stats } from './game';
import { emptyProgress, equipped, type Look, type Progress } from './rewards';
import type { AppNotification, Comment, Group, Member, MemberItem, Poll, PollAnswer, Post, Profile, Reaction, StreakAward, Vote } from './types';

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
  awards: StreakAward[];
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

/** Busca todas as linhas (a API do Supabase devolve no máximo 1000 por vez). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(make: () => any, page = 1000): Promise<{ data: T[] | null; error: unknown }> {
  const all: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await make().range(from, from + page - 1);
    if (error) return { data: null, error };
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < page) return { data: all, error: null };
  }
}

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
  const [awards, setAwards] = useState<StreakAward[]>([]);
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
    const [g, m, p, v, pl, a, rx, cm, nt, it, aw] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('group_members').select('*').eq('group_id', groupId),
      fetchAll<Post>(() => supabase.from('posts').select('*').eq('group_id', groupId).not('status', 'in', '(archived,removed)').order('created_at', { ascending: false }).order('id')),
      fetchAll<Vote>(() => supabase.from('post_votes').select('*').eq('group_id', groupId).order('post_id').order('user_id')),
      supabase.from('polls').select('*').eq('group_id', groupId).eq('archived', false).order('created_at', { ascending: false }),
      fetchAll<PollAnswer>(() => supabase.from('poll_answers').select('*').eq('group_id', groupId).order('poll_id').order('user_id')),
      fetchAll<Reaction>(() => supabase.from('post_reactions').select('*').eq('group_id', groupId).order('created_at').order('post_id')),
      fetchAll<Comment>(() => supabase.from('post_comments').select('*').eq('group_id', groupId).order('created_at').order('id')),
      supabase.from('notifications').select('*').eq('group_id', groupId).eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
      fetchAll<MemberItem>(() => supabase.from('member_items').select('*').eq('group_id', groupId).order('post_id')),
      supabase.from('streak_awards').select('*').eq('group_id', groupId),
    ]);
    // só sai do grupo se ele realmente não existe mais (sem sinal ≠ grupo excluído)
    if (g.error) return;
    if (!g.data) return onMissing();
    setGroup(g.data as Group);
    // em erro de rede, mantém o que já estava na tela
    if (!m.error) setMembers((m.data ?? []) as Member[]);
    if (!p.error) setPosts((p.data ?? []) as Post[]);
    if (!v.error) setVotes((v.data ?? []) as Vote[]);
    if (!pl.error) setPolls((pl.data ?? []) as Poll[]);
    if (!a.error) setAnswers((a.data ?? []) as PollAnswer[]);
    if (!rx.error) setReactions((rx.data ?? []) as Reaction[]);
    if (!cm.error) setComments((cm.data ?? []) as Comment[]);
    if (!nt.error) setNotifications((nt.data ?? []) as AppNotification[]);
    if (!it.error) setItems((it.data ?? []) as MemberItem[]);
    if (!aw.error) setAwards((aw.data ?? []) as StreakAward[]);
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
        if ((pl.new as Post | undefined)?.type === 'streak')
          supabase.from('streak_awards').select('*').eq('group_id', groupId).then(({ data }) => setAwards((data ?? []) as StreakAward[]));
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

    // o adm excluiu o grupo: todo mundo sai na hora
    const del = supabase.channel(`groupdel-${groupId}`).on('broadcast', { event: 'deleted' }, () => onMissing()).subscribe();

    // ao voltar para o app (PWA em segundo plano), sincroniza tudo
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(del);
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

  // cálculo pesado separado: só refaz quando posts/membros mudam (não a cada reação ou comentário)
  const stats = useMemo(() => (group && today ? computeStats(group, members, posts, today) : null), [group, members, posts, today]);
  const derived = useMemo(() => {
    if (!group || !stats) return null;
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
    // níveis do intensivo só valem se o bônus continua válido (temporada zerada ou bônus cancelado não contam)
    const validAwards = awards.filter((a) => a.post_id && valid.has(a.post_id) && valid.get(a.post_id) !== 'cancelled');
    return {
      prog,
      look: (uid: string) => equipped(group, memberMap.get(uid), prog(uid)),
      validAwards,
      unlocked: groupUnlocked(maxGroup(group, members.length), stats.groupPoints),
    };
  }, [group, stats, members, posts, items, awards]);

  const value = useMemo<GroupData | null>(() => {
    if (!group || !today || !stats || !derived) return null;
    const { prog } = derived;
    return {
      group, members, profiles, posts, votes, polls, answers, reactions, comments, notifications, items, awards: derived.validAwards, unread, setNotifications, today, stats,
      unlocked: derived.unlocked,
      isAdmin: group.admin_id === userId,
      me: userId,
      myPoints: stats.byUser[userId]?.points ?? 0,
      maxInd: maxIndividual(group),
      maxGrp: maxGroup(group, members.length),
      look: derived.look,
      progress: prog,
      reload, reloadProfiles,
    };
  }, [group, members, profiles, posts, votes, polls, answers, reactions, comments, notifications, items, unread, today, userId, reload, reloadProfiles, stats, derived]);

  if (!value) return <>{fallback}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
