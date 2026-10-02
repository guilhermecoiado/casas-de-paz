'use client';
import { useEffect } from 'react';
import { useConfirm } from '@/components/Providers';
export default function Demo() {
  const ask = useConfirm();
  useEffect(() => { setTimeout(() => ask({ title: 'Excluir "Casa de Paz - Growth"?', message: 'O grupo é apagado de vez para TODOS os membros, com posts, fotos, pontos, chat e enquetes. Não dá para desfazer.', confirmLabel: 'Excluir grupo', danger: true }), 2200); }, [ask]);
  return <div className="p-6"><h1 className="font-display text-2xl font-bold">Administração</h1><p className="mt-4 text-[#6b5643]">Conteúdo da página por trás do modal…</p></div>;
}
