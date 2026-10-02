import { NextResponse } from 'next/server';
import { adminClient, pushConfigError, saveNotifications, sendToUsers, withNotification } from '@/lib/push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Esqueci minha senha": a pessoa (sem login) informa o @usuário e o adm do grupo dela
 * recebe um aviso para criar uma senha temporária. Não precisa de e-mail.
 */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  let input: { username?: string };
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 }); }
  const username = (input.username ?? '').trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9_.]{3,24}$/.test(username)) return NextResponse.json({ error: 'Digite o seu @usuário' }, { status: 400 });

  const db = adminClient();
  const { data: prof } = await db.from('profiles').select('id,name,username').eq('username', username).maybeSingle();
  if (!prof) return NextResponse.json({ error: 'Usuário não encontrado. Confira como você escreveu o @usuário.' }, { status: 404 });

  // evita vários pedidos seguidos
  const { data: recent } = await db.from('password_requests').select('id').eq('user_id', prof.id).is('resolved_at', null)
    .gte('created_at', new Date(Date.now() - 10 * 60_000).toISOString()).limit(1);
  if (recent?.length) return NextResponse.json({ ok: true, already: true });

  // adms dos grupos da pessoa; se ela não estiver em nenhum grupo, avisa os adms de todos os grupos ativos
  const { data: mine } = await db.from('group_members').select('group_id, groups!inner(id,admin_id,deleted_at)').eq('user_id', prof.id).is('groups.deleted_at', null);
  let targets = (mine ?? []).map((m) => (m.groups as unknown as { id: string; admin_id: string })).filter((g) => g.admin_id !== prof.id);
  if (!targets.length) {
    const { data: all } = await db.from('groups').select('id,admin_id').is('deleted_at', null);
    targets = (all ?? []).filter((g) => g.admin_id !== prof.id);
  }
  if (!targets.length) return NextResponse.json({ error: 'Não há administrador para ajudar agora. Fale com quem organiza a Casa de Paz.' }, { status: 409 });

  await db.from('password_requests').insert({ user_id: prof.id });

  const first = (prof.name as string).trim().split(/\s+/)[0];
  const rows = targets.map((g) => ({
    user_id: g.admin_id, group_id: g.id, kind: 'reset' as const,
    title: `@${prof.username} pediu uma senha nova 🔑`,
    body: `${first} esqueceu a senha. Toque para criar uma senha temporária e enviar para ela.`,
    url: `/g/${g.id}/admin?senha=${prof.id}`,
    actor_id: prof.id as string,
  }));
  const nids = await saveNotifications(db, rows);
  if (!pushConfigError()) {
    const urlOf = new Map(rows.map((r) => [r.user_id, r.url]));
    await sendToUsers(db, Array.from(new Set(rows.map((r) => r.user_id))), (u) => ({
      title: 'Pedido de senha nova 🔑', body: rows[0].body.replace('ela', 'a pessoa'), url: withNotification(urlOf.get(u)!, nids.get(u)), tag: `reset-${prof.id}`,
    })).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
