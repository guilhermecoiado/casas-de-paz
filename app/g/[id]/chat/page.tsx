'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, Lock, Puzzle, Send, Smile, X } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { errMsg, supabase } from '@/lib/supabase';
import { Avatar, Sheet, Spinner } from '@/components/ui';
import { useToast } from '@/components/Providers';
import { EmojiField, EmojiKeyboard, useEmojiInput } from '@/components/EmojiKeyboard';
import { Confetti } from '@/components/Confetti';
import { GROUP_UNLOCKS, groupThreshold } from '@/lib/game';
import { CHALLENGE_RULES, challengeSeal } from '@/lib/challenge';
import type { Challenge, ChallengeGuess, Message } from '@/lib/types';

/** Avisa por push quem recebeu notificação desta ação (o banco já gravou as notificações). */
async function pushPending(groupId: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch('/api/push/notify', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ groupId }) });
  } catch {}
}

const hasLetters = (s: string) => /\p{L}/u.test(s);
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function ChatPage() {
  return <Suspense><Chat /></Suspense>;
}

function Chat() {
  const { group, me, profiles, look, unlocked, stats, maxGrp, today, isAdmin } = useGroup();
  const toast = useToast();
  const params = useSearchParams();
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [chs, setChs] = useState<Challenge[]>([]);
  const [guesses, setGuesses] = useState<ChallengeGuess[]>([]);
  const input = useEmojiInput(200);
  const text = input.text;
  const [kb, setKb] = useState(false);
  const [creating, setCreating] = useState(false);
  const [guessing, setGuessing] = useState<Challenge | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [party, setParty] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const open = unlocked.has('chat');

  const loadChallenges = useCallback(async () => {
    const [c, g] = await Promise.all([
      supabase.from('challenges').select('*').eq('group_id', group.id).eq('archived', false).order('created_at', { ascending: false }).limit(60),
      supabase.from('challenge_guesses').select('*').eq('group_id', group.id).order('created_at').limit(1000),
    ]);
    if (c.data) setChs(c.data as Challenge[]);
    if (g.data) setGuesses(g.data as ChallengeGuess[]);
  }, [group.id]);

  useEffect(() => {
    if (!open) return;
    supabase.rpc('close_challenges', { p_group: group.id }).then(() => loadChallenges());
    supabase.from('messages').select('*').eq('group_id', group.id).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setMsgs(((data ?? []) as Message[]).reverse()));
    const f = `group_id=eq.${group.id}`;
    const ch = supabase
      .channel(`chat-${group.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: f }, (p) =>
        setMsgs((l) => (l.some((m) => m.id === (p.new as Message).id) ? l : [...l, p.new as Message])))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter: f }, () => loadChallenges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenge_guesses', filter: f }, () => loadChallenges())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [group.id, open, loadChallenges]);

  // abre direto: ?novo=1 (lançar desafio) e ?c=ID (ir até o desafio)
  useEffect(() => {
    if (!open) return;
    if (params.get('novo')) setCreating(true);
    const c = Number(params.get('c'));
    if (c) setFocus(c);
  }, [params, open]);

  // tudo o que está na tela conta como lido (zera o contador do início)
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { supabase.rpc('mark_chat_read', { p_group: group.id }).then(() => window.dispatchEvent(new Event('chat-read'))); }, 400);
    return () => clearTimeout(t);
  }, [open, group.id, msgs.length, chs.length]);

  const items = useMemo(() => {
    const all: ({ k: 'm'; at: string; m: Message } | { k: 'c'; at: string; c: Challenge })[] = [
      ...msgs.map((m) => ({ k: 'm' as const, at: m.created_at, m })),
      ...chs.map((c) => ({ k: 'c' as const, at: c.created_at, c })),
    ];
    return all.sort((a, b) => a.at.localeCompare(b.at));
  }, [msgs, chs]);

  // rola para o fim quando chega coisa nova; ou até o desafio pedido no link
  useEffect(() => {
    if (focus) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [items.length, kb, focus]);
  useEffect(() => {
    if (!focus || !chs.some((c) => c.id === focus)) return;
    document.getElementById(`ch-${focus}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setFocus(null), 2500);
    return () => clearTimeout(t);
  }, [focus, chs]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (hasLetters(body)) return toast('Aqui só se fala emojês 🤐', 'error');
    input.set('');
    const { data, error } = await supabase.from('messages').insert({ group_id: group.id, user_id: me, body }).select().single();
    if (error) { input.set(body); return toast(errMsg(error), 'error'); }
    setMsgs((l) => (l.some((m) => m.id === (data as Message).id) ? l : [...l, data as Message]));
  };

  const openToday = chs.filter((c) => c.status === 'open' && c.local_date === today);
  const mineToday = chs.some((c) => c.user_id === me && c.local_date === today);

  const header = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-sand bg-cream/95 px-4 py-3 backdrop-blur pt-safe">
      <Link href={`/g/${group.id}`} className="rounded-full bg-sand p-2.5" aria-label="Voltar"><ArrowLeft size={20} /></Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate whitespace-nowrap font-display text-[19px] font-bold leading-tight">Dom de Línguas 🔥</h1>
        <p className="truncate text-xs font-bold text-[#a8927a]">aqui só se fala emojês</p>
      </div>
      {open && (
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-full bg-[#7B3FA0] px-3.5 py-2.5 text-[13px] font-extrabold text-white shadow-sm active:scale-95">
          <Puzzle size={16} /> Desafiar
        </button>
      )}
    </header>
  );

  if (!open) {
    const need = groupThreshold(maxGrp, GROUP_UNLOCKS.find((u) => u.id === 'chat')!);
    return (
      <div className="min-h-[100dvh]">
        {header}
        <div className="flex flex-col items-center px-8 pt-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sand text-[#8A6F57]"><Lock size={36} /></div>
          <h2 className="mt-4 font-display text-2xl font-bold">Dom de Línguas bloqueado</h2>
          <p className="mt-2 text-[#6b5643]">O chat só de emojis libera quando a equipe chegar em {need} pontos. Faltam {Math.max(0, need - stats.groupPoints)}.</p>
          <p className="mt-4 text-4xl">🤐🔒🗣️</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      {party > 0 && <Confetti key={party} duration={3500} />}
      {header}

      {openToday.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-sand bg-[#f3eafb] px-3 py-2">
          {openToday.map((c) => (
            <button key={c.id} onClick={() => setFocus(c.id)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold shadow-sm">
              <Puzzle size={14} className="text-[#7B3FA0]" /> <span className="max-w-[120px] truncate">{c.emojis}</span>
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4" onClick={() => setKb(false)}>
        {items.map((it, i) => {
          if (it.k === 'c') {
            return (
              <ChallengeCard key={`c${it.c.id}`} c={it.c} guesses={guesses.filter((g) => g.challenge_id === it.c.id)}
                highlight={focus === it.c.id} onGuess={() => setGuessing(it.c)} onChanged={loadChallenges} isAdmin={isAdmin} />
            );
          }
          const m = it.m;
          const mine = m.user_id === me;
          const prev = items[i - 1];
          const showHead = !prev || prev.k !== 'm' || prev.m.user_id !== m.user_id;
          const p = profiles[m.user_id];
          const onlyEmoji = [...m.body].length <= 6;
          return (
            <div key={`m${m.id}`} className={`flex items-end gap-2 ${mine ? 'justify-end' : ''}`}>
              {!mine && <div className="w-8 shrink-0">{showHead && <Avatar url={p?.avatar_url} name={p?.name} size={32} frame={look(m.user_id).avatarFrame} />}</div>}
              <div className={`max-w-[78%] rounded-3xl px-4 py-2 ${mine ? 'rounded-br-lg bg-terra text-white' : 'rounded-bl-lg bg-white'}`}>
                {!mine && showHead && <p className="text-xs font-extrabold text-terra">{p?.name?.split(' ')[0]}</p>}
                <p className={`whitespace-pre-wrap break-words leading-snug ${onlyEmoji ? 'text-[34px]' : 'text-[22px]'}`}>{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-white/70' : 'text-[#a8927a]'}`}>{hhmm(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="pt-12 text-center">
            <p className="text-5xl">👋😃🔥</p>
            <p className="mt-3 font-bold text-[#a8927a]">Diga olá… em emojês!</p>
          </div>
        )}
      </div>

      {!mineToday && !kb && (
        <button onClick={() => setCreating(true)} className="mx-3 mb-2 flex items-center gap-2 rounded-2xl bg-[#f3eafb] px-3 py-2.5 text-left text-[13px] font-extrabold text-[#5b2a86]">
          <Puzzle size={18} className="shrink-0" /> <span className="truncate">Lance seu desafio · vale até {CHALLENGE_RULES.fair} pts</span>
        </button>
      )}

      {/* compositor: sem teclado do celular, só o teclado de emojis */}
      <div className="flex items-end gap-2 border-t border-sand bg-cream px-3 pt-2" style={{ paddingBottom: kb ? 8 : 'max(var(--safe-bottom), 8px)' }}>
        <button onClick={() => setKb((v) => !v)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sand text-[#6b5643]" aria-label={kb ? 'Fechar emojis' : 'Abrir emojis'}>
          {kb ? <ChevronDown size={22} /> : <Smile size={22} />}
        </button>
        <EmojiField input={input} active={kb} onActivate={() => setKb(true)} placeholder="Fale em emojês 😃"
          className={`flex max-h-32 min-h-[48px] flex-1 items-center overflow-y-auto rounded-3xl border-2 bg-white px-4 py-1.5 text-left ${kb ? 'border-terra/40' : 'border-sand'}`} />
        <button onClick={send} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terra text-white disabled:opacity-50" disabled={!text.trim()} aria-label="Enviar">
          <Send size={20} />
        </button>
      </div>
      {kb && (
        <EmojiKeyboard
          {...input.keys}
        />
      )}

      <CreateChallenge open={creating} onClose={() => setCreating(false)} already={mineToday}
        onCreated={(c) => { setChs((l) => [c, ...l.filter((x) => x.id !== c.id)]); setCreating(false); setFocus(c.id); pushPending(group.id); }} />
      <GuessSheet c={guessing} mine={guesses.filter((g) => g.challenge_id === guessing?.id && g.user_id === me)} onClose={() => setGuessing(null)}
        onDone={(right) => { setGuessing(null); loadChallenges(); pushPending(group.id); if (right) { setParty((n) => n + 1); toast(`Acertou! +${CHALLENGE_RULES.solver} pts 🎉`); } }} />
    </div>
  );
}

/* ---------------- Cartão do desafio ---------------- */

const STATUS: Record<Challenge['status'], { label: string; tone: string }> = {
  open: { label: 'Valendo!', tone: 'bg-[#7B3FA0] text-white' },
  review: { label: 'Em julgamento', tone: 'bg-amber text-ink' },
  solved: { label: 'Decifrado', tone: 'bg-olive text-white' },
  missed: { label: 'Ninguém acertou', tone: 'bg-[#e8562e] text-white' },
  expired: { label: 'Expirou', tone: 'bg-sand text-[#8A6F57]' },
};

function ChallengeCard({ c, guesses, highlight, onGuess, onChanged, isAdmin }: {
  c: Challenge; guesses: ChallengeGuess[]; highlight: boolean; onGuess: () => void; onChanged: () => void; isAdmin: boolean;
}) {
  const { me, profiles, today, group } = useGroup();
  const toast = useToast();
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const owner = profiles[c.user_id];
  const isOwner = c.user_id === me;
  const live = c.status === 'open' && c.local_date === today;
  const canJudge = (isOwner && (c.status === 'open' || c.status === 'review')) || (isAdmin && c.status === 'review');
  const myGuesses = guesses.filter((g) => g.user_id === me);
  const myPending = myGuesses.some((g) => g.status === 'pending');
  const left = CHALLENGE_RULES.maxGuesses - myGuesses.length;
  const pending = guesses.filter((g) => g.status === 'pending');
  const seal = challengeSeal(c);
  const closed = c.status !== 'open';

  useEffect(() => {
    if (isOwner && !c.answer) supabase.rpc('my_challenge_answer', { p_challenge: c.id }).then(({ data }) => setAnswer((data as string) ?? null));
  }, [isOwner, c.id, c.answer]);

  const judge = async (g: ChallengeGuess, right: boolean) => {
    setBusy(g.id);
    const { error } = await supabase.rpc('judge_guess', { p_guess: g.id, p_right: right });
    setBusy(null);
    if (error) return toast(errMsg(error), 'error');
    if (right) toast('Desafio decifrado! Pontos creditados 🎉');
    pushPending(group.id);
    onChanged();
  };

  return (
    <div id={`ch-${c.id}`} className={`mx-auto w-full max-w-[340px] rounded-3xl border-2 bg-white p-4 shadow-sm transition ${highlight ? 'border-[#7B3FA0] ring-4 ring-[#7B3FA0]/20' : 'border-[#e6d6f3]'}`}>
      <div className="flex items-center gap-2">
        <Avatar url={owner?.avatar_url} name={owner?.name} size={28} />
        <p className="min-w-0 flex-1 truncate text-[13px] font-extrabold">
          <Puzzle size={13} className="-mt-0.5 mr-1 inline text-[#7B3FA0]" />{isOwner ? 'Seu desafio' : `Desafio de ${owner?.name?.split(' ')[0]}`}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${STATUS[c.status].tone}`}>{c.status === 'open' && !live ? 'Encerrando' : STATUS[c.status].label}</span>
      </div>

      <p className="my-3 break-words text-center text-[40px] leading-tight">{c.emojis}</p>

      {(c.answer || (isOwner && answer)) && (
        <div className={`rounded-2xl px-3 py-2 text-center ${closed ? 'bg-olive/10' : 'bg-cream'}`}>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#a8927a]">{closed ? 'Resposta' : 'Sua resposta (só você vê)'}</p>
          <p className="font-display text-lg font-extrabold leading-tight">{c.answer ?? answer}</p>
        </div>
      )}

      {c.status === 'solved' && c.solved_by && (
        <p className="mt-2 text-center text-sm font-extrabold text-olive">
          🎉 {c.solved_by === me ? 'Você decifrou!' : `${profiles[c.solved_by]?.name?.split(' ')[0]} decifrou!`} +{CHALLENGE_RULES.solver} pts
        </p>
      )}
      {seal && (
        <p className="mt-1 text-center text-[12px] font-bold text-[#8A6F57]">
          {seal.emoji} {seal.label}{c.owner_points > 0 ? ` · ${isOwner ? 'você ganhou' : 'quem lançou ganhou'} ${c.owner_points} pts` : ''}
        </p>
      )}
      {c.status === 'review' && (
        <p className="mt-2 truncate text-center text-[13px] font-bold text-[#9a5b00]">{isOwner ? 'Palpite sem julgar: julgue abaixo' : 'Aguardando julgamento ⏳'}</p>
      )}

      {/* palpites: o dono vê todos; depois de fechar, todo mundo vê */}
      {(isOwner || closed) && guesses.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {guesses.map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-xl bg-cream px-2.5 py-1.5">
              <span className="w-16 shrink-0 truncate text-[12px] font-extrabold text-[#8A6F57]">{profiles[g.user_id]?.name?.split(' ')[0]}</span>
              <span className={`min-w-0 flex-1 break-words text-[14px] font-bold ${g.status === 'wrong' ? 'text-[#a8927a] line-through' : ''}`}>{g.guess}</span>
              {g.status === 'pending' && canJudge ? (
                <span className="flex shrink-0 gap-1">
                  <button onClick={() => judge(g, false)} disabled={busy !== null} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fde3dc] text-[#c8553d]" aria-label="Errado">{busy === g.id ? <Spinner /> : <X size={18} strokeWidth={3} />}</button>
                  <button onClick={() => judge(g, true)} disabled={busy !== null} className="flex h-9 w-9 items-center justify-center rounded-full bg-olive text-white" aria-label="Certo"><Check size={18} strokeWidth={3} /></button>
                </span>
              ) : (
                <span className="shrink-0 text-base">{g.status === 'right' ? '✅' : g.status === 'wrong' ? '❌' : '⏳'}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {isOwner && live && pending.length === 0 && (
        <p className="mt-2 text-center text-[12px] font-bold text-[#a8927a]">{guesses.length ? `${guesses.length} palpite(s) até agora` : 'Esperando palpites…'}</p>
      )}

      {/* quem joga: os próprios palpites e o botão */}
      {!isOwner && !closed && (
        <div className="mt-3">
          {myGuesses.length > 0 && (
            <div className="mb-2 flex flex-wrap justify-center gap-1.5">
              {myGuesses.map((g) => (
                <span key={g.id} className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${g.status === 'wrong' ? 'bg-[#fde3dc] text-[#c8553d] line-through' : 'bg-amber/20 text-[#9a5b00]'}`}>
                  {g.status === 'pending' ? '⏳ ' : ''}{g.guess}
                </span>
              ))}
            </div>
          )}
          {live && (
            myPending ? (
              <p className="truncate text-center text-[13px] font-bold text-[#9a5b00]">Esperando {owner?.name?.split(' ')[0]} julgar ⏳</p>
            ) : left > 0 ? (
              <button onClick={onGuess} className="btn w-full !min-h-[46px] bg-[#7B3FA0] text-white">
                Decifrar · {left} {left === 1 ? 'palpite' : 'palpites'}
              </button>
            ) : (
              <p className="text-center text-[13px] font-bold text-[#a8927a]">Seus 3 palpites acabaram 😬</p>
            )
          )}
          {!live && c.status === 'open' && <p className="truncate text-center text-[12px] font-bold text-[#a8927a]">Encerrando… resposta já já</p>}
        </div>
      )}

      {!closed && guesses.length > 0 && !isOwner && (
        <p className="mt-2 truncate text-center text-[11px] font-bold text-[#b9a690]">palpites aparecem no fim</p>
      )}
      <p className="mt-2 text-right text-[10px] text-[#a8927a]">{hhmm(c.created_at)}</p>
    </div>
  );
}

/* ---------------- Lançar desafio ---------------- */

function CreateChallenge({ open, onClose, onCreated, already }: { open: boolean; onClose: () => void; onCreated: (c: Challenge) => void; already: boolean }) {
  const { group } = useGroup();
  const toast = useToast();
  const emoIn = useEmojiInput(60);
  const emo = emoIn.text;
  const [ans, setAns] = useState('');
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { emoIn.set(''); setAns(''); setTyping(false); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!emo.trim()) return toast('Monte o desafio com emojis', 'error');
    if (ans.trim().length < 2) return toast('Escreva a resposta certa', 'error');
    setBusy(true);
    const { data, error } = await supabase.rpc('create_challenge', { p_group: group.id, p_emojis: emo.trim(), p_answer: ans.trim() });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    toast('Desafio lançado! 🧩');
    onCreated(data as Challenge);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Desafiar em emojês 🧩">
      {already ? (
        <div className="py-6 text-center">
          <p className="text-4xl">✅🧩</p>
          <p className="mt-3 whitespace-nowrap font-extrabold text-ink">Desafio de hoje já lançado!</p>
          <p className="whitespace-nowrap font-bold text-[#6b5643]">Amanhã tem mais 😉</p>
        </div>
      ) : (
        <>
          <p className="truncate text-[14px] font-bold text-[#6b5643]">Conte uma história <b>só com emojis</b></p>
          <p className="truncate text-[13px] text-[#8A6F57]">Quem decifrar ganha {CHALLENGE_RULES.solver} pts · você até {CHALLENGE_RULES.fair}</p>
          <EmojiField input={emoIn} active={!typing} size={32} onActivate={() => { (document.activeElement as HTMLElement | null)?.blur(); setTyping(false); }}
            placeholder="Ex.: 🐋👨🌊3️⃣🌙"
            className={`mt-3 flex min-h-[72px] w-full items-center justify-center rounded-3xl border-2 bg-white px-3 py-2 text-center ${typing ? 'border-sand' : 'border-[#7B3FA0]'}`} />
          {!typing && (
            <div className="-mx-5 mt-2">
              <EmojiKeyboard height={250} {...emoIn.keys} />
            </div>
          )}
          <label className="label mt-3">Resposta certa (fica escondida até o fim)</label>
          <input className="input" value={ans} onChange={(e) => setAns(e.target.value)} onFocus={() => setTyping(true)} maxLength={80}
            placeholder="Ex.: Jonas e a baleia" />
          <p className="mt-1.5 truncate text-[12px] font-bold text-[#a8927a]">Palpite igual à resposta é aprovado sozinho</p>
          <p className="truncate text-[12px] font-bold text-[#a8927a]">Os outros você julga com ✓ ou ✗</p>
          <button className="btn mt-4 w-full bg-[#7B3FA0] text-white" onClick={submit} disabled={busy}>{busy ? <Spinner /> : 'Lançar desafio'}</button>
        </>
      )}
    </Sheet>
  );
}

/* ---------------- Palpite ---------------- */

function GuessSheet({ c, mine, onClose, onDone }: { c: Challenge | null; mine: ChallengeGuess[]; onClose: () => void; onDone: (right: boolean) => void }) {
  const toast = useToast();
  const [g, setG] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setG(''); }, [c?.id]);
  const left = CHALLENGE_RULES.maxGuesses - mine.length;

  const submit = async () => {
    if (!c || !g.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('guess_challenge', { p_challenge: c.id, p_guess: g.trim() });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    const r = data as ChallengeGuess;
    if (r.status !== 'right') toast('Palpite enviado! Agora é esperar o julgamento ⏳');
    onDone(r.status === 'right');
  };

  return (
    <Sheet open={!!c} onClose={onClose} title="Decifrar 🧩">
      {c && (
        <>
          <p className="break-words rounded-3xl bg-white py-4 text-center text-[40px] leading-tight">{c.emojis}</p>
          {mine.length > 0 && (
            <p className="mt-2 truncate text-center text-[13px] font-bold text-[#a8927a]">Já tentou: {mine.map((x) => x.guess).join(', ')}</p>
          )}
          <label className="label mt-4">Seu palpite</label>
          <input className="input" value={g} onChange={(e) => setG(e.target.value)} maxLength={80} autoFocus placeholder="O que esses emojis querem dizer?"
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} enterKeyHint="send" />
          <p className="mt-1.5 truncate text-[12px] font-bold text-[#a8927a]">{left} {left === 1 ? 'palpite restante' : 'palpites restantes'} · aqui pode usar letras 😉</p>
          <button className="btn mt-4 w-full bg-[#7B3FA0] text-white" onClick={submit} disabled={busy || !g.trim()}>{busy ? <Spinner /> : 'Enviar palpite'}</button>
        </>
      )}
    </Sheet>
  );
}
