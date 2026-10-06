'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Delete, Search, X } from 'lucide-react';

/* Teclado de emojis do Dom de Línguas: substitui o teclado do celular (aqui só se fala emojês). */

type Entry = [string, string]; // [emoji, palavras-chave em português]
type Data = [number, Entry[]][];

// os mais usados num grupo de igreja, já disponíveis antes de carregar a lista completa
const BIBLIA: Entry[] = [
  '🙏', '✝️', '📖', '🕊️', '⛪', '🙌', '❤️', '🔥', '👑', '🌈', '⭐', '✨', '🐑', '🐟', '🍞', '🍷', '🌊', '🐋', '⛵', '🦁',
  '🐍', '🍎', '🌳', '🌿', '🌾', '🫒', '🪨', '⛰️', '🏜️', '🐫', '🫏', '🐂', '🕯️', '🎺', '🗡️', '🛡️', '🏹', '👶', '👼', '😇',
  '🧔', '👨‍👩‍👧', '💒', '🏠', '🚪', '🗝️', '💰', '⚖️', '💧', '🩸', '☀️', '🌙', '⚡', '☁️', '🌧️', '🍇', '🥖', '🐓', '🦅', '🐻',
  '3️⃣', '7️⃣', '1️⃣2️⃣', '4️⃣0️⃣', '❓', '❗', '➡️', '⬆️', '⬇️', '✅', '❌', '💯',
].map((e) => [e, 'biblia igreja']);

const TABS: { id: string; icon: string; label: string; group?: number }[] = [
  { id: 'rec', icon: '🕘', label: 'Recentes' },
  { id: 'bib', icon: '✝️', label: 'Bíblia' },
  { id: 'g0', icon: '😀', label: 'Carinhas', group: 0 },
  { id: 'g1', icon: '🙋', label: 'Pessoas', group: 1 },
  { id: 'g3', icon: '🐶', label: 'Natureza', group: 3 },
  { id: 'g4', icon: '🍔', label: 'Comida', group: 4 },
  { id: 'g5', icon: '✈️', label: 'Lugares', group: 5 },
  { id: 'g6', icon: '⚽', label: 'Atividades', group: 6 },
  { id: 'g7', icon: '💡', label: 'Objetos', group: 7 },
  { id: 'g8', icon: '🔣', label: 'Símbolos', group: 8 },
  { id: 'g9', icon: '🏳️', label: 'Bandeiras', group: 9 },
];

let cache: Promise<Data> | null = null;
const loadData = () => (cache ??= fetch('/emoji-pt.json').then((r) => r.json() as Promise<Data>).catch(() => { cache = null; return []; }));

const REC_KEY = 'emoji-recent';
function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(REC_KEY) || '[]'); } catch { return []; }
}

/** Separa por "letra" de verdade (um emoji composto conta como 1). */
export function graphemes(s: string): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Seg = (Intl as any).Segmenter;
    if (Seg) return Array.from(new Seg('pt', { granularity: 'grapheme' }).segment(s), (x: { segment: string }) => x.segment);
  } catch {}
  return Array.from(s);
}
export const dropLast = (s: string) => graphemes(s).slice(0, -1).join('');

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function EmojiKeyboard({
  onPick, onBackspace, onSpace, height = 280,
}: { onPick: (e: string) => void; onBackspace: () => void; onSpace?: () => void; height?: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [tab, setTab] = useState('bib');
  const [q, setQ] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = readRecent();
    setRecent(r);
    if (r.length >= 8) setTab('rec');
    loadData().then(setData);
  }, []);
  useEffect(() => { gridRef.current?.scrollTo({ top: 0 }); }, [tab, q]);

  const pick = (e: string) => {
    onPick(e);
    setRecent((prev) => {
      const next = [e, ...prev.filter((x) => x !== e)].slice(0, 40);
      try { localStorage.setItem(REC_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const list = useMemo<string[]>(() => {
    if (q !== null) {
      const words = norm(q).trim().split(/\s+/).filter(Boolean);
      if (!words.length || !data) return [];
      const out: string[] = [];
      for (const [, entries] of data) for (const [e, kw] of entries) if (words.every((w) => norm(kw).includes(w))) out.push(e);
      return out.slice(0, 120);
    }
    if (tab === 'rec') return recent;
    if (tab === 'bib') return BIBLIA.map((x) => x[0]);
    const g = TABS.find((t) => t.id === tab)?.group;
    return data?.find(([id]) => id === g)?.[1].map((x) => x[0]) ?? [];
  }, [tab, q, data, recent]);

  // segura o apagar para apagar vários
  const hold = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  const stopHold = () => { clearTimeout(hold.current.t); clearInterval(hold.current.i); hold.current = {}; };
  const startHold = () => { stopHold(); hold.current.t = setTimeout(() => { hold.current.i = setInterval(onBackspace, 110); }, 450); };
  useEffect(() => stopHold, []);

  return (
    <div className="select-none border-t border-sand bg-[#f6efe4]" style={{ touchAction: 'manipulation' }}>
      {q !== null ? (
        <div className="flex items-center gap-2 px-3 pt-2">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-3">
            <Search size={16} className="text-[#a8927a]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar emoji (ex.: baleia)" enterKeyHint="search"
              className="h-10 flex-1 bg-transparent text-[15px] outline-none" />
          </div>
          <button onClick={() => setQ(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white" aria-label="Fechar busca"><X size={18} /></button>
        </div>
      ) : (
        <div className="no-scrollbar flex gap-0.5 overflow-x-auto px-2 pt-2">
          <button onClick={() => setQ('')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#8A6F57]" aria-label="Buscar emoji"><Search size={19} /></button>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-label={t.label}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[22px] transition ${tab === t.id ? 'bg-white shadow-sm' : 'opacity-60'}`}>
              {t.id === 'rec' ? <Clock size={19} className="text-[#8A6F57]" /> : t.icon}
            </button>
          ))}
        </div>
      )}

      <div ref={gridRef} className="overflow-y-auto px-1.5 pb-1 pt-1" style={{ height: height - 96 }}>
        {list.length === 0 ? (
          <p className="pt-8 text-center text-sm font-bold text-[#a8927a]">
            {q !== null ? (q.trim() ? 'Nenhum emoji encontrado' : 'Digite o que procura') : tab === 'rec' ? 'Os emojis que você usar aparecem aqui' : 'Carregando…'}
          </p>
        ) : (
          <div className="grid grid-cols-8">
            {list.map((e, i) => (
              <button key={`${e}-${i}`} onClick={() => pick(e)} className="flex aspect-square items-center justify-center rounded-xl text-[28px] leading-none active:scale-90 active:bg-white">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 pb-2 pt-1" style={{ paddingBottom: 'max(var(--safe-bottom), 8px)' }}>
        <p className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-[#a8927a]">
          {q !== null ? 'Busca' : TABS.find((t) => t.id === tab)?.label}
        </p>
        {onSpace && (
          <button onClick={onSpace} className="h-10 w-24 rounded-xl bg-white text-xs font-extrabold text-[#a8927a] shadow-sm active:scale-95" aria-label="Espaço">espaço</button>
        )}
        <button
          onClick={onBackspace}
          onPointerDown={startHold}
          onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
          className="flex h-10 w-14 items-center justify-center rounded-xl bg-white text-ink shadow-sm active:scale-95" aria-label="Apagar">
          <Delete size={20} />
        </button>
      </div>
    </div>
  );
}
