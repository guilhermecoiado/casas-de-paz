import type { ActionType, Group, Member, Post, PostType } from './types';

/* ------------------------------------------------------------------ */
/*  Datas (sempre no fuso do grupo)                                    */
/* ------------------------------------------------------------------ */

export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

const toUTC = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, dd);
};

export const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
export const weekdayOf = (d: string) => new Date(toUTC(d)).getUTCDay();
export const addDays = (d: string, n: number) => new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10);

export const totalWeeks = (g: Group) => Math.max(Math.ceil((daysBetween(g.start_date, g.end_date) + 1) / 7), 1);
/** Semana do período (depois do fim continua contando: semana 5, 6...). */
export const weekOf = (g: Group, d: string) => Math.max(Math.floor(daysBetween(g.start_date, d) / 7) + 1, 1);

/** Dias do período (início e fim inclusos). */
export const periodDays = (g: Group) => Math.max(daysBetween(g.start_date, g.end_date) + 1, 1);
/** Duração em semanas com fração: 22 dias = 3,14 semanas (a última semana curta conta só os dias que tem). */
export const periodWeeks = (g: Group) => periodDays(g) / 7;
/** Dias que faltam até o fim do período, contando hoje. */
export const daysLeft = (g: Group, today: string) => Math.max(daysBetween(today, g.end_date) + 1, 0);
const round10 = (n: number) => Math.max(10, Math.round(n / 10) * 10);

/** Meta individual = limite semanal × semanas do período (proporcional aos dias reais). */
export const maxIndividual = (g: Group) => round10(g.weekly_user_cap * periodWeeks(g));

/** Quanto a equipe pode somar por semana para a casa: automático (membros × limite × %) ou manual. */
export const teamWeeklyCap = (g: Group, members: number) =>
  g.group_cap_auto ? Math.max(1, Math.round(g.weekly_user_cap * Math.max(members, 1) * Number(g.group_cap_factor || 0.6))) : g.weekly_group_cap;
export const maxGroup = (g: Group, members: number) => round10(teamWeeklyCap(g, members) * periodWeeks(g));

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function formatDate(d: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) {
  return new Date(toUTC(d)).toLocaleDateString('pt-BR', { ...opts, timeZone: 'UTC' });
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/* ------------------------------------------------------------------ */
/*  Ações que valem ponto                                              */
/* ------------------------------------------------------------------ */

export type ActionWhen = 'meeting' | 'daily';

export interface ActionInfo {
  type: ActionType;
  when: ActionWhen;
  label: string;
  short: string;
  hint: string;
  photo: 'required' | 'optional' | 'none';
  text: 'none' | 'optional' | 'required';
  textLabel?: string;
  placeholder?: string;
  maxPerDay: number;
}

export const ACTIONS: ActionInfo[] = [
  /* dia do encontro: 1 vez cada */
  { type: 'checkin', when: 'meeting', label: 'Check-in na Casa de Paz', short: 'Check-in', hint: 'Foto no local. Cada convidado vale o dobro do check-in!', photo: 'required', text: 'optional', textLabel: 'Como foi? (opcional)', maxPerDay: 1 },
  { type: 'group', when: 'meeting', label: 'Foto em grupo', short: 'Em grupo', hint: 'Só 1 por grupo no dia: quem postar primeiro leva os pontos e o bônus da equipe.', photo: 'required', text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'snack', when: 'meeting', label: 'Ajuda no lanche', short: 'Lanche', hint: 'Conte o que levou e tire uma foto.', photo: 'required', text: 'required', textLabel: 'O que você levou?', placeholder: 'Ex.: Bolo de cenoura', maxPerDay: 1 },
  { type: 'dynamic', when: 'meeting', label: 'Dinâmica', short: 'Dinâmica', hint: 'Registre a dinâmica do encontro.', photo: 'required', text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'fellowship', when: 'meeting', label: 'Comunhão', short: 'Comunhão', hint: 'Momento de comunhão com o grupo.', photo: 'required', text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'relax', when: 'meeting', label: 'Relax', short: 'Relax', hint: 'Um momento leve e descontraído do encontro.', photo: 'required', text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  /* dia a dia: 1 vez por dia cada (máximo do dia = soma destas ações) */
  { type: 'evangelism', when: 'daily', label: 'Evangelizei / Convidei', short: 'Evangelismo', hint: 'Conte brevemente o que aconteceu. É a ação que mais vale no dia a dia!', photo: 'none', text: 'required', textLabel: 'O que aconteceu?', placeholder: 'Ex.: Convidei meu colega de trabalho para sexta.', maxPerDay: 1 },
  { type: 'individual', when: 'daily', label: 'Foto individual', short: 'Individual', hint: 'Sua foto do dia.', photo: 'required', text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'verse', when: 'daily', label: 'Versículo do dia', short: 'Versículo', hint: 'Compartilhe o versículo que falou com você.', photo: 'optional', text: 'required', textLabel: 'Versículo', placeholder: 'Ex.: “Tudo posso naquele que me fortalece” — Fp 4:13', maxPerDay: 1 },
  { type: 'encourage', when: 'daily', label: 'Encorajamento para o encontro', short: 'Encorajamento', hint: 'Anime o grupo para a próxima Casa de Paz.', photo: 'optional', text: 'required', textLabel: 'Mensagem', placeholder: 'Ex.: Sexta tem Casa de Paz! Traga alguém com você 🙌', maxPerDay: 1 },
  { type: 'devotional', when: 'daily', label: 'TSD (Devocional)', short: 'TSD', hint: 'O que Deus falou com você no seu tempo a sós.', photo: 'optional', text: 'required', textLabel: 'O que você aprendeu?', maxPerDay: 1 },
  { type: 'prayer', when: 'daily', label: 'Orei pela Casa de Paz', short: 'Oração', hint: 'Registre que orou pelo encontro e pelos convidados.', photo: 'none', text: 'optional', textLabel: 'Por quem orou? (opcional)', maxPerDay: 1 },
  { type: 'fasting', when: 'daily', label: 'Registro de jejum', short: 'Jejum', hint: 'Registre seu jejum pela Casa de Paz.', photo: 'none', text: 'required', textLabel: 'Como foi o jejum?', placeholder: 'Ex.: Jejum até as 12h', maxPerDay: 1 },
  { type: 'testimony', when: 'daily', label: 'Testemunho', short: 'Testemunho', hint: 'Conte algo que Deus fez. Inspira quem ainda não conhece!', photo: 'optional', text: 'required', textLabel: 'O que Deus fez?', maxPerDay: 1 },
];

export const TYPE_LABEL: Record<PostType, string> = {
  checkin: 'Check-in',
  evangelism: 'Evangelismo',
  group: 'Foto em grupo',
  snack: 'Lanche',
  dynamic: 'Dinâmica',
  fellowship: 'Comunhão',
  individual: 'Individual',
  relax: 'Relax',
  verse: 'Versículo',
  encourage: 'Encorajamento',
  devotional: 'TSD',
  prayer: 'Oração',
  fasting: 'Jejum',
  testimony: 'Testemunho',
  poll: 'Enquete',
  adjust: 'Ajuste do adm',
  streak: 'Intensivo',
};

export const POINT_LABELS: { key: keyof Group['points']; label: string; when: ActionWhen | 'other' }[] = [
  { key: 'checkin', label: 'Check-in (convidado = 2× por pessoa)', when: 'meeting' },
  { key: 'group', label: 'Foto em grupo (quem postar primeiro)', when: 'meeting' },
  { key: 'group_bonus', label: 'Foto em grupo (bônus da equipe)', when: 'meeting' },
  { key: 'snack', label: 'Ajuda no lanche', when: 'meeting' },
  { key: 'dynamic', label: 'Dinâmica', when: 'meeting' },
  { key: 'fellowship', label: 'Comunhão', when: 'meeting' },
  { key: 'relax', label: 'Relax', when: 'meeting' },
  { key: 'evangelism', label: 'Evangelizar / convidar', when: 'daily' },
  { key: 'individual', label: 'Foto individual', when: 'daily' },
  { key: 'verse', label: 'Versículo do dia', when: 'daily' },
  { key: 'encourage', label: 'Encorajamento', when: 'daily' },
  { key: 'devotional', label: 'TSD (devocional)', when: 'daily' },
  { key: 'prayer', label: 'Orei pela Casa de Paz', when: 'daily' },
  { key: 'fasting', label: 'Registro de jejum', when: 'daily' },
  { key: 'testimony', label: 'Testemunho', when: 'daily' },
  { key: 'poll', label: 'Resposta de enquete', when: 'other' },
];

/** Pontos desta ação (check-in considera os convidados). */
export function actionPoints(g: Group, type: ActionType, guests = 0) {
  if (type === 'checkin') return (g.points.checkin ?? 0) * (1 + 2 * guests);
  return g.points[type] ?? 0;
}

/** Máximo do dia a dia (todas as ações diárias, 1x cada). */
export const dailyMax = (g: Group) =>
  ACTIONS.filter((a) => a.when === 'daily').reduce((sum, a) => sum + (g.points[a.type] ?? 0), 0);

/** Bônus do dia do encontro (sem convidados). */
export const meetingMax = (g: Group) =>
  ACTIONS.filter((a) => a.when === 'meeting').reduce((sum, a) => sum + (g.points[a.type] ?? 0), 0);

/** Limite semanal sugerido: 7 dias de dia a dia + bônus do encontro + ~2 enquetes. */
export const suggestedWeeklyCap = (g: Group) => dailyMax(g) * 7 + meetingMax(g) + (g.points.poll ?? 0) * 2;

export interface Availability {
  blocked: string | null; // motivo do bloqueio (null = liberado)
  left: number;           // quantas vezes ainda pode postar hoje
  done: number;
}

/** Verifica no cliente se a ação está liberada hoje (o servidor revalida tudo). */
export function actionAvailability(g: Group, type: ActionType, today: string, myTodayPosts: Post[], groupTodayPosts: Post[] = []): Availability {
  const info = ACTIONS.find((a) => a.type === type)!;
  const done = myTodayPosts.filter((p) => p.type === type && p.status !== 'cancelled').length;
  const left = Math.max(info.maxPerDay - done, 0);
  if (today < g.start_date) return { blocked: `Começa em ${formatDate(g.start_date)}`, left, done };
  const dow = weekdayOf(today);
  if (info.when === 'meeting') {
    if (dow !== g.house_weekday) return { blocked: `Só no dia do encontro (${WEEKDAYS[g.house_weekday].toLowerCase()})`, left, done };
    if (type === 'group') {
      const first = groupTodayPosts.find((p) => p.type === 'group' && p.status !== 'cancelled');
      if (first && !done) return { blocked: 'Já postada hoje', left: 0, done };
    }
  } else if (g.post_mode === 'selected' && !g.post_weekdays.includes(dow) && dow !== g.house_weekday) {
    return { blocked: 'Hoje não é dia de post', left, done };
  }
  if (left === 0) return { blocked: 'done', left, done };
  return { blocked: null, left, done };
}

/* ------------------------------------------------------------------ */
/*  Estatísticas                                                       */
/* ------------------------------------------------------------------ */

export interface UserStats {
  points: number;
  weekPoints: number;
  checkins: number;
  guests: number;
  evangelism: number;
  posts: number;
  postedToday: boolean;
  todayPhoto: string | null;
  pending: number;
  days: number;        // dias diferentes com post (constância)
  polls: number;       // enquetes respondidas
  snacks: number;      // ajudas no lanche
  groupPhotos: number; // fotos em grupo
  reachedAt: string;   // quando chegou na pontuação atual (desempate: quem chegou primeiro)
  streak: number;      // dias seguidos postando (vale até ontem: hoje ainda dá tempo)
  bestStreak: number;  // maior sequência da temporada
  weekGuests: number;
  weekDays: number;
}

export interface Stats {
  byUser: Record<string, UserStats>;
  groupPoints: number;
  groupWeekPoints: number;
  week: number;
  teamWeekCap: number;
}

const emptyStats = (): UserStats => ({
  points: 0, weekPoints: 0, checkins: 0, guests: 0, evangelism: 0, posts: 0, postedToday: false, todayPhoto: null, pending: 0,
  days: 0, polls: 0, snacks: 0, groupPhotos: 0, reachedAt: '', streak: 0, bestStreak: 0, weekGuests: 0, weekDays: 0,
});

/** Sequência atual e recorde a partir dos dias (yyyy-mm-dd) em que a pessoa postou. */
export function streakOf(days: Iterable<string>, today: string) {
  const sorted = Array.from(new Set(days)).filter((d) => d <= today).sort();
  let best = 0, run = 0, prev = '';
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  // a sequência só está viva se o último dia postado foi hoje ou ontem
  const current = prev && daysBetween(prev, today) <= 1 ? run : 0;
  return { current, best };
}

/** Nível do fogo (estilo Duolingo): cresce com a sequência. */
export const streakLevel = (n: number) => (n >= 14 ? 4 : n >= 7 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);

export function computeStats(g: Group, members: Member[], posts: Post[], today: string): Stats {
  const week = weekOf(g, today);
  const teamWeekCap = teamWeeklyCap(g, members.length);
  const byUser: Record<string, UserStats> = {};
  members.forEach((m) => (byUser[m.user_id] = emptyStats()));
  const teamByWeek = new Map<number, number>();
  const dayKeys = new Set<string>();
  const userDays = new Map<string, string[]>();
  // posts vêm do mais novo para o mais antigo
  for (const p of posts) {
    if (p.status === 'cancelled') continue;
    const s = (byUser[p.user_id] ||= emptyStats());
    s.points += p.points;
    s.posts += 1;
    if (!s.reachedAt && p.points !== 0) s.reachedAt = p.created_at;
    if (p.status === 'voting') s.pending += p.points;
    if (p.week === week) s.weekPoints += p.points;
    if (p.type === 'checkin') {
      s.checkins += 1;
      s.guests += p.guests;
    }
    if (p.type === 'evangelism') s.evangelism += 1;
    if (p.type === 'poll') s.polls += 1;
    if (p.type === 'snack') s.snacks += 1;
    if (p.type === 'group') s.groupPhotos += 1;
    if (p.type !== 'poll' && p.type !== 'adjust' && p.type !== 'streak' && !dayKeys.has(`${p.user_id}|${p.local_date}`)) {
      dayKeys.add(`${p.user_id}|${p.local_date}`);
      s.days += 1;
      if (p.week === week) s.weekDays += 1;
      const l = userDays.get(p.user_id) ?? [];
      l.push(p.local_date);
      userDays.set(p.user_id, l);
    }
    if (p.type === 'checkin' && p.week === week) s.weekGuests += p.guests;
    if (p.local_date === today && p.type !== 'poll' && p.type !== 'adjust' && p.type !== 'streak') {
      s.postedToday = true;
      if (!s.todayPhoto && p.photo_url) s.todayPhoto = p.photo_url;
    }
    teamByWeek.set(p.week, (teamByWeek.get(p.week) ?? 0) + p.points + p.group_bonus);
  }
  userDays.forEach((days, uid) => {
    const st = streakOf(days, today);
    byUser[uid].streak = st.current;
    byUser[uid].bestStreak = st.best;
  });
  // a casa avança no máximo o limite semanal da equipe por semana (liberação gradual)
  let groupPoints = 0;
  teamByWeek.forEach((v) => (groupPoints += Math.max(0, Math.min(v, teamWeekCap))));
  const groupWeekPoints = Math.max(0, Math.min(teamByWeek.get(week) ?? 0, teamWeekCap));
  return { byUser, groupPoints, groupWeekPoints, week, teamWeekCap };
}

/** Ordena para ranking. Empate: mais fiel (dias postando) → chegou primeiro → mais desbloqueios. */
export function rankCompare(a: { v: number; s?: UserStats; unlocks: number }, b: { v: number; s?: UserStats; unlocks: number }) {
  if (b.v !== a.v) return b.v - a.v;
  const da = a.s?.days ?? 0, db = b.s?.days ?? 0;
  if (db !== da) return db - da;
  const ra = a.s?.reachedAt || '9999', rb = b.s?.reachedAt || '9999';
  if (ra !== rb) return ra < rb ? -1 : 1;
  return b.unlocks - a.unlocks;
}

/* ------------------------------------------------------------------ */
/*  Desbloqueios gerais (percentual da pontuação máxima do grupo)       */
/* ------------------------------------------------------------------ */

export type HousePart =
  | 'foundation' | 'walls' | 'door' | 'windows' | 'roof' | 'chimney' | 'garden' | 'lights' | 'fence' | 'complete';

export interface GroupUnlock {
  id: string;
  name: string;
  desc: string;
  pct: number;
  part?: HousePart;
  feature?: 'frame' | 'chat' | 'tile_anim' | 'background';
}

export const GROUP_UNLOCKS: GroupUnlock[] = [
  { id: 'frame', name: 'Moldura Casa de Paz', desc: 'Aplique a moldura nas fotos e compartilhe no Instagram', pct: 0, feature: 'frame' },
  { id: 'foundation', name: 'Fundação', desc: 'A base da nossa casa', pct: 5, part: 'foundation' },
  { id: 'chat', name: 'Chat do grupo', desc: 'Conversa liberada para todos', pct: 10, feature: 'chat' },
  { id: 'walls', name: 'Paredes', desc: 'A casa começa a ganhar forma', pct: 18, part: 'walls' },
  { id: 'tile_anim', name: 'Tiles animados', desc: 'Todos os tiles ganham vida', pct: 25, feature: 'tile_anim' },
  { id: 'door', name: 'Porta', desc: 'Porta aberta para os convidados', pct: 30, part: 'door' },
  { id: 'windows', name: 'Janelas', desc: 'Luz entrando na casa', pct: 40, part: 'windows' },
  { id: 'background', name: 'Foto de fundo', desc: 'O adm pode colocar uma foto de fundo no início', pct: 45, feature: 'background' },
  { id: 'roof', name: 'Telhado', desc: 'Proteção para todos', pct: 55, part: 'roof' },
  { id: 'chimney', name: 'Chaminé', desc: 'Casa aquecida', pct: 65, part: 'chimney' },
  { id: 'garden', name: 'Jardim', desc: 'Flores e vida ao redor', pct: 75, part: 'garden' },
  { id: 'lights', name: 'Luzes', desc: 'A casa se ilumina', pct: 85, part: 'lights' },
  { id: 'fence', name: 'Cerca', desc: 'Acabamento final', pct: 93, part: 'fence' },
  { id: 'complete', name: 'Casa completa!', desc: 'Missão cumprida. Casa de Paz construída!', pct: 100, part: 'complete' },
];

export const groupThreshold = (maxGrp: number, u: GroupUnlock) => Math.ceil((maxGrp * u.pct) / 100);

export function groupUnlocked(maxGrp: number, groupPoints: number) {
  const set = new Set<string>();
  GROUP_UNLOCKS.forEach((u) => {
    if (groupPoints >= groupThreshold(maxGrp, u)) set.add(u.id);
  });
  return set;
}

export function nextGroupUnlock(maxGrp: number, groupPoints: number) {
  return GROUP_UNLOCKS.find((u) => groupPoints < groupThreshold(maxGrp, u)) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Molduras por semana                                                */
/* ------------------------------------------------------------------ */

/** Semana 1 libera no cadastro; as demais, com o check-in do membro naquela semana. */
export function unlockedFrameWeeks(userId: string, posts: Post[]) {
  const set = new Set<number>([1]);
  posts.forEach((p) => {
    if (p.user_id === userId && p.type === 'checkin' && (p.status === 'ok' || p.status === 'voting')) set.add(p.week);
  });
  return set;
}
