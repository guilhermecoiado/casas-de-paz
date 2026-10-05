import { addDays, daysBetween } from './game';
import type { StreakAward } from './types';

/** Níveis do intensivo (manter igual a streak_milestone() no schema.sql). */
export interface StreakTier {
  days: 7 | 14 | 21 | 28;
  name: string;
  color: string;       // nome da cor da chama
  aura: string;        // classe CSS da aura ao redor do tile
  swatch: string;      // cor de amostra
  bonus: number;
  double: boolean;     // pontos em dobro nos 7 dias seguintes
  title?: string;
}

export const STREAK_TIERS: StreakTier[] = [
  { days: 7, name: 'Chama vermelha', color: 'vermelha', aura: 'aura-red', swatch: '#ff4b3a', bonus: 150, double: false },
  { days: 14, name: 'Chama amarela', color: 'amarela', aura: 'aura-yellow', swatch: '#ffc83a', bonus: 150, double: true },
  { days: 21, name: 'Chama roxa', color: 'roxa', aura: 'aura-purple', swatch: '#a24bff', bonus: 210, double: true, title: 'Discípulo de Daniel' },
  { days: 28, name: 'Chama azul', color: 'azul', aura: 'aura-blue', swatch: '#3aa8ff', bonus: 210, double: true, title: 'Sede meus Imitadores' },
];

/** Nível alcançado pela sequência atual (null abaixo de 7 dias). */
export const tierOf = (streak: number) => [...STREAK_TIERS].reverse().find((t) => streak >= t.days) ?? null;
export const nextTier = (streak: number) => STREAK_TIERS.find((t) => streak < t.days) ?? null;

/**
 * Pontos em dobro ativos hoje? Vale nos 7 dias seguintes a um nível 14/21/28, desde que a sequência não tenha quebrado.
 * `streak` é a sequência atual; `postedToday` diz se ela já inclui hoje.
 */
export function doubleUntil(awards: StreakAward[], userId: string, today: string, streak: number, postedToday: boolean): string | null {
  const s = postedToday ? streak : streak + 1; // se postar hoje, a sequência vira isto
  let until: string | null = null;
  for (const a of awards) {
    if (a.user_id !== userId || a.level < 14) continue;
    const d = daysBetween(a.local_date, today);
    if (d >= 1 && d <= 7 && s >= a.level + d) {
      const end = addDays(a.local_date, 7);
      if (!until || end > until) until = end;
    }
  }
  return until;
}
