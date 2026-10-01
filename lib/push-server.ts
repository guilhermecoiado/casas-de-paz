// Somente servidor: envio de Web Push com chaves VAPID.
import 'server-only';
import webpush from 'web-push';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const REMINDER_BODY = 'Você tem encontro marcado hoje na casa de paz, esperamos vocês!';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let configured = false;
export function pushConfigError(): string | null {
  const missing = [
    ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY],
    ['VAPID_PRIVATE_KEY', process.env.VAPID_PRIVATE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);
  return missing.length ? `Variáveis de ambiente ausentes: ${missing.join(', ')}` : null;
}

function setup() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contato@casasdepaz.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/** Cliente com a service role: ignora RLS. Nunca expor no navegador. */
export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface SubRow { endpoint: string; user_id: string; p256dh: string; auth: string }

/** Envia para todos os aparelhos inscritos dos membros do grupo. Remove inscrições expiradas. */
export async function sendToGroup(db: SupabaseClient, groupId: string, payload: PushPayload) {
  const { data: members, error } = await db.from('group_members').select('user_id').eq('group_id', groupId);
  if (error) throw error;
  return sendToUsers(db, (members ?? []).map((m) => m.user_id as string), () => payload);
}

/** Envia uma mensagem (que pode ser diferente para cada pessoa) aos aparelhos dos usuários. */
export async function sendToUsers(db: SupabaseClient, ids: string[], payloadFor: (userId: string) => PushPayload | null) {
  setup();
  if (!ids.length) return { recipients: 0, devices: 0, delivered: 0 };
  const { data: subs, error } = await db.from('push_subscriptions').select('endpoint,user_id,p256dh,auth').in('user_id', ids);
  if (error) throw error;
  const rows = (subs ?? []) as SubRow[];
  const gone: string[] = [];
  const delivered = new Set<string>();
  let ok = 0;

  await Promise.all(
    rows.map(async (s) => {
      const payload = payloadFor(s.user_id);
      if (!payload) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 12,
          urgency: 'high',
          topic: payload.tag?.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, ''),
        });
        ok++;
        delivered.add(s.user_id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.endpoint); // aparelho desinstalou ou revogou
      }
    }),
  );
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return { recipients: delivered.size, devices: ok, delivered: ok };
}

export interface NotificationRow {
  user_id: string;
  group_id: string;
  kind: 'comment' | 'digest' | 'reminder' | 'manual';
  title: string;
  body: string;
  url: string;
  actor_id?: string | null;
}

/** Guarda na central de notificações de cada pessoa. Devolve o id criado por usuário. */
export async function saveNotifications(db: SupabaseClient, rows: NotificationRow[]) {
  const ids = new Map<string, number>();
  if (!rows.length) return ids;
  const { data, error } = await db.from('notifications').insert(rows).select('id,user_id');
  if (error) { console.error('notifications', error.message); return ids; }
  (data ?? []).forEach((r) => ids.set(r.user_id as string, r.id as number));
  return ids;
}

/** Acrescenta ?n=<id> para a notificação sair das pendentes quando o push for aberto. */
export const withNotification = (url: string, id?: number) => (id ? `${url}${url.includes('?') ? '&' : '?'}n=${id}` : url);

export async function groupMemberIds(db: SupabaseClient, groupId: string) {
  const { data, error } = await db.from('group_members').select('user_id').eq('group_id', groupId);
  if (error) throw error;
  return (data ?? []).map((m) => m.user_id as string);
}
