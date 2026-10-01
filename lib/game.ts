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
export const weekOf = (g: Group, d: string) =>
  Math.min(Math.max(Math.floor(daysBetween(g.start_date, d) / 7) + 1, 1), totalWeeks(g));

export const maxIndividual = (g: Group) => g.weekly_user_cap * totalWeeks(g);
export const maxGroup = (g: Group) => g.weekly_group_cap * totalWeeks(g);

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

export interface ActionInfo {
  type: ActionType;
  label: string;
  short: string;
  hint: string;
  photo: boolean;
  text: 'none' | 'optional' | 'required';
  textLabel?: string;
  maxPerDay: number;
}

export const ACTIONS: ActionInfo[] = [
  { type: 'checkin', label: 'Check-in na Casa de Paz', short: 'Check-in', hint: 'Só no dia da Casa de Paz. Foto obrigatória. Cada convidado vale o dobro!', photo: true, text: 'optional', textLabel: 'Como foi? (opcional)', maxPerDay: 1 },
  { type: 'evangelism', label: 'Evangelizei / Convidei', short: 'Evangelismo', hint: 'Sem foto. Conte brevemente o que aconteceu.', photo: false, text: 'required', textLabel: 'O que aconteceu?', maxPerDay: 3 },
  { type: 'group', label: 'Foto em grupo', short: 'Em grupo', hint: 'Vale pontos para você e um bônus extra para a equipe.', photo: true, text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'snack', label: 'Ajuda no lanche', short: 'Lanche', hint: 'Confirme o que vai levar e tire uma foto.', photo: true, text: 'required', textLabel: 'O que você vai levar?', maxPerDay: 1 },
  { type: 'dynamic', label: 'Dinâmica', short: 'Dinâmica', hint: 'Registre a dinâmica do encontro.', photo: true, text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'fellowship', label: 'Comunhão', short: 'Comunhão', hint: 'Momento de comunhão com o grupo.', photo: true, text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'individual', label: 'Foto individual', short: 'Individual', hint: 'Sua foto do dia.', photo: true, text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
  { type: 'relax', label: 'Relax', short: 'Relax', hint: 'Um momento leve e descontraído.', photo: true, text: 'optional', textLabel: 'Legenda (opcional)', maxPerDay: 1 },
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
  poll: 'Enquete',
};

export const POINT_LABELS: { key: keyof Group['points']; label: string }[] = [
  { key: 'checkin', label: 'Check-in (convidado = 2× por pessoa)' },
  { key: 'evangelism', label: 'Evangelizar / convidar' },
  { key: 'group', label: 'Foto em grupo (individual)' },
  { key: 'group_bonus', label: 'Foto em grupo (bônus da equipe)' },
  { key: 'snack', label: 'Ajuda no lanche' },
  { key: 'dynamic', label: 'Dinâmica' },
  { key: 'fellowship', label: 'Comunhão' },
  { key: 'individual', label: 'Foto individual' },
  { key: 'relax', label: 'Relax' },
  { key: 'poll', label: 'Resposta de enquete' },
];

export function actionPoints(g: Group, type: ActionType, guests = 0) {
  if (type === 'checkin') return g.points.checkin * (1 + 2 * guests);
  return g.points[type] ?? 0;
}

/** Verifica no cliente se a ação está liberada hoje (o servidor revalida tudo). */
export function actionAvailability(g: Group, type: ActionType, today: string, myTodayPosts: Post[]): string | null {
  if (today < g.start_date) return `Começa em ${formatDate(g.start_date)}`;
  if (today > g.end_date) return 'Período encerrado';
  const dow = weekdayOf(today);
  if (type === 'checkin') {
    if (dow !== g.house_weekday) return `Só ${WEEKDAYS[g.house_weekday].toLowerCase()}`;
  } else if (g.post_mode === 'selected' && !g.post_weekdays.includes(dow) && dow !== g.house_weekday) {
    return 'Hoje não é dia de post';
  }
  const done = myTodayPosts.filter((p) => p.type === type && p.status !== 'cancelled').length;
  const max = ACTIONS.find((a) => a.type === type)?.maxPerDay ?? 1;
  if (done >= max) return max > 1 ? `Limite de ${max}/dia` : 'Feito hoje ✓';
  return null;
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
}

export interface Stats {
  byUser: Record<string, UserStats>;
  groupPoints: number;
  groupWeekPoints: number;
  week: number;
}

const emptyStats = (): UserStats => ({
  points: 0, weekPoints: 0, checkins: 0, guests: 0, evangelism: 0, posts: 0, postedToday: false, todayPhoto: null, pending: 0,
});

export function computeStats(g: Group, members: Member[], posts: Post[], today: string): Stats {
  const week = weekOf(g, today);
  const byUser: Record<string, UserStats> = {};
  members.forEach((m) => (byUser[m.user_id] = emptyStats()));
  let groupPoints = 0;
  let groupWeekPoints = 0;
  // posts vêm do mais novo para o mais antigo
  for (const p of posts) {
    if (p.status === 'cancelled') continue;
    const s = (byUser[p.user_id] ||= emptyStats());
    s.points += p.points;
    s.posts += 1;
    if (p.status === 'voting') s.pending += p.points;
    if (p.week === week) s.weekPoints += p.points;
    if (p.type === 'checkin') {
      s.checkins += 1;
      s.guests += p.guests;
    }
    if (p.type === 'evangelism') s.evangelism += 1;
    if (p.local_date === today && p.type !== 'poll') {
      s.postedToday = true;
      if (!s.todayPhoto && p.photo_url) s.todayPhoto = p.photo_url;
    }
    groupPoints += p.points + p.group_bonus;
    if (p.week === week) groupWeekPoints += p.points + p.group_bonus;
  }
  return { byUser, groupPoints, groupWeekPoints, week };
}

/* ------------------------------------------------------------------ */
/*  Recompensas individuais (percentual da pontuação máxima individual) */
/* ------------------------------------------------------------------ */

export type RewardKind = 'title' | 'avatar_frame' | 'tile_frame' | 'tile_color' | 'tile_anim';

export interface Reward {
  id: string;
  kind: RewardKind;
  name: string;
  pct: number; // 0–100 da pontuação máxima individual
}

export const REWARD_KIND_LABEL: Record<RewardKind, string> = {
  title: 'Títulos',
  avatar_frame: 'Molduras de perfil',
  tile_frame: 'Molduras do tile',
  tile_color: 'Cores do tile',
  tile_anim: 'Animações do tile',
};

export const REWARDS: Reward[] = [
  { id: 'Semente', kind: 'title', name: 'Semente', pct: 0 },
  { id: 'Mensageiro', kind: 'title', name: 'Mensageiro', pct: 10 },
  { id: 'Anfitrião', kind: 'title', name: 'Anfitrião', pct: 25 },
  { id: 'Pescador de Gente', kind: 'title', name: 'Pescador de Gente', pct: 45 },
  { id: 'Construtor de Paz', kind: 'title', name: 'Construtor de Paz', pct: 65 },
  { id: 'Embaixador da Paz', kind: 'title', name: 'Embaixador da Paz', pct: 85 },
  { id: 'Coluna da Casa', kind: 'title', name: 'Coluna da Casa', pct: 100 },

  { id: 'af-bronze', kind: 'avatar_frame', name: 'Bronze', pct: 8 },
  { id: 'af-silver', kind: 'avatar_frame', name: 'Prata', pct: 30 },
  { id: 'af-gold', kind: 'avatar_frame', name: 'Ouro', pct: 55 },
  { id: 'af-light', kind: 'avatar_frame', name: 'Coroa de luz', pct: 90 },

  { id: 'tc-amber', kind: 'tile_color', name: 'Âmbar', pct: 5 },
  { id: 'tc-olive', kind: 'tile_color', name: 'Oliva', pct: 18 },
  { id: 'tc-terra', kind: 'tile_color', name: 'Terracota', pct: 35 },
  { id: 'tc-sky', kind: 'tile_color', name: 'Céu', pct: 50 },
  { id: 'tc-lilac', kind: 'tile_color', name: 'Lilás', pct: 72 },
  { id: 'tc-gold', kind: 'tile_color', name: 'Dourado', pct: 95 },

  { id: 'tf-dashed', kind: 'tile_frame', name: 'Pontilhada', pct: 15 },
  { id: 'tf-double', kind: 'tile_frame', name: 'Dupla', pct: 40 },
  { id: 'tf-glow', kind: 'tile_frame', name: 'Brilho', pct: 70 },

  { id: 'ta-pulse', kind: 'tile_anim', name: 'Pulsar', pct: 22 },
  { id: 'ta-float', kind: 'tile_anim', name: 'Flutuar', pct: 48 },
  { id: 'ta-shine', kind: 'tile_anim', name: 'Reflexo', pct: 60 },
  { id: 'ta-sparkle', kind: 'tile_anim', name: 'Faíscas', pct: 80 },
];

export const rewardThreshold = (g: Group, r: Reward) => Math.ceil((maxIndividual(g) * r.pct) / 100);
export const isRewardUnlocked = (g: Group, r: Reward, points: number) => points >= rewardThreshold(g, r);

export function defaultTitle(g: Group, points: number) {
  const titles = REWARDS.filter((r) => r.kind === 'title' && isRewardUnlocked(g, r, points));
  return titles[titles.length - 1]?.name ?? 'Semente';
}

/** Só aplica cosméticos que o membro realmente desbloqueou. */
export function equipped(g: Group, m: Member | undefined, points: number) {
  const ok = (id: string | null | undefined) => {
    if (!id) return null;
    const r = REWARDS.find((x) => x.id === id);
    return r && isRewardUnlocked(g, r, points) ? id : null;
  };
  return {
    title: ok(m?.title) ?? defaultTitle(g, points),
    avatarFrame: ok(m?.avatar_frame),
    tileFrame: ok(m?.tile_frame),
    tileColor: ok(m?.tile_color),
    tileAnim: ok(m?.tile_anim),
  };
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

export const groupThreshold = (g: Group, u: GroupUnlock) => Math.ceil((maxGroup(g) * u.pct) / 100);

export function groupUnlocked(g: Group, groupPoints: number) {
  const set = new Set<string>();
  GROUP_UNLOCKS.forEach((u) => {
    if (groupPoints >= groupThreshold(g, u)) set.add(u.id);
  });
  return set;
}

export function nextGroupUnlock(g: Group, groupPoints: number) {
  return GROUP_UNLOCKS.find((u) => groupPoints < groupThreshold(g, u)) ?? null;
}
