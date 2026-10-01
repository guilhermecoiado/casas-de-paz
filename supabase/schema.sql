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
    from posts where group_id = g.id and user_id = p_user and week = p_week and status <> 'cancelled';
  select coalesce(sum(points + group_bonus), 0) into g_used
    from posts where group_id = g.id and week = p_week and status <> 'cancelled';
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
       and local_date = v_today and status <> 'cancelled';
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
         and local_date = v_today and status <> 'cancelled';
      if v_count >= 3 then raise exception 'Limite de 3 registros de evangelismo por dia'; end if;
      p_photo_url := null;
    else
      if p_photo_url is null then raise exception 'Esta ação precisa de uma foto'; end if;
      if p_type = 'snack' and coalesce(length(p_description), 0) < 2 then
        raise exception 'Conte o que você vai levar para o lanche';
      end if;
      select count(*) into v_count from posts
       where group_id = p_group and user_id = auth.uid() and type = p_type
         and local_date = v_today and status <> 'cancelled';
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
