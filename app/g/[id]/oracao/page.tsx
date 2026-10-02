'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, HandHeart, Trash2 } from 'lucide-react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useGroup } from '@/lib/group-context';
import { timeAgo } from '@/lib/game';
import { errMsg, supabase } from '@/lib/supabase';
import { useConfirm, useToast } from '@/components/Providers';
import { Avatar, Spinner } from '@/components/ui';
import type { PrayerAmen, PrayerRequest } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { [k: string]: any };
function apply<T>(list: T[], pl: RealtimePostgresChangesPayload<Row>, key: (r: T) => string, prepend = false): T[] {
  if (pl.eventType === 'DELETE') {
    const old = pl.old as unknown as T;
    return list.filter((r) => key(r) !== key(old));
  }
  const row = pl.new as unknown as T;
  const i = list.findIndex((r) => key(r) === key(row));
  if (i >= 0) { const c = list.slice(); c[i] = row; return c; }
  return prepend ? [row, ...list] : [...list, row];
}

export default function Oracao() {
  const { group, me, profiles, look, isAdmin, posts, today } = useGroup();
  const toast = useToast();
  const ask = useConfirm();
  const [requests, setRequests] = useState<PrayerRequest[] | null>(null);
  const [amens, setAmens] = useState<PrayerAmen[]>([]);
  const [tab, setTab] = useState<'open' | 'answered'>('open');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      supabase.from('prayer_requests').select('*').eq('group_id', group.id).order('created_at', { ascending: false }).limit(300),
      supabase.from('prayer_amens').select('*').eq('group_id', group.id),
    ]);
    setRequests((r.data ?? []) as PrayerRequest[]);
    setAmens((a.data ?? []) as PrayerAmen[]);
  }, [group.id]);

  useEffect(() => {
    load();
    const f = `group_id=eq.${group.id}`;
    const ch = supabase
      .channel(`prayer-${group.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prayer_requests', filter: f }, (pl) =>
        setRequests((l) => apply(l ?? [], pl, (r) => String(r.id), true)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prayer_amens', filter: f }, (pl) =>
        setAmens((l) => apply(l, pl, (r) => `${r.request_id}:${r.user_id}`)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [group.id, load]);

  const prayedToday = posts.some((p) => p.user_id === me && p.type === 'prayer' && p.local_date === today && p.status !== 'cancelled');
  const list = useMemo(() => (requests ?? []).filter((r) => (tab === 'open' ? !r.answered_at : !!r.answered_at)), [requests, tab]);
  const answeredCount = (requests ?? []).filter((r) => r.answered_at).length;

  const send = async () => {
    const body = text.trim();
    if (body.length < 3) return toast('Escreva o seu pedido', 'error');
    setBusy(true);
    const { error } = await supabase.from('prayer_requests').insert({ group_id: group.id, user_id: me, body });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    setText('');
    setTab('open');
    toast('Pedido no mural 🙏');
  };

  const toggleAmen = async (r: PrayerRequest, on: boolean) => {
    // resposta imediata na tela; o tempo real confirma
    if (on) setAmens((l) => l.filter((a) => !(a.request_id === r.id && a.user_id === me)));
    else setAmens((l) => [...l, { request_id: r.id, group_id: group.id, user_id: me, created_at: new Date().toISOString() }]);
    const { error } = on
      ? await supabase.from('prayer_amens').delete().match({ request_id: r.id, user_id: me })
      : await supabase.from('prayer_amens').insert({ request_id: r.id, group_id: group.id, user_id: me });
    if (error && !/duplicate/i.test(error.message)) { toast(errMsg(error), 'error'); load(); }
  };

  const answer = async (r: PrayerRequest) => {
    const { error } = await supabase.from('prayer_requests').update({ answered_at: r.answered_at ? null : new Date().toISOString() }).eq('id', r.id);
    if (error) return toast(errMsg(error), 'error');
    if (!r.answered_at) toast('Glória a Deus! 🙌');
  };

  const del = async (r: PrayerRequest) => {
    if (!(await ask({ title: 'Apagar este pedido?', message: 'Ele sai do mural para todos.', confirmLabel: 'Apagar', danger: true }))) return;
    const { error } = await supabase.from('prayer_requests').delete().eq('id', r.id);
    if (error) toast(errMsg(error), 'error');
  };

  return (
    <div className="pt-safe">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-cream/95 px-3 pb-2 pt-3 backdrop-blur">
        <Link href={`/g/${group.id}`} className="rounded-full p-2" aria-label="Voltar"><ArrowLeft size={22} /></Link>
        <h1 className="flex-1 font-display text-[24px] font-extrabold">Mural de oração</h1>
      </header>

      <div className="space-y-3 px-4">
        <div className="card p-3">
          <textarea
            className="input min-h-[84px] resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={400}
            placeholder="Qual é o seu pedido de oração?"
          />
          <button className="btn-primary mt-2 w-full" onClick={send} disabled={busy || text.trim().length < 3}>
            {busy ? <Spinner /> : <><HandHeart size={18} /> Pedir oração</>}
          </button>
        </div>

        {!prayedToday && (
          <Link href={`/g/${group.id}/postar?acao=prayer`} className="flex items-center gap-3 rounded-2xl bg-olive/15 p-3 active:scale-[0.99]">
            <span className="text-2xl">🙏</span>
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-[#3f5a24]">
              Orou pelos pedidos hoje? Registre <b>Orei pela Casa de Paz</b> e ganhe pontos.
            </span>
            <span className="chip bg-olive text-white">Registrar</span>
          </Link>
        )}

        <div className="grid grid-cols-2 rounded-2xl bg-sand p-1">
          {([['open', 'Pedidos'], ['answered', `Respondidos 🙌${answeredCount ? ` (${answeredCount})` : ''}`]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-xl py-2 text-sm font-extrabold transition ${tab === id ? 'bg-white text-ink shadow-sm' : 'text-[#8A6F57]'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4 pb-8 pt-3">
        {requests === null && <div className="flex justify-center py-10"><Spinner className="h-7 w-7 text-terra" /></div>}
        {requests !== null && list.length === 0 && (
          <p className="py-12 text-center font-bold text-[#a8927a]">
            {tab === 'open' ? 'Nenhum pedido ainda. Compartilhe o seu 🙏' : 'Quando Deus responder um pedido, ele aparece aqui.'}
          </p>
        )}
        {list.map((r) => {
          const who = amens.filter((a) => a.request_id === r.id);
          const mine = who.some((a) => a.user_id === me);
          const p = profiles[r.user_id];
          const own = r.user_id === me;
          return (
            <article key={r.id} className={`card p-4 ${r.answered_at ? 'ring-2 ring-amber/50' : ''}`}>
              <div className="flex items-center gap-2.5">
                <Avatar url={p?.avatar_url} name={p?.name} size={38} frame={look(r.user_id).avatarFrame} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold leading-tight">{p?.name ?? '…'}{own ? ' (você)' : ''}</p>
                  <p className="text-xs font-bold text-[#a8927a]">{timeAgo(r.created_at)}</p>
                </div>
                {r.answered_at && <span className="chip bg-amber/25 text-[#9a5b00]">🙌 Respondido</span>}
              </div>
              <p className="mt-2.5 whitespace-pre-wrap text-[15px] leading-snug">{r.body}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => toggleAmen(r, mine)}
                  aria-pressed={mine}
                  className={`flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-extrabold transition active:scale-95 ${mine ? 'border-olive bg-olive text-white' : 'border-sand bg-white text-[#6b5643]'}`}
                >
                  <span className={mine ? 'react-pop' : ''}>🙏</span> {mine ? 'Orei' : 'Orar'}{who.length ? ` · ${who.length}` : ''}
                </button>
                <div className="flex -space-x-2">
                  {who.slice(0, 5).map((a) => (
                    <span key={a.user_id} className="rounded-full ring-2 ring-white"><Avatar url={profiles[a.user_id]?.avatar_url} name={profiles[a.user_id]?.name} size={24} /></span>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {own && (
                    <button onClick={() => answer(r)} className="chip bg-sand !py-2 text-[#6b5643]">
                      <Check size={13} /> {r.answered_at ? 'Desfazer' : 'Respondido'}
                    </button>
                  )}
                  {(own || isAdmin) && (
                    <button onClick={() => del(r)} className="rounded-full p-2 text-[#c4b09a]" aria-label="Apagar pedido"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
