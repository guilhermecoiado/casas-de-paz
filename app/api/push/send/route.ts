import { NextResponse } from 'next/server';
import { adminClient, pushConfigError, sendToGroup } from '@/lib/push-server';
import { todayIn } from '@/lib/game';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Push manual do administrador para todo o grupo. */
export async function POST(req: Request) {
  const cfg = pushConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Faça login primeiro' }, { status: 401 });

  let input: { groupId?: string; title?: string; body?: string };
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 }); }
  const title = (input.title ?? '').trim().slice(0, 60);
  const body = (input.body ?? '').trim().slice(0, 240);
  if (!input.groupId || !title || body.length < 3) return NextResponse.json({ error: 'Preencha título e mensagem' }, { status: 400 });

  const db = adminClient();
  const { data: auth, error: authErr } = await db.auth.getUser(token);
  if (authErr || !auth.user) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 });

  const { data: group } = await db.from('groups').select('id,name,admin_id,timezone').eq('id', input.groupId).maybeSingle();
  if (!group || group.admin_id !== auth.user.id) return NextResponse.json({ error: 'Apenas o administrador' }, { status: 403 });

  // limite simples contra disparos repetidos: 10 avisos por dia
  const today = todayIn(group.timezone);
  const { count } = await db.from('push_log').select('id', { count: 'exact', head: true })
    .eq('group_id', group.id).eq('kind', 'manual').eq('local_date', today);
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Limite de 10 avisos por dia atingido' }, { status: 429 });

  const result = await sendToGroup(db, group.id, { title, body, url: `/g/${group.id}`, tag: `manual-${Date.now()}` });
  await db.from('push_log').insert({
    group_id: group.id, kind: 'manual', title, body, sent_by: auth.user.id,
    recipients: result.recipients, devices: result.devices, local_date: today,
  });
  return NextResponse.json(result);
}
