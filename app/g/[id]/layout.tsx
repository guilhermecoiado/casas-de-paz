'use client';

import { useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Home, Images, Plus, Trophy, Heart } from 'lucide-react';
import { useAuth } from '@/components/Providers';
import { FullLoader } from '@/components/ui';
import { GroupProvider } from '@/lib/group-context';
import { UnlockWatcher } from '@/components/UnlockWatcher';

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { ready, userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !userId) router.replace('/entrar');
  }, [ready, userId, router]);

  useEffect(() => {
    try { localStorage.setItem('cdp-last-group', id); } catch {}
  }, [id]);

  const onMissing = useCallback(() => {
    try { localStorage.removeItem('cdp-last-group'); } catch {}
    router.replace('/grupos');
  }, [router]);

  if (!ready || !userId) return <FullLoader />;

  return (
    <GroupProvider groupId={id} userId={userId} fallback={<FullLoader />} onMissing={onMissing}>
      <div className="mx-auto min-h-[100dvh] max-w-md pb-nav">{children}</div>
      <BottomNav id={id} />
      <UnlockWatcher />
    </GroupProvider>
  );
}

function BottomNav({ id }: { id: string }) {
  const path = usePathname();
  const base = `/g/${id}`;
  const items = [
    { href: base, icon: Home, label: 'Início' },
    { href: `${base}/feed`, icon: Images, label: 'Feed' },
    { href: `${base}/postar`, icon: Plus, label: 'Postar', center: true },
    { href: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { href: `${base}/casa`, icon: Heart, label: 'Casa' },
  ];
  if (path?.endsWith('/postar') || path?.endsWith('/chat')) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-cream/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-2">
        {items.map(({ href, icon: Icon, label, center }) => {
          const active = path === href;
          if (center)
            return (
              <Link key={href} href={href} className="-mt-7 flex flex-col items-center" aria-label={label}>
                <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-terra text-white shadow-[0_6px_0_#9c3f2b] active:translate-y-1 active:shadow-[0_2px_0_#9c3f2b]">
                  <Icon size={30} strokeWidth={2.8} />
                </span>
              </Link>
            );
          return (
            <Link key={href} href={href} className={`flex min-w-[56px] flex-col items-center gap-0.5 pb-2 text-[11px] font-extrabold ${active ? 'text-terra' : 'text-[#a8927a]'}`}>
              <Icon size={24} strokeWidth={active ? 2.6 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
