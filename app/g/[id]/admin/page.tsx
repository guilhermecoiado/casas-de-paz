'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Gavel, ImagePlus, Plus, Trash2, UserMinus, X } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { useToast } from '@/components/Providers';
import { Avatar, PhotoPicker, Spinner } from '@/components/ui';
import { AdminPush } from '@/components/AdminPush';
import { MemberSheet } from '@/components/MemberSheet';
import { POINT_LABELS, WEEKDAYS, WEEKDAYS_SHORT, formatDate, totalWeeks } from '@/lib/game';
import { compressImage } from '@/lib/image';
import { errMsg, supabase, uploadImage } from '@/lib/supabase';
import type { Group, PointsConfig } from '@/lib/types';

export default function Admin() {
  const router = useRouter();
  const toast = useToast();
  const { group, isAdmin, members, profiles, polls, answers, posts, me, today, unlocked, reload } = useGroup();
  const [form, setForm] = useState<Group>(group);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<string[]>(['', '']);
  const [pollDate, setPollDate] = useState(today);
  const [bg, setBg] = useState<Blob | null>(null);
  const [pw, setPw] = useState('');
  const [ledger, setLedger] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-8 pt-safe text-center">
        <p className="mt-20 font-bold">Apenas o administrador acessa esta área.</p>
        <button className="btn-soft mt-4" onClick={() => router.back()}>Voltar</button>
      </div>
    );
  }

  const set = <K extends keyof Group>(k: K, v: Group[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setPoint = (k: keyof PointsConfig, v: number) => setForm((f) => ({ ...f, points: { ...f.points, [k]: v } }));
  const weeks = totalWeeks(form);

  const save = async () => {
    if (form.end_date < form.start_date) return toast('A data final precisa ser depois da inicial', 'error');
    setSaving(true);
    const { error } = await supabase.from('groups').update({
      start_date: form.start_date, end_date: form.end_date, house_weekday: form.house_weekday,
      post_mode: form.post_mode, post_weekdays: form.post_weekdays,
      weekly_user_cap: form.weekly_user_cap, weekly_group_cap: form.weekly_group_cap, points: form.points,
    }).eq('id', group.id);
    setSaving(false);
    if (error) return toast(errMsg(error), 'error');
    toast('Configurações salvas');
    reload();
  };

  const createPoll = async () => {
    const options = opts.map((o) => o.trim()).filter(Boolean);
    if (q.trim().length < 3 || options.length < 2) return toast('Escreva a pergunta e pelo menos 2 opções', 'error');
    const { error } = await supabase.from('polls').insert({ group_id: group.id, question: q.trim(), options, poll_date: pollDate });
    if (error) return toast(errMsg(error), 'error');
    setQ(''); setOpts(['', '']);
    toast('Enquete criada');
  };

  const deletePoll = async (id: string) => {
    if (!confirm('Excluir esta enquete? Os pontos de quem já respondeu serão cancelados.')) return;
    const { error } = await supabase.from('polls').delete().eq('id', id);
    if (error) return toast(errMsg(error), 'error');
    reload();
  };

  const saveBg = async (remove = false) => {
    setSaving(true);
    try {
      const url = remove || !bg ? null : await uploadImage(me, await compressImage(bg, 1600), 'bg');
      const { error } = await supabase.from('groups').update({ background_url: url }).eq('id', group.id);
      if (error) throw error;
      setBg(null);
      toast(remove ? 'Foto de fundo removida' : 'Foto de fundo salva');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (uid: string) => {
    if (!confirm(`Remover ${profiles[uid]?.name} do grupo?`)) return;
    const { error } = await supabase.rpc('admin_remove_member', { p_group: group.id, p_user: uid });
    if (error) return toast(errMsg(error), 'error');
    reload();
  };

  const changePw = async () => {
    const { error } = await supabase.rpc('admin_set_password', { p_group: group.id, p_password: pw });
    if (error) return toast(errMsg(error), 'error');
    setPw('');
    toast('Senha do grupo alterada');
  };

  const voting = posts.filter((p) => p.status === 'voting').length;

  return (
    <div className="pt-safe">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream/95 px-4 py-3 backdrop-blur">
        <Link href={`/g/${group.id}`} className="rounded-full bg-sand p-2.5" aria-label="Voltar"><ArrowLeft size={20} /></Link>
        <h1 className="font-display text-xl font-bold">Administração</h1>
      </header>

      <div className="space-y-5 px-4 pb-8">
        <Link href={`/g/${group.id}/feed`} className="card flex items-center gap-3 p-4">
          <Gavel className="text-terra" />
          <div className="flex-1">
            <p className="font-extrabold">Contestar pontos</p>
            <p className="text-sm text-[#8A6F57]">No Feed, toque em ••• em qualquer post para cancelar ou enviar para votação.</p>
          </div>
          {voting > 0 && <span className="chip bg-terra text-white">{voting}</span>}
        </Link>

        <AdminPush />

        <Section title="Período">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><input type="date" className="input" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
            <Field label="Último dia"><input type="date" className="input" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
          </div>
          <Field label="Dia da Casa de Paz (check-in)">
            <select className="input" value={form.house_weekday} onChange={(e) => set('house_weekday', Number(e.target.value))}>
              {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </Field>
          <p className="text-xs font-bold text-[#a8927a]">{weeks} semana{weeks > 1 ? 's' : ''} · {formatDate(form.start_date)} a {formatDate(form.end_date)}</p>
        </Section>

        <Section title="Dias de postagem">
          <div className="grid grid-cols-2 gap-2">
            {(['all', 'selected'] as const).map((m) => (
              <button key={m} onClick={() => set('post_mode', m)} className={`btn !min-h-[44px] !text-sm ${form.post_mode === m ? 'bg-ink text-white' : 'bg-white'}`}>
                {m === 'all' ? 'Todos os dias' : 'Dias escolhidos'}
              </button>
            ))}
          </div>
          {form.post_mode === 'selected' && (
            <div className="flex justify-between gap-1">
              {WEEKDAYS_SHORT.map((d, i) => {
                const on = form.post_weekdays.includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => set('post_weekdays', on ? form.post_weekdays.filter((x) => x !== i) : [...form.post_weekdays, i].sort())}
                    className={`h-11 flex-1 rounded-xl text-xs font-extrabold ${on ? 'bg-terra text-white' : 'bg-white text-[#8A6F57]'}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-[#8A6F57]">O check-in sempre fica liberado no dia da Casa de Paz.</p>
        </Section>

        <Section title="Limite de pontos por semana">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Por pessoa"><NumberInput value={form.weekly_user_cap} onChange={(v) => set('weekly_user_cap', Math.max(1, v))} /></Field>
            <Field label="Equipe toda"><NumberInput value={form.weekly_group_cap} onChange={(v) => set('weekly_group_cap', Math.max(1, v))} /></Field>
          </div>
          <p className="text-xs leading-relaxed text-[#8A6F57]">
            Máximo no período: <b>{(form.weekly_user_cap * weeks).toLocaleString('pt-BR')} pts por pessoa</b> (libera todos os prêmios individuais) e{' '}
            <b>{(form.weekly_group_cap * weeks).toLocaleString('pt-BR')} pts da equipe</b> (completa a casa).
          </p>
        </Section>

        <Section title="Pontos por ação">
          {POINT_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-[#6b5643]">{label}</span>
              <div className="w-24"><NumberInput value={form.points[key]} onChange={(v) => setPoint(key, Math.max(0, v))} /></div>
            </div>
          ))}
        </Section>

        <button className="btn-primary sticky bottom-[calc(100px+var(--safe-bottom))] z-10 w-full" onClick={save} disabled={saving}>
          {saving ? <Spinner /> : 'Salvar configurações'}
        </button>

        <Section title="Enquetes">
          <Field label="Pergunta"><input className="input" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="Ex.: Quem você vai convidar esta semana?" /></Field>
          {opts.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Opção ${i + 1}`} maxLength={80} />
              {opts.length > 2 && <button onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="rounded-2xl bg-sand px-3" aria-label="Remover opção"><X size={18} /></button>}
            </div>
          ))}
          {opts.length < 6 && <button className="flex items-center gap-1 text-sm font-extrabold text-terra" onClick={() => setOpts([...opts, ''])}><Plus size={16} /> Adicionar opção</button>}
          <Field label="Dia da enquete"><input type="date" className="input" value={pollDate} onChange={(e) => setPollDate(e.target.value)} /></Field>
          <button className="btn-soft w-full" onClick={createPoll}>Criar enquete</button>

          <div className="space-y-2 pt-2">
            {polls.map((p) => (
              <div key={p.id} className="rounded-2xl bg-cream p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#a8927a]">{formatDate(p.poll_date)}{p.poll_date === today ? ' · hoje' : ''}</p>
                    <p className="font-extrabold leading-snug">{p.question}</p>
                  </div>
                  <button onClick={() => deletePoll(p.id)} className="p-1 text-[#a8927a]" aria-label="Excluir"><Trash2 size={18} /></button>
                </div>
                <p className="mt-1 text-xs text-[#8A6F57]">
                  {p.options.map((o, i) => `${o}: ${answers.filter((a) => a.poll_id === p.id && a.option_index === i).length}`).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Foto de fundo do início">
          {!unlocked.has('background') && <p className="rounded-2xl bg-amber/15 p-3 text-sm font-bold text-[#9a5b00]">Você já pode enviar, mas ela só aparece quando a equipe desbloquear "Foto de fundo".</p>}
          {group.background_url && !bg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.background_url} alt="" className="aspect-video w-full rounded-2xl object-cover" />
          )}
          <PhotoPicker value={bg} onChange={setBg} label="Escolha uma foto do grupo" />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-soft" onClick={() => saveBg(false)} disabled={!bg || saving}><ImagePlus size={18} /> Salvar</button>
            <button className="btn-soft" onClick={() => saveBg(true)} disabled={!group.background_url || saving}>Remover</button>
          </div>
        </Section>

        <Section title={`Membros (${members.length})`}>
          <p className="text-xs text-[#8A6F57]">Toque em Extrato para ver todos os pontos de um membro (inclusive enquetes), contestar ou ajustar.</p>
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3">
              <Avatar url={profiles[m.user_id]?.avatar_url} name={profiles[m.user_id]?.name} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{profiles[m.user_id]?.name}</p>
                <p className="truncate text-xs text-[#a8927a]">@{profiles[m.user_id]?.username}</p>
              </div>
              <button onClick={() => setLedger(m.user_id)} className="chip bg-sand !py-2 text-ink">Extrato</button>
              {m.user_id !== me && (
                <button onClick={() => removeMember(m.user_id)} className="rounded-full bg-sand p-2 text-[#7a2618]" aria-label="Remover"><UserMinus size={16} /></button>
              )}
            </div>
          ))}
        </Section>

        <MemberSheet userId={ledger} onClose={() => setLedger(null)} />

        <Section title="Senha do grupo">
          <div className="flex gap-2">
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nova senha" autoComplete="off" />
            <button className="btn-soft shrink-0" onClick={changePw} disabled={pw.length < 4}>Alterar</button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      className="input text-center font-extrabold"
      type="number"
      inputMode="numeric"
      min={0}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
    />
  );
}
