'use client';

import { useState } from 'react';
import { Ban, Gavel, MoreHorizontal, RotateCcw, Share2, ThumbsDown, ThumbsUp, Trash2, Users } from 'lucide-react';
import { useRemovePost } from './useRemovePost';
import { useGroup } from '@/lib/group-context';
import { TYPE_LABEL, formatDate, timeAgo } from '@/lib/game';
import { ShareSheet } from './ShareSheet';
import { errMsg, supabase } from '@/lib/supabase';
import { Avatar, Sheet, Spinner } from './ui';
import { useToast } from './Providers';
import type { Post } from '@/lib/types';

export function PostCard({ post }: { post: Post }) {
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
    <article className={`card overflow-hidden ${cancelled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 p-3">
        <Avatar url={author?.avatar_url} name={author?.name} size={40} frame={l.avatarFrame} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold leading-tight">{author?.name ?? '…'}</p>
          <p className="truncate text-xs font-bold text-[#a8927a]">{l.title} · {timeAgo(post.created_at)}</p>
        </div>
        <span className="chip bg-terra/10 text-terra">{TYPE_LABEL[post.type]}</span>
        {(isAdmin || canRemove(post)) && (
          <button onClick={() => setMenu(true)} className="rounded-full p-1.5 text-[#8A6F57]" aria-label="Opções do post"><MoreHorizontal size={20} /></button>
        )}
      </div>

      {post.photo_url && (
        <div className="relative bg-sand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.photo_url} alt="" className="max-h-[70vh] w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="space-y-2 p-3">
        {post.description && <p className={`whitespace-pre-wrap text-[15px] leading-snug ${cancelled ? 'line-through' : ''}`}>{post.description}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${cancelled ? 'bg-sand text-[#8A6F57] line-through' : post.points < 0 ? 'bg-[#7a2618]/10 text-[#7a2618]' : 'bg-amber/20 text-[#9a5b00]'}`}>{post.points >= 0 ? '+' : ''}{post.points} pts</span>
          {post.group_bonus > 0 && <span className="chip bg-olive/15 text-olive"><Users size={12} /> +{post.group_bonus} equipe</span>}
          {post.guests > 0 && <span className="chip bg-olive/15 text-olive">{post.guests} convidado{post.guests > 1 ? 's' : ''}</span>}
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
        <ShareSheet open={sharing} onClose={() => setSharing(false)} source={post.photo_url} week={post.week} label={TYPE_LABEL[post.type]} dateLabel={formatDate(post.local_date, { day: '2-digit', month: 'long' })} />
      )}
    </article>
  );
}
