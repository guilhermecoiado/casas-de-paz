# Casas de Paz — webapp (PWA)

Gincana evangelística para as 4 semanas da Casa de Paz. App mobile instalável (Android e iOS), com tiles dos membros, pontos, ranking, casinha construída em tempo real, enquetes, chat e moldura para Instagram.

**Stack:** Next.js 14 + Supabase (login, banco, fotos e tempo real). Hospedagem gratuita na Vercel; o plano gratuito do Supabase atende um grupo pequeno.

---

## Publicar (cerca de 20 minutos)

### 1. Supabase (banco de dados)
1. Crie uma conta em https://supabase.com, depois **New project** (região: São Paulo).
2. Vá em **SQL Editor → New query**, cole o conteúdo inteiro de `supabase/schema.sql` e clique em **Run**.
3. Vá em **Authentication → Sign In / Providers → Email** e **desligue "Confirm email"**. *(Obrigatório: o login é por @usuário, então ninguém recebe e-mail.)*
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

### 2. Vercel (hospedagem)
1. Suba esta pasta para um repositório no GitHub.
2. Em https://vercel.com, clique em **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
4. Para as **notificações push**, adicione também:
   - `SUPABASE_SERVICE_ROLE_KEY` = chave **service_role** (Supabase → Project Settings → API). É secreta e fica só no servidor.
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`: rode `npm install` e depois `npm run vapid` no computador, e copie as duas linhas que aparecerem.
   - `VAPID_SUBJECT` = `mailto:seu-email@...`
   - `CRON_SECRET` = qualquer texto aleatório longo (ex.: gere em https://1password.com/password-generator).
5. Clique em **Deploy**. Pronto: compartilhe o link com o grupo.

> Já rodou o `schema.sql` antes desta versão? Rode-o de novo inteiro. Ele é seguro para rodar várias vezes e só adiciona o que falta.

### 3. Instalar no celular
- **Android (Chrome):** abra o link e toque em **Instalar Casas de Paz** (ou use o menu ⋮ e depois **Instalar app**).
- **iPhone (Safari):** toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.

O app abre em tela cheia, com ícone próprio e tela de abertura.

### 4. Notificações push
- Cada pessoa toca em **Ativar notificações**, no banner do início ou em **Meu perfil**, e aceita a permissão.
- **iPhone:** só funciona com o app **instalado na Tela de Início** (iOS 16.4 ou mais novo) e aberto por lá. O app avisa isso sozinho.
- **Lembrete automático:** no dia da Casa de Paz, às **8h (horário de Brasília)**, todos recebem *"Você tem encontro marcado hoje na casa de paz, esperamos vocês!"*. Ele vai no máximo 1 vez por dia por grupo, só dentro do período configurado. O adm liga e desliga o lembrete no painel ⚙️ → Notificações.
- **Avisos manuais:** no painel ⚙️ → Notificações, o adm escreve o título e a mensagem (ou usa um modelo pronto) e envia para o grupo todo. O limite é 10 por dia. O histórico mostra quantos aparelhos receberam.
- **Resumo de posts:** de hora em hora o app confere o que foi postado e manda, no máximo a cada N horas (o adm escolhe 1, 2, 3, 4 ou 6h no painel ⚙️ → Notificações), algo como *"Ana, Beto e mais 3 postaram — venha conferir!"*. Cada pessoa só vê os nomes dos outros, e nada é enviado entre 22h e 8h ou se ninguém postou.
- **Central de notificações:** o sino no topo do início mostra quantas notificações estão pendentes (o número também aparece no ícone do app, quando o celular permite). Lá ficam os comentários nos seus posts, os resumos do feed, o lembrete do encontro e os avisos do adm. Tocar abre, e o X ou "Limpar todas" apaga. Abrir pelo push também tira a notificação das pendentes.
- **Lembrete das 20h:** só vai para quem ainda não postou no dia, e lembra a sequência 🔥 quando ela existe. Pode ser desligado no painel.
- **Esqueceu a senha:** na tela de entrar, a pessoa toca em *Esqueci minha senha* e digita o @usuário. O adm do grupo dela recebe um push e um aviso na central; ao tocar, abre a 🔑 já preenchida, que cria uma senha temporária e monta a mensagem para enviar. Se a pessoa não estiver em nenhum grupo, o aviso vai para os adms dos grupos ativos. Depois ela troca em Meu perfil → Trocar senha. O adm também pode usar a 🔑 direto em ⚙️ → Membros.
- **Mudar o horário do lembrete:** edite `vercel.json` (`"0 11 * * *"` = 11h UTC = 8h em Brasília) e faça um novo deploy. No plano gratuito da Vercel, o agendamento roda 1 vez por dia e pode atrasar até 1 hora.

### Rodar localmente
```bash
cp .env.example .env.local   # preencha as duas chaves
npm install
npm run dev
```

---

## Como funciona

### Fluxo
1. A pessoa cria a conta com nome, @usuário, senha, bio e foto.
2. Ela entra num grupo existente (nome e senha do grupo) ou cria um novo. Quem cria o grupo vira o **administrador**.
3. **Início:** tiles de todos os membros. Quem já postou hoje aparece com a foto do dia e ✓, quem não postou aparece em cinza, marcado como "falta".

### Pontuação padrão (o adm altera tudo no painel ⚙️)
**Dia a dia: 1 vez por dia cada, no máximo 100 pts por dia**

| Ação | Pontos |
|---|---|
| Evangelizei / convidei (sem foto) | 25 |
| TSD (devocional) | 15 |
| Registro de jejum | 15 |
| Versículo do dia | 10 |
| Encorajamento para o encontro | 10 |
| Orei pela Casa de Paz | 10 |
| Testemunho | 10 |
| Foto individual | 5 |

**Bônus do dia do encontro: só no dia da Casa de Paz, 1 vez cada**

| Ação | Pontos |
|---|---|
| Check-in (foto no local) | 100, e cada convidado vale o dobro (+200) |
| Foto em grupo | 60, mais 50 de bônus para a equipe. Só uma por grupo no dia: quem postar primeiro leva |
| Ajuda no lanche | 40 |
| Dinâmica | 30 |
| Comunhão | 30 |
| Relax | 20 |

Cada resposta de enquete vale 10 pts.

**Conta da semana:** 100 × 7 dias = 700, mais ~280 do encontro e as enquetes, dá **≈ 1000 por semana**, ou seja, **4000 em 4 semanas**. O painel mostra o limite semanal sugerido e tem um botão para aplicá-lo quando os pontos forem alterados.

### Limites semanais (liberação gradual)
- **Por pessoa** (padrão: 250 por semana) e **da equipe** (padrão: 2.000 por semana).
- O que passa do limite não conta. O post aparece com o selo "limite semanal".
- **Pontuação máxima individual** = limite por pessoa × semanas do período, contadas pelos dias reais (22 dias = 3,14 semanas; a última semana curta conta só os dias que tem). Ela libera **todos os prêmios individuais**.
- **Pontuação máxima da equipe** = limite da equipe × semanas do período (pelos dias reais). Ela **completa a casa**.
- Os desbloqueios usam **percentuais** desses máximos, então se ajustam sozinhos quando o adm muda os limites ou as datas.
- Atenção: quando a equipe atinge o limite da semana, os pontos individuais também param até a semana seguinte.

### Recompensas individuais
O catálogo completo fica em `lib/rewards.ts`.

**Linha da evolução (por pontos).** São quatro caminhos, um por semana. Como o limite semanal libera no máximo 25% da pontuação por semana, cada caminho fecha logo antes do fim da sua semana:

| Caminho | Itens, nesta ordem | Fecha em |
|---|---|---|
| 🌱 Semeador | Semente → Cor Terra → Moldura Semente → Tile Trigo → Animação Broto → Título Semeador | 22% |
| 🐟 Pescador | Cor Mar da Galileia → Moldura Peixes → Tile Pesca → Animação Pesca Milagrosa → Título Pescador de Gente | 45% |
| 🔥 Mensageiro | Cor Fogo → Moldura Chama → Animação Pentecostes → Frase "Leve a Boa Nova" → Título Mensageiro | 68% |
| 👑 Reino | Púrpura Real → Moldura Coroa → Tile Reino → Animação Glória → Título Embaixador do Reino | 90% |

**Kits secretos.** Quem usa juntos todos os itens de um caminho revela uma animação única no tile:
- Semeador: **Campo Fértil**
- Pescador: **Rede Cheia**
- Mensageiro: **Línguas de Fogo**
- Reino: **Glória do Reino**

O nome do kit só aparece quando o caminho está completo, e o perfil tem um botão "Usar kit completo".

**Itens por categoria (avulsos).** Além dos itens dos caminhos, cada categoria tem pelo menos 8 itens avulsos: títulos, molduras de perfil, cores do tile (incluindo a **Túnica de José**, com listras multicoloridas), molduras do tile e animações. Eles são liberados de dois jeitos:
- **por pontos:** espalhados entre os marcos dos caminhos, então sempre tem algo novo chegando;
- **por ações:** conquistas como check-ins, convidados, evangelismo, dias postando, lanche e fotos em grupo.

Nenhum desses itens é necessário para completar a linha da evolução.

**Frases de sobrepor.** Ao compartilhar uma foto com moldura, a pessoa escolhe uma frase, que aparece estilizada sobre a imagem. As frases vêm de quatro fontes:
- 3 frases liberadas desde o início
- 1 frase na linha da evolução
- frases da coleção
- versículos que a equipe inteira ganha conforme a casa avança

### Desbloqueios da equipe (a casinha)
A moldura Casa de Paz já vem liberada desde o início. Depois, conforme a equipe pontua: fundação → **chat** → paredes → **tiles animados** → porta → janelas → **foto de fundo no início** → telhado → chaminé → jardim → luzes → cerca → **casa completa**, com animação de conquista e confete. A barra e a casa atualizam em tempo real para todos. Com a casa completa, aparece o botão **Compartilhar**, que gera uma imagem da casinha montada com a moldura do grupo e uma polaroid da última foto em grupo.

### Moldura e Instagram
Depois de cada post com foto, o app gera a imagem com a moldura "Casa de Paz" em formato 4:5 e abre o menu de compartilhamento do celular, onde aparece o Instagram (Stories ou Feed). Qualquer foto do Feed também pode ser compartilhada com moldura pelo botão **Moldura**.

### Check-in com QR code e item surpresa
- O check-in só libera a foto depois que a pessoa escaneia o QR code impresso no local (ou digita o código de 6 letras embaixo dele). O servidor confere o código, e ele vale só no dia do encontro.
- **Painel ⚙️ → QR code do check-in:** baixe o cartaz para imprimir, gere um QR novo se o código vazar, ou desligue a exigência do QR.
- Cada check-in sorteia **1 item surpresa** que só sai assim. São 14 itens: 7 comuns (títulos e frases), 5 raros (cores e molduras) e 2 lendários (animações). O sorteio nunca repete um item que a pessoa já tem. Se o check-in for cancelado ou removido, o item volta para o sorteio.
- A surpresa abre numa caixa de presente logo depois do check-in. As que faltam aparecem como "?" em Meu perfil → Surpresas do check-in.

### Sequência de dias 🔥
O número no tile mostra quantos dias seguidos a pessoa está postando, e o fogo cresce com a sequência (3, 7 e 14 dias mudam o visual). Se a pessoa ainda não postou hoje, o fogo fica cinza até ela postar. **Intensivo:** 7 dias seguidos liberam o título *Intensivo* e a animação exclusiva *Fogo do Intensivo*. Com 14 dias vem a *Moldura Brasa Viva*, com 21 a *Cor Brasa* e com 28 o título *Fogo que Não se Apaga*.

### Fechamento da semana, destaques, convidados e oração
- **Fechamento:** no 1º dia de cada semana, às 8h20, chega um push com o resumo da semana anterior, e o início mostra um card com uma imagem compartilhável.
- **Ranking → Destaques da semana:** mais pontos, quem mais cresceu, mais convidados, maior sequência, mais constante e mais encorajador.
- **Convidados:** no check-in dá para anotar o nome de cada convidado. A lista fica em Início → Convidados e pode ser enviada ou copiada.
- **Mural de oração:** pedidos com "🙏 Orar". Quem pediu é avisado e pode marcar como respondido.
- **Como funciona:** guia completo, aberto no primeiro acesso e disponível no início e no perfil.

### Reações e comentários
No feed, cada post tem reações rápidas (🙏 ❤️ 🔥 🙌 😂) e comentários com atalhos de emoji. Não valem pontos. Cada pessoa apaga os próprios comentários, e o adm apaga qualquer um. O dono do post recebe o aviso na central e no próximo resumo de push.

### Administrador
- **Painel ⚙️:** datas de início e fim, dia da Casa de Paz, postagem todos os dias ou só em dias escolhidos, limites semanais, pontos de cada ação, enquetes, foto de fundo, membros e senha do grupo.
- **Grupo:** no painel dá para renomear o grupo (muda para todos na hora) e excluir o grupo (apaga de vez dados e fotos para todos os membros; as contas continuam). Para tirar alguém do grupo, use o botão de remover membro na lista de membros.
- **Contestar pontos:** no Feed, toque em ••• num post. Dá para **cancelar direto** ou **enviar para votação**. Na votação, os membros votam em "manter" ou "cancelar", e a maioria absoluta decide na hora. O adm também pode encerrar a votação ou restaurar os pontos.

---

## Problemas comuns
- **"Conta criada, mas sem sessão" / "Email not confirmed":** desligue "Confirm email" (passo 1.3).
- **Erro de e-mail inválido ao cadastrar:** defina `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` com um domínio seu (ex.: `seudominio.com`). Ele só serve para montar o login interno e não envia e-mails.
- **Notificações não chegam:** confira as 5 variáveis de ambiente de push e faça um novo deploy (as `NEXT_PUBLIC_` só valem após um novo build). No celular, veja se as notificações do app/navegador não estão bloqueadas. Para testar o lembrete sem esperar: Vercel → Settings → Cron Jobs → **Run**.
- **Trocou as chaves VAPID:** todos precisam tocar em **Ativar notificações** de novo.
- **Trocar ícones e telas de abertura:** edite `scripts/generate-icons.mjs` e rode `npm run icons`.
