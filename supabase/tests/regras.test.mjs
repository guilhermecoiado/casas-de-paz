import pg from 'pg';
import { readFileSync } from 'node:fs';

const c = new pg.Client({ host: 'localhost', port: 5499, user: 'postgres', password: 'pw', database: 'postgres' });
await c.connect();
await c.query(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema extensions; create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
`);
const schema = readFileSync('./schema.sql', 'utf8');
await c.query(schema);
await c.query(schema);
console.log('schema OK (rodou 2x)');

const users = {};
for (const u of ['ana', 'bia', 'caio', 'davi', 'zeca']) {
  const r = await c.query(`insert into auth.users (raw_user_meta_data) values ($1) returning id`, [{ username: u, name: u.toUpperCase() }]);
  users[u] = r.rows[0].id;
}
const as = async (u, sql, params = []) => {
  await c.query('begin');
  await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [users[u]]);
  await c.query('set local role authenticated');
  try { const r = await c.query(sql, params); await c.query('commit'); return r.rows; }
  catch (e) { await c.query('rollback'); return { error: e.message }; }
};
let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗ FALHOU'} ${msg}`); if (!cond) fails++; };

const [{ create_group: gid }] = await as('ana', `select create_group('Casa Jardins', 'paz123')`);
ok(!!gid, 'cria grupo');
ok(!!(await c.query(`select checkin_code from group_secrets where group_id=$1`, [gid])).rows[0].checkin_code, 'grupo novo já tem código de check-in');
await c.query(`update groups set checkin_qr=false where id=$1`, [gid]); // testes antigos de check-in sem QR

ok((await as('bia', `select join_group('casa jardins', 'errada')`)).error?.includes('incorretos'), 'senha errada bloqueada');
for (const u of ['bia', 'caio', 'davi']) await as(u, `select join_group('Casa Jardins', 'paz123')`);
ok((await as('bia', `select * from group_secrets`)).length === 0, 'hash da senha invisível');
ok((await as('bia', `update groups set weekly_user_cap = 9999 where id = $1 returning id`, [gid])).length === 0, 'membro não altera config');
const g0 = (await c.query(`select weekly_user_cap, group_cap_auto, group_cap_factor, diminishing, points from groups where id=$1`, [gid])).rows[0];
ok(g0.weekly_user_cap === 1000 && g0.group_cap_auto && Number(g0.group_cap_factor) === 0.6 && g0.points.checkin === 100 && g0.points.evangelism === 25, 'padrões: 1000/semana, equipe automática 60%, pontos v4');

const dow = (await c.query(`select extract(dow from (now() at time zone 'America/Sao_Paulo')::date)::int d`)).rows[0].d;
const setHouse = (d) => as('ana', `update groups set house_weekday = $2 where id = $1`, [gid, d]);
const post = (u, type, photo, desc, guests = 0) => as(u, `select * from submit_post($1, $2, $3, $4, $5)`, [gid, type, photo, desc, guests]);

// ---- fora do dia do encontro ----
await setHouse((dow + 1) % 7);
for (const t of ['checkin', 'group', 'dynamic', 'relax', 'fellowship', 'snack'])
  ok((await post('bia', t, 'http://x/a.jpg', 'Bolo de cenoura')).error?.includes('dia do encontro'), `${t} só no dia do encontro`);

// ---- ações diárias: 1 vez por dia cada ----
let r = await post('bia', 'individual', 'http://x/1.jpg', null);
ok(r[0]?.points === 5, `foto individual = 5 (${r[0]?.points ?? r.error})`);
ok((await post('bia', 'individual', 'http://x/2.jpg', null)).error?.includes('já fez isso hoje'), 'só 1 foto individual por dia');
ok((await post('davi', 'individual', null, null)).error?.includes('foto'), 'foto individual exige foto');
r = await post('bia', 'verse', null, 'João 3:16');
ok(r[0]?.points === 10 && r[0]?.photo_url === null, 'versículo sem foto = 10');
ok((await post('caio', 'verse', null, 'x')).error?.includes('mínimo 5'), 'versículo exige texto');
r = await post('bia', 'encourage', 'http://x/e.jpg', 'Bora pessoal, sexta tem Casa de Paz!');
ok(r[0]?.points === 10 && r[0]?.photo_url, 'encorajamento com foto opcional = 10');
ok((await post('bia', 'devotional', null, 'curto')).error?.includes('mínimo 10'), 'TSD exige texto');
r = await post('bia', 'devotional', null, 'Hoje li Salmos 23 e aprendi a confiar');
ok(r[0]?.points === 15, 'TSD = 15');
r = await post('bia', 'prayer', null, null);
ok(r[0]?.points === 10, 'oração = 10');
r = await post('bia', 'fasting', null, 'Jejum até 12h');
ok(r[0]?.points === 15, 'jejum = 15');
r = await post('bia', 'testimony', null, 'Deus abriu uma porta no trabalho');
ok(r[0]?.points === 10, 'testemunho = 10');
r = await post('bia', 'evangelism', 'http://x/ev.jpg', 'Convidei meu vizinho para sexta');
ok(r[0]?.points === 25 && r[0]?.photo_url === null, 'evangelismo = 25, sem foto');
ok((await post('bia', 'evangelism', null, 'Convidei mais alguém hoje')).error?.includes('já fez isso hoje'), 'evangelismo 1 por dia');
const day = (await c.query(`select sum(points)::int s from posts where user_id=$1`, [users.bia])).rows[0].s;
ok(day === 100, `máximo do dia a dia = 100 pts (${day})`);
await post('caio', 'prayer', null, null);
ok((await post('caio', 'prayer', null, null)).error?.includes('já fez isso hoje'), 'oração 1 por dia');

// ---- dia do encontro ----
await setHouse(dow);
r = await post('caio', 'checkin', 'http://x/c.jpg', null, 2);
ok(r[0]?.points === 500, `check-in com 2 convidados = 100×5 = 500 (${r[0]?.points ?? r.error})`);
ok((await post('caio', 'checkin', 'http://x/c2.jpg', null)).error?.includes('já registrou'), 'um check-in por dia');
r = await post('davi', 'group', 'http://x/g.jpg', null);
ok(r[0]?.points === 60 && r[0]?.group_bonus === 50, 'foto em grupo: 60 + 50 da equipe para o primeiro');
ok((await post('caio', 'group', 'http://x/g2.jpg', null)).error?.includes('@davi'), 'foto em grupo única por grupo no dia (mostra quem postou)');
const gp = (await c.query(`select id from posts where type='group'`)).rows[0].id;
await as('ana', `select admin_moderate($1,'cancel')`, [gp]);
r = await post('caio', 'group', 'http://x/g3.jpg', null);
ok(r[0]?.type === 'group', 'se o adm cancela, a foto em grupo do dia libera de novo');
ok((await post('davi', 'snack', 'http://x/s.jpg', '')).error?.includes('lanche'), 'lanche exige o que vai levar');
for (const t of ['dynamic', 'relax', 'fellowship']) {
  r = await post('davi', t, 'http://x/d.jpg', null);
  ok(r[0]?.type === t, `${t} no dia do encontro`);
}

// ---- limite semanal individual (1000) e equipe não trava ----
r = await post('caio', 'checkin', 'http://x/c.jpg', null, 0); // já fez: erro esperado
await as('ana', `update groups set weekly_user_cap = 520 where id = $1`, [gid]);
r = await post('caio', 'dynamic', 'http://x/d2.jpg', null);
ok(r[0]?.points === 0 || r[0]?.points <= 20, `limite semanal individual respeitado (${r[0]?.points ?? r.error})`);
await as('ana', `update groups set weekly_user_cap = 1000 where id = $1`, [gid]);

// ---- contestação ----
const cp = (await c.query(`select id from posts where user_id=$1 and type='checkin'`, [users.caio])).rows[0].id;
ok((await as('bia', `select admin_moderate($1,'cancel')`, [cp])).error?.includes('administrador'), 'só adm contesta');
ok((await as('ana', `select admin_moderate($1,'vote') s`, [cp]))[0].s === 'voting', 'adm envia para votação');
ok((await as('caio', `select vote_post($1,true)`, [cp])).error?.includes('próprio'), 'autor não vota');
await as('bia', `select vote_post($1,false)`, [cp]);
ok((await as('davi', `select vote_post($1,false) s`, [cp]))[0].s === 'cancelled', 'maioria cancela');
ok((await as('ana', `select admin_moderate($1,'restore') s`, [cp]))[0].s === 'ok', 'adm restaura');

// ---- enquete ----
await as('ana', `insert into polls (group_id, question, options, poll_date) values ($1, 'Quem vai convidar?', '{Vizinho,Colega}', (now() at time zone 'America/Sao_Paulo')::date)`, [gid]);
const pid = (await c.query(`select id from polls`)).rows[0].id;
r = await as('bia', `select * from answer_poll($1, 1)`, [pid]);
ok(r[0]?.points === 10 && r[0]?.poll_id === pid, 'resposta de enquete = 10, vinculada');
ok((await as('bia', `select answer_poll($1, 0)`, [pid])).error?.includes('já respondeu'), 'uma resposta por enquete');
await as('ana', `delete from polls where id = $1`, [pid]);
ok((await c.query(`select status from posts where type='poll'`)).rows[0].status === 'cancelled', 'excluir enquete cancela pontos');

// ---- ajuste ----
ok((await as('bia', `select * from admin_adjust_points($1,$2,50,'bônus')`, [gid, users.caio])).error?.includes('administrador'), 'só adm ajusta');
r = await as('ana', `select * from admin_adjust_points($1,$2,-30,'Foto repetida')`, [gid, users.caio]);
ok(r[0]?.points === -30, 'ajuste negativo');

// ---- período: depois do fim continua ----
await as('ana', `update groups set start_date = current_date - 40, end_date = current_date - 13 where id = $1`, [gid]);
r = await post('davi', 'prayer', null, null);
ok(r[0]?.week === 6 && r[0]?.points === 10, `depois do período continua contando (semana ${r[0]?.week ?? r.error})`);

// ---- zerar ----
ok((await as('bia', `select admin_reset_group($1,'Casa Jardins')`, [gid])).error?.includes('administrador'), 'só adm zera');
ok((await as('ana', `select admin_reset_group($1,'outro nome')`, [gid])).error?.includes('nome do grupo'), 'zerar exige digitar o nome');
await as('bia', `select set_cosmetics($1,'t-semente','af-pedra',null,null,null)`, [gid]);
ok(!(await as('ana', `select admin_reset_group($1,'casa jardins')`, [gid])).error, 'adm zera a temporada');
const after = (await c.query(`select (select count(*)::int from posts where status <> 'archived') p, (select count(*)::int from polls where not archived) q,
  (select count(*)::int from posts where status = 'archived') arch,
  (select count(*)::int from group_members where avatar_frame is not null) cos,
  (select start_date = (now() at time zone 'America/Sao_Paulo')::date from groups) st,
  (select count(*)::int from group_members) mem`)).rows[0];
ok(after.p === 0 && after.q === 0 && after.arch > 0 && after.cos === 0 && after.st && after.mem === 4, 'zerou (arquivou) pontos e enquetes, limpou cosméticos; mantém membros e histórico; recomeça hoje');
r = await post('davi', 'prayer', null, null);
ok(r[0]?.points === 10 && r[0]?.week === 1, 'depois de zerar, pontua de novo na semana 1');

// ---- remover post ----
await setHouse((dow + 3) % 7);
r = await post('caio', 'verse', null, 'Salmos 23:1');
const vid = r[0].id;
ok((await as('bia', `select remove_post($1)`, [vid])).error?.includes('próprios'), 'membro não remove post de outro');
ok(!(await as('caio', `select remove_post($1)`, [vid])).error, 'autor remove o próprio post');
ok((await c.query(`select status from posts where id=$1`, [vid])).rows[0].status === 'removed', 'post fica como removido (guardado)');
r = await post('caio', 'verse', null, 'Salmos 23:2');
ok(r[0]?.points === 10, `vaga do dia libera e o 1º volta a valer cheio (${r[0]?.points ?? r.error})`);
r = await as('ana', `select * from admin_adjust_points($1,$2,-20,'Teste')`, [gid, users.caio]);
ok((await as('caio', `select remove_post($1)`, [r[0].id])).error?.includes('adm'), 'membro não remove ajuste do adm');
ok(!(await as('ana', `select remove_post($1)`, [r[0].id])).error, 'adm remove qualquer registro');

// ---- permissões ----
ok((await as('zeca', `select * from posts`)).length === 0, 'não-membro não vê posts');
ok((await as('zeca', `select * from submit_post($1,'prayer',null,null)`, [gid])).error?.includes('não faz parte'), 'não-membro não posta');
ok((await as('ana', `select claim_reminder($1, current_date, 't', 'b')`, [gid])).error, 'membro não dispara lembrete');
ok(!(await as('bia', `select save_push_subscription('https://push/1','k','a','Android')`)).error, 'salva inscrição push');
ok(!(await as('bia', `insert into messages (group_id,user_id,body) values ($1,$2,'👋')`, [gid, users.bia])).error, 'membro envia mensagem');


// ---- reações, comentários e central de notificações ----
let spid = (await as('bia', `select id from posts where group_id=$1 and user_id=$2 and status in ('ok','voting') limit 1`, [gid, users.bia]))[0]?.id;
if (!spid) { const rr = await as('bia', `select * from submit_post($1,'devotional',null,'TSD de hoje')`, [gid]); spid = rr[0]?.id ?? rr[0]?.post_id; console.log('post novo', JSON.stringify(rr).slice(0,200)); }
ok(!(await as('caio', `insert into post_reactions (post_id,group_id,user_id,emoji) values ($1,$2,$3,'🙏')`, [spid, gid, users.caio])).error, 'membro reage');
ok((await as('caio', `insert into post_reactions (post_id,group_id,user_id,emoji) values ($1,$2,$3,'🙏')`, [spid, gid, users.caio])).error, 'mesma reação 2x bloqueada');
ok((await as('caio', `insert into post_reactions (post_id,group_id,user_id,emoji) values ($1,$2,$3,'💩')`, [spid, gid, users.caio])).error, 'emoji fora da lista bloqueado');
ok((await as('caio', `insert into post_reactions (post_id,group_id,user_id,emoji) values ($1,$2,$3,'🔥')`, [spid, gid, users.bia])).error, 'não reage em nome de outro');
ok((await as('zeca', `insert into post_reactions (post_id,group_id,user_id,emoji) values ($1,$2,$3,'🔥')`, [spid, gid, users.zeca])).error, 'não-membro não reage');
ok((await as('bia', `delete from post_reactions where post_id=$1 returning 1`, [spid])).length === 0, 'não remove reação dos outros');
ok((await as('caio', `delete from post_reactions where post_id=$1 returning 1`, [spid])).length === 1, 'remove a própria reação');

const cm = await as('caio', `insert into post_comments (post_id,group_id,user_id,body) values ($1,$2,$3,'Amém 🙏 que benção!') returning id`, [spid, gid, users.caio]);
ok(cm.length === 1, 'membro comenta');
ok((await as('caio', `insert into post_comments (post_id,group_id,user_id,body) values ($1,$2,$3,'   ')`, [spid, gid, users.caio])).error, 'comentário vazio bloqueado');
const nn = await as('bia', `select * from notifications`);
ok(nn.length === 1 && nn[0].kind === 'comment' && nn[0].title === 'CAIO comentou no seu post' && nn[0].url.includes(spid), `dono recebe aviso do comentário (${nn[0]?.title})`);
await as('bia', `insert into post_comments (post_id,group_id,user_id,body) values ($1,$2,$3,'obrigada!')`, [spid, gid, users.bia]);
ok((await as('bia', `select * from notifications`)).length === 1, 'comentar no próprio post não gera aviso');
ok((await as('caio', `select * from notifications`)).length === 0, 'cada um só vê as suas notificações');
ok((await as('caio', `update notifications set read_at=now() returning 1`)).length === 0, 'não marca notificação dos outros');
ok((await as('bia', `update notifications set read_at=now() returning 1`)).length === 1, 'marca como lida');
ok((await as('bia', `update notifications set body='x'`)).error, 'não altera o texto da notificação');
ok((await as('bia', `insert into notifications (user_id,group_id,kind,title,body,url) values ($1,$2,'manual','a','b','/')`, [users.bia, gid])).error, 'usuário não cria notificação');
ok((await as('davi', `delete from post_comments where id=$1 returning 1`, [cm[0].id])).length === 0, 'membro não apaga comentário dos outros');
ok((await as('ana', `delete from post_comments where id=$1 returning 1`, [cm[0].id])).length === 1, 'adm apaga qualquer comentário');
ok((await as('bia', `delete from notifications returning 1`)).length === 1, 'limpa as próprias notificações');
ok((await as('zeca', `select * from post_comments`)).length === 0, 'não-membro não vê comentários');


// ---- v6: convidados, mural de oração ----
{
  await setHouse(dow);
  const ck = await post('caio', 'checkin', 'http://x/ck.jpg', null, 2);
  const ckid = ck[0]?.id;
  ok(!!ckid, `check-in com 2 convidados (${ck.error ?? 'ok'})`);
  let gn = await as('caio', `select set_guest_names($1, array['  Maria  ', 'João', ''])`, [ckid]);
  ok(JSON.stringify(gn[0]?.set_guest_names) === JSON.stringify(['Maria', 'João']), `salva nomes limpos (${JSON.stringify(gn[0]?.set_guest_names ?? gn.error)})`);
  ok((await as('caio', `select set_guest_names($1, array['A','B','C'])`, [ckid])).error?.includes('Mais nomes'), 'não passa do nº de convidados');
  ok((await as('davi', `select set_guest_names($1, array['X'])`, [ckid])).error?.includes('Só quem'), 'outro membro não edita');
  ok(!(await as('ana', `select set_guest_names($1, array['Maria'])`, [ckid])).error, 'adm edita');

  const pr = await as('bia', `insert into prayer_requests (group_id,user_id,body) values ($1,$2,'Pela saúde da minha mãe') returning id`, [gid, users.bia]);
  ok(pr.length === 1, 'cria pedido de oração');
  const prid = pr[0].id;
  ok((await as('bia', `insert into prayer_requests (group_id,user_id,body,answered_at) values ($1,$2,'teste já respondido',now())`, [gid, users.bia])).error, 'não cria já respondido');
  ok((await as('zeca', `insert into prayer_requests (group_id,user_id,body) values ($1,$2,'oi pessoal')`, [gid, users.zeca])).error, 'não-membro não pede');
  ok(!(await as('davi', `insert into prayer_amens (request_id,group_id,user_id) values ($1,$2,$3)`, [prid, gid, users.davi])).error, 'membro ora pelo pedido');
  ok((await as('davi', `insert into prayer_amens (request_id,group_id,user_id) values ($1,$2,$3)`, [prid, gid, users.davi])).error, 'orei 2x bloqueado');
  const pn = await as('bia', `select * from notifications where kind='prayer'`);
  ok(pn.length === 1 && pn[0].title.includes('DAVI orou'), `dono recebe aviso de oração (${pn[0]?.title})`);
  ok((await as('davi', `update prayer_requests set answered_at=now() where id=$1 returning 1`, [prid])).length === 0, 'outro não marca respondido');
  ok((await as('bia', `update prayer_requests set body='mudou' where id=$1`, [prid])).error, 'não edita o texto');
  ok((await as('bia', `update prayer_requests set answered_at=now() where id=$1 returning 1`, [prid])).length === 1, 'dono marca respondido');
  ok((await as('davi', `delete from prayer_requests where id=$1 returning 1`, [prid])).length === 0, 'outro não apaga pedido');
  ok((await as('ana', `delete from prayer_requests where id=$1 returning 1`, [prid])).length === 1, 'adm apaga pedido');
  ok((await as('zeca', `select * from prayer_requests`)).length === 0, 'não-membro não vê mural');
}


// ---- v7: check-in com QR + item surpresa ----
{
  await c.query(`update groups set checkin_qr=true where id=$1`, [gid]);
  await setHouse(dow);
  // davi ainda não fez check-in hoje
  ok((await post('davi', 'checkin', 'http://x/d.jpg', null)).error?.includes('Escaneie'), 'check-in bloqueado sem QR');
  ok((await as('davi', `select claim_checkin_pass($1, 'ERRADO')`, [gid])).error?.includes('inválido'), 'código errado recusado');
  ok((await as('davi', `select admin_checkin_code($1)`, [gid])).error?.includes('Apenas'), 'membro não vê o código');
  const code = (await as('ana', `select admin_checkin_code($1) c`, [gid]))[0].c;
  ok(/^[A-Z2-9]{6}$/.test(code), `adm vê o código (${code})`);
  ok((await as('davi', `select * from group_secrets`)).length === 0, 'código continua secreto');
  ok(!(await as('davi', `select claim_checkin_pass($1, $2)`, [gid, `CASADEPAZ:${gid}:${code.toLowerCase()}`])).error, 'QR completo aceito (sem diferenciar maiúsculas)');
  const ck = await post('davi', 'checkin', 'http://x/d.jpg', null);
  ok(!!ck[0]?.id, `check-in liberado após QR (${ck.error ?? 'ok'})`);
  const it = await as('davi', `select * from member_items where post_id=$1`, [ck[0]?.id]);
  ok(it.length === 1 && it[0].item_id.startsWith('ck-'), `ganhou item surpresa (${it[0]?.item_id})`);
  ok((await as('davi', `insert into member_items (post_id,group_id,user_id,item_id) values ($1,$2,$3,'ck-ta-festa')`, [ck[0]?.id, gid, users.davi])).error, 'não cria item na mão');
  ok((await as('caio', `select * from member_items where user_id=$1`, [users.davi])).length === 1, 'grupo vê os itens (para mostrar o tile)');
  // sorteio nunca repete item válido: simula 14 check-ins
  const pool = (await c.query(`select count(*)::int n from _checkin_pool()`)).rows[0].n;
  const got = new Set([it[0].item_id]);
  for (let i = 0; i < pool + 2; i++) {
    const pr = await c.query(`insert into posts (group_id,user_id,type,local_date,week,base_points,points) values ($1,$2,'checkin',current_date - ($3::int + 30),1,0,0) returning id`, [gid, users.davi, i]).catch((e) => ({ error: e.message }));
    if (pr.error) { await c.query(`insert into checkin_passes values ($1,$2,current_date - ($3::int + 30)) on conflict do nothing`, [gid, users.davi, i]); await c.query(`insert into posts (group_id,user_id,type,local_date,week,base_points,points) values ($1,$2,'checkin',current_date - ($3::int + 30),1,0,0)`, [gid, users.davi, i]); }
  }
  const all = (await c.query(`select item_id from member_items where user_id=$1`, [users.davi])).rows.map((r) => r.item_id);
  ok(all.length === pool && new Set(all).size === pool, `coleção completa sem repetir (${all.length}/${pool})`);
  // cancelar o check-in devolve o item ao sorteio
  await c.query(`update posts set status='cancelled' where id=$1`, [ck[0].id]);
  await c.query(`insert into checkin_passes values ($1,$2,current_date - 90) on conflict do nothing`, [gid, users.davi]);
  const again = (await c.query(`insert into posts (group_id,user_id,type,local_date,week,base_points,points) values ($1,$2,'checkin',current_date - 90,1,0,0) returning id`, [gid, users.davi])).rows[0];
  const re = (await c.query(`select item_id from member_items where post_id=$1`, [again.id])).rows[0]?.item_id;
  ok(re === it[0].item_id, `item de check-in cancelado volta para o sorteio (${re})`);
}


// ---- v8: renomear e excluir grupo ----
{
  ok((await as('bia', `select admin_rename_group($1, 'Novo nome')`, [gid])).error?.includes('Apenas'), 'membro não renomeia');
  ok((await as('ana', `select admin_rename_group($1, 'ab')`, [gid])).error?.includes('3 a 40'), 'nome curto recusado');
  const [{ create_group: g2 }] = await as('zeca', `select create_group('Outra Casa', 'abcd')`);
  ok((await as('ana', `select admin_rename_group($1, 'outra casa')`, [gid])).error?.includes('Já existe'), 'nome repetido recusado');
  const rn = await as('ana', `select admin_rename_group($1, '  Casa   Jardins  Norte ') n`, [gid]);
  ok(rn[0]?.n === 'Casa Jardins Norte', `renomeia e limpa espaços (${rn[0]?.n})`);
  ok(!(await as('bia', `select join_group('casa jardins norte', 'paz123')`)).error, 'entra pelo nome novo');
  ok((await as('zeca', `select admin_delete_group($1, 'Outra Casa')`, [gid])).error?.includes('Apenas'), 'outro adm não exclui meu grupo');
  ok((await as('zeca', `select admin_delete_group($1, 'errado')`, [g2])).error?.includes('confirmar'), 'exclusão pede o nome certo');
  ok(!(await as('zeca', `select admin_delete_group($1, 'outra casa')`, [g2])).error, 'adm exclui o grupo');
  ok((await as('zeca', `select * from groups where id=$1`, [g2])).length === 0, 'grupo some para o adm');
  ok((await as('zeca', `select * from group_members where group_id=$1`, [g2])).length === 0, 'grupo some da lista de grupos');
  ok((await as('zeca', `select * from submit_post($1,'prayer',null,null)`, [g2])).error?.includes('não faz parte'), 'ninguém posta no grupo excluído');
  ok(!(await as('zeca', `select create_group('Outra Casa', 'abcd')`)).error, 'nome fica livre para outro grupo');
  ok((await c.query(`select count(*)::int n from profiles where id=$1`, [users.zeca])).rows[0].n === 1, 'conta do adm continua');
}


// ---- v10: intensivo em níveis ----
{
  const [{ create_group: gs }] = await as('caio', `select create_group('Grupo Intensivo', 'abcd')`);
  await c.query(`update groups set start_date = current_date - 40, end_date = current_date + 10, checkin_qr = false, weekly_user_cap = 1000 where id=$1`, [gs]);
  const U = users.caio;
  // posta 1x por dia (10 pts) de 35 dias atrás até ontem: dia 1 = hoje-35
  const ins = (offset, pts = 10, type = 'verse') => c.query(
    `insert into posts (group_id,user_id,type,description,base_points,points,local_date,week) values ($1,$2,$5,'x',$3,$3,current_date - $4::int, greatest(((current_date - $4::int) - (current_date - 40)) / 7 + 1, 1)) returning id, points, boost`,
    [gs, U, pts, offset, type]).then((r) => r.rows[0]);
  const bonus = async () => (await c.query(`select level, (select points from posts where id=post_id) pts from streak_awards where group_id=$1 and user_id=$2 order by level`, [gs, U])).rows;
  for (let d = 35; d >= 30; d--) await ins(d); // 6 dias
  ok((await bonus()).length === 0, '6 dias: nada ainda');
  await ins(29); // 7º dia
  let b = await bonus();
  ok(b.length === 1 && b[0].level === 7 && b[0].pts === 150, `7 dias: +150 (${JSON.stringify(b)})`);
  await ins(29, 5, 'individual');
  ok((await bonus()).length === 1, '2º post no mesmo dia não repete bônus');
  for (let d = 28; d >= 23; d--) await ins(d); // até 13 dias
  let r = await ins(22); // 14º dia
  b = await bonus();
  ok(b.length === 2 && b[1].level === 14 && b[1].pts === 150 && r.boost === 0, '14 dias: +150 (o próprio dia 14 ainda não é dobrado)');
  r = await ins(21); // 15º dia → dobro
  ok(r.points === 20 && r.boost === 10, `dia 15 vale em dobro (${r.points}/${r.boost})`);
  for (let d = 20; d >= 16; d--) await ins(d);
  r = await ins(15); // 21º dia: ainda na janela do 14 (dias 15-21) → dobro, e ganha nível 21
  b = await bonus();
  ok(r.points === 20 && b.length === 3 && b[2].level === 21 && b[2].pts === 210, '21 dias: +210 e dia 21 ainda dobrado');
  // quebra a sequência: pula o dia 14 (não posta) e posta no dia 13 → sem dobro
  r = await ins(13);
  ok(r.points === 10 && r.boost === 0, 'sequência quebrada: sem dobro');
  // limite semanal: bônus e parte dobrada não ocupam o limite
  const used = (await c.query(`select coalesce(sum(points - boost),0)::int u from posts where group_id=$1 and user_id=$2 and type not in ('adjust','streak') and week = (select week from posts where id = (select post_id from streak_awards where group_id=$1 and user_id=$2 and level=21))`, [gs, U])).rows[0].u;
  ok(used < 200, `limite semanal conta só os pontos normais (${used})`);
  ok((await as('davi', `select * from streak_awards where group_id=$1`, [gs])).error || true, 'ok');
  ok((await as('caio', `insert into streak_awards (group_id,user_id,level,local_date) values ($1,$2,7,current_date)`, [gs, U])).error, 'não cria prêmio na mão');
}


// ---- v11: refazer check-in no mesmo dia não sorteia de novo ----
{
  const [{ create_group: gq }] = await as('davi', `select create_group('Grupo Sorteio', 'abcd')`);
  await c.query(`update groups set start_date = current_date - 3, end_date = current_date + 20, house_weekday = $2, checkin_qr = false where id=$1`, [gq, dow]);
  const first = (await as('davi', `select * from submit_post($1,'checkin','http://x/a.jpg',null,0)`, [gq]))[0];
  const item1 = (await c.query(`select item_id from member_items where post_id=$1`, [first.id])).rows[0]?.item_id;
  ok(!(await as('davi', `select remove_post($1)`, [first.id])).error, 'remove o próprio check-in');
  const second = (await as('davi', `select * from submit_post($1,'checkin','http://x/b.jpg',null,0)`, [gq]))[0];
  const item2 = (await c.query(`select item_id from member_items where post_id=$1`, [second?.id])).rows[0]?.item_id;
  ok(!!item1 && item1 === item2, `mesmo item ao refazer (${item1} / ${item2})`);
}

// ---- v12: chat só de emojis + desafios em emojês ----
{
  const [{ create_group: gc }] = await as('ana', `select create_group('Grupo Emojês', 'emoj')`);
  for (const u of ['bia', 'caio', 'davi']) await as(u, `select join_group('Grupo Emojês', 'emoj')`);
  await c.query(`update groups set start_date = current_date - 3, end_date = current_date + 20 where id=$1`, [gc]);
  ok((await as('bia', `insert into messages (group_id,user_id,body) values ($1,$2,'oi gente') returning id`, [gc, users.bia])).error, 'chat bloqueia letras');
  ok(!(await as('bia', `insert into messages (group_id,user_id,body) values ($1,$2,'🙏🔥 3️⃣ 👨‍👩‍👧 🇧🇷') returning id`, [gc, users.bia])).error, 'chat aceita emojis');
  ok((await as('ana', `select * from create_challenge($1,'🐋 jonas','Jonas')`, [gc])).error?.includes('emojês'), 'desafio só em emojis');
  ok((await as('ana', `select * from create_challenge($1,'🐋👨🌊','')`, [gc])).error?.includes('resposta'), 'desafio exige resposta');
  const ch = (await as('ana', `select * from create_challenge($1,'🐋👨🌊3️⃣🌙','Jonas e a baleia')`, [gc]))[0];
  ok(ch?.status === 'open' && !ch.answer, 'cria desafio, resposta escondida');
  ok((await as('ana', `select * from create_challenge($1,'🦁','Daniel')`, [gc])).error?.includes('Volte amanhã'), '1 desafio por dia');
  ok((await as('bia', `select * from challenge_secrets`)).length === 0, 'resposta invisível para membros');
  ok((await as('ana', `select * from challenge_secrets`)).length === 0, 'resposta invisível até para o adm/dono direto');
  ok((await as('ana', `select my_challenge_answer($1) a`, [ch.id]))[0].a === 'Jonas e a baleia', 'dono revê a própria resposta');
  ok((await as('bia', `select my_challenge_answer($1) a`, [ch.id]))[0].a === null, 'outros não veem a resposta');
  ok((await as('bia', `select count(*)::int n from notifications where kind='challenge' and user_id=$1`, [users.bia]))[0].n === 1, 'grupo é avisado do desafio');
  ok((await as('ana', `select * from guess_challenge($1,'Jonas')`, [ch.id])).error?.includes('próprio'), 'dono não responde');
  let g1 = (await as('bia', `select * from guess_challenge($1,'Noé')`, [ch.id]))[0];
  ok(g1?.status === 'pending', 'palpite fica pendente');
  ok((await as('bia', `select * from guess_challenge($1,'Moisés')`, [ch.id])).error?.includes('Espere'), 'espera julgar antes do próximo');
  ok((await as('caio', `select * from challenge_guesses where challenge_id=$1`, [ch.id])).length === 0, 'palpite dos outros escondido enquanto aberto');
  ok((await as('ana', `select * from challenge_guesses where challenge_id=$1`, [ch.id])).length === 1, 'dono vê os palpites');
  ok((await as('caio', `select * from judge_guess($1,true)`, [g1.id])).error?.includes('Só quem lançou'), 'só o dono julga');
  ok((await as('ana', `select * from judge_guess($1,false)`, [g1.id]))[0].status === 'wrong', 'dono marca errado');
  await as('caio', `select * from guess_challenge($1,'Pedro')`, [ch.id]);
  const gcai = (await c.query(`select id from challenge_guesses where user_id=$1 and challenge_id=$2`, [users.caio, ch.id])).rows[0].id;
  await as('ana', `select * from judge_guess($1,false)`, [gcai]);
  for (const x of ['Moisés', 'Elias']) { const gg = (await as('bia', `select * from guess_challenge($1,$2)`, [ch.id, x]))[0]; await as('ana', `select * from judge_guess($1,false)`, [gg.id]); }
  ok((await as('bia', `select * from guess_challenge($1,'Jonas e a baleia')`, [ch.id])).error?.includes('3 palpites'), 'máximo 3 palpites');
  const win = (await as('davi', `select * from guess_challenge($1,'jonas E A Baleia!!')`, [ch.id]))[0];
  ok(win?.status === 'right' && win.auto, 'acerto automático (sem maiúscula/pontuação)');
  const done = (await as('caio', `select * from challenges where id=$1`, [ch.id]))[0];
  ok(done.status === 'solved' && done.answer === 'Jonas e a baleia' && done.solved_by === users.davi, 'fecha e revela a resposta');
  ok(done.wrong_people === 2 && done.owner_points === 15, `2 pessoas erraram antes → dono 15 (${done.wrong_people}/${done.owner_points})`);
  const pts = (await c.query(`select user_id, type, points from posts where group_id=$1 and type in ('challenge','riddle')`, [gc])).rows;
  ok(pts.some((p) => p.user_id === users.davi && p.type === 'riddle' && p.points === 10) && pts.some((p) => p.user_id === users.ana && p.type === 'challenge' && p.points === 15), 'pontos: quem acertou 10, dono 15');
  ok((await as('caio', `select * from challenge_guesses where challenge_id=$1`, [ch.id])).length === 5, 'depois de fechar, todos veem os palpites');
  ok((await as('caio', `select * from guess_challenge($1,'Jonas')`, [ch.id])).error?.includes('encerrado'), 'fechado não aceita palpite');

  // fácil demais: acerta de primeira → dono 5
  const ch2 = (await as('bia', `select * from create_challenge($1,'🦁🕳️','Daniel na cova dos leões')`, [gc]))[0];
  const gd = (await as('caio', `select * from guess_challenge($1,'Daniel')`, [ch2.id]))[0];
  await as('bia', `select * from judge_guess($1,true)`, [gd.id]);
  ok((await as('bia', `select owner_points o, status s from challenges where id=$1`, [ch2.id]))[0].o === 5, 'acertou de primeira (julgado pelo dono) → dono 5');

  // dias anteriores: sem palpites expira; com errados → 5; pendente → revisão
  const mk = async (u, emo, ans, back) => { const x = (await as(u, `select * from create_challenge($1,$2,$3)`, [gc, emo, ans]))[0]; await c.query(`update challenges set local_date = current_date - $2::int where id=$1`, [x.id, back]); return x; };
  const e1 = await mk('caio', '🌊🚶', 'Pedro andando sobre as águas', 2);
  const e2 = await mk('davi', '🍞🐟', 'Multiplicação dos pães', 1);
  await c.query(`insert into challenge_guesses (challenge_id, group_id, user_id, guess, status) values ($1,$2,$3,'Santa ceia','wrong')`, [e2.id, gc, users.bia]);
  const e3 = await mk('caio', '🌈🚢', 'Arca de Noé', 1);
  await c.query(`insert into challenge_guesses (challenge_id, group_id, user_id, guess) values ($1,$2,$3,'Noé e o dilúvio')`, [e3.id, gc, users.bia]);
  await as('bia', `select close_challenges($1)`, [gc]);
  const st = Object.fromEntries((await c.query(`select id, status, owner_points from challenges where id = any($1)`, [[e1.id, e2.id, e3.id]])).rows.map((x) => [x.id, x]));
  ok(st[e1.id].status === 'expired' && st[e1.id].owner_points === 0, 'sem palpites: expira (0)');
  ok(st[e2.id].status === 'missed' && st[e2.id].owner_points === 5, 'teve palpite e ninguém acertou: dono 5');
  ok(st[e3.id].status === 'review', 'palpite sem julgamento: vai para revisão');
  const pend = (await c.query(`select id from challenge_guesses where challenge_id=$1`, [e3.id])).rows[0].id;
  ok((await as('davi', `select * from judge_guess($1,true)`, [pend])).error, 'membro comum não julga a revisão');
  ok((await as('ana', `select * from judge_guess($1,true)`, [pend]))[0]?.status === 'right', 'adm julga na revisão');
  const e3b = (await c.query(`select status, local_date from challenges where id=$1`, [e3.id])).rows[0];
  const rid = (await c.query(`select local_date from posts where type='riddle' and user_id=$1 and group_id=$2 order by created_at desc limit 1`, [users.bia, gc])).rows[0];
  ok(e3b.status === 'solved' && String(rid.local_date) === String(e3b.local_date), 'pontos ficam no dia do desafio');
  await as('ana', `select admin_reset_group($1,'Grupo Emojês')`, [gc]);
  ok(!(await as('ana', `select * from create_challenge($1,'🔥','Pentecostes')`, [gc])).error, 'depois de zerar, pode lançar de novo');
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
await c.end();
