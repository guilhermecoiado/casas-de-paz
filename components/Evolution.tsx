'use client';

import { useMemo, useState } from 'react';
import { Check, Gift, Lock, Sparkles } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import {
  ACH_LABEL, KIND_LABEL, PATHS, RARITY, REWARDS, TEAM_PHRASES, isUnlocked, kitItems, rewardThreshold,
  type PathInfo, type Reward,
} from '@/lib/rewards';
import { GROUP_UNLOCKS } from '@/lib/game';
import { Avatar, ProgressBar, Spinner } from './ui';
import { KitFx, TileFx } from './Cosmetics';
import type { Member } from '@/lib/types';

type Field = 'title' | 'avatar_frame' | 'tile_frame' | 'tile_color' | 'tile_anim';

/** Item está equipado? (título conta o padrão como equipado) */
function isWorn(r: Reward, member: Member | undefined, titleId: string) {
  if (r.kind === 'phrase') return false;
  if (r.kind === 'title') return titleId === r.id;
  return member?.[r.kind as Field] === r.id;
}

export function RewardPreview({ r, url, name }: { r: Reward; url?: string | null; name?: string }) {
  switch (r.kind) {
    case 'title':
      return <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber/20 text-xl">{r.icon}</span>;
    case 'avatar_frame':
      return <div className="flex h-11 w-11 items-center justify-center"><Avatar url={url} name={name} size={34} frame={r.id} /></div>;
    case 'tile_color':
      return <span className={`block h-12 w-10 rounded-xl ${r.id}`} style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' }} />;
    case 'tile_frame':
      return (
        <span className="relative flex h-12 w-10 items-center justify-center rounded-xl bg-white text-base">
          <span className={`absolute inset-0 rounded-xl ${r.id}`} />
          {r.icon}
        </span>
      );
    case 'tile_anim':
      return <span className="relative block h-12 w-10 overflow-hidden rounded-xl bg-white" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' }}><TileFx anim={r.id} kit={null} /></span>;
    default:
      return <span className="flex h-11 w-11 items-center justify-center rounded-full bg-terra/10 text-xl">💬</span>;
  }
}

interface Props {
  member: Member | undefined;
  titleId: string;
  kit: string | null;
  onEquip: (r: Reward) => Promise<unknown>;
  onEquipKit: (path: PathInfo) => Promise<void>;
  saving: string | null;
}

/* ===================== Linha da evolução ===================== */

export function EvolutionLine(props: Props) {
  const { group, me, progress, profiles } = useGroup();
  const p = progress(me);
  const prof = profiles[me];
  const [open, setOpen] = useState<string | null>(null);
  const current = useMemo(
    () => PATHS.find((path) => REWARDS.some((r) => r.path === path.id && !isUnlocked(group, r, p)))?.id ?? 'reino',
    [group, p],
  );
  const shown = open ?? current;

  return (
    <section className="mx-4 mt-6">
      <h2 className="font-display text-xl font-bold">Linha da evolução</h2>
      <p className="mb-3 truncate text-sm text-[#8A6F57]">Um caminho por semana · kit secreto ✨</p>
      <div className="space-y-3">
        {PATHS.map((path) => {
          const items = REWARDS.filter((r) => r.path === path.id);
          const got = items.filter((r) => isUnlocked(group, r, p)).length;
          const done = got === items.length;
          const start = rewardThreshold(group, items[0]);
          const end = rewardThreshold(group, items[items.length - 1]);
          const expanded = shown === path.id;
          const kitOn = props.kit === path.id;
          return (
            <div key={path.id} className={`card overflow-hidden ${kitOn ? 'ring-2 ring-amber' : ''}`}>
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(expanded ? '' : path.id)}>
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${done ? 'bg-amber/25' : got ? 'bg-sand' : 'bg-sand grayscale'}`}>{path.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold leading-tight">{path.name}</p>
                  <p className="truncate text-xs font-bold text-[#a8927a]">Semana {path.week} · {got}/{items.length} desbloqueados</p>
                  <div className="mt-1.5"><ProgressBar value={Math.max(0, p.points - start)} max={Math.max(1, end - start)} height={8} color={done ? 'bg-olive' : 'bg-amber'} /></div>
                </div>
              </button>
              {expanded && (
                <div className="border-t border-sand px-3 pb-3">
                  <ol className="relative mt-2">
                    {items.map((r, i) => (
                      <RewardRow key={r.id} r={r} last={i === items.length - 1} url={prof?.avatar_url} name={prof?.name} {...props} />
                    ))}
                  </ol>
                  <KitRow path={path} unlockedAll={done} active={kitOn} onEquipKit={props.onEquipKit} saving={props.saving} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RewardRow({ r, last, url, name, member, titleId, onEquip, saving }: Props & { r: Reward; last: boolean; url?: string | null; name?: string }) {
  const { group, me, progress } = useGroup();
  const p = progress(me);
  const ok = isUnlocked(group, r, p);
  const worn = ok && isWorn(r, member, titleId);
  const need = r.req ? `${Math.min(p[r.req.stat], r.req.n)}/${r.req.n} ${ACH_LABEL[r.req.stat]}` : `${rewardThreshold(group, r)} pts`;
  return (
    <li className="relative flex items-center gap-3 py-2 pl-1">
      {!last && <span className="absolute left-[26px] top-[52px] h-[calc(100%-44px)] w-0.5 bg-sand" />}
      <div className={ok ? '' : 'opacity-55'}><RewardPreview r={r} url={url} name={name} /></div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-extrabold ${ok ? '' : 'text-[#8A6F57]'}`}>{r.name}</p>
        <p className="text-[11px] font-bold text-[#a8927a]">{KIND_LABEL[r.kind]}</p>
      </div>
      {!ok ? (
        <span className="chip bg-sand text-[#8A6F57]"><Lock size={11} /> {need}</span>
      ) : r.kind === 'phrase' ? (
        <span className="chip bg-olive/15 text-olive"><Check size={11} /> nas frases</span>
      ) : worn ? (
        <button onClick={() => onEquip(r)} className="chip bg-terra text-white !py-1.5"><Check size={12} strokeWidth={3} /> Em uso</button>
      ) : (
        <button onClick={() => onEquip(r)} disabled={saving !== null} className="chip bg-ink text-white !py-1.5">
          {saving === r.id ? <Spinner className="h-3 w-3" /> : 'Usar'}
        </button>
      )}
    </li>
  );
}

function KitRow({ path, unlockedAll, active, onEquipKit, saving }: { path: PathInfo; unlockedAll: boolean; active: boolean; onEquipKit: Props['onEquipKit']; saving: string | null }) {
  const n = kitItems(path.id).length;
  return (
    <div className={`relative mt-2 overflow-hidden rounded-2xl p-3 ${active ? 'bg-ink text-white' : 'bg-cream'}`}>
      {active && <div className="absolute inset-y-0 right-0 w-24"><KitFx kit={path.id} /></div>}
      <div className="relative flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/15' : 'bg-white'}`}>
          {active ? <Sparkles size={20} className="text-amber" /> : <Gift size={20} className="text-terra" />}
        </span>
        <div className="min-w-0 flex-1 pr-16">
          <p className="text-sm font-extrabold leading-tight">
            Kit secreto: {unlockedAll ? path.kit.name : '???'}
          </p>
          <p className={`text-[11px] leading-snug ${active ? 'text-white/75' : 'text-[#8A6F57]'}`}>
            {active ? `${path.kit.desc}. Ativo!` : unlockedAll ? `Use os ${n} itens juntos para ativar` : `Use os ${n} itens juntos`}
          </p>
        </div>
      </div>
      {unlockedAll && !active && (
        <button className="btn-primary relative mt-3 w-full !min-h-[42px] !text-sm" disabled={saving !== null} onClick={() => onEquipKit(path)}>
          {saving === `kit:${path.id}` ? <Spinner className="h-4 w-4" /> : <>✨ Usar kit completo</>}
        </button>
      )}
    </div>
  );
}

/* ===================== Coleção ===================== */

/** sem o prefixo repetido da categoria ("Moldura", "Animação"…), para caber numa linha */
const shortName = (r: Reward) => r.name.replace(/^(Moldura|Animação|Tile|Cor) (?=\S)/, '');

const BLOCKS: { kind: Reward['kind']; label: string }[] = [
  { kind: 'title', label: 'Títulos' },
  { kind: 'avatar_frame', label: 'Molduras de perfil' },
  { kind: 'tile_color', label: 'Cores do tile' },
  { kind: 'tile_frame', label: 'Molduras do tile' },
  { kind: 'tile_anim', label: 'Animações do tile' },
];

/** Itens fora dos caminhos (por pontos ou por ação), em blocos por categoria. */
export function Collection(props: Props) {
  const { group, me, progress, profiles } = useGroup();
  const p = progress(me);
  const prof = profiles[me];
  // por pontos primeiro (em ordem), depois as conquistas por ação
  const all = REWARDS.filter((r) => !r.path && !r.drop && r.kind !== 'phrase').sort(
    (a, b) => (a.req ? 1 : 0) - (b.req ? 1 : 0) || (a.pct ?? 0) - (b.pct ?? 0),
  );
  const got = all.filter((r) => isUnlocked(group, r, p)).length;
  return (
    <section className="mx-4 mt-8">
      <div className="mb-1 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Itens por categoria</h2>
          <p className="truncate text-sm text-[#8A6F57]">Por pontos ou por ações no app</p>
        </div>
        <span className="chip bg-white text-[#6b5643]">{got}/{all.length}</span>
      </div>
      {BLOCKS.map((b) => {
        const items = all.filter((r) => r.kind === b.kind);
        if (!items.length) return null;
        return (
          <div key={b.kind} className="mt-4">
            <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-[#a8927a]">
              {b.label} <span className="font-bold normal-case tracking-normal">· {items.filter((r) => isUnlocked(group, r, p)).length}/{items.length}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {items.map((r) => {
                const ok = isUnlocked(group, r, p);
                const worn = ok && isWorn(r, props.member, props.titleId);
                const need = r.req ? r.req.n : rewardThreshold(group, r);
                const cur = Math.min(r.req ? p[r.req.stat] : p.points, need);
                return (
                  <div key={r.id} className={`flex flex-col rounded-2xl bg-white p-3 ${worn ? 'ring-2 ring-terra' : ''}`}>
                    <div className="flex flex-col items-start gap-1.5">
                      <div className={ok ? '' : 'opacity-55'}><RewardPreview r={r} url={prof?.avatar_url} name={prof?.name} /></div>
                      <p className="w-full truncate whitespace-nowrap text-[13px] font-extrabold leading-tight">{shortName(r)}</p>
                    </div>
                    <p className="mt-1 truncate whitespace-nowrap text-[11px] leading-snug text-[#6b5643]">{r.req ? r.req.label : `Libera com ${need} pontos`}</p>
                    {ok ? (
                      <button
                        onClick={() => props.onEquip(r)}
                        disabled={props.saving !== null}
                        className={`chip mt-2 justify-center !py-1.5 ${worn ? 'bg-terra text-white' : 'bg-ink text-white'}`}
                      >
                        {props.saving === r.id ? <Spinner className="h-3 w-3" /> : worn ? <><Check size={12} strokeWidth={3} /> Em uso</> : 'Usar'}
                      </button>
                    ) : (
                      <div className="mt-auto pt-2">
                        <ProgressBar value={cur} max={need} height={6} color="bg-amber" />
                        <p className="mt-1 text-[10px] font-bold text-[#a8927a]">{cur}/{need} {r.req ? ACH_LABEL[r.req.stat] : 'pts'}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <Surprises {...props} />
    </section>
  );
}

/** Surpresas do check-in: cada check-in com QR code sorteia uma. As que faltam ficam em mistério. */
function Surprises(props: Props) {
  const { group, me, progress, profiles } = useGroup();
  const p = progress(me);
  const prof = profiles[me];
  const pool = REWARDS.filter((r) => r.drop);
  const got = pool.filter((r) => isUnlocked(group, r, p));
  const order = { lendario: 0, raro: 1, comum: 2 } as const;
  const sorted = [...pool].sort((a, b) => Number(isUnlocked(group, b, p)) - Number(isUnlocked(group, a, p)) || order[a.drop!] - order[b.drop!]);
  return (
    <div className="mt-6 rounded-3xl bg-gradient-to-br from-[#2b2118] to-[#5a3a26] p-4 text-white">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="flex items-center gap-1.5 font-display text-lg font-bold"><Gift size={18} className="text-amber" /> Surpresas do check-in</h3>
          <p className="truncate text-xs leading-snug text-white/70">Cada check-in sorteia 1 item</p>
        </div>
        <span className="chip bg-white/15 text-white">{got.length}/{pool.length}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {sorted.map((r) => {
          const ok = isUnlocked(group, r, p);
          const worn = ok && isWorn(r, props.member, props.titleId);
          const rar = RARITY[r.drop!];
          if (!ok)
            return (
              <div key={r.id} className="flex flex-col items-center rounded-2xl bg-white/10 p-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-display text-xl font-extrabold text-white/50">?</span>
                <span className={`chip mt-1.5 !px-2 !py-0.5 !text-[9px] ${rar.cls}`}>{rar.label}</span>
              </div>
            );
          return (
            <button
              key={r.id}
              onClick={() => r.kind !== 'phrase' && props.onEquip(r)}
              disabled={props.saving !== null || r.kind === 'phrase'}
              className={`flex flex-col items-center rounded-2xl bg-white p-2 text-center text-ink ${worn ? 'ring-2 ring-amber' : ''}`}
            >
              <RewardPreview r={r} url={prof?.avatar_url} name={prof?.name} />
              <span className="mt-1 line-clamp-2 text-[10px] font-extrabold leading-tight">{r.name}</span>
              <span className={`chip mt-1 !px-2 !py-0.5 !text-[9px] ${rar.cls}`}>{worn ? 'Em uso' : r.kind === 'phrase' ? 'Frase' : rar.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== Frases ===================== */

export function Phrases() {
  const { group, me, progress, unlocked } = useGroup();
  const p = progress(me);
  // surpresas do check-in só aparecem aqui depois de ganhas
  const own = REWARDS.filter((r) => r.kind === 'phrase' && (!r.drop || isUnlocked(group, r, p)));
  return (
    <section className="mx-4 mt-8">
      <h2 className="font-display text-xl font-bold">Frases de sobrepor</h2>
      <p className="mb-3 truncate text-sm text-[#8A6F57]">Para usar nas fotos com a moldura</p>
      <div className="space-y-2">
        {own.map((r) => {
          const ok = isUnlocked(group, r, p);
          return (
            <div key={r.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${ok ? 'bg-white' : 'bg-white/50'}`}>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-display text-[16px] font-bold italic ${ok ? 'text-ink' : 'text-[#b9a690]'}`}>{r.name}</p>
                {!ok && <p className="flex items-center gap-1 truncate text-[11px] font-bold text-[#8A6F57]"><Lock size={10} className="shrink-0" /> {r.req ? r.req.label : `${rewardThreshold(group, r)} pts`}</p>}
              </div>
              {ok && <Check size={16} className="shrink-0 text-olive" />}
            </div>
          );
        })}
        {TEAM_PHRASES.map((t) => {
          const ok = unlocked.has(t.unlock);
          const u = GROUP_UNLOCKS.find((x) => x.id === t.unlock);
          return (
            <div key={t.text} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${ok ? 'bg-white' : 'bg-white/50'}`}>
              <div className="min-w-0 flex-1">
                <p className={`truncate font-display text-[16px] font-bold italic ${ok ? 'text-ink' : 'text-[#b9a690]'}`}>{t.text}</p>
                {!ok && <p className="flex items-center gap-1 truncate text-[11px] font-bold text-[#8A6F57]"><Lock size={10} className="shrink-0" /> Equipe: {u?.name}</p>}
              </div>
              {ok && <Check size={16} className="shrink-0 text-olive" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
