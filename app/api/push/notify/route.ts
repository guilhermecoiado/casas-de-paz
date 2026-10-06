import { NextResponse } from 'next/server';
import { adminClient, pushConfigError, sendToUsers, withNotification } from '@/lib/push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS = ['challenge', 'guess', 'solved'];
// avisos de "novo desafio" para o grupo todo respeitam o horário de silêncio
const QUIET_START = 22;
const QUIET_END = 8;
const hourIn = (tz: string) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));

/**
 * Entrega por push as notificações dos desafios que o banco acabou de criar (cada uma só uma vez).
 * Qualquer membro pode chamar depois de uma ação; só envia o que já está na central de notificações.
 */
export async function POST(req: Request) {
  const cfg = pushConfigError();
  if (cfg) return NextResponse.json({ error: cfg }, { status: 500 });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Faça login primeiro' }, { status: 401 });
  let input: { groupId?: string };
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 }); }
  if (!input.groupId) return NextResponse.json({ error: 'Grupo ausente' }, { status: 400 });

  const db = adminClient();
  const { data: auth } = await db.auth.getUser(token);
  if (!auth?.user) return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
  const { data: member } = await db.from('group_members').select('user_id').eq('group_id', input.groupId).eq('user_id', auth.user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: 'Você não faz parte deste grupo' }, { status: 403 });
  const { data: group } = await db.from('groups').select('timezone').eq('id', input.groupId).maybeSingle();

  // marca como enviado antes de enviar: chamadas simultâneas não duplicam
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: rows } = await db.from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('group_id', input.groupId).in('kind', KINDS).is('pushed_at', null).gte('created_at', since)
    .select('id,user_id,kind,title,body,url');
  const h = hourIn(group?.timezone ?? 'America/Sao_Paulo');
  const quiet = h >= QUIET_START || h < QUIET_END;
  const list = (rows ?? []).filter((n) => !(quiet && n.kind === 'challenge'));
  if (!list.length) return NextResponse.json({ sent: 0 });

  const byUser = new Map<string, typeof list>();
  list.forEach((n) => byUser.set(n.user_id as string, [...(byUser.get(n.user_id as string) ?? []), n]));
  const result = await sendToUsers(db, [...byUser.keys()], (u) => {
    const mine = byUser.get(u)!;
    const n = mine[mine.length - 1];
    return { title: n.title as string, body: n.body as string, url: withNotification(n.url as string, n.id as number), tag: `ch-${n.id}` };
  });
  return NextResponse.json(result);
}
