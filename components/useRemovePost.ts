'use client';

import { useCallback, useState } from 'react';
import { errMsg, supabase } from '@/lib/supabase';
import { useGroup } from '@/lib/group-context';
import { useToast } from './Providers';
import type { Post } from '@/lib/types';

/** Remover post: o autor remove o próprio; o adm remove o de qualquer membro. */
export function useRemovePost() {
  const { me, isAdmin, reload } = useGroup();
  const toast = useToast();
  const [removing, setRemoving] = useState<string | null>(null);

  const canRemove = useCallback(
    (p: Post) => isAdmin || (p.user_id === me && p.type !== 'adjust'),
    [isAdmin, me],
  );

  const remove = useCallback(
    async (p: Post) => {
      const mine = p.user_id === me;
      const msg = mine
        ? 'Remover este post? Os pontos dele saem da sua pontuação e você pode postar de novo.'
        : 'Remover este post do membro? Os pontos dele saem da pontuação.';
      if (!confirm(msg)) return false;
      setRemoving(p.id);
      const { error } = await supabase.rpc('remove_post', { p_post: p.id });
      setRemoving(null);
      if (error) { toast(errMsg(error), 'error'); return false; }
      toast('Post removido', 'info');
      reload();
      return true;
    },
    [me, toast, reload],
  );

  return { canRemove, remove, removing };
}
