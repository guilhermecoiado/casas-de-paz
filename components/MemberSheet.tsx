'use client';

import { useGroup } from '@/lib/group-context';
import { TYPE_LABEL } from '@/lib/game';
import { Avatar, Sheet } from './ui';
import { thumbOf } from '@/lib/supabase';
import { PointsLedger } from './PointsLedger';
import { useRemovePost } from './useRemovePost';
import { Trash2 } from 'lucide-react';

export function MemberSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { profiles, stats, look, posts, group, isAdmin, me, today } = useGroup();
  const { canRemove, remove, removing } = useRemovePost();
  if (!userId) return null;
  const todays = posts.filter((x) => x.user_id === userId && x.local_date === today && x.type !== 'adjust');
  const canManage = userId === me || isAdmin;
  const p = profiles[userId];
  const s = stats.byUser[userId];
  const l = look(userId);
  const photos = posts.filter((x) => x.user_id === userId && x.photo_url && x.status !== 'cancelled').slice(0, 9);

  return (
    <Sheet open={!!userId} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <Avatar url={p?.avatar_url} name={p?.name} size={96} frame={l.avatarFrame} />
        <h3 className="mt-3 font-display text-2xl font-extrabold">{p?.name}</h3>
        <p className="text-sm font-bold text-[#8A6F57]">@{p?.username} · {l.title}{group.admin_id === userId ? ' · Adm' : ''}</p>
        {p?.bio && <p className="mt-2 max-w-xs text-[15px] text-[#6b5643]">{p.bio}</p>}
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        {[
          ['Pontos', s?.points ?? 0],
          ['Check-ins', s?.checkins ?? 0],
          ['Convidados', s?.guests ?? 0],
          ['Evangelismo', s?.evangelism ?? 0],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-2xl bg-white py-3">
            <p className="text-xl font-black text-terra">{v}</p>
            <p className="text-[10px] font-extrabold uppercase text-[#a8927a]">{k}</p>
          </div>
        ))}
      </div>
      {canManage && todays.length > 0 && (
        <section className="mt-5">
          <h4 className="mb-2 font-display text-lg font-bold">{userId === me ? 'Seus posts de hoje' : 'Posts de hoje'}</h4>
          <div className="divide-y divide-sand overflow-hidden rounded-2xl bg-white">
            {todays.map((x) => (
              <div key={x.id} className="flex items-center gap-3 px-3 py-2.5">
                {x.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbOf(x.photo_url)} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" onError={(e) => { if (e.currentTarget.src !== x.photo_url) e.currentTarget.src = x.photo_url!; }} />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sand text-lg">💬</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{TYPE_LABEL[x.type]} <span className="text-terra">{x.points >= 0 ? '+' : ''}{x.points}</span></p>
                  {x.description && <p className="truncate text-xs text-[#8A6F57]">{x.description}</p>}
                </div>
                {canRemove(x) && (
                  <button
                    onClick={() => remove(x)}
                    disabled={removing === x.id}
                    className="flex items-center gap-1 rounded-full bg-sand px-3 py-2 text-xs font-extrabold text-[#7a2618]"
                    aria-label="Remover post"
                  >
                    <Trash2 size={14} /> Remover
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-[#a8927a]">Removeu sem querer? É só postar de novo: a vaga do dia volta.</p>
        </section>
      )}

      {photos.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-1.5">
          {photos.map((x) => (
            <div key={x.id} className="relative aspect-square overflow-hidden rounded-xl bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbOf(x.photo_url!)} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { if (e.currentTarget.src !== x.photo_url) e.currentTarget.src = x.photo_url!; }} />
              <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 text-[9px] font-bold text-white">{TYPE_LABEL[x.type]}</span>
            </div>
          ))}
        </div>
      )}
      {isAdmin && <PointsLedger userId={userId} />}
    </Sheet>
  );
}
