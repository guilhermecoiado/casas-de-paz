'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGroup } from '@/lib/group-context';
import { WEEKDAYS, dailyMax } from '@/lib/game';
import { Sheet } from './ui';

/** Primeiro acesso ao grupo: convite para ver o guia "Como funciona". */
export function WelcomeSheet() {
  const { group, me, dailyMaxPts } = useWelcomeData();
  const key = `cdp-welcome-${group.id}-${me}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem(key) !== '1') setOpen(true); } catch { /* sem storage: não insiste */ }
  }, [key]);
  const close = () => { try { localStorage.setItem(key, '1'); } catch { /* ok */ } setOpen(false); };

  return (
    <Sheet open={open} onClose={close} title="Bem-vindo à Casa de Paz! 🏠">
      <div className="space-y-3 text-[#4a3a2c]">
        {([
          ['📅', 'Poste todo dia', `até ${dailyMaxPts} pts por dia · toque no +`],
          ['🏠', `${WEEKDAYS[group.house_weekday]} tem bônus`, 'e cada convidado vale o dobro!'],
          ['🔥', 'Mantenha a sequência', '7 dias seguidos liberam prêmios'],
          ['🧱', 'Juntos constroem a casa', 'e liberam prêmios para você'],
        ] as const).map(([icon, title, sub], i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <span className="shrink-0 text-2xl">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold leading-tight text-ink">{title}</p>
              <p className="truncate text-[14px] leading-snug text-[#6b5643]">{sub}</p>
            </div>
          </div>
        ))}
        <Link href={`/g/${group.id}/como-funciona`} onClick={close} className="btn-primary w-full">Ver o guia completo</Link>
        <button onClick={close} className="btn-soft w-full">Começar agora</button>
      </div>
    </Sheet>
  );
}

function useWelcomeData() {
  const { group, me } = useGroup();
  return { group, me, dailyMaxPts: dailyMax(group) };
}
