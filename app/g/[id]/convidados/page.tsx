'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Pencil, Share2, UserPlus } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { formatDate } from '@/lib/game';
import { errMsg, supabase } from '@/lib/supabase';
import { useToast } from '@/components/Providers';
import { Avatar, Sheet, Spinner } from '@/components/ui';
import type { Post } from '@/lib/types';

export default function Convidados() {
  const { group, posts, profiles, look, me, isAdmin, reload } = useGroup();
  const toast = useToast();
  const [edit, setEdit] = useState<Post | null>(null);

  const checkins = useMemo(
    () => posts.filter((p) => p.type === 'checkin' && p.guests > 0 && p.status !== 'cancelled').sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [posts],
  );
  const total = checkins.reduce((n, p) => n + p.guests, 0);
  const named = checkins.reduce((n, p) => n + (p.guest_names?.length ?? 0), 0);
  const byWeek = useMemo(() => {
    const m = new Map<number, Post[]>();
    checkins.forEach((p) => m.set(p.week, [...(m.get(p.week) ?? []), p]));
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [checkins]);

  const asText = () => {
    const lines = [`Convidados · ${group.name}`, ''];
    byWeek.forEach(([w, list]) => {
      lines.push(`Semana ${w}`);
      list.forEach((p) => {
        const who = profiles[p.user_id]?.name?.split(' ')[0] ?? '';
        const names = p.guest_names ?? [];
        const extra = p.guests - names.length;
        lines.push(`• ${formatDate(p.local_date)} (com ${who}): ${[...names, ...(extra > 0 ? [`+${extra} sem nome`] : [])].join(', ')}`);
      });
      lines.push('');
    });
    return lines.join('\n').trim();
  };

  const share = async () => {
    const text = asText();
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) { try { await nav.share({ text }); return; } catch { /* cancelou */ } }
    await navigator.clipboard?.writeText(text);
    toast('Lista copiada');
  };

  return (
    <div className="pt-safe">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-cream/95 px-3 pb-2 pt-3 backdrop-blur">
        <Link href={`/g/${group.id}`} className="rounded-full p-2" aria-label="Voltar"><ArrowLeft size={22} /></Link>
        <h1 className="flex-1 font-display text-[24px] font-extrabold">Convidados</h1>
        {total > 0 && <button onClick={share} className="chip bg-white !py-2 text-[#6b5643]"><Share2 size={14} /> Enviar lista</button>}
      </header>

      <div className="mx-4 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-gradient-to-br from-[#e9f5df] to-[#d3ebc0] p-4">
          <p className="font-display text-4xl font-extrabold leading-none text-olive">{total}</p>
          <p className="mt-1 text-xs font-extrabold text-[#556b2f]">pessoas visitaram</p>
        </div>
        <div className="rounded-3xl bg-white p-4">
          <p className="font-display text-4xl font-extrabold leading-none">{named}</p>
          <p className="mt-1 text-xs font-extrabold text-[#a8927a]">com nome anotado</p>
        </div>
      </div>
      <p className="mx-5 mt-3 text-xs font-bold leading-snug text-[#a8927a]">
        Use esta lista para orar por eles, mandar uma mensagem e convidar de novo. Quem fez o check-in pode completar os nomes depois.
      </p>

      {total === 0 ? (
        <div className="flex flex-col items-center px-8 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sand text-[#a8927a]"><UserPlus size={28} /></span>
          <p className="mt-4 font-display text-xl font-bold">Ninguém por aqui ainda</p>
          <p className="mt-1 text-sm text-[#8A6F57]">Os convidados aparecem quando alguém faz check-in levando gente nova.</p>
        </div>
      ) : (
        <div className="space-y-5 px-4 pb-8 pt-4">
          {byWeek.map(([w, list]) => (
            <section key={w}>
              <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wider text-[#a8927a]">Semana {w}</h2>
              <div className="space-y-2">
                {list.map((p) => {
                  const names = p.guest_names ?? [];
                  const missing = p.guests - names.length;
                  const can = p.user_id === me || isAdmin;
                  return (
                    <div key={p.id} className="card p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar url={profiles[p.user_id]?.avatar_url} name={profiles[p.user_id]?.name} size={34} frame={look(p.user_id).avatarFrame} />
                        <p className="min-w-0 flex-1 truncate text-sm font-extrabold">
                          {profiles[p.user_id]?.name?.split(' ')[0]} <span className="font-bold text-[#a8927a]">· {formatDate(p.local_date, { day: '2-digit', month: 'long' })}</span>
                        </p>
                        {can && (
                          <button onClick={() => setEdit(p)} className="chip bg-sand !py-1.5 text-[#6b5643]"><Pencil size={12} /> {missing > 0 ? 'Anotar nomes' : 'Editar'}</button>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {names.map((n, i) => <span key={i} className="chip bg-olive/15 !text-[13px] text-[#3f5a24]">{n}</span>)}
                        {missing > 0 && <span className="chip bg-sand !text-[13px] text-[#8A6F57]">+{missing} sem nome</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <EditNames post={edit} onClose={() => setEdit(null)} onSaved={reload} />
      {total > 0 && (
        <button onClick={async () => { await navigator.clipboard?.writeText(asText()); toast('Lista copiada'); }} className="btn-soft mx-4 mb-8 w-[calc(100%-2rem)]">
          <Copy size={16} /> Copiar lista
        </button>
      )}
    </div>
  );
}

function EditNames({ post, onClose, onSaved }: { post: Post | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [names, setNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [for_, setFor] = useState<string | null>(null);
  if (post && for_ !== post.id) { setFor(post.id); setNames(Array.from({ length: post.guests }, (_, i) => post.guest_names?.[i] ?? '')); }

  const save = async () => {
    if (!post) return;
    setBusy(true);
    const { error } = await supabase.rpc('set_guest_names', { p_post: post.id, p_names: names.map((n) => n.trim()).filter(Boolean) });
    setBusy(false);
    if (error) return toast(errMsg(error), 'error');
    toast('Nomes salvos');
    onSaved();
    onClose();
  };

  return (
    <Sheet open={!!post} onClose={() => { setFor(null); onClose(); }} title="Nomes dos convidados">
      <div className="space-y-2">
        {names.map((n, i) => (
          <input key={i} className="input !py-2.5" value={n} maxLength={60} placeholder={`Convidado ${i + 1}`}
            onChange={(e) => setNames((l) => { const c = [...l]; c[i] = e.target.value; return c; })} />
        ))}
        <button className="btn-primary mt-2 w-full" onClick={save} disabled={busy}>{busy ? <Spinner /> : 'Salvar'}</button>
      </div>
    </Sheet>
  );
}
