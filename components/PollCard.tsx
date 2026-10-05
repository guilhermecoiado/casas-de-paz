'use client';

import { useState } from 'react';
import { BarChart3, Check } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { errMsg, supabase } from '@/lib/supabase';
import { useToast } from './Providers';
import type { Poll } from '@/lib/types';

export function PollCard({ poll }: { poll: Poll }) {
  const { answers, me, group, members, today } = useGroup();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const mine = answers.find((a) => a.poll_id === poll.id && a.user_id === me);
  const all = answers.filter((a) => a.poll_id === poll.id);

  const answer = async (i: number) => {
    if (mine || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('answer_poll', { p_poll: poll.id, p_option: i });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    const pts = (data as { points: number } | null)?.points ?? 0;
    toast(pts > 0 ? `+${pts} pontos pela resposta!` : today < group.start_date ? 'Resposta registrada (a gincana ainda não começou)' : 'Resposta registrada (limite semanal atingido)');
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="chip bg-amber/20 text-[#9a5b00]"><BarChart3 size={14} /> Enquete do dia</span>
        <span className="chip bg-sand text-[#8A6F57]">+{group.points.poll} pts</span>
        <span className="ml-auto text-xs font-bold text-[#a8927a]">{all.length}/{members.length} responderam</span>
      </div>
      <p className="font-extrabold leading-snug">{poll.question}</p>
      <div className="mt-3 space-y-2">
        {poll.options.map((opt, i) => {
          const count = all.filter((a) => a.option_index === i).length;
          const pct = all.length ? Math.round((count / all.length) * 100) : 0;
          const chosen = mine?.option_index === i;
          return (
            <button
              key={i}
              disabled={!!mine || busy}
              onClick={() => answer(i)}
              className={`relative w-full overflow-hidden rounded-2xl border-2 px-4 py-3 text-left font-bold transition active:scale-[0.98] ${
                chosen ? 'border-terra' : 'border-sand'
              } bg-white disabled:active:scale-100`}
            >
              {mine && <div className="absolute inset-y-0 left-0 bg-amber/25 transition-[width] duration-700" style={{ width: `${pct}%` }} />}
              <span className="relative flex items-center gap-2">
                {chosen && <Check size={16} className="text-terra" />}
                <span className="flex-1">{opt}</span>
                {mine && <span className="text-sm text-[#8A6F57]">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
