'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Share2 } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { availablePhrases } from '@/lib/rewards';
import { frameImage, frameTheme, shareImage } from '@/lib/image';
import { totalWeeks, unlockedFrameWeeks } from '@/lib/game';
import { errMsg } from '@/lib/supabase';
import { useToast } from './Providers';
import { Sheet, Spinner } from './ui';

/** Compartilhar foto com a moldura Casa de Paz e, opcionalmente, uma frase de sobrepor. */
export function ShareSheet({
  open, onClose, source, label, dateLabel, inline = false, week,
}: {
  open: boolean;
  onClose: () => void;
  source: Blob | string | null;
  label: string;
  dateLabel: string;
  inline?: boolean; // renderiza direto na página (tela de sucesso do post)
  week?: number;    // semana do post (sugere a moldura dessa semana)
}) {
  const { group, me, profiles, progress, unlocked, posts, stats } = useGroup();
  const frames = useMemo(() => unlockedFrameWeeks(me, posts), [me, posts]);
  const weeks = Math.max(totalWeeks(group), stats.week);
  const best = Math.max(...Array.from(frames).filter((w) => w <= Math.max(week ?? stats.week, 1)));
  const [frameWeek, setFrameWeek] = useState<number>(week && frames.has(week) ? week : best);
  // o check-in recém-feito libera a moldura da semana: seleciona assim que ela aparece
  const autoPicked = useRef(false);
  useEffect(() => {
    if (!autoPicked.current && week && frames.has(week)) { autoPicked.current = true; setFrameWeek(week); }
  }, [frames, week]);
  const toast = useToast();
  const phrases = useMemo(() => availablePhrases(group, progress(me), unlocked), [group, progress, me, unlocked]);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    if (!open || !source) return;
    const id = ++run.current;
    setBusy(true);
    frameImage(source, { groupName: group.name, label, username: profiles[me]?.username ?? '', dateLabel, phrase, week: frameWeek })
      .then((b) => {
        if (id !== run.current) return;
        setBlob(b);
        setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
      })
      .catch((e) => toast(errMsg(e), 'error'))
      .finally(() => { if (id === run.current) setBusy(false); });
  }, [open, source, phrase, frameWeek, group.name, label, profiles, me, dateLabel, toast]);

  const body = (
    <div>
      <div className="relative mx-auto w-full max-w-[300px]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Prévia com moldura" className="w-full rounded-2xl shadow-xl" />
        ) : (
          <div className="aspect-[4/5] w-full rounded-2xl bg-sand" />
        )}
        {busy && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/40"><Spinner className="h-7 w-7 text-terra" /></div>}
      </div>

      <p className="mt-4 text-sm font-extrabold text-[#6b5643]">Moldura da semana</p>
      <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
          const ok = frames.has(w);
          const t = frameTheme(w);
          return (
            <button
              key={w}
              disabled={!ok}
              onClick={() => setFrameWeek(w)}
              className={`chip shrink-0 !px-3.5 !py-2 !text-sm ${frameWeek === w ? 'text-white' : 'bg-white text-[#6b5643]'} disabled:opacity-60`}
              style={frameWeek === w ? { background: t.accent } : undefined}
            >
              {ok ? t.orn[0] : <Lock size={12} />} Semana {w}
            </button>
          );
        })}
      </div>
      <p className="mt-1 truncate text-[11px] font-bold text-[#a8927a]">Cada semana libera com o seu check-in</p>

      <p className="mt-4 text-sm font-extrabold text-[#6b5643]">Frase sobre a foto</p>
      <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1">
        <button onClick={() => setPhrase(null)} className={`chip shrink-0 !px-3.5 !py-2 !text-sm ${phrase === null ? 'bg-ink text-white' : 'bg-white text-[#6b5643]'}`}>Sem frase</button>
        {phrases.map((p) => (
          <button key={p} onClick={() => setPhrase(p)} className={`chip shrink-0 !px-3.5 !py-2 !text-sm ${phrase === p ? 'bg-terra text-white' : 'bg-white text-[#6b5643]'}`}>{p}</button>
        ))}
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-[#a8927a]"><Lock size={11} className="shrink-0" /> <span className="truncate">Mais frases na sua evolução</span></p>

      <button className="btn-primary mt-4 w-full" disabled={!blob || busy} onClick={() => blob && shareImage(blob)}>
        <Share2 size={18} /> Compartilhar no Instagram
      </button>
    </div>
  );

  if (inline) return open ? body : null;
  return <Sheet open={open} onClose={onClose} title="Compartilhar com moldura">{body}</Sheet>;
}
