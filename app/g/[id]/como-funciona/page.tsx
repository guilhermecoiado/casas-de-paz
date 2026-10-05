'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { useGroup } from '@/lib/group-context';
import { ACTIONS, WEEKDAYS, actionPoints, dailyMax, formatDate, maxIndividual, meetingMax, totalWeeks } from '@/lib/game';
import { PATHS } from '@/lib/rewards';

function Topic({ icon, title, children, open = false }: { icon: string; title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sand text-xl">{icon}</span>
        <span className="flex-1 font-display text-lg font-bold leading-tight">{title}</span>
        <ChevronDown size={20} className="shrink-0 text-[#a8927a] transition group-open:rotate-180" />
      </summary>
      <div className="space-y-2.5 px-4 pb-4 text-[15px] leading-snug text-[#4a3a2c] [&_b]:text-ink">{children}</div>
    </details>
  );
}

const Row = ({ label, pts, note }: { label: string; pts: string; note?: string }) => (
  <div className="flex items-start justify-between gap-3 border-b border-sand/70 py-1.5 last:border-0">
    <div className="min-w-0">
      <p className="font-bold leading-tight">{label}</p>
      {note && <p className="text-xs text-[#a8927a]">{note}</p>}
    </div>
    <span className="shrink-0 font-display font-extrabold text-terra">{pts}</span>
  </div>
);

export default function ComoFunciona() {
  const { group } = useGroup();
  const weeks = totalWeeks(group);
  const day = WEEKDAYS[group.house_weekday].toLowerCase();
  const daily = ACTIONS.filter((a) => a.when === 'daily').sort((a, b) => actionPoints(group, b.type, 0) - actionPoints(group, a.type, 0));
  const meeting = ACTIONS.filter((a) => a.when === 'meeting');
  const ck = group.points.checkin;

  return (
    <div className="pt-safe">
      <header className="sticky top-0 z-10 flex items-center gap-2 bg-cream/95 px-3 pb-2 pt-3 backdrop-blur">
        <Link href={`/g/${group.id}`} className="rounded-full p-2" aria-label="Voltar"><ArrowLeft size={22} /></Link>
        <h1 className="flex-1 font-display text-[24px] font-extrabold">Como funciona</h1>
      </header>

      <div className="mx-4 rounded-3xl bg-gradient-to-br from-terra to-[#e07a4f] p-5 text-white">
        <p className="font-display text-2xl font-extrabold leading-tight">Uma gincana de {weeks} semanas para encher a Casa de Paz 🏠</p>
        <p className="mt-2 text-sm font-bold leading-snug text-white/90">
          De {formatDate(group.start_date, { day: '2-digit', month: 'long' })} a {formatDate(group.end_date, { day: '2-digit', month: 'long' })}. Encontro toda {day}.
          Cada coisa que você faz pelo Reino vira pontos, que liberam prêmios para você e constroem a casa da equipe.
        </p>
      </div>

      <div className="space-y-3 px-4 pb-10 pt-4">
        <Topic icon="📅" title="O que fazer todo dia" open>
          <p>Cada ação vale <b>1 vez por dia</b>. Fazendo todas, são <b>{dailyMax(group)} pts por dia</b>.</p>
          <div>{daily.map((a) => <Row key={a.type} label={a.label} pts={`+${actionPoints(group, a.type, 0)}`} note={a.hint} />)}</div>
        </Topic>

        <Topic icon="🏠" title={`Dia da Casa de Paz (${day})`}>
          <p>No dia do encontro abrem as <b>ações bônus</b>, que valem mais (até <b>{meetingMax(group)} pts</b>). Cada uma vale 1 vez.</p>
          <div>{meeting.map((a) => <Row key={a.type} label={a.label} pts={`+${actionPoints(group, a.type, 0)}`} note={a.hint} />)}</div>
          <p className="rounded-2xl bg-[#2b2118] p-3 font-bold text-white">📲 <b className="!text-amber">Check-in com QR code:</b> no local tem um QR code impresso. Toque no + → Check-in e escaneie para liberar a foto. Cada check-in sorteia um <b className="!text-amber">item surpresa</b> (título, moldura, cor, frase ou até uma animação lendária) que só sai assim!</p>
          <p className="rounded-2xl bg-olive/15 p-3 font-bold text-[#3f5a24]">🙌 Cada convidado vale o dobro do check-in: <b>+{ck * 2} pts por pessoa</b>. Anote o nome dele para o grupo acompanhar depois.</p>
        </Topic>

        <Topic icon="🎯" title="Limites e meta da semana">
          <p>Cada pessoa pode somar até <b>{group.weekly_user_cap.toLocaleString('pt-BR')} pts por semana</b>. O que passa disso não conta, e o post fica com o selo “limite semanal”.</p>
          <p>A meta é chegar perto de <b>{maxIndividual(group).toLocaleString('pt-BR')} pts</b> no período: isso libera todos os prêmios individuais.</p>
          <p>A pontuação não zera sozinha no fim do período: só o adm pode começar uma temporada nova.</p>
        </Topic>

        <Topic icon="🔥" title="Sequência de dias">
          <p>Poste <b>pelo menos uma coisa por dia</b> para manter o fogo aceso. O número no seu tile mostra quantos dias seguidos você está postando, e o fogo cresce conforme a sequência aumenta.</p>
          <p>Se ainda não postou hoje, o fogo fica apagado (cinza), mas a sequência só se perde se o dia virar sem post.</p>
          <p className="rounded-2xl bg-[#fff1dc] p-3 font-bold text-[#a8400f]">Intensivo: <b>7 dias seguidos</b> liberam a animação exclusiva <b>Fogo do Intensivo</b> e o título <b>Intensivo</b>. Com 14, 21 e 28 dias tem mais prêmios.</p>
        </Topic>

        <Topic icon="🎁" title="Prêmios individuais">
          <p><b>Linha da evolução:</b> {PATHS.length} caminhos, um por semana ({PATHS.map((p) => `${p.icon} ${p.name.replace('Caminho do ', '')}`).join(', ')}). Os itens vão liberando conforme seus pontos.</p>
          <p><b>Kits secretos:</b> use juntos todos os itens de um caminho e descubra uma animação surpresa no seu tile.</p>
          <p><b>Coleção:</b> títulos, molduras, cores e animações extras, liberados por pontos ou por conquistas (check-ins, convidados, dias postando, lanche e mais).</p>
          <p>Tudo fica em <b>Meu perfil</b>. Toque num item liberado para usar e toque de novo para tirar.</p>
        </Topic>

        <Topic icon="🧱" title="A casa da equipe">
          <p>Os pontos de todo mundo somam para construir a <b>Casa de Paz</b>: fundação, paredes, porta, janelas, telhado… até a casa completa, com festa e imagem para compartilhar.</p>
          <p>No caminho a equipe libera o <b>chat</b>, os <b>tiles animados</b> e a <b>foto de fundo</b> do início. A casa avança no máximo um tanto por semana, então a constância de todos conta.</p>
        </Topic>

        <Topic icon="🏆" title="Ranking e destaques">
          <p>O ranking atualiza em tempo real. Em caso de empate vence quem foi mais fiel (mais dias postando), depois quem chegou primeiro à pontuação.</p>
          <p>Na aba <b>Destaques da semana</b> brilham também quem mais cresceu, quem trouxe mais convidados, a maior sequência e quem mais encorajou os outros no feed.</p>
          <p>No 1º dia de cada semana sai o <b>fechamento</b> da semana anterior, com uma imagem para compartilhar.</p>
        </Topic>

        <Topic icon="📸" title="Feed, moldura e Instagram">
          <p>No feed, reaja com 🙏 ❤️ 🔥 🙌 😂 e comente os posts. Reações e comentários não valem pontos: é só carinho mesmo.</p>
          <p>Toda foto pode ser compartilhada com a <b>moldura Casa de Paz</b> e uma frase. Cada semana tem a sua moldura, liberada com o seu check-in naquela semana.</p>
        </Topic>

        <Topic icon="🙏" title="Mural de oração e convidados">
          <p>No <b>Mural de oração</b> você deixa um pedido e o grupo toca em “Orar”. Quem pediu recebe o aviso e pode marcar “Respondido 🙌”.</p>
          <p>A lista de <b>Convidados</b> junta todo mundo que visitou a Casa de Paz, para orar, mandar mensagem e convidar de novo.</p>
        </Topic>

        <Topic icon="🔔" title="Notificações">
          <p>Ative as notificações no início ou no perfil. No iPhone, o app precisa estar instalado na Tela de Início.</p>
          <p>Você recebe o lembrete do dia do encontro, um resumo de quem postou, os comentários nos seus posts, o aviso das 20h se ainda não postou e o fechamento da semana. Tudo fica também no <b>sino 🔔</b> do início.</p>
        </Topic>

        <Topic icon="⚖️" title="Regras e justiça">
          <p>O adm pode cancelar pontos de um post que não vale ou mandar para <b>votação do grupo</b>. Quem postou algo errado pode remover o próprio post, e os pontos saem junto.</p>
          <p>Esqueceu a senha? Na tela de entrar, toque em <b>Esqueci minha senha</b>: o adm recebe o pedido e manda uma senha nova. Depois, troque em <b>Meu perfil → Trocar senha</b>.</p>
        </Topic>
      </div>
    </div>
  );
}
