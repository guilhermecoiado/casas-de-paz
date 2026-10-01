'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, BookOpen, Camera, Coffee, Flame, HandHeart, Heart, Megaphone, MapPin, MessageCircleHeart, Minus, Plus,
  Smile, Sparkles, Sun, User, Users, UtensilsCrossed,
} from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { ACTIONS, WEEKDAYS, actionAvailability, actionPoints, dailyMax, formatDate, weekdayOf, type ActionInfo } from '@/lib/game';
import { ProgressBar } from '@/components/ui';
import { compressImage } from '@/lib/image';
import { ShareSheet } from '@/components/ShareSheet';
import { StreakCard } from '@/components/StreakCard';
import { errMsg, supabase, uploadPostImage } from '@/lib/supabase';
import { PhotoPicker, Spinner } from '@/components/ui';
import { useToast } from '@/components/Providers';
import { Confetti } from '@/components/Confetti';
import type { ActionType, Post } from '@/lib/types';

const ICONS: Record<ActionType, React.ElementType> = {
  checkin: MapPin, evangelism: Megaphone, group: Users, snack: Coffee, dynamic: Sparkles, fellowship: Heart, individual: User, relax: Smile,
  verse: BookOpen, encourage: MessageCircleHeart, devotional: Sun, prayer: HandHeart, fasting: UtensilsCrossed, testimony: Flame,
};

/** mínimo de caracteres exigido por tipo (o servidor confere de novo) */
const MIN_TEXT: Partial<Record<ActionType, number>> = { evangelism: 10, encourage: 10, devotional: 10, testimony: 10, verse: 5, fasting: 5, snack: 2 };

export default function Postar() {
  const router = useRouter();
  const toast = useToast();
  const { group, posts, me, today, profiles, reload, stats } = useGroup();
  const [action, setAction] = useState<ActionInfo | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [text, setText] = useState('');
  const [guests, setGuests] = useState(0);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ post: Post; photo: Blob | null; label: string } | null>(null);

  const myToday = useMemo(() => posts.filter((p) => p.user_id === me && p.local_date === today), [posts, me, today]);
  const groupToday = useMemo(() => posts.filter((p) => p.local_date === today), [posts, today]);
  const isHouseDay = weekdayOf(today) === group.house_weekday;
  const groupPhotoBy = groupToday.find((p) => p.type === 'group' && p.status !== 'cancelled');
  const dayMax = dailyMax(group);
  const dayDone = myToday.filter((p) => p.status !== 'cancelled' && ACTIONS.some((a) => a.when === 'daily' && a.type === p.type)).reduce((s, p) => s + p.points, 0);
  const weekDone = stats.byUser[me]?.weekPoints ?? 0;
  // atalho vindo de outra tela (ex.: mural de oração → "Orei pela Casa de Paz")
  const preset = useSearchParams()?.get('acao');
  useEffect(() => {
    if (!preset) return;
    const a = ACTIONS.find((x) => x.type === preset);
    if (a && !actionAvailability(group, a.type, today, myToday, groupToday).blocked) setAction(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);
  const back = () => (action ? setAction(null) : router.push(`/g/${group.id}`));

  const submit = async () => {
    if (!action) return;
    if (action.photo === 'required' && !photo) return toast('Adicione a foto', 'error');
    const min = MIN_TEXT[action.type] ?? 0;
    if (text.trim().length < min) return toast(`Escreva um pouco mais (mínimo ${min} caracteres)`, 'error');
    setBusy(true);
    try {
      let photoUrl: string | null = null;
      let small: Blob | null = null;
      if (photo) {
        small = await compressImage(photo);
        const thumb = await compressImage(photo, 480, 0.72);
        photoUrl = await uploadPostImage(me, small, thumb);
      }
      const { data, error } = await supabase.rpc('submit_post', {
        p_group: group.id, p_type: action.type, p_photo_url: photoUrl, p_description: text.trim() || null, p_guests: guests,
      });
      if (error) throw error;
      const names = guestNames.slice(0, guests).map((n) => n.trim()).filter(Boolean);
      if (action.type === 'checkin' && names.length) {
        const { error: ge } = await supabase.rpc('set_guest_names', { p_post: (data as Post).id, p_names: names });
        if (ge) toast(`Check-in salvo, mas os nomes não: ${errMsg(ge)}`, 'error');
      }
      setDone({ post: data as Post, photo: small, label: action.short });
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ---------- sucesso ---------- */
  if (done) {
    const p = done.post;
    return (
      <main className="min-h-[100dvh] px-5 pt-safe pb-safe">
        <Confetti />
        <div className="pt-8 text-center anim-pop">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-terra">Registrado!</p>
          <p className="mt-1 font-display text-6xl font-extrabold text-ink">+{p.points}</p>
          <p className="font-bold text-[#8A6F57]">pontos{p.group_bonus ? ` · +${p.group_bonus} bônus para a equipe` : ''}</p>
          {p.capped && (
            <p className="mx-auto mt-2 max-w-xs rounded-2xl bg-amber/20 px-3 py-2 text-sm font-bold text-[#9a5b00]">
              Limite semanal atingido: parte dos pontos ficou para a próxima semana.
            </p>
          )}
        </div>
        {done.post.type !== 'poll' && <div className="mx-auto mt-5 max-w-[360px] anim-rise"><StreakCard celebrate /></div>}
        {done.photo && (
          <div className="mx-auto mt-6 max-w-[360px] anim-rise">
            <ShareSheet inline open onClose={() => {}} source={done.photo} week={done.post.week} label={done.label} dateLabel={formatDate(today, { day: '2-digit', month: 'long' })} />
          </div>
        )}
        <button className="btn-soft mx-auto mt-3 flex w-full max-w-[320px]" onClick={() => router.push(`/g/${group.id}`)}>
          Voltar ao início
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] pt-safe pb-safe">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-cream/95 px-4 py-3 backdrop-blur">
        <button onClick={back} className="rounded-full bg-sand p-2.5" aria-label="Voltar"><ArrowLeft size={20} /></button>
        <h1 className="font-display text-xl font-bold">{action ? action.label : 'O que você fez hoje?'}</h1>
      </header>

      {!action ? (
        <div className="space-y-6 px-4 pb-8">
          <div className="card grid grid-cols-2 gap-4 p-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#a8927a]">Hoje (dia a dia)</p>
              <p className="font-display text-2xl font-extrabold leading-tight">{dayDone}<span className="text-sm text-[#a8927a]"> / {dayMax}</span></p>
              <div className="mt-1.5"><ProgressBar value={dayDone} max={dayMax} height={8} color={dayDone >= dayMax ? 'bg-olive' : 'bg-amber'} /></div>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#a8927a]">Semana</p>
              <p className="font-display text-2xl font-extrabold leading-tight">{weekDone}<span className="text-sm text-[#a8927a]"> / {group.weekly_user_cap}</span></p>
              <div className="mt-1.5"><ProgressBar value={weekDone} max={group.weekly_user_cap} height={8} /></div>
            </div>
          </div>
          {(['daily', 'meeting'] as const).map((when) => {
            const list = ACTIONS.filter((a) => a.when === when);
            return (
              <section key={when}>
                <div className="mb-2.5 flex items-end justify-between px-1">
                  <div>
                    <h2 className="font-display text-lg font-bold">{when === 'meeting' ? 'Bônus do dia do encontro' : 'Dia a dia'}</h2>
                    <p className="text-xs font-bold text-[#a8927a]">
                      {when === 'meeting'
                        ? isHouseDay ? 'Hoje é dia de Casa de Paz! Vale mais pontos' : `Libera ${WEEKDAYS[group.house_weekday].toLowerCase()} · vale mais pontos`
                        : `1 vez por dia cada · máximo de ${dayMax} pts por dia`}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {list.map((a, i) => {
                    const av = actionAvailability(group, a.type, today, myToday, groupToday);
                    const Icon = ICONS[a.type];
                    const featured = a.type === 'checkin' || a.type === 'evangelism';
                    const pts = actionPoints(group, a.type);
                    return (
                      <button
                        key={a.type}
                        disabled={!!av.blocked}
                        onClick={() => { setAction(a); setPhoto(null); setText(''); setGuests(0); setGuestNames([]); }}
                        className={`card relative flex flex-col items-start p-4 text-left transition active:scale-[0.97] disabled:opacity-55 anim-rise ${featured ? 'col-span-2 bg-gradient-to-br from-white to-amber/15' : ''}`}
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${featured ? 'bg-terra text-white' : 'bg-terra/10 text-terra'}`}>
                          <Icon size={22} />
                        </span>
                        <p className="mt-3 font-extrabold leading-tight">{a.label}</p>
                        {featured && <p className="mt-1 text-sm text-[#6b5643]">{a.hint}</p>}
                        <p className="mt-2 text-sm font-black text-terra">
                          {a.type === 'checkin' ? `${group.points.checkin} pts + ${group.points.checkin * 2}/convidado` : `+${pts} pts`}
                          {a.type === 'group' && <span className="font-bold text-olive"> +{group.points.group_bonus} equipe</span>}
                        </p>
                        {a.type === 'group' && groupPhotoBy && (
                          <p className="mt-1 text-[11px] font-bold text-[#8A6F57]">Postada por @{profiles[groupPhotoBy.user_id]?.username ?? '…'}</p>
                        )}
                        {a.when === 'daily' && !av.blocked && (
                          <p className="mt-1 text-[11px] font-bold text-olive">Disponível hoje</p>
                        )}
                        {av.blocked === 'done' && <p className="mt-1 text-[11px] font-bold text-olive">✓ Feito hoje</p>}
                        {av.blocked && av.blocked !== 'done' && !(a.when === 'meeting' && !isHouseDay) && (
                          <p className="mt-1 text-[11px] font-bold text-[#8A6F57]">🔒 {av.blocked}</p>
                        )}
                        {a.when === 'meeting' && !isHouseDay && (
                          <p className="mt-1 text-[11px] font-bold text-[#8A6F57]">🔒 Libera {WEEKDAYS[group.house_weekday].toLowerCase()}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-5 px-4 pb-10 anim-rise">
          <p className="rounded-2xl bg-sand/70 px-4 py-3 text-sm font-bold text-[#6b5643]">{action.hint}</p>

          {action.photo !== 'none' && (
            <PhotoPicker
              value={photo}
              onChange={setPhoto}
              cameraOnly={action.type === 'checkin'}
              label={action.type === 'checkin' ? 'Tire uma foto agora no local' : action.photo === 'optional' ? 'Foto (opcional)' : 'Foto do momento'}
            />
          )}

          {action.type === 'checkin' && (
            <div className="card p-4">
              <p className="font-extrabold">Levou convidados?</p>
              <p className="text-sm text-[#8A6F57]">Cada convidado vale o dobro do check-in.</p>
              <div className="mt-3 flex items-center justify-between">
                <button className="btn-soft h-12 w-12 !px-0" onClick={() => setGuests((g) => Math.max(0, g - 1))} aria-label="Menos"><Minus /></button>
                <div className="text-center">
                  <p className="font-display text-4xl font-extrabold">{guests}</p>
                  <p className="text-xs font-bold text-[#a8927a]">convidado{guests === 1 ? '' : 's'}</p>
                </div>
                <button className="btn-soft h-12 w-12 !px-0" onClick={() => setGuests((g) => Math.min(20, g + 1))} aria-label="Mais"><Plus /></button>
              </div>
              {guests > 0 && (
                <div className="mt-4 space-y-2 border-t border-sand pt-3">
                  <p className="text-sm font-extrabold text-[#6b5643]">Nome dos convidados <span className="font-bold text-[#a8927a]">(opcional)</span></p>
                  <p className="text-xs leading-snug text-[#a8927a]">Fica numa lista para o grupo acompanhar e convidar de novo.</p>
                  {Array.from({ length: guests }, (_, i) => (
                    <input
                      key={i}
                      className="input !py-2.5"
                      value={guestNames[i] ?? ''}
                      maxLength={60}
                      placeholder={`Convidado ${i + 1}`}
                      onChange={(e) => setGuestNames((l) => { const c = [...l]; c[i] = e.target.value; return c; })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {action.text !== 'none' && (
            <div>
              <label className="label">{action.textLabel}</label>
              <textarea
                className="input min-h-[110px] resize-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                placeholder={action.placeholder ?? ''}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
            <span className="font-bold text-[#6b5643]">Você vai ganhar</span>
            <span className="font-display text-2xl font-extrabold text-terra">
              +{actionPoints(group, action.type, guests)} pts
            </span>
          </div>

          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? <Spinner /> : <>{action.photo === 'required' ? <Camera size={18} /> : null} Registrar</>}
          </button>
        </div>
      )}
    </main>
  );
}
