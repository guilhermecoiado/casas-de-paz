import type { Challenge } from './types';

/** Pontos de quem lança, conforme quantas pessoas erraram antes do acerto. */
export const CHALLENGE_RULES = {
  solver: 10,
  easy: 5,     // acertaram de primeira
  oneWrong: 10,
  fair: 15,    // 2+ pessoas erraram antes
  missed: 5,   // teve palpite e ninguém acertou
  maxGuesses: 3,
};

/** Selo mostrado quando o desafio fecha. */
export function challengeSeal(c: Challenge): { emoji: string; label: string } | null {
  if (c.status === 'solved') {
    if (c.wrong_people >= 2) return { emoji: '🎯', label: 'na medida' };
    if (c.wrong_people === 1) return { emoji: '👍', label: 'bom desafio' };
    return { emoji: '😅', label: 'fácil demais' };
  }
  if (c.status === 'missed') return { emoji: '🤯', label: 'difícil demais' };
  if (c.status === 'expired') return { emoji: '🦗', label: 'ninguém respondeu' };
  return null;
}
