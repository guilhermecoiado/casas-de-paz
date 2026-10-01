'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, CalendarClock, MessagesSquare, Send } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { WEEKDAYS, timeAgo } from '@/lib/game';
import { errMsg, supabase } from '@/lib/supabase';
import type { PushLog } from '@/lib/types';
import { useToast } from './Providers';
import { Spinner } from './ui';

const REMINDER = 'Você tem encontro marcado hoje na casa de paz, esperamos vocês!';

export function AdminPush() {
  const { group, reload } = useGroup();
  const toast = useToast();
  const [title, setTitle] = useState(`Casa de Paz · ${group.name}`);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<PushLog[]>([]);

  const loadLog = useCallback(async () => {
    const { data } = await supabase.from('push_log').select('*').eq('group_id', group.id).order('created_at', { ascending: false }).limit(15);
    setLog((data ?? []) as PushLog[]);
  }, [group.id]);
  useEffect(() => { loadLog(); }, [loadLog]);

  const toggleReminder = async () => {
    const { error } = await supabase.from('groups').update({ reminder_enabled: !group.reminder_enabled }).eq('id', group.id);
    if (error) return toast(errMsg(error), 'error');
    reload();
  };

  const setDigest = async (patch: { digest_enabled?: boolean; digest_hours?: number }) => {
    const { error } = await supabase.from('groups').update(patch).eq('id', group.id);
    if (error) return toast(errMsg(error), 'error');
    reload();
  };

  const send = async () => {
    if (!title.trim() || body.trim().length < 3) return toast('Escreva o título e a mensagem', 'error');
    if (!confirm('Enviar esta notificação para todos do grupo?')) return;
    setBusy(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ groupId: group.id, title, body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Falha ao enviar');
      toast(j.devices ? `Enviado para ${j.recipients} pessoa(s) em ${j.devices} aparelho(s)` : 'Ninguém com notificações ativas ainda', j.devices ? 'ok' : 'info');
      setBody('');
      loadLog();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><BellRing size={20} className="text-terra" /> Notificações</h2>

      <div className="flex items-start gap-3 rounded-2xl bg-cream p-3">
        <CalendarClock size={20} className="mt-0.5 shrink-0 text-terra" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">Lembrete automático</p>
          <p className="text-sm leading-snug text-[#8A6F57]">
            Toda {WEEKDAYS[group.house_weekday].toLowerCase()}, às 8h: “{REMINDER}”
          </p>
        </div>
        <button
          role="switch"
          aria-checked={group.reminder_enabled}
          aria-label="Lembrete automático"
          onClick={toggleReminder}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${group.reminder_enabled ? 'bg-olive' : 'bg-[#d9c8b2]'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${group.reminder_enabled ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      <div className="rounded-2xl bg-cream p-3">
        <div className="flex items-start gap-3">
          <MessagesSquare size={20} className="mt-0.5 shrink-0 text-terra" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold leading-tight">Resumo de posts</p>
            <p className="text-sm leading-snug text-[#8A6F57]">
              “Ana, Beto e mais 3 postaram — venha conferir!” · no máximo 1 a cada {group.digest_hours}h, das 8h às 22h
            </p>
          </div>
          <button
            role="switch"
            aria-checked={group.digest_enabled}
            aria-label="Resumo de posts"
            onClick={() => setDigest({ digest_enabled: !group.digest_enabled })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${group.digest_enabled ? 'bg-olive' : 'bg-[#d9c8b2]'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${group.digest_enabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        {group.digest_enabled && (
          <div className="mt-3 flex items-center gap-2 pl-8">
            <span className="text-xs font-extrabold text-[#8A6F57]">A cada</span>
            {[1, 2, 3, 4, 6].map((h) => (
              <button
                key={h}
                onClick={() => setDigest({ digest_hours: h })}
                className={`chip !px-3 !py-1.5 ${group.digest_hours === h ? 'bg-terra text-white' : 'bg-white text-[#6b5643]'}`}
              >
                {h}h
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="pt-1 text-sm font-extrabold text-[#6b5643]">Enviar aviso agora</p>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {[
          ['Lembrete do encontro', REMINDER],
          ['Enquete no ar', 'Tem enquete nova no app! Responda e ganhe pontos.'],
          ['Falta pouco', 'Faltam poucos pontos para o próximo desbloqueio da casa. Bora postar!'],
        ].map(([label, text]) => (
          <button key={label} onClick={() => setBody(text)} className="chip shrink-0 bg-sand !py-1.5 text-[#6b5643]">{label}</button>
        ))}
      </div>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Título" />
      <textarea className="input min-h-[90px] resize-none" value={body} onChange={(e) => setBody(e.target.value)} maxLength={240} placeholder="Mensagem para o grupo" />
      <button className="btn-primary w-full" onClick={send} disabled={busy}>{busy ? <Spinner /> : <><Send size={18} /> Enviar para o grupo</>}</button>
      <p className="text-xs text-[#a8927a]">Chega para quem ativou as notificações no app. Até 10 avisos por dia.</p>

      {log.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-extrabold text-[#6b5643]">Enviados</p>
          {log.map((l) => (
            <div key={l.id} className="rounded-2xl bg-cream p-3">
              <div className="flex items-center gap-2">
                <span className={`chip ${l.kind === 'reminder' ? 'bg-olive/15 text-olive' : 'bg-terra/10 text-terra'}`}>{l.kind === 'reminder' ? 'Automático' : 'Manual'}</span>
                <span className="ml-auto text-xs font-bold text-[#a8927a]">{timeAgo(l.created_at)} · {l.devices} aparelho{l.devices === 1 ? '' : 's'}</span>
              </div>
              <p className="mt-1 text-sm leading-snug">{l.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
