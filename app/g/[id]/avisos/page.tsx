'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BellOff, BellRing, CalendarCheck, CalendarClock, CheckCheck, Flame, HandHeart, Images, KeyRound, Megaphone, MessageCircle, PartyPopper, Puzzle, X } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { timeAgo } from '@/lib/game';
import { errMsg, supabase } from '@/lib/supabase';
import { useConfirm, useToast } from '@/components/Providers';
import { Avatar } from '@/components/ui';
import { PushToggle } from '@/components/PushToggle';
import type { AppNotification } from '@/lib/types';

const ICON = { comment: MessageCircle, digest: Images, reminder: CalendarClock, manual: Megaphone, nudge: Flame, recap: CalendarCheck, prayer: HandHeart, reset: KeyRound, challenge: Puzzle, guess: Puzzle, solved: PartyPopper } as const;
const TONE = {
  comment: 'bg-terra/10 text-terra',
  digest: 'bg-olive/15 text-olive',
  reminder: 'bg-amber/20 text-[#9a5b00]',
  manual: 'bg-[#7B3FA0]/10 text-[#7B3FA0]',
  nudge: 'bg-[#ff7a3a]/15 text-[#e8562e]',
  recap: 'bg-[#2F8FD0]/10 text-[#2F8FD0]',
  prayer: 'bg-olive/15 text-olive',
  reset: 'bg-amber/20 text-[#9a5b00]',
  challenge: 'bg-[#7B3FA0]/10 text-[#7B3FA0]',
  guess: 'bg-[#7B3FA0]/10 text-[#7B3FA0]',
  solved: 'bg-olive/15 text-olive',
} as const;

export default function Avisos() {
  const { group, me, notifications, setNotifications, unread, profiles, look } = useGroup();
  const router = useRouter();
  const toast = useToast();
  const ask = useConfirm();

  const markRead = async (ids: number[]) => {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setNotifications((l) => l.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    const { error } = await supabase.from('notifications').update({ read_at: now }).in('id', ids);
    if (error) toast(errMsg(error), 'error');
  };

  const remove = async (ids: number[]) => {
    if (!ids.length) return;
    setNotifications((l) => l.filter((n) => !ids.includes(n.id)));
    const { error } = await supabase.from('notifications').delete().in('id', ids);
    if (error) toast(errMsg(error), 'error');
  };

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead([n.id]);
    router.push(n.url);
  };

  const clearAll = async () => {
    if (!(await ask({ title: 'Limpar todas as notificações?', message: 'Elas saem da sua central. Isso não afeta os outros membros.', confirmLabel: 'Limpar' }))) return;
    remove(notifications.map((n) => n.id));
  };

  return (
    <div className="pt-safe">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-cream/95 px-3 pb-2 pt-3 backdrop-blur">
        <Link href={`/g/${group.id}`} className="rounded-full p-2" aria-label="Voltar"><ArrowLeft size={22} /></Link>
        <h1 className="flex-1 font-display text-[24px] font-extrabold">Notificações</h1>
        {unread > 0 && (
          <button onClick={() => markRead(notifications.filter((n) => !n.read_at).map((n) => n.id))} className="chip bg-white !py-2 text-[#6b5643]">
            <CheckCheck size={14} /> Ler todas
          </button>
        )}
      </header>

      <div className="px-4">
        <PushToggle variant="compact" />
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center px-8 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sand text-[#a8927a]"><BellOff size={28} /></span>
          <p className="mt-4 font-display text-xl font-bold">Tudo em dia!</p>
          <p className="mt-1 text-sm text-[#8A6F57]">Comentários nos seus posts, resumos do grupo e avisos aparecem aqui.</p>
        </div>
      ) : (
        <>
          <ul className="mt-2 space-y-2 px-4">
            {notifications.map((n) => {
              const Icon = ICON[n.kind] ?? BellRing;
              const actor = n.actor_id ? profiles[n.actor_id] : null;
              return (
                <li key={n.id} className={`relative flex items-start gap-3 rounded-2xl p-3 pr-10 transition ${n.read_at ? 'bg-white/60' : 'bg-white shadow-sm'}`}>
                  <button onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <div className="relative shrink-0">
                      {actor ? (
                        <Avatar url={actor.avatar_url} name={actor.name} size={42} frame={n.actor_id ? look(n.actor_id).avatarFrame : null} />
                      ) : (
                        <span className={`flex h-[42px] w-[42px] items-center justify-center rounded-full ${TONE[n.kind]}`}><Icon size={20} /></span>
                      )}
                      {actor && (
                        <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${TONE[n.kind]} bg-white`}><Icon size={11} /></span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`leading-tight ${n.read_at ? 'font-bold text-[#6b5643]' : 'font-extrabold'}`}>{n.title}</p>
                      <p className={`mt-0.5 line-clamp-2 text-sm leading-snug ${n.read_at ? 'text-[#a8927a]' : 'text-[#6b5643]'}`}>{n.body}</p>
                      <p className="mt-1 text-xs font-bold text-[#a8927a]">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                  {!n.read_at && <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-terra" aria-label="Não lida" />}
                  <button onClick={() => remove([n.id])} className="absolute bottom-1 right-1 rounded-full p-2.5 text-[#c4b09a]" aria-label="Limpar notificação">
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-6">
            <button onClick={clearAll} className="btn-soft w-full">Limpar todas</button>
            {me && <p className="mt-2 text-center text-xs font-bold text-[#a8927a]">Toque numa notificação para abrir.</p>}
          </div>
        </>
      )}
    </div>
  );
}
