'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Gavel, ImagePlus, KeyRound, Plus, Trash2, UserMinus, X } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { useConfirm, useToast } from '@/components/Providers';
import { Avatar, PhotoPicker, Spinner } from '@/components/ui';
import { AdminPush } from '@/components/AdminPush';
import { AdminCheckinQR } from '@/components/AdminCheckinQR';
import { MemberSheet } from '@/components/MemberSheet';
import { ResetPasswordSheet } from '@/components/ResetPasswordSheet';
import { POINT_LABELS, WEEKDAYS, WEEKDAYS_SHORT, dailyMax, formatDate, maxGroup, maxIndividual, meetingMax, periodDays, suggestedWeeklyCap, teamWeeklyCap, totalWeeks } from '@/lib/game';
import { compressImage } from '@/lib/image';
import { errMsg, supabase, uploadImage } from '@/lib/supabase';
import type { Group, PointsConfig } from '@/lib/types';

export default function Admin() {
  const router = useRouter();
  const toast = useToast();
  const ask = useConfirm();
  const { group, isAdmin, members, profiles, polls, answers, posts, me, today, unlocked, reload } = useGroup();
  const [form, setForm] = useState<Group>(group);
  const [dirty, setDirty] = useState(false);
  // acompanha o grupo (ex.: depois de zerar a temporada) enquanto não houver edição pendente
  useEffect(() => { if (!dirty) setForm(group); }, [group, dirty]);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<string[]>(['', '']);
  const [pollDate, setPollDate] = useState(today);
  const [bg, setBg] = useState<Blob | null>(null);
  const [pw, setPw] = useState('');
  const [ledger, setLedger] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState<string | null>(null);
  // vindo do aviso "pediu uma senha nova": já abre a redefinição
  const askedPw = useSearchParams()?.get('senha');
  useEffect(() => { if (askedPw) setResetPw(askedPw); }, [askedPw]);
  const [resetName, setResetName] = useState('');
  const [resetting, setResetting] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [renaming, setRenaming] = useState(false);
  const [delName, setDelName] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!isAdmin) {
    return (
      <div className="p-8 pt-safe text-center">
        <p className="mt-20 font-bold">Apenas o administrador acessa esta área.</p>
        <button className="btn-soft mt-4" onClick={() => router.back()}>Voltar</button>
      </div>
    );
  }

  const set = <K extends keyof Group>(k: K, v: Group[K]) => { setDirty(true); setForm((f) => ({ ...f, [k]: v })); };
  const setPoint = (k: keyof PointsConfig, v: number) => { setDirty(true); setForm((f) => ({ ...f, points: { ...f.points, [k]: v } })); };
  const weeks = totalWeeks(form);
  const teamCap = teamWeeklyCap(form, members.length);

  const resetSeason = async () => {
    if (!(await ask({ title: 'Zerar a temporada?', message: 'Pontos, enquetes e itens equipados de todo o grupo serão apagados e a temporada recomeça hoje. Não dá para desfazer.', confirmLabel: 'Zerar tudo', danger: true }))) return;
    setResetting(true);
    const { error } = await supabase.rpc('admin_reset_group', { p_group: group.id, p_confirm: resetName });
    setResetting(false);
    if (error) return toast(errMsg(error), 'error');
    setResetName('');
    toast('Temporada zerada. Começa hoje!');
    reload();
  };

  const rename = async () => {
    setRenaming(true);
    const { data, error } = await supabase.rpc('admin_rename_group', { p_group: group.id, p_name: newName });
    setRenaming(false);
    if (error) return toast(errMsg(error), 'error');
    setNewName(data as string);
    toast('Nome do grupo atualizado para todos');
    reload();
  };

  const deleteGroup = async () => {
    if (!(await ask({ title: `Excluir "${group.name}"?`, message: 'O grupo é apagado de vez para TODOS os membros, com posts, fotos, pontos, chat e enquetes. Não dá para desfazer.', confirmLabel: 'Excluir grupo', danger: true }))) return;
    setDeleting(true);
    const { error } = await supabase.rpc('admin_delete_group', { p_group: group.id, p_confirm: delName });
    if (error) { setDeleting(false); return toast(errMsg(error), 'error'); }
    // avisa quem está com o app aberto agora para sair do grupo na hora
    const ch = supabase.channel(`groupdel-${group.id}`);
    await new Promise<void>((res) => {
      const t = setTimeout(res, 2500);
      ch.subscribe(async (st) => {
        if (st === 'SUBSCRIBED') { await ch.send({ type: 'broadcast', event: 'deleted', payload: {} }); clearTimeout(t); res(); }
      });
    });
    supabase.removeChannel(ch);
    // apaga de vez no servidor: dados e fotos (libera espaço)
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/purge-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ groupId: group.id }),
      });
      if (!res.ok) console.warn('purge', await res.text());
    } catch (e) { console.warn('purge', e); }
    try { localStorage.removeItem('cdp-last-group'); } catch { /* ok */ }
    toast('Grupo excluído');
    router.replace('/grupos');
  };

  const save = async () => {
    if (form.end_date < form.start_date) return toast('A data final precisa ser depois da inicial', 'error');
    setSaving(true);
    const { error } = await supabase.from('groups').update({
      start_date: form.start_date, end_date: form.end_date, house_weekday: form.house_weekday,
      post_mode: form.post_mode, post_weekdays: form.post_weekdays,
      weekly_user_cap: form.weekly_user_cap, weekly_group_cap: form.weekly_group_cap, points: form.points,
      group_cap_auto: form.group_cap_auto, group_cap_factor: form.group_cap_factor, diminishing: form.diminishing,
    }).eq('id', group.id);
    setSaving(false);
    if (error) return toast(errMsg(error), 'error');
    setDirty(false);
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
    if (!(await ask({ title: 'Excluir esta enquete?', message: 'Os pontos de quem já respondeu serão cancelados.', confirmLabel: 'Excluir', danger: true }))) return;
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
    if (!(await ask({ title: `Remover ${profiles[uid]?.name ?? 'membro'}?`, message: 'A pessoa sai do grupo na hora. A conta dela continua e ela pode entrar de novo com a senha do grupo.', confirmLabel: 'Remover', danger: true }))) return;
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

        <AdminCheckinQR />
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
          <p className="text-xs font-bold text-[#a8927a]">{periodDays(form)} dias ({weeks} semana{weeks > 1 ? 's' : ''}{periodDays(form) % 7 ? `, a última com ${periodDays(form) % 7} dia${periodDays(form) % 7 > 1 ? 's' : ''}` : ''}) · {formatDate(form.start_date)} a {formatDate(form.end_date)}</p>
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
          <p className="text-xs text-[#8A6F57]">Vale para as ações do dia a dia. As ações do encontro (check-in, foto em grupo, dinâmica, lanche, comunhão e relax) só liberam no dia da Casa de Paz.</p>
        </Section>

        <Section title="Limite de pontos por semana">
          <Field label="Por pessoa (meta semanal de cada membro)">
            <NumberInput value={form.weekly_user_cap} onChange={(v) => set('weekly_user_cap', Math.max(1, v))} />
          </Field>
          <div className="rounded-2xl bg-cream p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold">Total da equipe automático</p>
                <p className="text-xs text-[#8A6F57]">Acompanha o número de membros ({members.length})</p>
              </div>
              <Toggle on={form.group_cap_auto} onChange={(v) => set('group_cap_auto', v)} />
            </div>
            {form.group_cap_auto ? (
              <div className="mt-3">
                <label className="label">Meta da equipe: % do máximo de todos os membros</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={30} max={100} step={5} className="flex-1 accent-[#C8553D]"
                    value={Math.round(Number(form.group_cap_factor) * 100)}
                    onChange={(e) => set('group_cap_factor', Number(e.target.value) / 100)}
                  />
                  <span className="w-12 text-right font-display text-lg font-extrabold">{Math.round(Number(form.group_cap_factor) * 100)}%</span>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <Field label="Equipe toda (fixo por semana)"><NumberInput value={form.weekly_group_cap} onChange={(v) => set('weekly_group_cap', Math.max(1, v))} /></Field>
              </div>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[#8A6F57]">
            Por semana: <b>{form.weekly_user_cap.toLocaleString('pt-BR')} pts por pessoa</b> e <b>{teamCap.toLocaleString('pt-BR')} pts da equipe</b>.<br />
            No período ({periodDays(form)} dias): <b>{maxIndividual(form).toLocaleString('pt-BR')}</b> por pessoa (libera toda a evolução) e{' '}
            <b>{maxGroup(form, members.length).toLocaleString('pt-BR')}</b> da equipe (completa a casa). Semana incompleta conta só pelos dias que tem. O limite da equipe só controla o avanço da casa; não trava os pontos de ninguém.
          </p>
        </Section>

        <Section title="Pontos por ação">
          <div className="rounded-2xl bg-cream p-3 text-sm leading-relaxed text-[#6b5643]">
            <p><b>Máximo do dia a dia:</b> {dailyMax(form)} pts (cada ação 1x por dia)</p>
            <p><b>Semana:</b> {dailyMax(form)} × 7 = {dailyMax(form) * 7} + bônus do encontro {meetingMax(form)} + enquetes ≈ <b>{suggestedWeeklyCap(form)}</b></p>
            {suggestedWeeklyCap(form) !== form.weekly_user_cap && (
              <button className="chip mt-2 bg-ink !py-2 text-white" onClick={() => set('weekly_user_cap', suggestedWeeklyCap(form))}>
                Usar {suggestedWeeklyCap(form)} como limite semanal por pessoa
              </button>
            )}
          </div>
          {(['daily', 'meeting', 'other'] as const).map((w) => (
            <div key={w} className="space-y-2">
              <p className="pt-2 text-xs font-extrabold uppercase tracking-wider text-[#a8927a]">
                {w === 'meeting' ? 'Bônus do dia do encontro (1 vez)' : w === 'daily' ? 'Dia a dia (1 vez por dia)' : 'Outros'}
              </p>
              {POINT_LABELS.filter((x) => x.when === w).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-[#6b5643]">{label}</span>
                  <div className="w-24"><NumberInput value={form.points[key] ?? 0} onChange={(v) => setPoint(key, Math.max(0, v))} /></div>
                </div>
              ))}
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
                  <button onClick={() => deletePoll(p.id)} className="-m-1.5 p-2.5 text-[#a8927a]" aria-label="Excluir"><Trash2 size={18} /></button>
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
          <p className="text-xs text-[#8A6F57]">Toque em Extrato para ver todos os pontos de um membro (inclusive enquetes), contestar ou ajustar. A chave 🔑 cria uma senha nova para quem esqueceu.</p>
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3">
              <Avatar url={profiles[m.user_id]?.avatar_url} name={profiles[m.user_id]?.name} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{profiles[m.user_id]?.name}</p>
                <p className="truncate text-xs text-[#a8927a]">@{profiles[m.user_id]?.username}</p>
              </div>
              <button onClick={() => setLedger(m.user_id)} className="chip bg-sand !py-2 text-ink">Extrato</button>
              {m.user_id !== me && (
                <button onClick={() => setResetPw(m.user_id)} className="rounded-full bg-sand p-2 text-ink" aria-label="Redefinir senha"><KeyRound size={16} /></button>
              )}
              {m.user_id !== me && (
                <button onClick={() => removeMember(m.user_id)} className="rounded-full bg-sand p-2 text-[#7a2618]" aria-label="Remover"><UserMinus size={16} /></button>
              )}
            </div>
          ))}
        </Section>

        <MemberSheet userId={ledger} onClose={() => setLedger(null)} />
        <ResetPasswordSheet userId={resetPw} onClose={() => setResetPw(null)} />

        <Section title="Nome do grupo">
          <div className="flex gap-2">
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} />
            <button className="btn-soft shrink-0" onClick={rename} disabled={renaming || newName.trim().length < 3 || newName.trim() === group.name}>
              {renaming ? <Spinner /> : 'Salvar'}
            </button>
          </div>
          <p className="text-xs text-[#8A6F57]">Muda para todos os membros na hora. Para entrar no grupo, novos membros passam a usar o nome novo (a senha continua a mesma).</p>
        </Section>

        <Section title="Senha do grupo">
          <div className="flex gap-2">
            <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nova senha" autoComplete="off" />
            <button className="btn-soft shrink-0" onClick={changePw} disabled={pw.length < 4}>Alterar</button>
          </div>
        </Section>

        <section className="space-y-3 rounded-3xl border-2 border-[#7a2618]/30 bg-[#7a2618]/5 p-4">
          <h2 className="font-display text-lg font-bold text-[#7a2618]">Zerar temporada</h2>
          <p className="text-sm leading-snug text-[#6b5643]">
            A pontuação nunca zera sozinha: depois do último dia, tudo continua contando. Para começar do zero, digite o nome do grupo
            (<b>{group.name}</b>) e confirme. Apaga pontos, enquetes e itens equipados; mantém membros, chat e configurações.
          </p>
          <input className="input" value={resetName} onChange={(e) => setResetName(e.target.value)} placeholder="Nome do grupo" />
          <button className="btn w-full bg-[#7a2618] text-white" onClick={resetSeason} disabled={resetting || resetName.trim().toLowerCase() !== group.name.toLowerCase()}>
            {resetting ? <Spinner /> : 'Zerar e recomeçar hoje'}
          </button>
        </section>

        <section className="space-y-3 rounded-3xl border-2 border-[#7a2618] bg-[#7a2618]/10 p-4">
          <h2 className="font-display text-lg font-bold text-[#7a2618]">Excluir grupo</h2>
          <p className="text-sm leading-snug text-[#6b5643]">
            O grupo é apagado <b>de vez para todos os membros</b>, com posts, fotos, pontos, chat, enquetes e pedidos de oração. Não dá para recuperar. As contas das pessoas continuam e elas podem entrar em outro grupo.
            Para confirmar, digite o nome do grupo (<b>{group.name}</b>).
          </p>
          <input className="input" value={delName} onChange={(e) => setDelName(e.target.value)} placeholder="Nome do grupo" />
          <button className="btn w-full bg-[#7a2618] text-white" onClick={deleteGroup} disabled={deleting || delName.trim().toLowerCase() !== group.name.toLowerCase()}>
            {deleting ? <Spinner /> : <><Trash2 size={18} /> Excluir grupo para todos</>}
          </button>
        </section>
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
  // texto livre enquanto digita (dá para apagar tudo); vira número ao sair do campo
  const [text, setText] = useState(String(Number.isFinite(value) ? value : 0));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(String(Number.isFinite(value) ? value : 0)); }, [value, editing]);
  return (
    <input
      className="input text-center font-extrabold"
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9]/g, '');
        setText(t);
        if (t !== '') onChange(parseInt(t, 10));
      }}
      onBlur={() => { setEditing(false); onChange(parseInt(text || '0', 10)); }}
    />
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-olive' : 'bg-[#d9c8b2]'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}
