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
- **Pontuação máxima individual** = limite por pessoa × número de semanas. Ela libera **todos os prêmios individuais**.
- **Pontuação máxima da equipe** = limite da equipe × número de semanas. Ela **completa a casa**.
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
A moldura Casa de Paz já vem liberada desde o início. Depois, conforme a equipe pontua: fundação → **chat** → paredes → **tiles animados** → porta → janelas → **foto de fundo no início** → telhado → chaminé → jardim → luzes → cerca → **casa completa**, com animação de conquista e confete. A barra e a casa atualizam em tempo real para todos.

### Moldura e Instagram
Depois de cada post com foto, o app gera a imagem com a moldura "Casa de Paz" em formato 4:5 e abre o menu de compartilhamento do celular, onde aparece o Instagram (Stories ou Feed). Qualquer foto do Feed também pode ser compartilhada com moldura pelo botão **Moldura**.

### Administrador
- **Painel ⚙️:** datas de início e fim, dia da Casa de Paz, postagem todos os dias ou só em dias escolhidos, limites semanais, pontos de cada ação, enquetes, foto de fundo, membros e senha do grupo.
- **Contestar pontos:** no Feed, toque em ••• num post. Dá para **cancelar direto** ou **enviar para votação**. Na votação, os membros votam em "manter" ou "cancelar", e a maioria absoluta decide na hora. O adm também pode encerrar a votação ou restaurar os pontos.

---

## Problemas comuns
- **"Conta criada, mas sem sessão" / "Email not confirmed":** desligue "Confirm email" (passo 1.3).
- **Erro de e-mail inválido ao cadastrar:** defina `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` com um domínio seu (ex.: `seudominio.com`). Ele só serve para montar o login interno e não envia e-mails.
- **Notificações não chegam:** confira as 5 variáveis de ambiente de push e faça um novo deploy (as `NEXT_PUBLIC_` só valem após um novo build). No celular, veja se as notificações do app/navegador não estão bloqueadas. Para testar o lembrete sem esperar: Vercel → Settings → Cron Jobs → **Run**.
- **Trocou as chaves VAPID:** todos precisam tocar em **Ativar notificações** de novo.
- **Trocar ícones e telas de abertura:** edite `scripts/generate-icons.mjs` e rode `npm run icons`.
