import { maxIndividual, type UserStats } from './game';
import type { Group, Member } from './types';

/* ===================================================================== */
/*  RECOMPENSAS                                                            */
/*                                                                         */
/*  1) Linha da evolução: 4 caminhos, desbloqueados por % da pontuação      */
/*     máxima individual. O limite semanal libera no máximo 25% por semana, */
/*     então cada caminho fecha logo antes do fim da "sua" semana.          */
/*  2) Coleção: conquistas por ação (check-ins, convidados, evangelismo...). */
/*  3) Frases de sobrepor: livres, por caminho, por conquista e da equipe.   */
/*  4) Kits secretos: equipar o caminho inteiro revela uma animação única.   */
/* ===================================================================== */

export type RewardKind = 'title' | 'avatar_frame' | 'tile_color' | 'tile_frame' | 'tile_anim' | 'phrase';
export type PathId = 'semeador' | 'pescador' | 'mensageiro' | 'reino';
export type AchStat = 'checkins' | 'guests' | 'evangelism' | 'days' | 'polls' | 'snacks' | 'groupPhotos' | 'bestStreak';

export interface Reward {
  id: string;
  kind: RewardKind;
  name: string;
  icon: string;
  path?: PathId;
  pct?: number;                                   // linha da evolução
  req?: { stat: AchStat; n: number; label: string }; // coleção
  free?: boolean;                                 // liberado desde o início
}

export const KIND_LABEL: Record<RewardKind, string> = {
  title: 'Título',
  avatar_frame: 'Moldura de perfil',
  tile_color: 'Cor do tile',
  tile_frame: 'Moldura do tile',
  tile_anim: 'Animação do tile',
  phrase: 'Frase',
};

export interface PathInfo {
  id: PathId;
  name: string;
  icon: string;
  week: number;
  kit: { name: string; desc: string };
}

export const PATHS: PathInfo[] = [
  { id: 'semeador', name: 'Caminho do Semeador', icon: '🌱', week: 1, kit: { name: 'Campo Fértil', desc: 'O trigo cresce e o sol nasce no seu tile' } },
  { id: 'pescador', name: 'Caminho do Pescador', icon: '🐟', week: 2, kit: { name: 'Rede Cheia', desc: 'Ondas e peixes saltando no seu tile' } },
  { id: 'mensageiro', name: 'Caminho do Mensageiro', icon: '🔥', week: 3, kit: { name: 'Línguas de Fogo', desc: 'A pomba desce e o fogo se acende no seu tile' } },
  { id: 'reino', name: 'Caminho do Reino', icon: '👑', week: 4, kit: { name: 'Glória do Reino', desc: 'Raios dourados e a coroa descendo sobre o seu tile' } },
];

export const REWARDS: Reward[] = [
  /* 🌱 Semeador (semana 1 · até 22%) */
  { id: 't-semente', kind: 'title', name: 'Semente', icon: '🌱', path: 'semeador', pct: 0 },
  { id: 'tc-terra', kind: 'tile_color', name: 'Cor Terra', icon: '🟤', path: 'semeador', pct: 4 },
  { id: 'af-semente', kind: 'avatar_frame', name: 'Moldura Semente', icon: '🌱', path: 'semeador', pct: 8 },
  { id: 'tf-trigo', kind: 'tile_frame', name: 'Tile Trigo', icon: '🌾', path: 'semeador', pct: 13 },
  { id: 'ta-broto', kind: 'tile_anim', name: 'Animação Broto', icon: '🌿', path: 'semeador', pct: 18 },
  { id: 't-semeador', kind: 'title', name: 'Semeador', icon: '🧑‍🌾', path: 'semeador', pct: 22 },

  /* 🐟 Pescador (semana 2 · até 45%) */
  { id: 'tc-galileia', kind: 'tile_color', name: 'Cor Mar da Galileia', icon: '🌊', path: 'pescador', pct: 27 },
  { id: 'af-peixes', kind: 'avatar_frame', name: 'Moldura Peixes', icon: '🐟', path: 'pescador', pct: 32 },
  { id: 'tf-pesca', kind: 'tile_frame', name: 'Tile Pesca', icon: '🎣', path: 'pescador', pct: 37 },
  { id: 'ta-pesca', kind: 'tile_anim', name: 'Animação Pesca Milagrosa', icon: '🐠', path: 'pescador', pct: 41 },
  { id: 't-pescador', kind: 'title', name: 'Pescador de Gente', icon: '🛶', path: 'pescador', pct: 45 },

  /* 🔥 Mensageiro (semana 3 · até 68%) */
  { id: 'tc-fogo', kind: 'tile_color', name: 'Cor Fogo', icon: '🟠', path: 'mensageiro', pct: 50 },
  { id: 'af-chama', kind: 'avatar_frame', name: 'Moldura Chama', icon: '🔥', path: 'mensageiro', pct: 55 },
  { id: 'ta-pentecostes', kind: 'tile_anim', name: 'Animação Pentecostes', icon: '🕊️', path: 'mensageiro', pct: 60 },
  { id: 'ph-boa-nova', kind: 'phrase', name: 'Leve a Boa Nova', icon: '💬', path: 'mensageiro', pct: 64 },
  { id: 't-mensageiro', kind: 'title', name: 'Mensageiro', icon: '📯', path: 'mensageiro', pct: 68 },

  /* 👑 Reino (semana 4 · até 90%) */
  { id: 'tc-purpura', kind: 'tile_color', name: 'Púrpura Real', icon: '🟣', path: 'reino', pct: 73 },
  { id: 'af-coroa', kind: 'avatar_frame', name: 'Moldura Coroa', icon: '👑', path: 'reino', pct: 78 },
  { id: 'tf-reino', kind: 'tile_frame', name: 'Tile Reino', icon: '🏛️', path: 'reino', pct: 82 },
  { id: 'ta-gloria', kind: 'tile_anim', name: 'Animação Glória', icon: '✨', path: 'reino', pct: 86 },
  { id: 't-embaixador', kind: 'title', name: 'Embaixador do Reino', icon: '🎖️', path: 'reino', pct: 90 },

  /* 🏆 Coleção: conquistas por ação */
  { id: 'af-pomba', kind: 'avatar_frame', name: 'Moldura Pomba', icon: '🕊️', req: { stat: 'checkins', n: 1, label: 'Faça seu 1º check-in' } },
  { id: 'af-oliveira', kind: 'avatar_frame', name: 'Moldura Oliveira', icon: '🌿', req: { stat: 'checkins', n: 3, label: '3 check-ins na Casa de Paz' } },
  { id: 'af-belem', kind: 'avatar_frame', name: 'Moldura Estrela de Belém', icon: '⭐', req: { stat: 'checkins', n: 4, label: 'Check-in em todas as Casas de Paz (4)' } },
  { id: 't-anfitriao', kind: 'title', name: 'Anfitrião', icon: '🏠', req: { stat: 'guests', n: 1, label: 'Leve 1 convidado' } },
  { id: 't-ponte', kind: 'title', name: 'Ponte', icon: '🌉', req: { stat: 'guests', n: 2, label: 'Leve 2 convidados' } },
  { id: 'ta-pomba', kind: 'tile_anim', name: 'Animação Pomba', icon: '🕊️', req: { stat: 'guests', n: 3, label: 'Leve 3 convidados' } },
  { id: 't-multiplicador', kind: 'title', name: 'Multiplicador', icon: '🌳', req: { stat: 'guests', n: 5, label: 'Leve 5 convidados (lendário)' } },
  { id: 't-arauto', kind: 'title', name: 'Arauto', icon: '📣', req: { stat: 'evangelism', n: 5, label: '5 registros de evangelismo' } },
  { id: 't-voz', kind: 'title', name: 'Voz no Deserto', icon: '🏜️', req: { stat: 'evangelism', n: 10, label: '10 registros de evangelismo' } },
  { id: 'tc-agua-viva', kind: 'tile_color', name: 'Cor Água Viva', icon: '💧', req: { stat: 'days', n: 5, label: 'Poste em 5 dias diferentes' } },
  { id: 'ta-gotas', kind: 'tile_anim', name: 'Animação Gotas', icon: '💧', req: { stat: 'days', n: 10, label: 'Poste em 10 dias diferentes' } },
  { id: 'tf-videira', kind: 'tile_frame', name: 'Tile Videira Verdadeira', icon: '🍇', req: { stat: 'days', n: 18, label: 'Poste em 18 dias diferentes (rara)' } },
  { id: 't-guardiao', kind: 'title', name: 'Guardião da Mesa', icon: '🍞', req: { stat: 'snacks', n: 2, label: 'Ajude no lanche 2 vezes' } },
  { id: 'tc-mana', kind: 'tile_color', name: 'Cor Maná', icon: '🍯', req: { stat: 'snacks', n: 3, label: 'Ajude no lanche 3 vezes' } },
  { id: 't-comunhao', kind: 'title', name: 'Construtor de Comunhão', icon: '🤝', req: { stat: 'groupPhotos', n: 3, label: '3 fotos em grupo' } },
  // 🔥 intensivo: sequência de dias seguidos postando (exclusivos, só por constância)
  { id: 't-intensivo', kind: 'title', name: 'Intensivo', icon: '🔥', req: { stat: 'bestStreak', n: 7, label: 'Complete o intensivo: 7 dias seguidos' } },
  { id: 'ta-intensivo', kind: 'tile_anim', name: 'Fogo do Intensivo', icon: '🔥', req: { stat: 'bestStreak', n: 7, label: 'Complete o intensivo: 7 dias seguidos (exclusiva)' } },
  { id: 'af-brasa', kind: 'avatar_frame', name: 'Moldura Brasa Viva', icon: '♨️', req: { stat: 'bestStreak', n: 14, label: '14 dias seguidos' } },
  { id: 'tc-brasa', kind: 'tile_color', name: 'Cor Brasa', icon: '🟥', req: { stat: 'bestStreak', n: 21, label: '21 dias seguidos' } },
  { id: 't-fogo-continuo', kind: 'title', name: 'Fogo que Não se Apaga', icon: '🕯️', req: { stat: 'bestStreak', n: 28, label: '28 dias seguidos (lendário)' } },

  /* 🎁 Itens avulsos por pontos (intercalados com os caminhos; não são necessários para completar a evolução) */
  // Títulos
  { id: 't-discipulo', kind: 'title', name: 'Discípulo', icon: '📖', pct: 6 },
  { id: 't-testemunha', kind: 'title', name: 'Testemunha', icon: '🙌', pct: 30 },
  { id: 't-luz-caminho', kind: 'title', name: 'Luz do Caminho', icon: '🕯️', pct: 57 },
  { id: 't-sal', kind: 'title', name: 'Sal da Terra', icon: '🧂', pct: 96 },
  // Molduras de perfil
  { id: 'af-pedra', kind: 'avatar_frame', name: 'Moldura Pedra', icon: '🪨', pct: 3 },
  { id: 'af-aguas', kind: 'avatar_frame', name: 'Moldura Águas', icon: '💧', pct: 15 },
  { id: 'af-videira', kind: 'avatar_frame', name: 'Moldura Videira', icon: '🍇', pct: 35 },
  { id: 'af-rebanho', kind: 'avatar_frame', name: 'Moldura Rebanho', icon: '🐑', pct: 52 },
  { id: 'af-alianca', kind: 'avatar_frame', name: 'Moldura Aliança', icon: '🌈', pct: 76 },
  { id: 'af-leao', kind: 'avatar_frame', name: 'Moldura Leão de Judá', icon: '🦁', pct: 97 },
  // Cores do tile
  { id: 'tc-areia', kind: 'tile_color', name: 'Areia do Deserto', icon: '🏜️', pct: 2 },
  { id: 'tc-oliveira', kind: 'tile_color', name: 'Oliveira', icon: '🫒', pct: 11 },
  { id: 'tc-linho', kind: 'tile_color', name: 'Linho Branco', icon: '🤍', pct: 20 },
  { id: 'tc-ceu', kind: 'tile_color', name: 'Céu da Galileia', icon: '☁️', pct: 34 },
  { id: 'tc-rosa', kind: 'tile_color', name: 'Rosa de Sarom', icon: '🌹', pct: 47 },
  { id: 'tc-jose', kind: 'tile_color', name: 'Túnica de José', icon: '🧥', pct: 62 },
  { id: 'tc-ouro', kind: 'tile_color', name: 'Ouro do Tabernáculo', icon: '🪙', pct: 94 },
  // Molduras do tile
  { id: 'tf-pedras', kind: 'tile_frame', name: 'Tile Pedras', icon: '🪨', pct: 5 },
  { id: 'tf-ondas', kind: 'tile_frame', name: 'Tile Ondas', icon: '🌊', pct: 16 },
  { id: 'tf-estrelas', kind: 'tile_frame', name: 'Tile Estrelas', icon: '⭐', pct: 25 },
  { id: 'tf-ramos', kind: 'tile_frame', name: 'Tile Ramos', icon: '🌿', pct: 40 },
  { id: 'tf-arca', kind: 'tile_frame', name: 'Tile Arca', icon: '🕊️', pct: 53 },
  { id: 'tf-tabua', kind: 'tile_frame', name: 'Tile Tábua da Lei', icon: '📜', pct: 70 },
  { id: 'tf-alianca', kind: 'tile_frame', name: 'Tile Arco da Aliança', icon: '🌈', pct: 88 },
  // Animações do tile
  { id: 'ta-brilho', kind: 'tile_anim', name: 'Animação Brilho', icon: '✨', pct: 7 },
  { id: 'ta-estrelas', kind: 'tile_anim', name: 'Animação Estrelas', icon: '⭐', pct: 21 },
  { id: 'ta-vento', kind: 'tile_anim', name: 'Animação Vento', icon: '🍃', pct: 29 },
  { id: 'ta-ceifa', kind: 'tile_anim', name: 'Animação Ceifa', icon: '🌾', pct: 39 },
  { id: 'ta-belem', kind: 'tile_anim', name: 'Animação Estrela de Belém', icon: '🌟', pct: 71 },
  { id: 'ta-arvore', kind: 'tile_anim', name: 'Animação Árvore da Vida', icon: '🌳', pct: 84 },
  { id: 'ta-alianca', kind: 'tile_anim', name: 'Animação Aliança', icon: '🌈', pct: 99 },

  /* 💬 Frases de sobrepor */
  { id: 'ph-esperanca', kind: 'phrase', name: 'Há esperança', icon: '💬', free: true },
  { id: 'ph-transforma', kind: 'phrase', name: 'Jesus transforma', icon: '💬', free: true },
  { id: 'ph-venha', kind: 'phrase', name: 'Venha e veja', icon: '💬', free: true },
  { id: 'ph-mesa', kind: 'phrase', name: 'Convide para a mesa', icon: '💬', req: { stat: 'checkins', n: 1, label: 'Faça seu 1º check-in' } },
  { id: 'ph-lugar', kind: 'phrase', name: 'Há lugar para você', icon: '💬', req: { stat: 'guests', n: 1, label: 'Leve 1 convidado' } },
  { id: 'ph-semente', kind: 'phrase', name: 'Plante uma semente', icon: '💬', req: { stat: 'evangelism', n: 1, label: '1 registro de evangelismo' } },
  { id: 'ph-ouvir', kind: 'phrase', name: 'Alguém precisa ouvir', icon: '💬', req: { stat: 'evangelism', n: 3, label: '3 registros de evangelismo' } },
  { id: 'ph-luz', kind: 'phrase', name: 'Seja luz', icon: '💬', req: { stat: 'groupPhotos', n: 1, label: '1 foto em grupo' } },
  { id: 'ph-bom', kind: 'phrase', name: 'Deus é bom', icon: '💬', req: { stat: 'polls', n: 3, label: 'Responda 3 enquetes' } },
  { id: 'ph-continue', kind: 'phrase', name: 'Permaneça', icon: '💬', req: { stat: 'days', n: 7, label: 'Poste em 7 dias diferentes' } },
];

/** Frases que a equipe inteira ganha conforme a casa avança (id do desbloqueio geral → frase). */
export const TEAM_PHRASES: { unlock: string; text: string }[] = [
  { unlock: 'door', text: '“Ide por todo o mundo”' },
  { unlock: 'roof', text: '“Eu sou o caminho”' },
  { unlock: 'lights', text: '“Vós sois a luz do mundo”' },
  { unlock: 'complete', text: '“Eis que faço novas todas as coisas”' },
];

export const ACH_LABEL: Record<AchStat, string> = {
  checkins: 'check-ins', guests: 'convidados', evangelism: 'evangelismos', days: 'dias postando',
  polls: 'enquetes', snacks: 'lanches', groupPhotos: 'fotos em grupo', bestStreak: 'dias seguidos',
};

/* --------------------------- lógica --------------------------- */

export type Progress = Pick<UserStats, 'points' | AchStat>;

export const emptyProgress = (): Progress => ({ points: 0, checkins: 0, guests: 0, evangelism: 0, days: 0, polls: 0, snacks: 0, groupPhotos: 0, bestStreak: 0 });

export const rewardThreshold = (g: Group, r: Reward) => Math.ceil((maxIndividual(g) * (r.pct ?? 0)) / 100);

export function isUnlocked(g: Group, r: Reward, p: Progress) {
  if (r.free) return true;
  if (r.req) return p[r.req.stat] >= r.req.n;
  return p.points >= rewardThreshold(g, r);
}

export const rewardById = (id: string | null | undefined) => (id ? REWARDS.find((r) => r.id === id) : undefined);

/** Item da linha da evolução ainda não liberado (o próximo da fila). */
export function nextPathReward(g: Group, p: Progress) {
  return REWARDS.filter((r) => r.path && !isUnlocked(g, r, p)).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0] ?? null;
}

export function defaultTitle(g: Group, p: Progress) {
  const titles = REWARDS.filter((r) => r.kind === 'title' && r.path && isUnlocked(g, r, p));
  return titles[titles.length - 1] ?? REWARDS[0];
}

/** Itens equipáveis que formam o kit de cada caminho (frases não são equipáveis). */
export function kitItems(path: PathId) {
  return REWARDS.filter((r) => r.path === path && r.kind !== 'phrase');
}

export interface Look {
  title: string;
  titleId: string;
  avatarFrame: string | null;
  tileFrame: string | null;
  tileColor: string | null;
  tileAnim: string | null;
  kit: PathId | null;
}

const FIELD: Record<Exclude<RewardKind, 'phrase'>, keyof Pick<Member, 'title' | 'avatar_frame' | 'tile_frame' | 'tile_color' | 'tile_anim'>> = {
  title: 'title', avatar_frame: 'avatar_frame', tile_frame: 'tile_frame', tile_color: 'tile_color', tile_anim: 'tile_anim',
};
export const fieldOf = (kind: Exclude<RewardKind, 'phrase'>) => FIELD[kind];

/** Só aplica o que o membro realmente desbloqueou; detecta kit completo equipado. */
export function equipped(g: Group, m: Member | undefined, p: Progress): Look {
  const ok = (id: string | null | undefined, kind: RewardKind) => {
    const r = rewardById(id);
    return r && r.kind === kind && isUnlocked(g, r, p) ? r.id : null;
  };
  const titleR = rewardById(ok(m?.title, 'title')) ?? defaultTitle(g, p);
  const look: Look = {
    title: titleR.name,
    titleId: titleR.id,
    avatarFrame: ok(m?.avatar_frame, 'avatar_frame'),
    tileFrame: ok(m?.tile_frame, 'tile_frame'),
    tileColor: ok(m?.tile_color, 'tile_color'),
    tileAnim: ok(m?.tile_anim, 'tile_anim'),
    kit: null,
  };
  const worn = new Set([look.titleId, look.avatarFrame, look.tileFrame, look.tileColor, look.tileAnim]);
  for (const path of PATHS) {
    if (kitItems(path.id).every((r) => worn.has(r.id))) look.kit = path.id;
  }
  return look;
}

/** Frases que o membro pode usar ao compartilhar. */
export function availablePhrases(g: Group, p: Progress, teamUnlocked: Set<string>): string[] {
  const own = REWARDS.filter((r) => r.kind === 'phrase' && isUnlocked(g, r, p)).map((r) => r.name);
  const team = TEAM_PHRASES.filter((t) => teamUnlocked.has(t.unlock)).map((t) => t.text);
  return [...own, ...team];
}
