// Testes das regras do banco (64 casos). Rodar contra um Postgres local vazio na porta 5499
// com o schema.sql na mesma pasta: node regras.test.mjs
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
ok((await as('bia', `select join_group('casa jardins', 'errada')`)).error?.includes('incorretos'), 'senha errada bloqueada');
for (const u of ['bia', 'caio', 'davi']) await as(u, `select join_group('Casa Jardins', 'paz123')`);
ok((await as('bia', `select * from group_secrets`)).length === 0, 'hash da senha invisível');
ok((await as('bia', `update groups set weekly_user_cap = 9999 where id = $1 returning id`, [gid])).length === 0, 'membro não altera config');
const g0 = (await c.query(`select weekly_user_cap, group_cap_auto, group_cap_factor, diminishing, points from groups where id=$1`, [gid])).rows[0];
ok(g0.weekly_user_cap === 1000 && g0.group_cap_auto && Number(g0.group_cap_factor) === 0.6 && g0.diminishing && g0.points.checkin === 100, 'padrões novos: 1000/semana, equipe automática 60%, pontos decrescentes');

const dow = (await c.query(`select extract(dow from (now() at time zone 'America/Sao_Paulo')::date)::int d`)).rows[0].d;
const setHouse = (d) => as('ana', `update groups set house_weekday = $2 where id = $1`, [gid, d]);
const post = (u, type, photo, desc, guests = 0) => as(u, `select * from submit_post($1, $2, $3, $4, $5)`, [gid, type, photo, desc, guests]);

// ---- fora do dia do encontro ----
await setHouse((dow + 1) % 7);
for (const t of ['checkin', 'group', 'dynamic', 'relax', 'fellowship', 'snack'])
  ok((await post('bia', t, 'http://x/a.jpg', 'Bolo de cenoura')).error?.includes('dia do encontro'), `${t} só no dia do encontro`);

// ---- ações diárias ----
let r = await post('bia', 'individual', 'http://x/1.jpg', null);
ok(r[0]?.points === 10, `foto individual 1ª = 10 (${r[0]?.points ?? r.error})`);
r = await post('bia', 'individual', 'http://x/2.jpg', null);
ok(r[0]?.points === 5, `2ª do dia vale 50% (${r[0]?.points ?? r.error})`);
r = await post('bia', 'individual', 'http://x/3.jpg', null);
ok(r[0]?.points === 3, `3ª do dia vale 25% (${r[0]?.points ?? r.error})`);
ok((await post('bia', 'individual', 'http://x/4.jpg', null)).error?.includes('3 vezes'), 'máximo 3 por dia');
ok((await post('davi', 'individual', null, null)).error?.includes('foto'), 'foto individual exige foto');
r = await post('bia', 'verse', null, 'João 3:16');
ok(r[0]?.points === 10 && r[0]?.photo_url === null, 'versículo sem foto = 10');
ok((await post('bia', 'verse', null, 'x')).error?.includes('mínimo 5'), 'versículo exige texto');
r = await post('bia', 'encourage', 'http://x/e.jpg', 'Bora pessoal, sexta tem Casa de Paz!');
ok(r[0]?.points === 15 && r[0]?.photo_url, 'encorajamento com foto opcional = 15');
ok((await post('bia', 'devotional', null, 'curto')).error?.includes('mínimo 10'), 'TSD exige texto');
r = await post('bia', 'devotional', null, 'Hoje li Salmos 23 e aprendi a confiar');
ok(r[0]?.points === 20, 'TSD = 20');
r = await post('bia', 'prayer', null, null);
ok(r[0]?.points === 10, 'orei pela casa de paz sem texto = 10');
r = await post('bia', 'fasting', null, 'Jejum até 12h');
ok(r[0]?.points === 25, 'jejum = 25');
r = await post('bia', 'testimony', null, 'Deus abriu uma porta no trabalho');
ok(r[0]?.points === 20, 'testemunho = 20');
for (let i = 0; i < 3; i++) r = await post('bia', 'evangelism', 'http://x/ev.jpg', 'Convidei meu vizinho para sexta');
ok(r[0]?.points === 30 && r[0]?.photo_url === null, 'evangelismo não diminui (3º ainda vale 30) e não leva foto');
ok((await post('bia', 'evangelism', null, 'Convidei mais alguém hoje')).error?.includes('3 vezes'), 'evangelismo máximo 3 por dia');

// ---- pontos decrescentes desligados ----
await as('ana', `update groups set diminishing = false where id = $1`, [gid]);
await post('caio', 'prayer', null, null);
r = await post('caio', 'prayer', null, null);
ok(r[0]?.points === 10, 'sem decrescente: 2º post vale cheio');
await as('ana', `update groups set diminishing = true where id = $1`, [gid]);

// ---- dia do encontro ----
await setHouse(dow);
r = await post('caio', 'checkin', 'http://x/c.jpg', null, 2);
ok(r[0]?.points === 500, `check-in com 2 convidados = 100×5 = 500 (${r[0]?.points ?? r.error})`);
ok((await post('caio', 'checkin', 'http://x/c2.jpg', null)).error?.includes('já registrou'), 'um check-in por dia');
r = await post('davi', 'group', 'http://x/g.jpg', null);
ok(r[0]?.points === 50 && r[0]?.group_bonus === 50, 'foto em grupo: 50 + 50 da equipe para o primeiro');
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
ok(!(await as('bia', `insert into messages (group_id,user_id,body) values ($1,$2,'oi')`, [gid, users.bia])).error, 'membro envia mensagem');

console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
await c.end();
