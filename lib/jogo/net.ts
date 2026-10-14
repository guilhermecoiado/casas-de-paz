'use client';

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

/*
 * Rede do jogo "Casa na Rocha": canais de broadcast do Supabase Realtime (sem banco).
 *  - jogo:<sala>          → saguão: o celular pede para entrar e a TV responde com a vaga
 *  - jogo:<sala>:<id>     → canal de cada jogador: comandos (celular → TV) e placar/avisos (TV → celular)
 * Assim cada mensagem de comando chega só na TV (não em todos os celulares).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://exemplo.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key-ausente';

let client: ReturnType<typeof createClient> | null = null;
/** Cliente só para o jogo: sem sessão de login e com mais mensagens por segundo. */
export function rt() {
  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'cdp-jogo' },
    realtime: { params: { eventsPerSecond: 60 } },
  });
  return client;
}

export const lobbyName = (room: string) => `jogo:${room}`;
export const playerChan = (room: string, id: string) => `jogo:${room}:${id}`;

export function channel(name: string): RealtimeChannel {
  return rt().channel(name, { config: { broadcast: { self: false, ack: false } } });
}

export type Mode = 'attract' | 'lobby' | 'play' | 'finale' | 'results';

export interface JoinMsg { id: string; name: string }
export interface WelcomeMsg { id: string; slot: number; full?: boolean; name: string }
export interface InputMsg { l: boolean; r: boolean; j: boolean }
export interface StateMsg {
  mode: Mode;
  slot: number;
  pts: number;
  rank: number;
  team: number;
  players: number;
  countdown?: number;   // segundos para começar (sala)
  timeLeft?: number;    // segundos de jogo
  phase?: string;
  suggest?: number;     // pontos sugeridos no app (resultado)
  complete?: boolean;
  /** Fase de acabamento: a tarefa deste jogador e quanto falta. */
  fin?: FinState;
  /** Desafio de toque (terremoto, goteiras): todos tocam rápido para ajudar a equipe. */
  ch?: ChState;
}
export interface ChState { kind: 'quake' | 'leak'; title: string; emoji: string; prog: number; per: number; left: number }
export type TaskId = 'paint' | 'light' | 'garden' | 'decor';
export interface FinState {
  task: TaskId;
  helping: boolean;   // já terminou a própria parte e está ajudando outra equipe
  prog: number;       // 0..1 da barrinha (a própria parte ou a equipe que está ajudando)
  per: number;        // quanto cada toque enche a barrinha
  done: boolean;      // casa toda pronta
}
export interface TapMsg { n: number }
export interface BuzzMsg { kind: 'pick' | 'deliver' | 'stomped' | 'stomp' | 'gold' | 'part' | 'finish' | 'alert' | 'storm' | 'boing' }

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const newRoom = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
export const newId = () => Math.random().toString(36).slice(2, 10);
