-- P2.1c: Engelleme (iki yönlü gizleme) ve içerik bildirme (Apple kullanıcı içeriği şartı).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Yalnızca kendi engellerini görürsün (engellendiğini öğrenemezsin).
create policy "blocks: kendi engellerini oku"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "blocks: engelle"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "blocks: engeli kaldır"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;

-- İki kullanıcı arasında (hangi yönde olursa olsun) engel var mı? (RLS'e takılmadan kontrol)
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Engelleyince iki yönlü takip ilişkileri (bekleyen istekler dahil) silinir.
create or replace function public.blocks_remove_follows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;
revoke all on function public.blocks_remove_follows() from public, anon, authenticated;

create trigger blocks_remove_follows
  after insert on public.blocks
  for each row execute function public.blocks_remove_follows();

-- Engel varken takip edilemez.
drop policy "follows: takip et" on public.follows;
create policy "follows: takip et"
  on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.is_blocked_between(follower_id, following_id)
  );

-- ---------------------------------------------------------------------------
-- Aktivite görünürlüğü: engel varsa (iki yönde) sahibi dışında kimse göremez.
-- Yorum ve alkış politikaları da engelli yazarın içeriğini gizler.
-- ---------------------------------------------------------------------------
create or replace function public.can_view_activity(p_owner uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner = (select auth.uid())
    or (
      not public.is_blocked_between((select auth.uid()), p_owner)
      and p_visibility <> 'private'
      and (
        (p_visibility = 'public'
          and not exists (select 1 from public.profiles p where p.user_id = p_owner and p.is_private))
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid()) and f.following_id = p_owner and f.status = 'accepted'
        )
      )
    );
$$;

drop policy "comments: görünür aktivitenin yorumlarını oku" on public.comments;
create policy "comments: görünür aktivitenin yorumlarını oku"
  on public.comments for select to authenticated
  using (
    exists (select 1 from public.activities a where a.id = comments.activity_id)
    and not public.is_blocked_between((select auth.uid()), user_id)
  );

drop policy "kudos: görünür aktivitenin alkışlarını oku" on public.kudos;
create policy "kudos: görünür aktivitenin alkışlarını oku"
  on public.kudos for select to authenticated
  using (
    exists (select 1 from public.activities a where a.id = kudos.activity_id)
    and not public.is_blocked_between((select auth.uid()), user_id)
  );

-- ---------------------------------------------------------------------------
-- Sorgular: engelli kullanıcılar aramada, listelerde, yorumlarda ve rota yorumlarında görünmez
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(p_query text, p_limit int default 20)
returns table (user_id uuid, username text, display_name text, avatar_url text, follow_state text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id, p.username, coalesce(p.display_name, p.username), p.avatar_url,
    public.follow_state_of(p.user_id)
  from public.profiles p
  where char_length(btrim(p_query)) >= 2
    and p.user_id <> (select auth.uid())
    and not public.is_blocked_between((select auth.uid()), p.user_id)
    and (
      p.username ilike replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%'
      or p.display_name ilike '%' || replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%'
    )
  order by (p.username ilike replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%') desc, p.username
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.follow_list(p_user uuid, p_kind text, p_limit int default 30, p_offset int default 0)
returns table (user_id uuid, username text, display_name text, avatar_url text, follow_state text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id, p.username, coalesce(p.display_name, p.username), p.avatar_url,
    public.follow_state_of(p.user_id)
  from public.follows f
  join public.profiles p
    on p.user_id = case when p_kind = 'followers' then f.follower_id else f.following_id end
  where f.status = 'accepted'
    and (case when p_kind = 'followers' then f.following_id else f.follower_id end) = p_user
    and not public.is_blocked_between((select auth.uid()), p.user_id)
    and (
      p_user = (select auth.uid())
      or not exists (select 1 from public.profiles t where t.user_id = p_user and t.is_private)
      or public.follow_state_of(p_user) = 'following'
    )
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.activity_comments(p_id uuid, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  body text,
  created_at timestamptz,
  mine boolean,
  can_delete boolean
)
language sql
stable
set search_path = public
as $$
  select
    c.id, c.user_id, p.username, coalesce(p.display_name, p.username), p.avatar_url, c.body, c.created_at,
    c.user_id = (select auth.uid()),
    (c.user_id = (select auth.uid())
      or exists (select 1 from public.activities a where a.id = c.activity_id and a.user_id = (select auth.uid())))
  from public.comments c
  join public.profiles p on p.user_id = c.user_id
  where c.activity_id = p_id
    and not public.is_blocked_between((select auth.uid()), c.user_id)
  order by c.created_at asc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.route_reviews_list(
  p_id uuid,
  p_limit int default 10,
  p_offset int default 0
)
returns table (
  id uuid,
  user_id uuid,
  rating smallint,
  comment text,
  tags text[],
  is_verified boolean,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  photos text[],
  mine boolean
)
language sql
stable
set search_path = public
as $$
  select
    rv.id, rv.user_id, rv.rating, rv.comment, rv.tags, rv.is_verified, rv.created_at,
    coalesce(p.display_name, p.username) as display_name,
    p.avatar_url,
    coalesce(
      (select array_agg(ph.url order by ph.created_at)
       from public.route_photos ph
       where ph.route_id = rv.route_id and ph.user_id = rv.user_id),
      '{}'
    ) as photos,
    rv.user_id = (select auth.uid()) as mine
  from public.route_reviews rv
  left join public.profiles p on p.user_id = rv.user_id
  where rv.route_id = p_id
    and not public.is_blocked_between((select auth.uid()), rv.user_id)
  order by (rv.user_id = (select auth.uid())) desc, rv.created_at desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0);
$$;

-- Profil kartı: beni engelleyen kişinin profili "yok" gibi davranır; engellediğim kişide blocked_by_me true.
drop function if exists public.profile_card(uuid);
create function public.profile_card(p_user uuid)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  level text,
  is_private boolean,
  followers_count int,
  following_count int,
  activity_count int,
  total_distance_m bigint,
  route_count int,
  follow_state text,
  can_view boolean,
  blocked_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id, p.username, coalesce(p.display_name, p.username), p.avatar_url, p.level, p.is_private,
    (select count(*)::int from public.follows f where f.following_id = p.user_id and f.status = 'accepted'),
    (select count(*)::int from public.follows f where f.follower_id = p.user_id and f.status = 'accepted'),
    (select count(*)::int from public.activities a
      where a.user_id = p.user_id and public.can_view_activity(a.user_id, a.visibility)),
    coalesce((select sum(a.distance_m) from public.activities a
      where a.user_id = p.user_id and public.can_view_activity(a.user_id, a.visibility)), 0)::bigint,
    (select count(*)::int from public.routes r where r.creator_id = p.user_id and r.is_public),
    public.follow_state_of(p.user_id),
    ((not p.is_private) or public.follow_state_of(p.user_id) in ('self', 'following'))
      and not exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p.user_id),
    exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p.user_id)
  from public.profiles p
  where p.user_id = p_user
    and not exists (select 1 from public.blocks b where b.blocker_id = p.user_id and b.blocked_id = (select auth.uid()));
$$;

revoke all on function public.profile_card(uuid) from public, anon;
grant execute on function public.profile_card(uuid) to authenticated;

-- Engellediklerim (Ayarlar → Engellenen kullanıcılar)
create or replace function public.blocked_users()
returns table (user_id uuid, username text, display_name text, avatar_url text)
language sql
stable
set search_path = public
as $$
  select p.user_id, p.username, coalesce(p.display_name, p.username), p.avatar_url
  from public.blocks b
  join public.profiles p on p.user_id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;

revoke all on function public.blocked_users() from public, anon;
grant execute on function public.blocked_users() to authenticated;

-- ---------------------------------------------------------------------------
-- reports: istemci yalnızca report_content() ile yazar, kimse tabloyu okuyamaz (yönetici panelden bakar)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  target_type text not null check (target_type in ('activity', 'comment', 'profile', 'review')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'dangerous', 'other')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- Hedefin sahibi sunucuda bulunur (istemci sahte kullanıcı yazamaz); yalnızca görebildiğin içerik bildirilir.
create or replace function public.report_content(
  p_type text,
  p_target uuid,
  p_reason text,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_me is null then
    raise exception 'unauthorized';
  end if;
  if (select count(*) from public.reports r where r.reporter_id = v_me and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;

  if p_type = 'activity' then
    select a.user_id into v_owner from public.activities a
    where a.id = p_target and public.can_view_activity(a.user_id, a.visibility);
  elsif p_type = 'comment' then
    select c.user_id into v_owner
    from public.comments c join public.activities a on a.id = c.activity_id
    where c.id = p_target and public.can_view_activity(a.user_id, a.visibility);
  elsif p_type = 'profile' then
    select p.user_id into v_owner from public.profiles p where p.user_id = p_target;
  elsif p_type = 'review' then
    select rv.user_id into v_owner from public.route_reviews rv
    where rv.id = p_target and public.can_see_route(rv.route_id);
  else
    raise exception 'invalid_type';
  end if;

  if v_owner is null then
    raise exception 'not_found';
  end if;
  if v_owner = v_me then
    raise exception 'own_content';
  end if;

  insert into public.reports (reporter_id, reported_user_id, target_type, target_id, reason, details)
  values (v_me, v_owner, p_type, p_target, p_reason, nullif(btrim(p_details), ''));
end;
$$;

revoke all on function public.report_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;
