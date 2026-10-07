'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Quantas mensagens/desafios novos (de outras pessoas) chegaram no chat desde a última vez que você abriu. */
export function useChatUnread(groupId: string, me: string, enabled: boolean) {
  const [n, setN] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return setN(0);
    const { data: r } = await supabase.from('chat_reads').select('last_read_at').eq('group_id', groupId).eq('user_id', me).maybeSingle();
    const since = (r?.last_read_at as string | undefined) ?? '1970-01-01T00:00:00Z';
    const [m, c] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('group_id', groupId).neq('user_id', me).gt('created_at', since),
      supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('group_id', groupId).neq('user_id', me).gt('created_at', since),
    ]);
    setN((m.count ?? 0) + (c.count ?? 0));
  }, [groupId, me, enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return;
    const f = `group_id=eq.${groupId}`;
    const ch = supabase
      .channel(`chatbadge-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: f }, (p) => { if ((p.new as { user_id: string }).user_id !== me) setN((x) => x + 1); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'challenges', filter: f }, (p) => { if ((p.new as { user_id: string }).user_id !== me) setN((x) => x + 1); })
      .subscribe();
    const onRead = () => setN(0);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('chat-read', onRead);
    document.addEventListener('visibilitychange', onFocus);
    return () => { supabase.removeChannel(ch); window.removeEventListener('chat-read', onRead); document.removeEventListener('visibilitychange', onFocus); };
  }, [groupId, me, enabled, refresh]);

  return n;
}
