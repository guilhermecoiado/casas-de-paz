'use client';

import { Logo } from './Logo';

/** Tela de abertura animada (aparece ao abrir o app). */
export function Splash() {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-cream"
      style={{ animation: 'fadeIn .2s ease-out both, fadeIn .35s ease-in 1.35s reverse both' }}
    >
      <div className="anim-pop">
        <Logo size={112} animated />
      </div>
      <h1 className="mt-5 font-display text-4xl font-extrabold text-ink anim-rise" style={{ animationDelay: '.25s' }}>
        Casas de Paz
      </h1>
      <p className="mt-1 text-sm font-bold uppercase tracking-[0.2em] text-terra anim-rise" style={{ animationDelay: '.4s' }}>
        Paz seja nesta casa
      </p>
    </div>
  );
}
