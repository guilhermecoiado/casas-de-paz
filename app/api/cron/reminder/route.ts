import { NextResponse } from 'next/server';
import { REMINDER_BODY, adminClient, pushConfigError, sendToGroup } from '@/lib/push-server';
import { todayIn, weekdayOf } from '@/lib/game';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Lembrete automático do dia da Casa de Paz.
 * Chamado pelo Vercel Cron (vercel.json). Cada grupo recebe no máximo 1 lembrete por dia,
 * mesmo que a rota seja chamada mais vezes.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  const cfg = pushConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });

  const db = adminClient();
  const { data: groups, error } = await db
    .from('groups')
    .select('id,name,timezone,house_weekday,start_date,end_date,reminder_enabled');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report: { group: string; status: string; devices?: number }[] = [];
  for (const g of groups ?? []) {
    const today = todayIn(g.timezone);
    if (!g.reminder_enabled) { report.push({ group: g.name, status: 'desativado' }); continue; }
    // a temporada continua depois do último dia (só zera quando o adm mandar)
    if (today < g.start_date) { report.push({ group: g.name, status: 'ainda não começou' }); continue; }
    if (weekdayOf(today) !== g.house_weekday) { report.push({ group: g.name, status: 'não é dia de encontro' }); continue; }

    const title = `Casa de Paz · ${g.name}`;
    const { data: logId, error: claimErr } = await db.rpc('claim_reminder', { p_group: g.id, p_date: today, p_title: title, p_body: REMINDER_BODY });
    if (claimErr) { report.push({ group: g.name, status: `erro: ${claimErr.message}` }); continue; }
    if (!logId) { report.push({ group: g.name, status: 'já enviado hoje' }); continue; }

    try {
      const r = await sendToGroup(db, g.id, { title, body: REMINDER_BODY, url: `/g/${g.id}`, tag: `reminder-${today}` });
      await db.from('push_log').update({ recipients: r.recipients, devices: r.devices }).eq('id', logId);
      report.push({ group: g.name, status: 'enviado', devices: r.devices });
    } catch (e) {
      report.push({ group: g.name, status: `erro: ${(e as Error).message}` });
    }
  }
  return NextResponse.json({ ok: true, report });
}
