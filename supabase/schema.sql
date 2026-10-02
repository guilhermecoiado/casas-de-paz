-- =====================================================================
--  CASAS DE PAZ — schema completo
--  Execute este arquivo inteiro no Supabase: SQL Editor → New query → Run
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- PERFIS
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  name        text not null check (length(trim(name)) between 1 and 60),
  bio         text not null default '' check (length(bio) <= 160),
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, name)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'username')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.username_available(p_username text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(trim(p_username)));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- GRUPOS
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) between 3 and 40),
  admin_id         uuid not null references public.profiles(id),
  start_date       date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  end_date         date not null default ((now() at time zone 'America/Sao_Paulo')::date + 27),
  house_weekday    int  not null default 5 check (house_weekday between 0 and 6),
  post_mode        text not null default 'all' check (post_mode in ('all', 'selected')),
  post_weekdays    int[] not null default '{0,1,2,3,4,5,6}',
  weekly_user_cap  int  not null default 250 check (weekly_user_cap > 0),
  weekly_group_cap int  not null default 2000 check (weekly_group_cap > 0),
  points           jsonb not null default
    '{"individual":10,"group":15,"group_bonus":10,"dynamic":12,"relax":8,"fellowship":12,"snack":15,"evangelism":20,"checkin":40,"poll":5}',
  background_url   text,
  timezone         text not null default 'America/Sao_Paulo',
  created_at       timestamptz not null default now(),
  check (end_date >= start_date)
);
create unique index if not exists groups_name_unique on public.groups (lower(name));

-- senha do grupo fica numa tabela sem acesso público
create table if not exists public.group_secrets (
  group_id      uuid primary key references public.groups(id) on delete cascade,
  password_hash text not null
);

create table if not exists public.group_members (
  group_id     uuid not null references public.groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  title        text,
  avatar_frame text,
  tile_frame   text,
  tile_color   text,
  tile_anim    text,
  primary key (group_id, user_id)
);

-- ---------------------------------------------------------------------
-- POSTS (toda ação que vale ponto vira um post)
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  type         text not null check (type in
               ('individual','group','dynamic','relax','fellowship','snack','evangelism','checkin','poll')),
  photo_url    text,
  description  text check (length(description) <= 500),
  guests       int  not null default 0,
  base_points  int  not null default 0,   -- valor cheio da ação
  points       int  not null default 0,   -- pontos efetivamente concedidos (após limites)
  group_bonus  int  not null default 0,   -- bônus extra só para a equipe (foto em grupo)
  capped       boolean not null default false,
  local_date   date not null,
  week         int  not null,
  status       text not null default 'ok' check (status in ('ok','voting','cancelled')),
  created_at   timestamptz not null default now()
);
create index if not exists posts_group_created on public.posts (group_id, created_at desc);
create index if not exists posts_group_week on public.posts (group_id, week);

create table if not exists public.post_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  keep       boolean not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------
-- ENQUETES E CHAT
-- ---------------------------------------------------------------------
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  question   text not null check (length(trim(question)) between 3 and 200),
  options    text[] not null check (array_length(options, 1) between 2 and 6),
  poll_date  date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_answers (
  poll_id      uuid not null references public.polls(id) on delete cascade,
  group_id     uuid not null references public.groups(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  option_index int  not null,
  created_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_group_created on public.messages (group_id, created_at desc);

-- ---------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------
create or replace function public.is_member(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

create or replace function public.is_admin(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from groups where id = g and admin_id = auth.uid());
$$;

create or replace function public._weeks(g public.groups)
returns int language sql stable as $$
  select greatest(ceil((g.end_date - g.start_date + 1) / 7.0)::int, 1);
$$;

create or replace function public._week(g public.groups, d date)
returns int language sql stable as $$
  select least(greatest((d - g.start_date) / 7 + 1, 1), public._weeks(g));
$$;

-- Aplica os limites semanais (individual e da equipe) a uma pontuação
create or replace function public._award(
  g public.groups, p_user uuid, p_week int, p_base int, p_bonus int,
  out o_points int, out o_bonus int)
language plpgsql security definer set search_path = public as $$
declare u_used int; g_used int; u_left int; g_left int;
begin
  -- serializa pontuações do mesmo grupo (evita estourar o limite com posts simultâneos)
  perform pg_advisory_xact_lock(hashtext(g.id::text));
  select coalesce(sum(points), 0) into u_used
    from posts where group_id = g.id and user_id = p_user and week = p_week and status not in ('cancelled','archived','removed');
  select coalesce(sum(points + group_bonus), 0) into g_used
    from posts where group_id = g.id and week = p_week and status not in ('cancelled','archived','removed');
  u_left := greatest(g.weekly_user_cap - u_used, 0);
  g_left := greatest(g.weekly_group_cap - g_used, 0);
  o_points := greatest(least(p_base, u_left, g_left), 0);
  o_bonus  := greatest(least(p_bonus, g_left - o_points), 0);
end $$;
revoke execute on function public._award(public.groups, uuid, int, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- RPCs: GRUPOS
-- ---------------------------------------------------------------------
create or replace function public.create_group(p_name text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if length(trim(p_name)) < 3 then raise exception 'O nome do grupo precisa de pelo menos 3 letras'; end if;
  if length(p_password) < 4 then raise exception 'A senha do grupo precisa de pelo menos 4 caracteres'; end if;
  if exists (select 1 from groups where lower(name) = lower(trim(p_name))) then
    raise exception 'Já existe um grupo com esse nome';
  end if;
  insert into groups (name, admin_id) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into group_secrets (group_id, password_hash) values (v_id, crypt(p_password, gen_salt('bf')));
  insert into group_members (group_id, user_id) values (v_id, auth.uid());
  return v_id;
end $$;

create or replace function public.join_group(p_name text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  select g.id into v_id
    from groups g join group_secrets s on s.group_id = g.id
   where lower(g.name) = lower(trim(p_name))
     and s.password_hash = crypt(p_password, s.password_hash);
  if v_id is null then raise exception 'Nome do grupo ou senha incorretos'; end if;
  insert into group_members (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

create or replace function public.admin_set_password(p_group uuid, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  if length(p_password) < 4 then raise exception 'A senha precisa de pelo menos 4 caracteres'; end if;
  update group_secrets set password_hash = crypt(p_password, gen_salt('bf')) where group_id = p_group;
end $$;

create or replace function public.admin_remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  if p_user = auth.uid() then raise exception 'O administrador não pode se remover'; end if;
  delete from group_members where group_id = p_group and user_id = p_user;
end $$;

create or replace function public.set_cosmetics(
  p_group uuid, p_title text, p_avatar_frame text, p_tile_frame text, p_tile_color text, p_tile_anim text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update group_members
     set title = p_title, avatar_frame = p_avatar_frame, tile_frame = p_tile_frame,
         tile_color = p_tile_color, tile_anim = p_tile_anim
   where group_id = p_group and user_id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- RPC: POSTAR (valida regras do dia e calcula pontos no servidor)
-- ---------------------------------------------------------------------
create or replace function public.submit_post(
  p_group uuid, p_type text, p_photo_url text default null,
  p_description text default null, p_guests int default 0)
returns public.posts language plpgsql security definer set search_path = public as $$
declare
  g public.groups; v_today date; v_dow int; v_week int;
  v_base int; v_bonus int := 0; v_count int; v_pts int; v_b int; r public.posts;
begin
  if not is_member(p_group) then raise exception 'Você não faz parte deste grupo'; end if;
  select * into g from groups where id = p_group;
  v_today := (now() at time zone g.timezone)::date;
  if v_today < g.start_date then raise exception 'A Casa de Paz ainda não começou'; end if;
  if v_today > g.end_date   then raise exception 'O período da Casa de Paz já terminou'; end if;
  v_dow := extract(dow from v_today)::int;
  p_description := nullif(trim(coalesce(p_description, '')), '');

  if p_type = 'checkin' then
    if v_dow <> g.house_weekday then raise exception 'Check-in só no dia da Casa de Paz'; end if;
    if p_photo_url is null then raise exception 'O check-in precisa de uma foto'; end if;
    select count(*) into v_count from posts
     where group_id = p_group and user_id = auth.uid() and type = 'checkin'
       and local_date = v_today and status not in ('cancelled','archived','removed');
    if v_count > 0 then raise exception 'Você já fez check-in hoje'; end if;
    p_guests := least(greatest(coalesce(p_guests, 0), 0), 20);
    -- check-in + (2x check-in por convidado)
    v_base := (g.points->>'checkin')::int * (1 + 2 * p_guests);
  elsif p_type in ('individual','group','dynamic','relax','fellowship','snack','evangelism') then
    if g.post_mode = 'selected' and not (v_dow = any(g.post_weekdays)) and v_dow <> g.house_weekday then
      raise exception 'Hoje não é dia de postagem neste grupo';
    end if;
    if p_type = 'evangelism' then
      if coalesce(length(p_description), 0) < 10 then
        raise exception 'Conte brevemente o que aconteceu (mínimo 10 caracteres)';
      end if;
      select count(*) into v_count from posts
       where group_id = p_group and user_id = auth.uid() and type = 'evangelism'
         and local_date = v_today and status not in ('cancelled','archived','removed');
      if v_count >= 3 then raise exception 'Limite de 3 registros de evangelismo por dia'; end if;
      p_photo_url := null;
    else
      if p_photo_url is null then raise exception 'Esta ação precisa de uma foto'; end if;
      if p_type = 'snack' and coalesce(length(p_description), 0) < 2 then
        raise exception 'Conte o que você vai levar para o lanche';
      end if;
      select count(*) into v_count from posts
       where group_id = p_group and user_id = auth.uid() and type = p_type
         and local_date = v_today and status not in ('cancelled','archived','removed');
      if v_count > 0 then raise exception 'Você já registrou essa ação hoje'; end if;
    end if;
    v_base := coalesce((g.points->>p_type)::int, 0);
    if p_type = 'group' then v_bonus := coalesce((g.points->>'group_bonus')::int, 0); end if;
    p_guests := 0;
  else
    raise exception 'Tipo de post inválido';
  end if;

  v_week := _week(g, v_today);
  select a.o_points, a.o_bonus into v_pts, v_b from _award(g, auth.uid(), v_week, v_base, v_bonus) a;

  insert into posts (group_id, user_id, type, photo_url, description, guests,
                     base_points, points, group_bonus, capped, local_date, week)
  values (p_group, auth.uid(), p_type, p_photo_url, p_description, p_guests,
          v_base, v_pts, v_b, (v_pts < v_base or v_b < v_bonus), v_today, v_week)
  returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- RPC: ENQUETE
-- ---------------------------------------------------------------------
create or replace function public.answer_poll(p_poll uuid, p_option int)
returns public.posts language plpgsql security definer set search_path = public as $$
declare pl public.polls; g public.groups; v_today date; v_pts int; v_b int; v_base int; r public.posts;
begin
  select * into pl from polls where id = p_poll;
  if pl.id is null or not is_member(pl.group_id) then raise exception 'Enquete não encontrada'; end if;
  if p_option < 0 or p_option >= coalesce(array_length(pl.options, 1), 0) then raise exception 'Opção inválida'; end if;
  select * into g from groups where id = pl.group_id;
  v_today := (now() at time zone g.timezone)::date;
  if pl.poll_date <> v_today then raise exception 'Esta enquete não está aberta hoje'; end if;
  begin
    insert into poll_answers (poll_id, group_id, user_id, option_index)
    values (p_poll, pl.group_id, auth.uid(), p_option);
  exception when unique_violation then
    raise exception 'Você já respondeu esta enquete';
  end;
  v_base := case when v_today between g.start_date and g.end_date
                 then coalesce((g.points->>'poll')::int, 0) else 0 end;
  select a.o_points, a.o_bonus into v_pts, v_b from _award(g, auth.uid(), _week(g, v_today), v_base, 0) a;
  insert into posts (group_id, user_id, type, description, base_points, points, capped, local_date, week)
  values (pl.group_id, auth.uid(), 'poll', pl.question, v_base, v_pts, v_pts < v_base, v_today, _week(g, v_today))
  returning * into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- RPC: CONTESTAÇÃO DE PONTOS
-- ---------------------------------------------------------------------
-- p_action: 'cancel' (cancela direto), 'vote' (abre votação), 'close' (encerra votação), 'restore'
create or replace function public.admin_moderate(p_post uuid, p_action text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.posts; v_keep int; v_cancel int; v_new text;
begin
  select * into p from posts where id = p_post;
  if p.id is null or not is_admin(p.group_id) then raise exception 'Apenas o administrador'; end if;
  if p_action = 'cancel' then
    v_new := 'cancelled';
  elsif p_action = 'restore' then
    v_new := 'ok';
  elsif p_action = 'vote' then
    delete from post_votes where post_id = p_post;
    v_new := 'voting';
  elsif p_action = 'close' then
    if p.status <> 'voting' then raise exception 'Este post não está em votação'; end if;
    select count(*) filter (where keep), count(*) filter (where not keep)
      into v_keep, v_cancel from post_votes where post_id = p_post;
    v_new := case when v_keep >= v_cancel then 'ok' else 'cancelled' end;
  else
    raise exception 'Ação inválida';
  end if;
  update posts set status = v_new where id = p_post;
  return v_new;
end $$;

create or replace function public.vote_post(p_post uuid, p_keep boolean)
returns text language plpgsql security definer set search_path = public as $$
declare p public.posts; v_eligible int; v_keep int; v_cancel int;
begin
  select * into p from posts where id = p_post;
  if p.id is null or not is_member(p.group_id) then raise exception 'Post não encontrado'; end if;
  if p.status <> 'voting' then raise exception 'Este post não está em votação'; end if;
  if p.user_id = auth.uid() then raise exception 'Você não pode votar no seu próprio post'; end if;
  insert into post_votes (post_id, group_id, user_id, keep) values (p_post, p.group_id, auth.uid(), p_keep)
    on conflict (post_id, user_id) do update set keep = excluded.keep, created_at = now();
  select count(*) - 1 into v_eligible from group_members where group_id = p.group_id;
  select count(*) filter (where keep), count(*) filter (where not keep)
    into v_keep, v_cancel from post_votes where post_id = p_post;
  -- maioria absoluta decide automaticamente
  if v_keep * 2 > v_eligible then
    update posts set status = 'ok' where id = p_post; return 'ok';
  elsif v_cancel * 2 > v_eligible then
    update posts set status = 'cancelled' where id = p_post; return 'cancelled';
  end if;
  return 'voting';
end $$;

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_secrets enable row level security;
alter table public.group_members enable row level security;
alter table public.posts         enable row level security;
alter table public.post_votes    enable row level security;
alter table public.polls         enable row level security;
alter table public.poll_answers  enable row level security;
alter table public.messages      enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated using (is_member(id));
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (is_admin(id)) with check (admin_id = auth.uid());

drop policy if exists members_select on public.group_members;
create policy members_select on public.group_members for select to authenticated using (is_member(group_id));

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (is_member(group_id));

drop policy if exists votes_select on public.post_votes;
create policy votes_select on public.post_votes for select to authenticated using (is_member(group_id));

drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select to authenticated using (is_member(group_id));
drop policy if exists polls_insert on public.polls;
create policy polls_insert on public.polls for insert to authenticated with check (is_admin(group_id));
drop policy if exists polls_delete on public.polls;
create policy polls_delete on public.polls for delete to authenticated using (is_admin(group_id));

drop policy if exists answers_select on public.poll_answers;
create policy answers_select on public.poll_answers for select to authenticated using (is_member(group_id));

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (is_member(group_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id));

-- ---------------------------------------------------------------------
-- STORAGE (fotos)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists media_insert_own on storage.objects;
create policy media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists media_delete_own on storage.objects;
create policy media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['posts','post_votes','polls','poll_answers','messages','group_members','groups'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
-- PUSH NOTIFICATIONS
-- =====================================================================
alter table public.groups add column if not exists reminder_enabled boolean not null default true;

-- uma linha por aparelho (endpoint do navegador)
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());

-- grava/atualiza o aparelho para o usuário logado (um aparelho troca de dono ao trocar de conta)
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth, user_agent)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- histórico de envios (lembretes automáticos e avisos do adm)
create table if not exists public.push_log (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.groups(id) on delete cascade,
  kind       text not null check (kind in ('reminder', 'manual')),
  title      text not null,
  body       text not null,
  sent_by    uuid references public.profiles(id) on delete set null,
  recipients int  not null default 0,
  devices    int  not null default 0,
  local_date date not null,
  created_at timestamptz not null default now()
);
-- garante no máximo 1 lembrete automático por grupo por dia
create unique index if not exists push_log_reminder_once on public.push_log (group_id, local_date) where kind = 'reminder';
alter table public.push_log enable row level security;
drop policy if exists push_log_admin on public.push_log;
create policy push_log_admin on public.push_log for select to authenticated using (is_admin(group_id));

-- usada pelo agendador (service role): reserva o lembrete do dia; devolve false se já foi enviado
create or replace function public.claim_reminder(p_group uuid, p_date date, p_title text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into push_log (group_id, kind, title, body, local_date)
  values (p_group, 'reminder', p_title, p_body, p_date)
  on conflict (group_id, local_date) where kind = 'reminder' do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.claim_reminder(uuid, date, text, text) from public, anon, authenticated;
grant execute on function public.claim_reminder(uuid, date, text, text) to service_role;

-- =====================================================================
-- PERMISSÕES: funções só para usuários logados (exceto checagem de @usuário)
-- =====================================================================
alter function public._weeks(public.groups) set search_path = public;
alter function public._week(public.groups, date) set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_member(uuid) from anon;
revoke execute on function public.is_admin(uuid) from anon;
revoke execute on function public.create_group(text, text) from public, anon;
revoke execute on function public.join_group(text, text) from public, anon;
revoke execute on function public.admin_set_password(uuid, text) from public, anon;
revoke execute on function public.admin_remove_member(uuid, uuid) from public, anon;
revoke execute on function public.set_cosmetics(uuid, text, text, text, text, text) from public, anon;
revoke execute on function public.submit_post(uuid, text, text, text, int) from public, anon;
revoke execute on function public.answer_poll(uuid, int) from public, anon;
revoke execute on function public.admin_moderate(uuid, text) from public, anon;
revoke execute on function public.vote_post(uuid, boolean) from public, anon;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;

grant execute on function public.create_group(text, text), public.join_group(text, text),
  public.admin_set_password(uuid, text), public.admin_remove_member(uuid, uuid),
  public.set_cosmetics(uuid, text, text, text, text, text), public.submit_post(uuid, text, text, text, int),
  public.answer_poll(uuid, int), public.admin_moderate(uuid, text), public.vote_post(uuid, boolean),
  public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text),
  public.is_member(uuid), public.is_admin(uuid)
  to authenticated;

-- =====================================================================
-- CONTESTAÇÃO AMPLIADA: pontos de enquete vinculados + ajuste manual do adm
-- =====================================================================

-- novo tipo de lançamento: ajuste manual (positivo ou negativo) feito pelo adm
alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts add constraint posts_type_check check (type in
  ('individual','group','dynamic','relax','fellowship','snack','evangelism','checkin','poll','adjust'));

-- resposta de enquete passa a apontar para a enquete
alter table public.posts add column if not exists poll_id uuid references public.polls(id) on delete set null;
create index if not exists posts_poll on public.posts (poll_id) where poll_id is not null;

-- vincula respostas antigas à enquete pela pergunta
update public.posts p set poll_id = pl.id
  from public.polls pl
 where p.type = 'poll' and p.poll_id is null and pl.group_id = p.group_id and pl.question = p.description;

-- respostas de enquetes que já foram excluídas: cancela os pontos
update public.posts set status = 'cancelled'
 where type = 'poll' and poll_id is null and status not in ('cancelled','archived','removed');

-- ao excluir uma enquete, cancela os pontos das respostas (o adm pode restaurar pelo extrato)
create or replace function public.cancel_poll_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update posts set status = 'cancelled' where poll_id = old.id and status not in ('cancelled','archived','removed');
  return old;
end $$;
revoke execute on function public.cancel_poll_points() from public, anon, authenticated;
drop trigger if exists polls_cancel_points on public.polls;
create trigger polls_cancel_points before delete on public.polls
  for each row execute function public.cancel_poll_points();

-- resposta de enquete grava o poll_id
create or replace function public.answer_poll(p_poll uuid, p_option int)
returns public.posts language plpgsql security definer set search_path = public as $$
declare pl public.polls; g public.groups; v_today date; v_pts int; v_b int; v_base int; r public.posts;
begin
  select * into pl from polls where id = p_poll;
  if pl.id is null or not is_member(pl.group_id) then raise exception 'Enquete não encontrada'; end if;
  if p_option < 0 or p_option >= coalesce(array_length(pl.options, 1), 0) then raise exception 'Opção inválida'; end if;
  select * into g from groups where id = pl.group_id;
  v_today := (now() at time zone g.timezone)::date;
  if pl.poll_date <> v_today then raise exception 'Esta enquete não está aberta hoje'; end if;
  begin
    insert into poll_answers (poll_id, group_id, user_id, option_index)
    values (p_poll, pl.group_id, auth.uid(), p_option);
  exception when unique_violation then
    raise exception 'Você já respondeu esta enquete';
  end;
  v_base := case when v_today between g.start_date and g.end_date
                 then coalesce((g.points->>'poll')::int, 0) else 0 end;
  select a.o_points, a.o_bonus into v_pts, v_b from _award(g, auth.uid(), _week(g, v_today), v_base, 0) a;
  insert into posts (group_id, user_id, type, description, poll_id, base_points, points, capped, local_date, week)
  values (pl.group_id, auth.uid(), 'poll', pl.question, pl.id, v_base, v_pts, v_pts < v_base, v_today, _week(g, v_today))
  returning * into r;
  return r;
end $$;
revoke execute on function public.answer_poll(uuid, int) from public, anon;
grant execute on function public.answer_poll(uuid, int) to authenticated;

-- ajustes do adm não consomem nem liberam o limite semanal
create or replace function public._award(
  g public.groups, p_user uuid, p_week int, p_base int, p_bonus int,
  out o_points int, out o_bonus int)
language plpgsql security definer set search_path = public as $$
declare u_used int; g_used int; u_left int; g_left int;
begin
  perform pg_advisory_xact_lock(hashtext(g.id::text));
  select coalesce(sum(points), 0) into u_used
    from posts where group_id = g.id and user_id = p_user and week = p_week and status not in ('cancelled','archived','removed') and type <> 'adjust';
  select coalesce(sum(points + group_bonus), 0) into g_used
    from posts where group_id = g.id and week = p_week and status not in ('cancelled','archived','removed') and type <> 'adjust';
  u_left := greatest(g.weekly_user_cap - u_used, 0);
  g_left := greatest(g.weekly_group_cap - g_used, 0);
  o_points := greatest(least(p_base, u_left, g_left), 0);
  o_bonus  := greatest(least(p_bonus, g_left - o_points), 0);
end $$;
revoke execute on function public._award(public.groups, uuid, int, int, int) from public, anon, authenticated;

-- ajuste manual: adm soma ou retira pontos de um membro, com motivo
create or replace function public.admin_adjust_points(p_group uuid, p_user uuid, p_points int, p_reason text)
returns public.posts language plpgsql security definer set search_path = public as $$
declare g public.groups; v_today date; r public.posts;
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    raise exception 'Membro não encontrado';
  end if;
  if coalesce(p_points, 0) = 0 or abs(p_points) > 1000 then raise exception 'Informe um valor entre -1000 e 1000 (diferente de zero)'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Explique o motivo do ajuste'; end if;
  select * into g from groups where id = p_group;
  v_today := least(greatest((now() at time zone g.timezone)::date, g.start_date), g.end_date);
  insert into posts (group_id, user_id, type, description, base_points, points, local_date, week)
  values (p_group, p_user, 'adjust', left(trim(p_reason), 500), p_points, p_points, v_today, _week(g, v_today))
  returning * into r;
  return r;
end $$;
revoke execute on function public.admin_adjust_points(uuid, uuid, int, text) from public, anon;
grant execute on function public.admin_adjust_points(uuid, uuid, int, text) to authenticated;

-- =====================================================================
-- REGRAS v2: dia do encontro × ações diárias, meta de 1000/semana,
-- total da equipe proporcional aos membros, temporada sem fim automático
-- =====================================================================

alter table public.posts drop constraint if exists posts_type_check;
alter table public.posts add constraint posts_type_check check (type in
  ('individual','group','dynamic','relax','fellowship','snack','evangelism','checkin','poll','adjust',
   'verse','encourage','devotional','prayer','fasting','testimony'));

-- configurações novas do grupo
alter table public.groups add column if not exists group_cap_auto boolean not null default true;
alter table public.groups add column if not exists group_cap_factor numeric not null default 0.6
  check (group_cap_factor > 0 and group_cap_factor <= 1);
alter table public.groups add column if not exists diminishing boolean not null default true;
alter table public.groups alter column weekly_user_cap set default 1000;
alter table public.groups alter column points set default
  '{"checkin":100,"group":50,"group_bonus":50,"dynamic":30,"relax":20,"fellowship":30,"snack":40,"individual":10,"verse":10,"encourage":15,"devotional":20,"prayer":10,"fasting":25,"testimony":20,"evangelism":30,"poll":10}';

-- semana sem teto: depois do período, a contagem continua (semana 5, 6...)
create or replace function public._week(g public.groups, d date)
returns int language sql stable set search_path = public as $$
  select greatest((d - g.start_date) / 7 + 1, 1);
$$;

-- limite individual por semana; o limite da equipe só controla o avanço da casa (calculado no app)
create or replace function public._award(
  g public.groups, p_user uuid, p_week int, p_base int, p_bonus int,
  out o_points int, out o_bonus int)
language plpgsql security definer set search_path = public as $$
declare u_used int;
begin
  perform pg_advisory_xact_lock(hashtext(g.id::text || p_user::text));
  select coalesce(sum(points), 0) into u_used
    from posts where group_id = g.id and user_id = p_user and week = p_week and status not in ('cancelled','archived','removed') and type <> 'adjust';
  o_points := greatest(least(p_base, g.weekly_user_cap - u_used), 0);
  o_bonus  := greatest(p_bonus, 0);
end $$;
revoke execute on function public._award(public.groups, uuid, int, int, int) from public, anon, authenticated;

create or replace function public.submit_post(
  p_group uuid, p_type text, p_photo_url text default null,
  p_description text default null, p_guests int default 0)
returns public.posts language plpgsql security definer set search_path = public as $$
declare
  g public.groups; v_today date; v_dow int; v_week int;
  v_base int; v_bonus int := 0; v_count int; v_pts int; v_b int; v_len int; v_who text; r public.posts;
begin
  if not is_member(p_group) then raise exception 'Você não faz parte deste grupo'; end if;
  select * into g from groups where id = p_group;
  v_today := (now() at time zone g.timezone)::date;
  if v_today < g.start_date then raise exception 'A Casa de Paz ainda não começou'; end if;
  v_dow := extract(dow from v_today)::int;
  p_description := nullif(trim(coalesce(p_description, '')), '');
  v_len := coalesce(length(p_description), 0);
  p_guests := 0 + case when p_type = 'checkin' then least(greatest(coalesce(p_guests, 0), 0), 20) else 0 end;

  -- serializa por grupo (foto em grupo única e contagem diária consistente)
  perform pg_advisory_xact_lock(hashtext(p_group::text));

  if p_type in ('checkin','group','dynamic','relax','fellowship','snack') then
    /* ---------- só no dia do encontro, 1 por pessoa ---------- */
    if v_dow <> g.house_weekday then raise exception 'Esta ação só pode ser postada no dia do encontro'; end if;
    if p_photo_url is null then raise exception 'Esta ação precisa de uma foto'; end if;
    if p_type = 'snack' and v_len < 2 then raise exception 'Conte o que você vai levar para o lanche'; end if;
    select count(*) into v_count from posts
     where group_id = p_group and user_id = auth.uid() and type = p_type and local_date = v_today and status not in ('cancelled','archived','removed');
    if v_count > 0 then raise exception 'Você já registrou essa ação hoje'; end if;
    if p_type = 'group' then
      select pr.username into v_who from posts po join profiles pr on pr.id = po.user_id
       where po.group_id = p_group and po.type = 'group' and po.local_date = v_today and po.status not in ('cancelled','archived','removed') limit 1;
      if v_who is not null then raise exception 'A foto em grupo de hoje já foi postada por @%', v_who; end if;
      v_bonus := coalesce((g.points->>'group_bonus')::int, 0);
    end if;
    if p_type = 'checkin' then
      v_base := coalesce((g.points->>'checkin')::int, 0) * (1 + 2 * p_guests);
    else
      v_base := coalesce((g.points->>p_type)::int, 0);
    end if;

  elsif p_type in ('individual','verse','encourage','devotional','prayer','fasting','testimony','evangelism') then
    /* ---------- ações do dia a dia: 1 por dia de cada ---------- */
    if g.post_mode = 'selected' and not (v_dow = any(g.post_weekdays)) and v_dow <> g.house_weekday then
      raise exception 'Hoje não é dia de postagem neste grupo';
    end if;
    select count(*) into v_count from posts
     where group_id = p_group and user_id = auth.uid() and type = p_type and local_date = v_today and status not in ('cancelled','archived','removed');
    if v_count >= 1 then raise exception 'Você já fez isso hoje. Volte amanhã!'; end if;
    if p_type = 'individual' and p_photo_url is null then raise exception 'A foto individual precisa de uma foto'; end if;
    if p_type = 'evangelism' then p_photo_url := null; end if;
    if p_type in ('encourage','devotional','evangelism','testimony') and v_len < 10 then
      raise exception 'Escreva um pouco mais (mínimo 10 caracteres)';
    end if;
    if p_type in ('verse','fasting') and v_len < 5 then
      raise exception 'Preencha o texto (mínimo 5 caracteres)';
    end if;
    v_base := coalesce((g.points->>p_type)::int, 0);
  else
    raise exception 'Tipo de post inválido';
  end if;

  v_week := _week(g, v_today);
  select a.o_points, a.o_bonus into v_pts, v_b from _award(g, auth.uid(), v_week, v_base, v_bonus) a;

  insert into posts (group_id, user_id, type, photo_url, description, guests,
                     base_points, points, group_bonus, capped, local_date, week)
  values (p_group, auth.uid(), p_type, p_photo_url, p_description, p_guests,
          v_base, v_pts, v_b, v_pts < v_base, v_today, v_week)
  returning * into r;
  return r;
end $$;
revoke execute on function public.submit_post(uuid, text, text, text, int) from public, anon;
grant execute on function public.submit_post(uuid, text, text, text, int) to authenticated;

-- enquete: vale pontos a partir do início (sem data final)
create or replace function public.answer_poll(p_poll uuid, p_option int)
returns public.posts language plpgsql security definer set search_path = public as $$
declare pl public.polls; g public.groups; v_today date; v_pts int; v_b int; v_base int; r public.posts;
begin
  select * into pl from polls where id = p_poll;
  if pl.id is null or not is_member(pl.group_id) then raise exception 'Enquete não encontrada'; end if;
  if p_option < 0 or p_option >= coalesce(array_length(pl.options, 1), 0) then raise exception 'Opção inválida'; end if;
  select * into g from groups where id = pl.group_id;
  v_today := (now() at time zone g.timezone)::date;
  if pl.poll_date <> v_today then raise exception 'Esta enquete não está aberta hoje'; end if;
  begin
    insert into poll_answers (poll_id, group_id, user_id, option_index)
    values (p_poll, pl.group_id, auth.uid(), p_option);
  exception when unique_violation then
    raise exception 'Você já respondeu esta enquete';
  end;
  v_base := case when v_today >= g.start_date then coalesce((g.points->>'poll')::int, 0) else 0 end;
  select a.o_points, a.o_bonus into v_pts, v_b from _award(g, auth.uid(), _week(g, v_today), v_base, 0) a;
  insert into posts (group_id, user_id, type, description, poll_id, base_points, points, capped, local_date, week)
  values (pl.group_id, auth.uid(), 'poll', pl.question, pl.id, v_base, v_pts, v_pts < v_base, v_today, _week(g, v_today))
  returning * into r;
  return r;
end $$;
revoke execute on function public.answer_poll(uuid, int) from public, anon;
grant execute on function public.answer_poll(uuid, int) to authenticated;

create or replace function public.admin_adjust_points(p_group uuid, p_user uuid, p_points int, p_reason text)
returns public.posts language plpgsql security definer set search_path = public as $$
declare g public.groups; v_today date; r public.posts;
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    raise exception 'Membro não encontrado';
  end if;
  if coalesce(p_points, 0) = 0 or abs(p_points) > 4000 then raise exception 'Informe um valor entre -4000 e 4000 (diferente de zero)'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Explique o motivo do ajuste'; end if;
  select * into g from groups where id = p_group;
  v_today := greatest((now() at time zone g.timezone)::date, g.start_date);
  insert into posts (group_id, user_id, type, description, base_points, points, local_date, week)
  values (p_group, p_user, 'adjust', left(trim(p_reason), 500), p_points, p_points, v_today, _week(g, v_today))
  returning * into r;
  return r;
end $$;
revoke execute on function public.admin_adjust_points(uuid, uuid, int, text) from public, anon;
grant execute on function public.admin_adjust_points(uuid, uuid, int, text) to authenticated;

-- zerar a temporada (só o adm): ARQUIVA pontos e enquetes (nada é apagado; dá para recuperar), limpa cosméticos e recomeça hoje
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check check (status in ('ok','voting','cancelled','archived','removed'));
alter table public.polls add column if not exists archived boolean not null default false;

create or replace function public.admin_reset_group(p_group uuid, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare g public.groups; v_today date;
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  select * into g from groups where id = p_group;
  if lower(trim(coalesce(p_confirm, ''))) <> lower(g.name) then raise exception 'Digite o nome do grupo para confirmar'; end if;
  v_today := (now() at time zone g.timezone)::date;
  update posts set status = 'archived' where group_id = p_group and status <> 'archived';
  update polls set archived = true where group_id = p_group and not archived;
  update group_members set title = null, avatar_frame = null, tile_frame = null, tile_color = null, tile_anim = null
   where group_id = p_group;
  update groups set start_date = v_today, end_date = v_today + 27 where id = p_group;
end $$;
revoke execute on function public.admin_reset_group(uuid, text) from public, anon;
grant execute on function public.admin_reset_group(uuid, text) to authenticated;


-- =====================================================================
-- REMOVER POST: o autor remove o próprio post; o adm remove o de qualquer membro.
-- O post some (status "removed", fica guardado), os pontos saem e a vaga do dia libera.
-- =====================================================================
create or replace function public.remove_post(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.posts;
begin
  select * into p from posts where id = p_post;
  if p.id is null or not is_member(p.group_id) then raise exception 'Post não encontrado'; end if;
  if p.status in ('removed', 'archived') then return; end if;
  if is_admin(p.group_id) then
    null; -- adm remove qualquer registro
  elsif p.user_id = auth.uid() then
    if p.type = 'adjust' then raise exception 'Ajustes do adm só podem ser removidos pelo adm'; end if;
  else
    raise exception 'Você só pode remover os seus próprios posts';
  end if;
  update posts set status = 'removed' where id = p_post;
end $$;
revoke execute on function public.remove_post(uuid) from public, anon;
grant execute on function public.remove_post(uuid) to authenticated;


-- =====================================================================
-- REGRAS v4: ações do dia a dia 1x por dia (máx. 100/dia = 700/semana)
-- + bônus do dia do encontro (~280) + enquetes ≈ 1000/semana
-- =====================================================================
alter table public.groups alter column points set default
  '{"checkin":100,"group":60,"group_bonus":50,"dynamic":30,"relax":20,"fellowship":30,"snack":40,"individual":5,"verse":10,"encourage":10,"devotional":15,"prayer":10,"fasting":15,"testimony":10,"evangelism":25,"poll":10}';

-- =====================================================================
-- RESUMO DE POSTS POR PUSH ("Fulano, Ciclano e mais 3 postaram")
-- =====================================================================
alter table public.groups add column if not exists digest_enabled boolean not null default true;
alter table public.groups add column if not exists digest_hours int not null default 3;
alter table public.groups add column if not exists last_digest_at timestamptz;

-- =====================================================================
-- REAÇÕES, COMENTÁRIOS E CENTRAL DE NOTIFICAÇÕES
-- =====================================================================
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('🙏', '❤️', '🔥', '🙌', '😂')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create index if not exists post_reactions_group on public.post_reactions (group_id);

create table if not exists public.post_comments (
  id         bigint generated always as identity primary key,
  post_id    uuid not null references public.posts(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post on public.post_comments (post_id, created_at);
create index if not exists post_comments_group on public.post_comments (group_id, created_at);

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  kind       text not null check (kind in ('comment', 'digest', 'reminder', 'manual')),
  title      text not null,
  body       text not null,
  url        text not null,
  actor_id   uuid references public.profiles(id) on delete set null,
  post_id    uuid,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, group_id, created_at desc);

alter table public.post_reactions enable row level security;
alter table public.post_comments  enable row level security;
alter table public.notifications  enable row level security;

-- o post precisa ser do mesmo grupo e estar visível
create or replace function public._post_in_group(p uuid, g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from posts where id = p and group_id = g and status not in ('archived', 'removed'));
$$;
revoke execute on function public._post_in_group(uuid, uuid) from anon;

drop policy if exists reactions_select on public.post_reactions;
create policy reactions_select on public.post_reactions for select to authenticated using (is_member(group_id));
drop policy if exists reactions_insert on public.post_reactions;
create policy reactions_insert on public.post_reactions for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id) and _post_in_group(post_id, group_id));
drop policy if exists reactions_delete on public.post_reactions;
create policy reactions_delete on public.post_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments for select to authenticated using (is_member(group_id));
drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id) and _post_in_group(post_id, group_id));
drop policy if exists comments_delete on public.post_comments;
create policy comments_delete on public.post_comments for delete to authenticated
  using (user_id = auth.uid() or is_admin(group_id));
revoke update on public.post_comments from authenticated;

-- cada um vê, marca como lida e limpa só as próprias notificações
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- comentário novo: avisa o dono do post na central (o push vai no resumo)
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text; v_excerpt text;
begin
  select user_id into v_owner from posts where id = new.post_id;
  if v_owner is null or v_owner = new.user_id then return new; end if;
  select split_part(trim(name), ' ', 1) into v_name from profiles where id = new.user_id;
  v_excerpt := left(regexp_replace(trim(new.body), '\s+', ' ', 'g'), 80);
  if length(trim(new.body)) > 80 then v_excerpt := v_excerpt || '…'; end if;
  insert into notifications (user_id, group_id, kind, title, body, url, actor_id, post_id)
  values (v_owner, new.group_id, 'comment', coalesce(v_name, 'Alguém') || ' comentou no seu post',
          '“' || v_excerpt || '”', '/g/' || new.group_id || '/feed?post=' || new.post_id, new.user_id, new.post_id);
  return new;
end $$;
revoke execute on function public.notify_comment() from public, anon, authenticated;
drop trigger if exists post_comments_notify on public.post_comments;
create trigger post_comments_notify after insert on public.post_comments
  for each row execute function public.notify_comment();

do $$
declare t text;
begin
  foreach t in array array['post_reactions','post_comments','notifications'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
-- DELETE em tempo real precisa da linha antiga completa
alter table public.post_reactions replica identity full;
alter table public.post_comments  replica identity full;
alter table public.notifications  replica identity full;

-- =====================================================================
-- v6: CONVIDADOS, MURAL DE ORAÇÃO, LEMBRETE DAS 20H E FECHAMENTO DA SEMANA
-- =====================================================================
alter table public.groups add column if not exists nudge_enabled boolean not null default true;
alter table public.groups add column if not exists last_nudge_date date;
alter table public.groups add column if not exists recap_enabled boolean not null default true;
alter table public.groups add column if not exists last_recap_week int;

-- nomes dos convidados do check-in (para acompanhar depois)
alter table public.posts add column if not exists guest_names text[] not null default '{}';

create or replace function public.set_guest_names(p_post uuid, p_names text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare r public.posts; v text[];
begin
  select * into r from posts where id = p_post;
  if r.id is null or r.type <> 'checkin' or r.status in ('archived', 'removed') then raise exception 'Check-in não encontrado'; end if;
  if r.user_id <> auth.uid() and not is_admin(r.group_id) then raise exception 'Só quem fez o check-in pode editar'; end if;
  select coalesce(array_agg(left(trim(n), 60)), '{}') into v
    from unnest(coalesce(p_names, '{}')) as n where length(trim(n)) > 0;
  if cardinality(v) > greatest(r.guests, 0) then raise exception 'Mais nomes do que convidados neste check-in'; end if;
  update posts set guest_names = v where id = p_post;
  return v;
end $$;
revoke execute on function public.set_guest_names(uuid, text[]) from public, anon;
grant execute on function public.set_guest_names(uuid, text[]) to authenticated;

-- mural de pedidos de oração
create table if not exists public.prayer_requests (
  id          bigint generated always as identity primary key,
  group_id    uuid not null references public.groups(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null check (length(trim(body)) between 3 and 400),
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists prayer_requests_group on public.prayer_requests (group_id, created_at desc);

create table if not exists public.prayer_amens (
  request_id bigint not null references public.prayer_requests(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
create index if not exists prayer_amens_group on public.prayer_amens (group_id);

alter table public.prayer_requests enable row level security;
alter table public.prayer_amens    enable row level security;

create or replace function public._prayer_in_group(p bigint, g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from prayer_requests where id = p and group_id = g);
$$;
revoke execute on function public._prayer_in_group(bigint, uuid) from anon;

drop policy if exists prayers_select on public.prayer_requests;
create policy prayers_select on public.prayer_requests for select to authenticated using (is_member(group_id));
drop policy if exists prayers_insert on public.prayer_requests;
create policy prayers_insert on public.prayer_requests for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id) and answered_at is null);
drop policy if exists prayers_update on public.prayer_requests;
create policy prayers_update on public.prayer_requests for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists prayers_delete on public.prayer_requests;
create policy prayers_delete on public.prayer_requests for delete to authenticated
  using (user_id = auth.uid() or is_admin(group_id));
revoke update on public.prayer_requests from authenticated;
grant update (answered_at) on public.prayer_requests to authenticated;

drop policy if exists amens_select on public.prayer_amens;
create policy amens_select on public.prayer_amens for select to authenticated using (is_member(group_id));
drop policy if exists amens_insert on public.prayer_amens;
create policy amens_insert on public.prayer_amens for insert to authenticated
  with check (user_id = auth.uid() and is_member(group_id) and _prayer_in_group(request_id, group_id));
drop policy if exists amens_delete on public.prayer_amens;
create policy amens_delete on public.prayer_amens for delete to authenticated using (user_id = auth.uid());
revoke update on public.prayer_amens from authenticated;

-- novos tipos na central
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'digest', 'reminder', 'manual', 'nudge', 'recap', 'prayer'));

-- alguém orou pelo seu pedido: avisa na central
create or replace function public.notify_amen()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text; v_body text;
begin
  select user_id, body into v_owner, v_body from prayer_requests where id = new.request_id;
  if v_owner is null or v_owner = new.user_id then return new; end if;
  select split_part(trim(name), ' ', 1) into v_name from profiles where id = new.user_id;
  insert into notifications (user_id, group_id, kind, title, body, url, actor_id)
  values (v_owner, new.group_id, 'prayer', coalesce(v_name, 'Alguém') || ' orou pelo seu pedido 🙏',
          '“' || left(v_body, 80) || case when length(v_body) > 80 then '…' else '' end || '”',
          '/g/' || new.group_id || '/oracao', new.user_id);
  return new;
end $$;
revoke execute on function public.notify_amen() from public, anon, authenticated;
drop trigger if exists prayer_amens_notify on public.prayer_amens;
create trigger prayer_amens_notify after insert on public.prayer_amens
  for each row execute function public.notify_amen();

do $$
declare t text;
begin
  foreach t in array array['prayer_requests','prayer_amens'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
alter table public.prayer_requests replica identity full;
alter table public.prayer_amens    replica identity full;

-- =====================================================================
-- v7: CHECK-IN COM QR CODE + ITEM SURPRESA
-- =====================================================================
alter table public.groups add column if not exists checkin_qr boolean not null default true;
alter table public.group_secrets add column if not exists checkin_code text;

-- código do QR (sem letras/números parecidos: 0/O, 1/I/L)
create or replace function public._new_checkin_code()
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
    from generate_series(1, 6);
$$;
update public.group_secrets set checkin_code = public._new_checkin_code() where checkin_code is null;

-- passe do dia: quem escaneou o QR pode fazer o check-in hoje
create table if not exists public.checkin_passes (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id, local_date)
);
alter table public.checkin_passes enable row level security;
drop policy if exists passes_select on public.checkin_passes;
create policy passes_select on public.checkin_passes for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.checkin_passes from authenticated, anon;

create or replace function public.claim_checkin_pass(p_group uuid, p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare g public.groups; v_today date; v_code text;
begin
  if not is_member(p_group) then raise exception 'Você não faz parte deste grupo'; end if;
  select * into g from groups where id = p_group;
  v_today := (now() at time zone g.timezone)::date;
  if extract(dow from v_today)::int <> g.house_weekday then raise exception 'O check-in só abre no dia do encontro'; end if;
  select checkin_code into v_code from group_secrets where group_id = p_group;
  -- aceita o texto do QR inteiro (CASADEPAZ:<grupo>:<código>) ou só o código digitado
  p_code := upper(regexp_replace(coalesce(p_code, ''), '^.*:', ''));
  p_code := regexp_replace(p_code, '[^A-Z0-9]', '', 'g');
  if v_code is null or p_code <> v_code then raise exception 'QR code inválido. Escaneie o QR da Casa de Paz.'; end if;
  insert into checkin_passes (group_id, user_id, local_date) values (p_group, auth.uid(), v_today)
    on conflict do nothing;
  return true;
end $$;

create or replace function public.admin_checkin_code(p_group uuid, p_rotate boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  if p_rotate then
    update group_secrets set checkin_code = _new_checkin_code() where group_id = p_group;
  end if;
  select checkin_code into v from group_secrets where group_id = p_group;
  if v is null then
    update group_secrets set checkin_code = _new_checkin_code() where group_id = p_group returning checkin_code into v;
  end if;
  return v;
end $$;

-- grupo novo já nasce com código
create or replace function public._secrets_code()
returns trigger language plpgsql as $$
begin
  if new.checkin_code is null then new.checkin_code := _new_checkin_code(); end if;
  return new;
end $$;
drop trigger if exists group_secrets_code on public.group_secrets;
create trigger group_secrets_code before insert on public.group_secrets
  for each row execute function public._secrets_code();

-- itens surpresa: 1 por check-in (o item some se o check-in for cancelado ou removido)
create table if not exists public.member_items (
  post_id    uuid primary key references public.posts(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    text not null,
  created_at timestamptz not null default now()
);
create index if not exists member_items_group on public.member_items (group_id);
alter table public.member_items enable row level security;
drop policy if exists items_select on public.member_items;
create policy items_select on public.member_items for select to authenticated using (is_member(group_id));
revoke insert, update, delete on public.member_items from authenticated, anon;

-- sorteio ponderado: comum 10, raro 5, lendário 3 (manter igual a lib/rewards.ts → drop)
create or replace function public._checkin_pool()
returns table (item_id text, weight int) language sql immutable as $$
  values
    ('ck-t-porta', 10), ('ck-t-mesa', 10), ('ck-t-lampada', 10), ('ck-t-coracao', 10),
    ('ck-ph-vem', 10), ('ck-ph-entre', 10), ('ck-ph-reunidos', 10),
    ('ck-tc-sol', 5), ('ck-tc-lavanda', 5), ('ck-tc-aurora', 5),
    ('ck-af-lampiao', 5), ('ck-af-chave', 5),
    ('ck-ta-lanternas', 3), ('ck-ta-festa', 3)
$$;

create or replace function public.checkin_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if new.type <> 'checkin' then return new; end if;
  select * into g from groups where id = new.group_id;
  if g.checkin_qr and not exists (
    select 1 from checkin_passes where group_id = new.group_id and user_id = new.user_id and local_date = new.local_date
  ) then
    raise exception 'Escaneie o QR code da Casa de Paz para fazer o check-in';
  end if;
  return new;
end $$;
drop trigger if exists posts_checkin_guard on public.posts;
create trigger posts_checkin_guard before insert on public.posts
  for each row execute function public.checkin_guard();

create or replace function public.checkin_drop()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_item text;
begin
  if new.type <> 'checkin' then return new; end if;
  -- só itens que a pessoa ainda não tem (de check-ins válidos)
  select p.item_id into v_item
    from _checkin_pool() p
   where p.item_id not in (
     select mi.item_id from member_items mi join posts po on po.id = mi.post_id
      where mi.group_id = new.group_id and mi.user_id = new.user_id
        and po.status not in ('cancelled', 'archived', 'removed'))
   order by -ln(1 - random()) / p.weight   -- sorteio ponderado
   limit 1;
  if v_item is not null then
    insert into member_items (post_id, group_id, user_id, item_id) values (new.id, new.group_id, new.user_id, v_item);
  end if;
  return new;
end $$;
drop trigger if exists posts_checkin_drop on public.posts;
create trigger posts_checkin_drop after insert on public.posts
  for each row execute function public.checkin_drop();

revoke execute on function public._new_checkin_code() from public, anon, authenticated;
revoke execute on function public.checkin_guard() from public, anon, authenticated;
revoke execute on function public.checkin_drop() from public, anon, authenticated;
revoke execute on function public._checkin_pool() from public, anon, authenticated;
revoke execute on function public.claim_checkin_pass(uuid, text) from public, anon;
grant execute on function public.claim_checkin_pass(uuid, text) to authenticated;
revoke execute on function public.admin_checkin_code(uuid, boolean) from public, anon;
grant execute on function public.admin_checkin_code(uuid, boolean) to authenticated;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.member_items';
  exception when duplicate_object then null;
  end;
end $$;

-- =====================================================================
-- v8: ADM RENOMEIA E EXCLUI O GRUPO
-- =====================================================================
create or replace function public.admin_rename_group(p_group uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  if length(v) < 3 or length(v) > 40 then raise exception 'O nome do grupo precisa ter de 3 a 40 letras'; end if;
  if exists (select 1 from groups where lower(name) = lower(v) and id <> p_group) then
    raise exception 'Já existe um grupo com esse nome';
  end if;
  update groups set name = v where id = p_group;
  return v;
end $$;

-- excluir grupo: o grupo some para todos os membros na hora (is_member/is_admin passam a ignorá-lo)
-- e o nome fica livre para outro grupo. As contas das pessoas continuam.
alter table public.groups add column if not exists deleted_at timestamptz;

create or replace function public.is_member(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members m join groups gr on gr.id = m.group_id
                  where m.group_id = g and m.user_id = auth.uid() and gr.deleted_at is null);
$$;

create or replace function public.is_admin(g uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from groups where id = g and admin_id = auth.uid() and deleted_at is null);
$$;

create or replace function public.admin_delete_group(p_group uuid, p_confirm text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin(p_group) then raise exception 'Apenas o administrador'; end if;
  select name into v_name from groups where id = p_group;
  if lower(trim(coalesce(p_confirm, ''))) <> lower(v_name) then raise exception 'Digite o nome do grupo para confirmar'; end if;
  update groups
     set deleted_at = now(),
         name = left(v_name, 40) || ' · excluído ' || left(p_group::text, 8),
         reminder_enabled = false, digest_enabled = false, nudge_enabled = false, recap_enabled = false
   where id = p_group;
end $$;

revoke execute on function public.admin_rename_group(uuid, text) from public, anon;
grant execute on function public.admin_rename_group(uuid, text) to authenticated;
revoke execute on function public.admin_delete_group(uuid, text) from public, anon;
grant execute on function public.admin_delete_group(uuid, text) to authenticated;

-- =====================================================================
-- v9: "ESQUECI MINHA SENHA" → PEDIDO PARA O ADM
-- =====================================================================
create table if not exists public.password_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists password_requests_user on public.password_requests (user_id, created_at desc);
-- só o servidor (service role) lê e escreve
alter table public.password_requests enable row level security;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'digest', 'reminder', 'manual', 'nudge', 'recap', 'prayer', 'reset'));
