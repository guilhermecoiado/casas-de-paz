import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** O adm define uma senha nova para um membro do grupo (quem esqueceu a senha). */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Faça login primeiro' }, { status: 401 });

  let input: { groupId?: string; userId?: string; password?: string };
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 }); }
  const password = (input.password ?? '').trim();
  if (!input.groupId || !input.userId) return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres' }, { status: 400 });

  const db = adminClient();
  const { data: auth, error: authErr } = await db.auth.getUser(token);
  if (authErr || !auth.user) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 });

  const { data: group } = await db.from('groups').select('id,admin_id,deleted_at').eq('id', input.groupId).maybeSingle();
  if (!group || group.deleted_at || group.admin_id !== auth.user.id) return NextResponse.json({ error: 'Apenas o administrador' }, { status: 403 });
  const { data: member } = await db.from('group_members').select('user_id').eq('group_id', group.id).eq('user_id', input.userId).maybeSingle();
  if (!member) {
    // fora do grupo: só se a própria pessoa pediu senha nova nos últimos 2 dias
    const { data: req2 } = await db.from('password_requests').select('id').eq('user_id', input.userId).is('resolved_at', null)
      .gte('created_at', new Date(Date.now() - 48 * 3600_000).toISOString()).limit(1);
    if (!req2?.length) return NextResponse.json({ error: 'Essa pessoa não faz parte do grupo' }, { status: 404 });
  }

  // o adm não pode trocar a senha de quem administra outro grupo (protege outros adms)
  if (input.userId !== auth.user.id) {
    const { count } = await db.from('groups').select('id', { count: 'exact', head: true }).eq('admin_id', input.userId);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'Essa pessoa é administradora de um grupo. Ela precisa trocar a própria senha.' }, { status: 403 });
  }

  const { error } = await db.auth.admin.updateUserById(input.userId, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await db.from('password_requests').update({ resolved_at: new Date().toISOString() }).eq('user_id', input.userId).is('resolved_at', null);
  return NextResponse.json({ ok: true });
}
