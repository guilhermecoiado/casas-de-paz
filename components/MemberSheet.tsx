'use client';

import { useGroup } from '@/lib/group-context';
import { TYPE_LABEL } from '@/lib/game';
import { Avatar, Sheet } from './ui';

export function MemberSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { profiles, stats, look, posts, group } = useGroup();
  if (!userId) return null;
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
      {photos.length > 0 && (
        <div className="mt-5 grid grid-cols-3 gap-1.5">
          {photos.map((x) => (
            <div key={x.id} className="relative aspect-square overflow-hidden rounded-xl bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.photo_url!} alt="" className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 text-[9px] font-bold text-white">{TYPE_LABEL[x.type]}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
