import { NextResponse } from 'next/server';
import { adminClient, groupMemberIds, pushConfigError, saveNotifications, sendToUsers, withNotification } from '@/lib/push-server';
import { addDays, streakOf, todayIn } from '@/lib/game';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lembrete das 20h só para quem ainda não postou nada hoje.
 * Chamado 1x por dia pela Netlify Scheduled Function `nudge`; no máximo 1 por grupo por dia.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const cfg = pushConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });

  const db = adminClient();
  const { data: groups, error } = await db.from('groups').select('id,name,timezone,start_date,nudge_enabled,last_nudge_date');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report: { group: string; status: string; devices?: number; people?: number }[] = [];
  for (const g of groups ?? []) {
    const today = todayIn(g.timezone);
    if (!g.nudge_enabled) { report.push({ group: g.name, status: 'desativado' }); continue; }
    if (today < g.start_date) { report.push({ group: g.name, status: 'ainda não começou' }); continue; }
    if (g.last_nudge_date === today) { report.push({ group: g.name, status: 'já enviado hoje' }); continue; }

    // reserva o dia (evita duplicar)
    let claim = db.from('groups').update({ last_nudge_date: today }).eq('id', g.id);
    claim = g.last_nudge_date ? claim.eq('last_nudge_date', g.last_nudge_date) : claim.is('last_nudge_date', null);
    const { data: claimed } = await claim.select('id');
    if (!claimed?.length) { report.push({ group: g.name, status: 'já enviado hoje' }); continue; }

    const members = await groupMemberIds(db, g.id);
    const { data: posts, error: pe } = await db
      .from('posts')
      .select('user_id,local_date')
      .eq('group_id', g.id)
      .gte('local_date', addDays(today, -60))
      .not('type', 'in', '(adjust,poll,streak)')
      .not('status', 'in', '(cancelled,archived,removed)');
    if (pe) { report.push({ group: g.name, status: `erro: ${pe.message}` }); continue; }

    const daysOf = new Map<string, string[]>();
    (posts ?? []).forEach((p) => daysOf.set(p.user_id, [...(daysOf.get(p.user_id) ?? []), p.local_date]));
    const missing = members.filter((u) => !(daysOf.get(u) ?? []).includes(today));
    if (!missing.length) { report.push({ group: g.name, status: 'todos já postaram 🎉' }); continue; }

    const title = `Casa de Paz · ${g.name}`;
    const url = `/g/${g.id}/postar`;
    const bodyFor = (u: string) => {
      const s = streakOf(daysOf.get(u) ?? [], today).current;
      return s > 1
        ? `🔥 Sua sequência de ${s} dias apaga à meia-noite! Poste algo hoje para manter o fogo aceso.`
        : 'Ainda dá tempo! Seus pontos de hoje estão te esperando 🙏';
    };
    try {
      const nids = await saveNotifications(db, missing.map((u) => ({ user_id: u, group_id: g.id, kind: 'nudge' as const, title: 'Ainda dá tempo hoje!', body: bodyFor(u), url })));
      const r = await sendToUsers(db, missing, (u) => ({ title, body: bodyFor(u), url: withNotification(url, nids.get(u)), tag: `nudge-${today}` }));
      report.push({ group: g.name, status: 'enviado', people: missing.length, devices: r.devices });
    } catch (e) {
      report.push({ group: g.name, status: `erro: ${(e as Error).message}` });
    }
  }
  return NextResponse.json({ ok: true, report });
}
