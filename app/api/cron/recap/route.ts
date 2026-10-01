import { NextResponse } from 'next/server';
import { adminClient, pushConfigError, saveNotifications, sendToUsers, withNotification } from '@/lib/push-server';
import { todayIn, weekOf } from '@/lib/game';
import { weekSummary } from '@/lib/recap';
import type { Group, Member, Post } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const first = (n?: string) => (n ?? '').trim().split(/\s+/)[0] || 'Alguém';

/**
 * Fechamento da semana: no 1º dia de cada semana nova, manda o resumo da semana que passou.
 * Chamado 1x por dia pela Netlify Scheduled Function `recap`; cada semana é enviada uma vez só.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const cfg = pushConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });

  const db = adminClient();
  const { data: groups, error } = await db.from('groups').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report: { group: string; status: string; devices?: number }[] = [];
  for (const g of (groups ?? []) as Group[]) {
    const today = todayIn(g.timezone);
    const prev = weekOf(g, today) - 1;
    if (!g.recap_enabled) { report.push({ group: g.name, status: 'desativado' }); continue; }
    if (today < g.start_date || prev < 1) { report.push({ group: g.name, status: 'nenhuma semana fechada ainda' }); continue; }
    if ((g.last_recap_week ?? 0) >= prev) { report.push({ group: g.name, status: `semana ${prev} já enviada` }); continue; }

    const [{ data: members }, { data: posts }] = await Promise.all([
      db.from('group_members').select('*').eq('group_id', g.id),
      db.from('posts').select('*').eq('group_id', g.id).not('status', 'in', '(archived,removed)').order('created_at', { ascending: false }).limit(5000),
    ]);
    const s = weekSummary(g, (members ?? []) as Member[], (posts ?? []) as Post[], prev);
    if (!s.posters) { report.push({ group: g.name, status: `semana ${prev} sem posts` }); continue; }

    // reserva a semana (evita duplicar)
    let claim = db.from('groups').update({ last_recap_week: prev }).eq('id', g.id);
    claim = g.last_recap_week != null ? claim.eq('last_recap_week', g.last_recap_week) : claim.is('last_recap_week', null);
    const { data: claimed } = await claim.select('id');
    if (!claimed?.length) { report.push({ group: g.name, status: 'já enviado' }); continue; }

    const ids = s.top.map((t) => t.id);
    const { data: profs } = ids.length ? await db.from('profiles').select('id,name').in('id', ids) : { data: [] };
    const names = s.top.map((t) => first((profs ?? []).find((p) => p.id === t.id)?.name as string | undefined));
    const parts = [`Equipe somou ${s.teamPoints.toLocaleString('pt-BR')} pts`];
    if (s.guests) parts.push(`${s.guests} convidado${s.guests === 1 ? '' : 's'}`);
    const star = names.length ? ` Destaque: ${names.join(' e ')} (${s.top[0].points} pts).` : '';
    const body = `${parts.join(' e ')}.${star} Bora para a semana ${prev + 1}! 🔥`;
    const title = `Semana ${prev} fechada! 🏠`;
    const url = `/g/${g.id}?recap=${prev}`;
    const memberIds = ((members ?? []) as Member[]).map((m) => m.user_id);
    try {
      const nids = await saveNotifications(db, memberIds.map((u) => ({ user_id: u, group_id: g.id, kind: 'recap' as const, title, body, url })));
      const r = await sendToUsers(db, memberIds, (u) => ({ title, body, url: withNotification(url, nids.get(u)), tag: `recap-${g.id}-${prev}` }));
      report.push({ group: g.name, status: `semana ${prev} enviada`, devices: r.devices });
    } catch (e) {
      report.push({ group: g.name, status: `erro: ${(e as Error).message}` });
    }
  }
  return NextResponse.json({ ok: true, report });
}
