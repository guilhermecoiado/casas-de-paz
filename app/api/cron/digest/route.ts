import { NextResponse } from 'next/server';
import { adminClient, groupMemberIds, pushConfigError, saveNotifications, sendToUsers, withNotification } from '@/lib/push-server';
import { todayIn } from '@/lib/game';
import type { PostType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// sem notificação de madrugada (horário do grupo)
const QUIET_START = 22;
const QUIET_END = 8;

const hourIn = (tz: string) =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));

const DID: Partial<Record<PostType, string>> = {
  checkin: 'fez check-in na Casa de Paz',
  group: 'postou a foto em grupo',
  snack: 'postou o lanche',
  dynamic: 'postou a dinâmica',
  fellowship: 'postou a comunhão',
  relax: 'postou o relax',
  individual: 'postou uma foto',
  evangelism: 'evangelizou',
  verse: 'postou o versículo do dia',
  encourage: 'deixou um encorajamento',
  devotional: 'fez o TSD',
  prayer: 'orou pela Casa de Paz',
  fasting: 'registrou o jejum',
  testimony: 'compartilhou um testemunho',
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** "Ana", "Ana e Beto", "Ana, Beto e Caio", "Ana, Beto e mais 3" */
function joinNames(names: string[]) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} e ${names[2]}`;
  return `${names[0]}, ${names[1]} e mais ${names.length - 2}`;
}

/**
 * Resumo de posts por push: no máximo 1 a cada N horas por grupo (o adm escolhe N).
 * Chamado de hora em hora pela Netlify Scheduled Function `digest`.
 * Cada pessoa recebe só os nomes dos OUTROS que postaram; quem foi o único a postar não recebe.
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
    .select('id,name,timezone,start_date,digest_enabled,digest_hours,last_digest_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const report: { group: string; status: string; devices?: number }[] = [];
  for (const g of groups ?? []) {
    if (!g.digest_enabled) { report.push({ group: g.name, status: 'desativado' }); continue; }
    if (todayIn(g.timezone) < g.start_date) { report.push({ group: g.name, status: 'ainda não começou' }); continue; }
    const h = hourIn(g.timezone);
    if (h >= QUIET_START || h < QUIET_END) { report.push({ group: g.name, status: 'horário de silêncio' }); continue; }
    const every = Math.max(1, g.digest_hours || 3) * 3600_000;
    const last = g.last_digest_at ? Date.parse(g.last_digest_at) : 0;
    // 5 min de folga: o agendador roda de hora em hora e pode atrasar alguns segundos
    if (last && now - last < every - 5 * 60_000) { report.push({ group: g.name, status: 'aguardando intervalo' }); continue; }

    // posts e comentários desde o último resumo (no primeiro, olha só a última janela)
    const since = new Date(last || now - every).toISOString();
    const [{ data: posts, error: pe }, { data: comments, error: ce }] = await Promise.all([
      db.from('posts')
        .select('user_id,type,created_at')
        .eq('group_id', g.id)
        .gt('created_at', since)
        .not('type', 'in', '(adjust,poll,streak)')
        .not('status', 'in', '(cancelled,archived,removed)')
        .order('created_at', { ascending: false }),
      db.from('post_comments')
        .select('user_id,post_id,created_at,posts!inner(user_id)')
        .eq('group_id', g.id)
        .gt('created_at', since)
        .order('created_at', { ascending: false }),
    ]);
    if (pe || ce) { report.push({ group: g.name, status: `erro: ${(pe ?? ce)!.message}` }); continue; }
    if (!posts?.length && !comments?.length) { report.push({ group: g.name, status: 'nada novo' }); continue; }

    // reserva o envio (evita duplicar se duas execuções coincidirem)
    const stamp = new Date(now).toISOString();
    let claim = db.from('groups').update({ last_digest_at: stamp }).eq('id', g.id);
    claim = g.last_digest_at ? claim.eq('last_digest_at', g.last_digest_at) : claim.is('last_digest_at', null);
    const { data: claimed } = await claim.select('id');
    if (!claimed?.length) { report.push({ group: g.name, status: 'já enviado' }); continue; }

    // autores na ordem do post mais recente, com o que cada um postou
    const byUser = new Map<string, PostType[]>();
    for (const p of posts ?? []) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p.type as PostType]);
    // quem comentou nos posts de cada dono
    const commentersOf = new Map<string, string[]>();
    const commentedPost = new Map<string, string>(); // post comentado mais recente de cada dono
    for (const c of comments ?? []) {
      const owner = (c.posts as unknown as { user_id: string }).user_id;
      if (owner === c.user_id) continue;
      if (!commentedPost.has(owner)) commentedPost.set(owner, c.post_id as string);
      const l = commentersOf.get(owner) ?? [];
      if (!l.includes(c.user_id)) l.push(c.user_id);
      commentersOf.set(owner, l);
    }
    const people = new Set([...Array.from(byUser.keys()), ...Array.from(commentersOf.values()).flat()]);
    const [{ data: profs }, members] = await Promise.all([
      db.from('profiles').select('id,name').in('id', Array.from(people)),
      groupMemberIds(db, g.id),
    ]);
    const nameOf = new Map((profs ?? []).map((p) => [p.id as string, firstName(p.name as string)]));
    const authors = Array.from(byUser.keys()).filter((id) => nameOf.has(id));

    const postsLine = (uid: string) => {
      const others = authors.filter((a) => a !== uid);
      if (!others.length) return null;
      if (others.length === 1) {
        const types = byUser.get(others[0])!;
        return types.length === 1 ? `${nameOf.get(others[0])} ${DID[types[0]] ?? 'postou'}` : `${nameOf.get(others[0])} fez ${types.length} posts`;
      }
      return `${joinNames(others.map((a) => nameOf.get(a)!))} postaram`;
    };
    const commentsLine = (uid: string) => {
      const who = (commentersOf.get(uid) ?? []).filter((c) => nameOf.has(c));
      if (!who.length) return null;
      return `${joinNames(who.map((c) => nameOf.get(c)!))} ${who.length === 1 ? 'comentou' : 'comentaram'} no seu post`;
    };

    const title = `Casa de Paz · ${g.name}`;
    const feed = `/g/${g.id}/feed`;
    try {
      // na central fica só o resumo dos posts (cada comentário já tem a sua notificação)
      const nids = await saveNotifications(db, members.flatMap((u) => {
        const pl = postsLine(u);
        return pl ? [{ user_id: u, group_id: g.id, kind: 'digest' as const, title: 'Novidades no feed', body: `${pl} — venha conferir!`, url: feed }] : [];
      }));
      const r = await sendToUsers(db, members, (uid) => {
        const parts = [commentsLine(uid), postsLine(uid)].filter(Boolean) as string[];
        if (!parts.length) return null;
        // só comentários: abre direto no post comentado
        const url = nids.get(uid) ? withNotification(feed, nids.get(uid)) : `${feed}?post=${commentedPost.get(uid)}`;
        return { title, body: `${parts.join(' · ')} — venha conferir!`, url, tag: `digest-${g.id}` };
      });
      report.push({ group: g.name, status: 'enviado', devices: r.devices });
    } catch (e) {
      report.push({ group: g.name, status: `erro: ${(e as Error).message}` });
    }
  }
  // a central guarda só os últimos 30 dias
  await db.from('notifications').delete().lt('created_at', new Date(now - 30 * 86400_000).toISOString());
  return NextResponse.json({ ok: true, report });
}
