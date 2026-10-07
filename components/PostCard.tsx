'use client';

import { useState } from 'react';
import { Ban, Gavel, MoreHorizontal, RotateCcw, Share2, ThumbsDown, ThumbsUp, Trash2, Users } from 'lucide-react';
import { useRemovePost } from './useRemovePost';
import { useGroup } from '@/lib/group-context';
import { TYPE_LABEL, formatDate, timeAgo } from '@/lib/game';
import { ShareSheet } from './ShareSheet';
import { PostSocial } from './PostSocial';
import { errMsg, supabase } from '@/lib/supabase';
import { Avatar, Sheet, Spinner } from './ui';
import { useToast } from './Providers';
import type { Post } from '@/lib/types';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { challengeOfPost, useGroupChallenges } from '@/lib/use-challenges';
import { challengeSeal } from '@/lib/challenge';

/** Card dos pontos do Dom de Línguas: não mostra o desafio nem a resposta, só o que aconteceu, com atalho para o chat. */
function ChallengePost({ post }: { post: Post }) {
  const { group, profiles } = useGroup();
  const list = useGroupChallenges(group.id);
  const c = challengeOfPost(list, post);
  const first = (id?: string | null) => (id ? profiles[id]?.name?.split(' ')[0] : null) ?? 'alguém';
  const href = `/g/${group.id}/chat${c ? `?c=${c.id}` : ''}`;
  const riddle = post.type === 'riddle';
  const seal = c ? challengeSeal(c) : null;
  return (
    <div className={`overflow-hidden rounded-2xl p-3.5 ${riddle ? 'bg-gradient-to-br from-[#e6f2dc] to-[#cfe6bd]' : 'bg-gradient-to-br from-[#f3eafb] to-[#e2cff3]'}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm ${riddle ? 'bg-white' : 'bg-white'}`}>{riddle ? '🎉' : '🧩'}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-black uppercase tracking-wider ${riddle ? 'text-olive' : 'text-[#7B3FA0]'}`}>Dom de Línguas</p>
          <p className="truncate whitespace-nowrap font-display text-[16px] font-extrabold leading-tight">
            {riddle ? `Decifrou o desafio de ${first(c?.user_id)}!` : 'Lançou um desafio em emojês'}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap text-[12.5px] font-bold leading-snug text-[#6b5643]">
            {riddle
              ? 'Acertou primeiro e levou os pontos'
              : !c ? 'Desafio do dia'
                : c.status === 'solved' ? `Decifrado por ${first(c.solved_by)} ${seal?.emoji}`
                  : c.status === 'missed' ? 'Ninguém acertou 🤯'
                    : c.status === 'expired' ? 'Expirou sem palpites'
                      : 'Valendo! Será que você decifra?'}
          </p>
        </div>
      </div>
      <Link href={href} className={`mt-3 flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-white active:scale-[0.98] ${riddle ? 'bg-olive' : 'bg-[#7B3FA0]'}`}>
        <MessageCircle size={17} /> Ver no chat
      </Link>
    </div>
  );
}

export function PostCard({ post, openComments = false, highlight = false }: { post: Post; openComments?: boolean; highlight?: boolean }) {
  const { profiles, look, isAdmin, me, votes, members, group } = useGroup();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { canRemove, remove, removing } = useRemovePost();
  const author = profiles[post.user_id];
  const l = look(post.user_id);
  const myVote = votes.find((v) => v.post_id === post.id && v.user_id === me);
  const keep = votes.filter((v) => v.post_id === post.id && v.keep).length;
  const cancel = votes.filter((v) => v.post_id === post.id && !v.keep).length;
  const cancelled = post.status === 'cancelled';
  const isChallenge = post.type === 'challenge' || post.type === 'riddle';

  const moderate = async (action: 'cancel' | 'vote' | 'close' | 'restore') => {
    setMenu(false);
    const { data, error } = await supabase.rpc('admin_moderate', { p_post: post.id, p_action: action });
    if (error) return toast(errMsg(error), 'error');
    toast(data === 'voting' ? 'Enviado para votação do grupo' : data === 'cancelled' ? 'Pontos cancelados' : 'Pontos mantidos');
  };

  const vote = async (k: boolean) => {
    const { data, error } = await supabase.rpc('vote_post', { p_post: post.id, p_keep: k });
    if (error) return toast(errMsg(error), 'error');
    toast(data === 'voting' ? 'Voto registrado' : data === 'ok' ? 'Maioria decidiu: pontos mantidos' : 'Maioria decidiu: pontos cancelados');
  };

  return (
    <article id={`post-${post.id}`} className={`card scroll-mt-28 overflow-hidden transition-shadow ${cancelled ? 'opacity-60' : ''} ${highlight ? 'ring-4 ring-amber/60' : ''}`}>
      <div className="flex items-center gap-3 p-3">
        <Avatar url={author?.avatar_url} name={author?.name} size={40} frame={l.avatarFrame} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold leading-tight">{author?.name ?? '…'}</p>
          <p className="truncate text-xs font-bold text-[#a8927a]">{l.title} · {timeAgo(post.created_at)}</p>
        </div>
        <span className="chip bg-terra/10 text-terra">{TYPE_LABEL[post.type]}</span>
        {(isAdmin || canRemove(post)) && (
          <button onClick={() => setMenu(true)} className="-mr-1 rounded-full p-2.5 text-[#8A6F57]" aria-label="Opções do post"><MoreHorizontal size={20} /></button>
        )}
      </div>

      {post.photo_url && (
        <div className="relative bg-sand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.photo_url} alt="" className="aspect-[4/5] max-h-[70vh] w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="space-y-2 p-3">
        {isChallenge ? <ChallengePost post={post} /> : post.description && <p className={`whitespace-pre-wrap text-[15px] leading-snug ${cancelled ? 'line-through' : ''}`}>{post.description}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${cancelled ? 'bg-sand text-[#8A6F57] line-through' : post.points < 0 ? 'bg-[#7a2618]/10 text-[#7a2618]' : 'bg-amber/20 text-[#9a5b00]'}`}>{post.points >= 0 ? '+' : ''}{post.points} pts</span>
          {post.group_bonus > 0 && <span className="chip bg-olive/15 text-olive"><Users size={12} /> +{post.group_bonus} equipe</span>}
          {post.guests > 0 && <span className="chip max-w-full bg-olive/15 text-olive"><span className="truncate">{post.guests} convidado{post.guests > 1 ? 's' : ''}{post.guest_names?.length ? `: ${post.guest_names.join(', ')}` : ''}</span></span>}
          {!!post.boost && <span className="chip bg-amber/25 text-[#9a5b00]">⚡ em dobro · intensivo</span>}
          {post.capped && <span className="chip bg-sand text-[#8A6F57]">limite semanal</span>}
          {cancelled && <span className="chip bg-[#7a2618] text-white">cancelado</span>}
          {post.photo_url && !cancelled && (
            <button onClick={() => setSharing(true)} className="ml-auto flex items-center gap-1 text-sm font-extrabold text-terra">
              <Share2 size={16} /> Moldura
            </button>
          )}
        </div>

        {post.status === 'voting' && (
          <div className="mt-2 rounded-2xl bg-amber/15 p-3">
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#9a5b00]"><Gavel size={16} /> Pontos em votação</p>
            <p className="text-xs text-[#8A6F57]">Maioria ({Math.floor((members.length - 1) / 2) + 1} votos) decide. Manter: {keep} · Cancelar: {cancel}</p>
            {post.user_id !== me && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => vote(true)} className={`btn !min-h-[40px] !text-sm ${myVote?.keep === true ? 'bg-olive text-white' : 'bg-white'}`}><ThumbsUp size={16} /> Manter</button>
                <button onClick={() => vote(false)} className={`btn !min-h-[40px] !text-sm ${myVote?.keep === false ? 'bg-[#7a2618] text-white' : 'bg-white'}`}><ThumbsDown size={16} /> Cancelar</button>
              </div>
            )}
          </div>
        )}

        {post.type !== 'poll' && post.type !== 'adjust' && post.type !== 'streak' && (
          <div className="border-t border-sand/70 pt-2.5">
            <PostSocial post={post} autoOpen={openComments} />
          </div>
        )}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={isAdmin ? 'Opções do post' : 'Meu post'}>
        <p className="mb-4 text-sm text-[#6b5643]">{author?.name} · {TYPE_LABEL[post.type]} · {post.points >= 0 ? '+' : ''}{post.points} pts</p>
        <div className="space-y-2">
          {canRemove(post) && (
            <button
              className="btn-soft w-full justify-start"
              disabled={removing === post.id}
              onClick={async () => { if (await remove(post)) setMenu(false); }}
            >
              <Trash2 size={18} /> {post.user_id === me ? 'Remover meu post' : 'Remover post do membro'}
            </button>
          )}
          {isAdmin && <>
          {post.status !== 'voting' && !cancelled && (
            <button className="btn-soft w-full justify-start" onClick={() => moderate('vote')}><Gavel size={18} /> Enviar para votação do grupo</button>
          )}
          {post.status === 'voting' && (
            <button className="btn-soft w-full justify-start" onClick={() => moderate('close')}><Gavel size={18} /> Encerrar votação agora</button>
          )}
          {!cancelled && (
            <button className="btn w-full justify-start bg-[#7a2618] text-white" onClick={() => moderate('cancel')}><Ban size={18} /> Cancelar pontos</button>
          )}
          {cancelled && (
            <button className="btn-soft w-full justify-start" onClick={() => moderate('restore')}><RotateCcw size={18} /> Restaurar pontos</button>
          )}
          </>}
        </div>
      </Sheet>
      {post.photo_url && (
        sharing && <ShareSheet open={sharing} onClose={() => setSharing(false)} source={post.photo_url} week={post.week} label={TYPE_LABEL[post.type]} dateLabel={formatDate(post.local_date, { day: '2-digit', month: 'long' })} />
      )}
    </article>
  );
}
