'use client';

import { useMemo, useState } from 'react';
import { Ban, ChevronDown, Gavel, Minus, Plus, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useRemovePost } from './useRemovePost';
import { useGroup } from '@/lib/group-context';
import { TYPE_LABEL, formatDate } from '@/lib/game';
import { errMsg, supabase } from '@/lib/supabase';
import { useToast } from './Providers';
import { Spinner } from './ui';
import type { Post } from '@/lib/types';

type Action = 'cancel' | 'vote' | 'close' | 'restore';

const STATUS: Record<Post['status'], { label: string; cls: string }> = {
  ok: { label: '', cls: '' },
  voting: { label: 'em votação', cls: 'bg-amber/20 text-[#9a5b00]' },
  cancelled: { label: 'cancelado', cls: 'bg-[#7a2618] text-white' },
  archived: { label: 'arquivado', cls: 'bg-sand text-[#8A6F57]' },
  removed: { label: 'removido', cls: 'bg-sand text-[#8A6F57]' },
};

const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;

/** Extrato completo de pontos de um membro, com ações de contestação (só para o adm). */
export function PointsLedger({ userId }: { userId: string }) {
  const { posts, group, reload } = useGroup();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [limit, setLimit] = useState(15);
  const { remove } = useRemovePost();

  const entries = useMemo(() => posts.filter((p) => p.user_id === userId), [posts, userId]);
  const valid = entries.filter((p) => p.status !== 'cancelled').reduce((a, p) => a + p.points, 0);
  const cancelled = entries.filter((p) => p.status === 'cancelled').reduce((a, p) => a + p.points, 0);

  const act = async (p: Post, action: Action) => {
    setBusy(p.id);
    const { data, error } = await supabase.rpc('admin_moderate', { p_post: p.id, p_action: action });
    setBusy(null);
    setOpen(null);
    if (error) return toast(errMsg(error), 'error');
    toast(data === 'voting' ? 'Enviado para votação do grupo' : data === 'cancelled' ? 'Pontos cancelados' : 'Pontos mantidos');
  };

  const adjust = async () => {
    const n = parseInt(amount, 10);
    if (!n || n <= 0) return toast('Informe quantos pontos', 'error');
    if (reason.trim().length < 3) return toast('Explique o motivo do ajuste', 'error');
    setBusy('adjust');
    const { error } = await supabase.rpc('admin_adjust_points', { p_group: group.id, p_user: userId, p_points: n * dir, p_reason: reason });
    setBusy(null);
    if (error) return toast(errMsg(error), 'error');
    toast(`Ajuste de ${sign(n * dir)} pts registrado`);
    setAmount(''); setReason(''); setAdjusting(false);
    reload();
  };

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h4 className="font-display text-lg font-bold">Extrato de pontos</h4>
          <p className="text-xs font-bold text-[#a8927a]">
            Válidos: {valid} pts{cancelled ? ` · cancelados: ${cancelled} pts` : ''}
          </p>
        </div>
        <button onClick={() => setAdjusting((v) => !v)} className="chip bg-ink !py-2 text-white">
          <SlidersHorizontal size={13} /> Ajustar
        </button>
      </div>

      {adjusting && (
        <div className="mb-3 space-y-2 rounded-2xl bg-white p-3 anim-rise">
          <div className="flex gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-2xl border-2 border-sand">
              <button onClick={() => setDir(-1)} className={`w-12 ${dir === -1 ? 'bg-[#7a2618] text-white' : 'bg-white text-[#8A6F57]'}`} aria-label="Retirar pontos"><Minus size={18} /></button>
              <button onClick={() => setDir(1)} className={`w-12 ${dir === 1 ? 'bg-olive text-white' : 'bg-white text-[#8A6F57]'}`} aria-label="Dar pontos"><Plus size={18} /></button>
            </div>
            <input className="input min-w-0 flex-1 text-center font-extrabold" type="number" inputMode="numeric" min={1} max={4000} placeholder="pontos" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <input className="input" maxLength={200} placeholder="Motivo (aparece no extrato)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn-primary w-full" onClick={adjust} disabled={busy === 'adjust'}>
            {busy === 'adjust' ? <Spinner /> : `${dir === -1 ? 'Retirar' : 'Dar'} ${amount || 0} pontos`}
          </button>
          <p className="text-[11px] leading-snug text-[#a8927a]">Ajustes não contam para o limite semanal e podem ser cancelados depois.</p>
        </div>
      )}

      <div className="divide-y divide-sand overflow-hidden rounded-2xl bg-white">
        {entries.slice(0, limit).map((p) => {
          const st = STATUS[p.status];
          const isOpen = open === p.id;
          return (
            <div key={p.id}>
              <button onClick={() => setOpen(isOpen ? null : p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-extrabold">
                    {TYPE_LABEL[p.type]}
                    {st.label && <span className={`chip !px-1.5 !py-0 !text-[10px] ${st.cls}`}>{st.label}</span>}
                  </p>
                  <p className="truncate text-xs text-[#8A6F57]">
                    {formatDate(p.local_date)}{p.description && p.type !== 'challenge' && p.type !== 'riddle' ? ` · ${p.description}` : ''}{p.guests ? ` · ${p.guests} convidado(s)` : ''}
                  </p>
                </div>
                <span className={`font-display text-base font-extrabold ${p.status === 'cancelled' ? 'text-[#b9a690] line-through' : p.points < 0 ? 'text-[#7a2618]' : 'text-terra'}`}>
                  {sign(p.points)}
                </span>
                <ChevronDown size={16} className={`shrink-0 text-[#b9a690] transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-2 px-3 pb-3 anim-fade">
                  {busy === p.id && <Spinner className="h-5 w-5 text-terra" />}
                  {p.status === 'ok' && (
                    <>
                      <button className="chip bg-sand !py-2 text-ink" onClick={() => act(p, 'vote')}><Gavel size={13} /> Votação do grupo</button>
                      <button className="chip bg-[#7a2618] !py-2 text-white" onClick={() => act(p, 'cancel')}><Ban size={13} /> Cancelar pontos</button>
                    </>
                  )}
                  {p.status === 'voting' && (
                    <>
                      <button className="chip bg-sand !py-2 text-ink" onClick={() => act(p, 'close')}><Gavel size={13} /> Encerrar votação</button>
                      <button className="chip bg-[#7a2618] !py-2 text-white" onClick={() => act(p, 'cancel')}><Ban size={13} /> Cancelar pontos</button>
                    </>
                  )}
                  {p.status === 'cancelled' && (
                    <button className="chip bg-olive !py-2 text-white" onClick={() => act(p, 'restore')}><RotateCcw size={13} /> Restaurar pontos</button>
                  )}
                  <button className="chip bg-white !py-2 text-[#7a2618] ring-1 ring-[#7a2618]/30" onClick={async () => { if (await remove(p)) setOpen(null); }}><Trash2 size={13} /> Remover</button>
                </div>
              )}
            </div>
          );
        })}
        {entries.length === 0 && <p className="px-3 py-6 text-center text-sm font-bold text-[#a8927a]">Nenhum ponto ainda.</p>}
      </div>
      {entries.length > limit && (
        <button className="btn-soft mt-2 w-full !min-h-[40px] !text-sm" onClick={() => setLimit((l) => l + 15)}>Ver mais</button>
      )}
    </section>
  );
}
