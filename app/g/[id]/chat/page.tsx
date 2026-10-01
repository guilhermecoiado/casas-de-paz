'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock, Send } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { errMsg, supabase } from '@/lib/supabase';
import { Avatar } from '@/components/ui';
import { useToast } from '@/components/Providers';
import { GROUP_UNLOCKS, groupThreshold } from '@/lib/game';
import type { Message } from '@/lib/types';

export default function Chat() {
  const { group, me, profiles, look, unlocked, stats, maxGrp } = useGroup();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const open = unlocked.has('chat');

  useEffect(() => {
    if (!open) return;
    supabase
      .from('messages').select('*').eq('group_id', group.id).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setMsgs(((data ?? []) as Message[]).reverse()));
    const ch = supabase
      .channel(`chat-${group.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${group.id}` }, (p) =>
        setMsgs((l) => (l.some((m) => m.id === (p.new as Message).id) ? l : [...l, p.new as Message])))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [group.id, open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    const { data, error } = await supabase.from('messages').insert({ group_id: group.id, user_id: me, body }).select().single();
    if (error) { setText(body); return toast(errMsg(error), 'error'); }
    setMsgs((l) => (l.some((m) => m.id === (data as Message).id) ? l : [...l, data as Message]));
  };

  const header = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-sand bg-cream/95 px-4 py-3 backdrop-blur pt-safe">
      <Link href={`/g/${group.id}`} className="rounded-full bg-sand p-2.5" aria-label="Voltar"><ArrowLeft size={20} /></Link>
      <div>
        <h1 className="font-display text-xl font-bold leading-tight">Chat</h1>
        <p className="text-xs font-bold text-[#a8927a]">{group.name}</p>
      </div>
    </header>
  );

  if (!open) {
    const need = groupThreshold(maxGrp, GROUP_UNLOCKS.find((u) => u.id === 'chat')!);
    return (
      <div className="min-h-[100dvh]">
        {header}
        <div className="flex flex-col items-center px-8 pt-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sand text-[#8A6F57]"><Lock size={36} /></div>
          <h2 className="mt-4 font-display text-2xl font-bold">Chat bloqueado</h2>
          <p className="mt-2 text-[#6b5643]">A equipe libera o chat ao chegar em {need} pontos. Faltam {Math.max(0, need - stats.groupPoints)}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      {header}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {msgs.map((m, i) => {
          const mine = m.user_id === me;
          const prev = msgs[i - 1];
          const showHead = !prev || prev.user_id !== m.user_id;
          const p = profiles[m.user_id];
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
              {!mine && <div className="w-8 shrink-0">{showHead && <Avatar url={p?.avatar_url} name={p?.name} size={32} frame={look(m.user_id).avatarFrame} />}</div>}
              <div className={`max-w-[75%] rounded-3xl px-4 py-2 ${mine ? 'rounded-br-lg bg-terra text-white' : 'rounded-bl-lg bg-white'}`}>
                {!mine && showHead && <p className="text-xs font-extrabold text-terra">{p?.name?.split(' ')[0]}</p>}
                <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/70' : 'text-[#a8927a]'}`}>
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        {msgs.length === 0 && <p className="pt-16 text-center font-bold text-[#a8927a]">Diga olá para o grupo 👋</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-sand bg-cream px-3 pt-2 pb-safe" style={{ paddingBottom: 'max(var(--safe-bottom), 8px)' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          maxLength={1000}
          placeholder="Mensagem"
          className="input max-h-32 flex-1 resize-none !rounded-3xl !py-2.5"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); send(e); } }}
        />
        <button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terra text-white disabled:opacity-50" disabled={!text.trim()} aria-label="Enviar">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
