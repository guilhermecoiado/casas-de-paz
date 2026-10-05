import { addDays, computeStats } from './game';
import type { Group, Member, Post } from './types';

export interface WeekSummary {
  week: number;
  from: string;
  to: string;
  teamPoints: number;   // o que a semana somou para a casa (já com o limite semanal da equipe)
  rawPoints: number;
  checkins: number;
  guests: number;
  posters: number;      // quantas pessoas postaram na semana
  members: number;
  top: { id: string; points: number }[];      // destaque(s) em pontos na semana
  topGuests: { id: string; guests: number } | null;
  bestStreak: { id: string; streak: number } | null;
}

export const weekRange = (g: Group, week: number) => {
  const from = addDays(g.start_date, (week - 1) * 7);
  return { from, to: addDays(from, 6) };
};

/** Resumo de uma semana fechada (usado no card do início, na imagem e no push). */
export function weekSummary(g: Group, members: Member[], posts: Post[], week: number): WeekSummary {
  const { from, to } = weekRange(g, week);
  // calcula como se "hoje" fosse o último dia daquela semana
  const upto = posts.filter((p) => p.local_date <= to);
  const st = computeStats(g, members, upto, to);
  const inWeek = posts.filter((p) => p.week === week && p.status !== 'cancelled');
  const ranked = members
    .map((m) => ({ id: m.user_id, points: st.byUser[m.user_id]?.weekPoints ?? 0 }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points);
  const topPts = ranked[0]?.points ?? 0;
  const guestsBy = members.map((m) => ({ id: m.user_id, guests: st.byUser[m.user_id]?.weekGuests ?? 0 })).sort((a, b) => b.guests - a.guests)[0];
  const streakBy = members.map((m) => ({ id: m.user_id, streak: st.byUser[m.user_id]?.streak ?? 0 })).sort((a, b) => b.streak - a.streak)[0];
  return {
    week, from, to,
    teamPoints: st.groupWeekPoints,
    rawPoints: inWeek.reduce((n, p) => n + p.points + p.group_bonus, 0),
    checkins: inWeek.filter((p) => p.type === 'checkin').length,
    guests: inWeek.filter((p) => p.type === 'checkin').reduce((n, p) => n + p.guests, 0),
    posters: new Set(inWeek.filter((p) => p.type !== 'poll' && p.type !== 'adjust' && p.type !== 'streak').map((p) => p.user_id)).size,
    members: members.length,
    top: ranked.filter((r) => r.points === topPts).slice(0, 3),
    topGuests: guestsBy && guestsBy.guests > 0 ? guestsBy : null,
    bestStreak: streakBy && streakBy.streak >= 2 ? streakBy : null,
  };
}
