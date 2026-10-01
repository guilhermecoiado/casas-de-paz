'use client';

import { useMemo, useState } from 'react';
import { useGroup } from '@/lib/group-context';
import { PostCard } from '@/components/PostCard';

const FILTERS = [
  { id: 'all', label: 'Tudo' },
  { id: 'voting', label: 'Em votação' },
  { id: 'checkin', label: 'Check-ins' },
  { id: 'evangelism', label: 'Evangelismo' },
  { id: 'mine', label: 'Meus' },
] as const;

export default function Feed() {
  const { posts, me } = useGroup();
  const [f, setF] = useState<(typeof FILTERS)[number]['id']>('all');
  const [limit, setLimit] = useState(20);

  const list = useMemo(
    () =>
      posts.filter((p) => {
        // enquetes e ajustes aparecem só quando estão em votação ou no filtro "Meus"
        if ((p.type === 'poll' || p.type === 'adjust') && f !== 'voting' && f !== 'mine') return false;
        if (f === 'voting') return p.status === 'voting';
        if (f === 'checkin' || f === 'evangelism') return p.type === f;
        if (f === 'mine') return p.user_id === me;
        return true;
      }),
    [posts, f, me],
  );
  const votingCount = posts.filter((p) => p.status === 'voting').length;

  return (
    <div className="pt-safe">
      <header className="sticky top-0 z-10 bg-cream/95 px-4 pb-2 pt-3 backdrop-blur">
        <h1 className="font-display text-[26px] font-extrabold">Feed</h1>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((x) => (
            <button
              key={x.id}
              onClick={() => { setF(x.id); setLimit(20); }}
              className={`chip shrink-0 !px-3.5 !py-2 !text-sm ${f === x.id ? 'bg-ink text-white' : 'bg-white text-[#6b5643]'}`}
            >
              {x.label}
              {x.id === 'voting' && votingCount > 0 && <span className="ml-1 rounded-full bg-terra px-1.5 text-[10px] text-white">{votingCount}</span>}
            </button>
          ))}
        </div>
      </header>
      <div className="space-y-4 px-4 pt-2">
        {list.slice(0, limit).map((p) => <PostCard key={p.id} post={p} />)}
        {list.length === 0 && <p className="py-16 text-center font-bold text-[#a8927a]">Nada por aqui ainda.</p>}
        {list.length > limit && (
          <button className="btn-soft w-full" onClick={() => setLimit((l) => l + 20)}>Carregar mais</button>
        )}
      </div>
    </div>
  );
}
