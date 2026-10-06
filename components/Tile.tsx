'use client';

import { Check, Crown } from 'lucide-react';
import { Avatar } from './ui';
import { thumbOf } from '@/lib/supabase';
import { StreakBadge, TileFx, TileOrnaments } from './Cosmetics';
import type { Profile } from '@/lib/types';
import type { UserStats } from '@/lib/game';
import type { PathId } from '@/lib/rewards';
import { tierOf } from '@/lib/streak';

export interface TileLook {
  title: string;
  avatarFrame: string | null;
  tileFrame: string | null;
  tileColor: string | null;
  tileAnim: string | null;
  kit?: PathId | null;
}

export function MemberTile({
  profile, stats, look, alive, isAdmin, onClick, forcePosted, compact, view = 'posts',
}: {
  profile?: Profile;
  stats?: UserStats;
  look: TileLook;
  alive: boolean;
  isAdmin: boolean;
  onClick?: () => void;
  forcePosted?: boolean; // prévia no perfil: mostra o tile "aceso"
  compact?: boolean;     // miniatura (prévia no perfil)
  view?: 'posts' | 'cards'; // posts: foto do dia no tile · cards: tile decorado
}) {
  const posted = forcePosted || !!stats?.postedToday;
  const photo = forcePosted || view === 'cards' ? null : stats?.todayPhoto;
  const cls = [
    'relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-[22px] text-left transition active:scale-[0.97]',
    'shadow-[0_2px_0_rgba(43,33,24,0.06),0_10px_24px_-14px_rgba(43,33,24,0.3)]',
    look.tileColor ?? 'tc-default',
    alive ? 'tile-alive' : '',
  ].join(' ');

  // intensivo: aura de fogo ao redor do tile (7, 14, 21 e 28 dias seguidos)
  const tier = tierOf(stats?.streak ?? 0);
  const tile = (
    <button onClick={onClick} className={cls}>
      {posted && photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbOf(photo)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => { if (e.currentTarget.src !== photo) e.currentTarget.src = photo; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          {/* mesmo com a foto do dia, a pessoa continua reconhecível: foto de perfil com o anel no canto */}
          <div className="absolute left-1.5 top-1.5 z-[3] rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
            <Avatar url={profile?.avatar_url} name={profile?.name} size={compact ? 20 : 26} frame={look.avatarFrame} />
          </div>
        </>
      ) : null}

      <TileFx anim={look.tileAnim} kit={look.kit} />

      <div className="relative z-[1] flex flex-1 flex-col items-center justify-center p-2">
        {!(posted && photo) && (
          <div className={posted ? '' : 'opacity-45 grayscale'}>
            <Avatar url={profile?.avatar_url} name={profile?.name} size={compact ? 42 : 58} frame={look.avatarFrame} />
          </div>
        )}
      </div>

      <div className={`relative z-[1] ${compact ? 'px-2 pb-2 [&_p]:!text-[10px]' : 'px-2.5 pb-2.5'} ${posted && photo ? 'text-white' : ''}`}>
        <p className="flex items-center gap-1 truncate text-[13px] font-extrabold leading-tight">
          {isAdmin && <Crown size={12} className="shrink-0 text-amber" />}
          <span className="truncate">{profile?.name?.split(' ')[0] ?? '…'}</span>
        </p>
        <p className={`truncate text-[11px] font-bold ${posted && photo ? 'text-white/80' : 'text-[#8A6F57]'}`}>{look.title}</p>
        <p className={`mt-0.5 text-[12px] font-black ${posted && photo ? 'text-amber' : 'text-terra'}`}>{stats?.points ?? 0} pts</p>
      </div>

      {/* moldura do tile por cima de tudo (inclusive da foto do dia) */}
      {look.tileFrame && <div className={`pointer-events-none absolute inset-0 z-[2] rounded-[22px] ${look.tileFrame}`} />}
      <TileOrnaments frame={look.tileFrame} />

      <div className={`absolute right-2 top-2 z-[3] flex items-center gap-1 ${compact ? 'origin-top-right scale-75' : ''}`}>
        {!forcePosted && <StreakBadge streak={stats?.streak ?? 0} postedToday={!!stats?.postedToday} />}
        {posted ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-olive text-white shadow"><Check size={14} strokeWidth={3} /></span>
        ) : (
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-[#8A6F57] shadow-sm">falta</span>
        )}
      </div>
    </button>
  );
  if (!tier) return tile;
  return (
    <div className="relative">
      <span className={`aura ${tier.aura} ${posted ? '' : 'aura-off'}`} aria-hidden />
      <div className="relative z-[1]">{tile}</div>
    </div>
  );
}
