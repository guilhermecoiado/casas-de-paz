'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { FullLoader } from '@/components/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export default function Home() {
  const { ready, userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !supabaseConfigured) return;
    if (!userId) return router.replace('/entrar');
    (async () => {
      let last: string | null = null;
      try { last = localStorage.getItem('cdp-last-group'); } catch {}
      if (last) {
        const { data } = await supabase.from('group_members').select('group_id').eq('group_id', last).eq('user_id', userId).maybeSingle();
        if (data) return router.replace(`/g/${last}`);
      }
      router.replace('/grupos');
    })();
  }, [ready, userId, router]);

  if (!supabaseConfigured) {
    return (
      <main className="mx-auto max-w-md p-6 pt-safe">
        <h1 className="mt-10 font-display text-2xl font-bold">Configuração pendente</h1>
        <p className="mt-3 text-[#6b5643]">
          Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> nas variáveis de ambiente
          (veja o README).
        </p>
      </main>
    );
  }
  return <FullLoader />;
}
