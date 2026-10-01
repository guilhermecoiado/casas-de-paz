'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGroup } from '@/lib/group-context';
import { dailyMax } from '@/lib/game';
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
      <div className="space-y-3 text-[15px] leading-snug text-[#4a3a2c]">
        {[
          ['📅', <>Todo dia tem ações que valem pontos (até <b>{dailyMaxPts} pts</b>). Toque no <b>+</b> para postar.</>],
          ['🏠', <>No dia do encontro abrem os bônus: check-in, foto em grupo, lanche… e <b>cada convidado vale o dobro</b>.</>],
          ['🔥', <>Poste todo dia para manter a <b>sequência</b>. 7 dias seguidos liberam um prêmio exclusivo.</>],
          ['🧱', <>Os pontos de todos constroem a <b>casa da equipe</b> e liberam prêmios para você.</>],
        ].map(([icon, text], i) => (
          <div key={i} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <span className="text-2xl">{icon}</span>
            <p>{text}</p>
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
