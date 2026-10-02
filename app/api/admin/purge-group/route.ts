import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Caminho no bucket "media" a partir da URL pública da foto. */
const pathOf = (url: string | null | undefined) => {
  const m = url?.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
  return m ? decodeURIComponent(m[1].split('?')[0]) : null;
};

/**
 * Apaga de vez um grupo que o adm acabou de excluir: fotos do armazenamento e todos os dados
 * (posts, chat, enquetes, comentários, oração, notificações...). As contas das pessoas continuam.
 */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Servidor sem SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Faça login primeiro' }, { status: 401 });
  let input: { groupId?: string };
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 }); }
  if (!input.groupId) return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 });

  const db = adminClient();
  const { data: auth, error: authErr } = await db.auth.getUser(token);
  if (authErr || !auth.user) return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 });

  const { data: group } = await db.from('groups').select('id,admin_id,deleted_at,background_url').eq('id', input.groupId).maybeSingle();
  if (!group) return NextResponse.json({ ok: true, already: true });
  if (group.admin_id !== auth.user.id) return NextResponse.json({ error: 'Apenas o administrador' }, { status: 403 });
  // só apaga de vez o que já foi excluído no app (com a confirmação do nome)
  if (!group.deleted_at) return NextResponse.json({ error: 'Exclua o grupo no painel primeiro' }, { status: 400 });

  // fotos dos posts (foto cheia + miniatura) e a foto de fundo
  const { data: posts, error: pe } = await db.from('posts').select('photo_url').eq('group_id', group.id).not('photo_url', 'is', null);
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });
  const paths = new Set<string>();
  (posts ?? []).forEach((p) => {
    const full = pathOf(p.photo_url as string);
    if (full) { paths.add(full); paths.add(full.replace(/\.jpg$/, '-t.jpg')); }
  });
  const bg = pathOf(group.background_url);
  if (bg) paths.add(bg);

  const list = Array.from(paths);
  let removed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const { data, error } = await db.storage.from('media').remove(list.slice(i, i + 100));
    if (error) return NextResponse.json({ error: `Fotos: ${error.message}` }, { status: 500 });
    removed += data?.length ?? 0;
  }

  // apaga o grupo; o resto vai junto (on delete cascade)
  const { error: de } = await db.from('groups').delete().eq('id', group.id);
  if (de) return NextResponse.json({ error: de.message }, { status: 500 });
  return NextResponse.json({ ok: true, photos: removed });
}
