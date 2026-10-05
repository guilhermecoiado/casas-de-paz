'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, SendHorizontal, Trash2 } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { timeAgo } from '@/lib/game';
import { errMsg, supabase } from '@/lib/supabase';
import { REACTIONS, type Comment, type Post, type ReactionEmoji } from '@/lib/types';
import { useConfirm, useToast } from './Providers';
import { Avatar, Sheet, Spinner } from './ui';

const QUICK = ['🙏', '❤️', '🔥', '🙌', '😂', '👏', '✨', '🏠', '🥹', '💪'];

/** Reações rápidas e comentários de um post do feed. */
export function PostSocial({ post, autoOpen = false }: { post: Post; autoOpen?: boolean }) {
  const { reactions, comments, me, profiles, setReactionsOptimistic } = useSocial();
  const [open, setOpen] = useState(autoOpen);
  const [who, setWho] = useState(false);
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);

  const mine = useMemo(() => reactions.filter((r) => r.post_id === post.id && r.user_id === me).map((r) => r.emoji), [reactions, post.id, me]);
  const counts = useMemo(() => {
    const c: Partial<Record<ReactionEmoji, number>> = {};
    reactions.forEach((r) => { if (r.post_id === post.id) c[r.emoji] = (c[r.emoji] ?? 0) + 1; });
    return c;
  }, [reactions, post.id]);
  const list = useMemo(() => comments.filter((c) => c.post_id === post.id), [comments, post.id]);
  const last = list[list.length - 1];
  // quem reagiu (mais recentes primeiro), com os emojis de cada pessoa
  const reactors = useMemo(() => {
    const m = new Map<string, ReactionEmoji[]>();
    reactions
      .filter((r) => r.post_id === post.id)
      .sort((a, b) => ((a.created_at || '9') < (b.created_at || '9') ? 1 : -1))
      .forEach((r) => m.set(r.user_id, [...(m.get(r.user_id) ?? []), r.emoji]));
    return Array.from(m.entries()).map(([user_id, emojis]) => ({ user_id, emojis }));
  }, [reactions, post.id]);
  const firstName = (uid: string) => (uid === me ? 'Você' : profiles[uid]?.name?.split(' ')[0] ?? '…');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {REACTIONS.map((e) => {
          const on = mine.includes(e);
          const n = counts[e] ?? 0;
          return (
            <button
              key={e}
              onClick={() => setReactionsOptimistic(post, e, on)}
              aria-pressed={on}
              aria-label={`Reagir com ${e}`}
              className={`flex h-9 items-center gap-1 rounded-full border px-2.5 text-[17px] transition active:scale-90 ${on ? 'border-terra/40 bg-terra/10' : 'border-sand bg-white'}`}
            >
              <span className={on ? 'react-pop' : ''}>{e}</span>
              {n > 0 && <span className={`text-xs font-extrabold ${on ? 'text-terra' : 'text-[#8A6F57]'}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      {reactors.length > 0 && (
        <button onClick={() => setWho(true)} className="flex w-full items-center gap-2 text-left" aria-label="Ver quem reagiu">
          <span className="flex -space-x-1.5">
            {reactors.slice(0, 3).map((r) => (
              <span key={r.user_id} className="rounded-full ring-2 ring-white"><Avatar url={profiles[r.user_id]?.avatar_url} name={profiles[r.user_id]?.name} size={24} /></span>
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#8A6F57]">
            {reactors.length === 1
              ? `${firstName(reactors[0].user_id)} reagiu`
              : reactors.length === 2
                ? `${firstName(reactors[0].user_id)} e ${firstName(reactors[1].user_id)} reagiram`
                : `${firstName(reactors[0].user_id)}, ${firstName(reactors[1].user_id)} e mais ${reactors.length - 2} reagiram`}
          </span>
        </button>
      )}

      <button onClick={() => setOpen(true)} className="w-full text-left">
        {last ? (
          <div className="space-y-0.5">
            {list.length > 1 && <p className="text-sm font-bold text-[#a8927a]">Ver os {list.length} comentários</p>}
            <p className="line-clamp-2 text-sm leading-snug">
              <span className="font-extrabold">{profiles[last.user_id]?.name?.split(' ')[0] ?? '…'}</span> {last.body}
            </p>
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-bold text-[#a8927a]"><MessageCircle size={16} /> Comentar</span>
        )}
      </button>

      <CommentsSheet open={open} onClose={() => setOpen(false)} post={post} list={list} />
      <ReactionsSheet open={who} onClose={() => setWho(false)} reactors={reactors} />
    </div>
  );
}

/** Lista de quem reagiu, com filtro por emoji. */
function ReactionsSheet({ open, onClose, reactors }: { open: boolean; onClose: () => void; reactors: { user_id: string; emojis: ReactionEmoji[] }[] }) {
  const { profiles, look, me } = useGroup();
  const [tab, setTab] = useState<ReactionEmoji | 'all'>('all');
  useEffect(() => { if (open) setTab('all'); }, [open]);
  const total = reactors.reduce((n, r) => n + r.emojis.length, 0);
  const tabs = REACTIONS.map((e) => ({ e, n: reactors.filter((r) => r.emojis.includes(e)).length })).filter((t) => t.n > 0);
  const shown = tab === 'all' ? reactors : reactors.filter((r) => r.emojis.includes(tab));
  return (
    <Sheet open={open} onClose={onClose} title="Reações">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
        <button onClick={() => setTab('all')} className={`chip shrink-0 !px-3.5 !py-2 !text-sm ${tab === 'all' ? 'bg-ink text-white' : 'bg-white text-[#6b5643]'}`}>Todas · {total}</button>
        {tabs.map((t) => (
          <button key={t.e} onClick={() => setTab(t.e)} className={`chip shrink-0 !px-3.5 !py-2 !text-sm ${tab === t.e ? 'bg-ink text-white' : 'bg-white text-[#6b5643]'}`}>
            <span className="text-base">{t.e}</span> {t.n}
          </button>
        ))}
      </div>
      <div className="max-h-[52vh] space-y-1 overflow-y-auto">
        {shown.map((r) => {
          const p = profiles[r.user_id];
          return (
            <div key={r.user_id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
              <Avatar url={p?.avatar_url} name={p?.name} size={40} frame={look(r.user_id).avatarFrame} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold leading-tight">{p?.name ?? '…'}{r.user_id === me ? ' (você)' : ''}</p>
                <p className="truncate text-xs font-bold text-[#a8927a]">{look(r.user_id).title}</p>
              </div>
              <span className="shrink-0 text-xl tracking-wider">{(tab === 'all' ? r.emojis : [tab]).join('')}</span>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/** Estado compartilhado + reação com resposta imediata na tela. */
function useSocial() {
  const g = useGroup();
  const toast = useToast();
  const [optimistic, setOptimistic] = useState<{ key: string; add: boolean }[]>([]);

  const reactions = useMemo(() => {
    let r = g.reactions;
    for (const o of optimistic) {
      const [post_id, emoji] = o.key.split('|');
      const has = r.some((x) => x.post_id === post_id && x.user_id === g.me && x.emoji === emoji);
      if (o.add && !has) r = [...r, { post_id, emoji: emoji as ReactionEmoji, user_id: g.me, group_id: g.group.id, created_at: '' }];
      if (!o.add && has) r = r.filter((x) => !(x.post_id === post_id && x.user_id === g.me && x.emoji === emoji));
    }
    return r;
  }, [g.reactions, optimistic, g.me, g.group.id]);

  const setReactionsOptimistic = async (post: Post, emoji: ReactionEmoji, on: boolean) => {
    const key = `${post.id}|${emoji}`;
    setOptimistic((l) => [...l.filter((x) => x.key !== key), { key, add: !on }]);
    const { error } = on
      ? await supabase.from('post_reactions').delete().match({ post_id: post.id, user_id: g.me, emoji })
      : await supabase.from('post_reactions').insert({ post_id: post.id, group_id: post.group_id, user_id: g.me, emoji });
    if (error && !/duplicate/i.test(error.message)) toast(errMsg(error), 'error');
    // a confirmação chega pelo tempo real; depois disso o ajuste local não é mais necessário
    setTimeout(() => setOptimistic((l) => l.filter((x) => x.key !== key)), error ? 0 : 15000);
  };

  return { ...g, reactions, setReactionsOptimistic };
}

function CommentsSheet({ open, onClose, post, list }: { open: boolean; onClose: () => void; post: Post; list: Comment[] }) {
  const { profiles, look, me, isAdmin } = useGroup();
  const toast = useToast();
  const ask = useConfirm();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 60);
  }, [open, list.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from('post_comments').insert({ post_id: post.id, group_id: post.group_id, user_id: me, body });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    setText('');
  };

  const del = async (c: Comment) => {
    if (!(await ask({ title: 'Apagar este comentário?', confirmLabel: 'Apagar', danger: true }))) return;
    const { error } = await supabase.from('post_comments').delete().eq('id', c.id);
    if (error) toast(errMsg(error), 'error');
  };

  const addEmoji = (e: string) => {
    setText((t) => (t && !t.endsWith(' ') ? `${t} ${e}` : `${t}${e}`));
    inputRef.current?.focus();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Comentários">
      <div className="max-h-[48vh] space-y-3 overflow-y-auto pb-2">
        {list.length === 0 && <p className="py-8 text-center font-bold text-[#a8927a]">Seja o primeiro a comentar ✨</p>}
        {list.map((c) => {
          const p = profiles[c.user_id];
          return (
            <div key={c.id} className="flex gap-2.5">
              <Avatar url={p?.avatar_url} name={p?.name} size={34} frame={look(c.user_id).avatarFrame} />
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl rounded-tl-md bg-cream px-3 py-2">
                  <p className="text-sm font-extrabold leading-tight">{p?.name ?? '…'}</p>
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{c.body}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-3 pl-2 text-xs font-bold text-[#a8927a]">
                  <span>{timeAgo(c.created_at)}</span>
                  {(c.user_id === me || isAdmin) && (
                    <button onClick={() => del(c)} className="-my-2 flex items-center gap-1 px-1 py-2 text-[#a8927a]"><Trash2 size={13} /> Apagar</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto border-t border-sand px-5 pt-3">
        {QUICK.map((e) => (
          <button key={e} onClick={() => addEmoji(e)} className="h-10 w-10 shrink-0 rounded-full bg-cream text-xl active:scale-90" aria-label={`Inserir ${e}`}>{e}</button>
        ))}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={1}
          placeholder="Escreva um comentário…"
          className="input max-h-28 min-h-[48px] flex-1 resize-none !py-3"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button onClick={send} disabled={busy || !text.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terra text-white disabled:opacity-40" aria-label="Enviar comentário">
          {busy ? <Spinner /> : <SendHorizontal size={20} />}
        </button>
      </div>
    </Sheet>
  );
}
