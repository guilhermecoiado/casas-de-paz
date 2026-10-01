import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://exemplo.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key-ausente';

export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || 'casasdepaz.app';

/** O login é por @usuario; internamente o Supabase usa um e-mail sintético. */
export const usernameToEmail = (username: string) => `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;

export const normalizeUsername = (u: string) => u.trim().replace(/^@/, '').toLowerCase();

export function errMsg(e: unknown): string {
  const raw =
    typeof e === 'string'
      ? e
      : e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : 'Algo deu errado';
  if (/Invalid login credentials/i.test(raw)) return 'Usuário ou senha incorretos';
  if (/User already registered/i.test(raw)) return 'Esse @usuário já existe';
  if (/Password should be at least/i.test(raw)) return 'A senha precisa ter pelo menos 6 caracteres';
  if (/Failed to fetch|NetworkError/i.test(raw)) return 'Sem conexão. Verifique sua internet.';
  if (/Email not confirmed/i.test(raw)) return 'Conta não confirmada. Peça ao administrador para desativar "Confirm email" no Supabase.';
  return raw;
}

/** Envia uma imagem para o bucket "media" na pasta do usuário e devolve a URL pública. */
export async function uploadImage(userId: string, blob: Blob, prefix = 'post', fixedPath?: string): Promise<string> {
  const path = fixedPath ?? `${userId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('media').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

/** Foto do post + miniatura leve (tiles). A miniatura fica no mesmo caminho com sufixo "-t". */
export async function uploadPostImage(userId: string, full: Blob, thumb: Blob): Promise<string> {
  const base = `${userId}/post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = await uploadImage(userId, full, 'post', `${base}.jpg`);
  await uploadImage(userId, thumb, 'post', `${base}-t.jpg`).catch(() => {}); // sem miniatura, o tile usa a foto cheia
  return url;
}

/** URL da miniatura de um post (fotos antigas sem miniatura caem na foto cheia via onError). */
export const thumbOf = (url: string) => url.replace(/\.jpg$/, '-t.jpg');
