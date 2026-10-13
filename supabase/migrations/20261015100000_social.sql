-- P2.1a: Sosyal katman — takip (gizli hesap istekleri dahil), alkış, yorum, akış.
-- Aktivite görünürlüğü artık gerçek: public (profil gizli değilse herkes), followers/public (kabul edilmiş takipçi), private (sahibi).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Yeni alanlar
-- ---------------------------------------------------------------------------
alter table public.activities add column description text check (char_length(description) <= 500);
alter table public.route_photos add column activity_id uuid references public.activities (id) on delete set null;
create index route_photos_activity_idx on public.route_photos (activity_id) where activity_id is not null;
create index activities_created_idx on public.activities (created_at desc);

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id, status);

alter table public.follows enable row level security;

-- Yalnızca kendi ilişkilerini görürsün (takip ettiklerin, seni takip edenler, bekleyen istekler).
create policy "follows: kendi ilişkilerini oku"
  on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

create policy "follows: takip et"
  on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));

-- İsteği yalnızca takip edilen kabul edebilir.
create policy "follows: takip edilen isteği kabul eder"
  on public.follows for update to authenticated
  using (following_id = (select auth.uid()))
  with check (following_id = (select auth.uid()) and status = 'accepted');

-- Takibi bırak / isteği geri çek (takip eden) ya da takipçiyi çıkar / isteği reddet (takip edilen).
create policy "follows: sil"
  on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (follower_id, following_id) on public.follows to authenticated;
grant update (status) on public.follows to authenticated;

-- Durumu istemci seçemez: hedef hesap gizliyse istek beklemeye düşer, değilse hemen kabul edilir.
create or replace function public.follows_set_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status := case
    when exists (select 1 from public.profiles p where p.user_id = new.following_id and p.is_private)
      then 'pending'
    else 'accepted'
  end;
  return new;
end;
$$;
revoke all on function public.follows_set_status() from public, anon, authenticated;

create trigger follows_set_status
  before insert on public.follows
  for each row execute function public.follows_set_status();

-- Hesap gizliden açığa dönünce bekleyen istekler kabul edilir.
create or replace function public.profiles_accept_pending_on_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted' where following_id = new.user_id and status = 'pending';
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_accept_pending_on_public() from public, anon, authenticated;

create trigger profiles_accept_pending_on_public
  after update of is_private on public.profiles
  for each row execute function public.profiles_accept_pending_on_public();

-- ---------------------------------------------------------------------------
-- Profil okuma: gizli hesapların YALNIZCA temel bilgisi (ad, avatar) herkese açık olur ki bulunup takip
-- isteği gönderilebilsin. İçerik (aktivite, istatistik) aşağıdaki kurallarla korunur.
-- ---------------------------------------------------------------------------
drop policy "profiles: okuma (gizli olmayanlar + kendi)" on public.profiles;
create policy "profiles: okuma (temel bilgi)"
  on public.profiles for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Aktivite görünürlüğü
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
      p_visibility <> 'private'
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
revoke all on function public.can_view_activity(uuid, text) from public, anon;
grant execute on function public.can_view_activity(uuid, text) to authenticated;

drop policy "activities: public olanı herkes, kendininkini sahibi okur" on public.activities;
create policy "activities: görünürlük kuralına göre oku"
  on public.activities for select to authenticated
  using (public.can_view_activity(user_id, visibility));

-- Fotoğraf bir aktiviteye bağlanıyorsa o aktivite kendinin olmalı.
drop policy "route_photos: kendi fotoğrafını ekle" on public.route_photos;
create policy "route_photos: kendi fotoğrafını ekle"
  on public.route_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_see_route(route_id)
    and (
      activity_id is null
      or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- kudos (alkış) ve comments (yorum): aktiviteyi görebilen herkes okur/yazar
-- ---------------------------------------------------------------------------
create table public.kudos (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.kudos enable row level security;

create policy "kudos: görünür aktivitenin alkışlarını oku"
  on public.kudos for select to authenticated
  using (exists (select 1 from public.activities a where a.id = kudos.activity_id));

create policy "kudos: kendi alkışını ekle"
  on public.kudos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.activities a where a.id = kudos.activity_id)
  );

create policy "kudos: kendi alkışını geri al"
  on public.kudos for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.kudos from anon, authenticated;
grant select, delete on public.kudos to authenticated;
grant insert (activity_id, user_id) on public.kudos to authenticated;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index comments_activity_idx on public.comments (activity_id, created_at);

alter table public.comments enable row level security;

create policy "comments: görünür aktivitenin yorumlarını oku"
  on public.comments for select to authenticated
  using (exists (select 1 from public.activities a where a.id = comments.activity_id));

create policy "comments: kendi yorumunu yaz"
  on public.comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.activities a where a.id = comments.activity_id)
  );

-- Yorumu yazan ya da aktivitenin sahibi silebilir.
create policy "comments: yazan ya da aktivite sahibi siler"
  on public.comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.activities a where a.id = comments.activity_id and a.user_id = (select auth.uid()))
  );

revoke all on public.comments from anon, authenticated;
grant select, delete on public.comments to authenticated;
grant insert (activity_id, user_id, body) on public.comments to authenticated;

-- ---------------------------------------------------------------------------
-- Takip durumu: benim bakış açımdan (self / following / pending / requested_me / none)
-- ---------------------------------------------------------------------------
create or replace function public.follow_state_of(p_target uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_target = (select auth.uid()) then 'self'
    when exists (select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.following_id = p_target and f.status = 'accepted') then 'following'
    when exists (select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.following_id = p_target and f.status = 'pending') then 'pending'
    when exists (select 1 from public.follows f
      where f.follower_id = p_target and f.following_id = (select auth.uid()) and f.status = 'pending') then 'requested_me'
    else 'none'
  end;
$$;
revoke all on function public.follow_state_of(uuid) from public, anon;
grant execute on function public.follow_state_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- feed_activities: akış / bir kullanıcının aktiviteleri / tek aktivite (security invoker: RLS geçerli)
--   p_scope: 'following' (takip ettiklerin + kendin) | 'user' (p_user) | 'one' (p_id)
-- ---------------------------------------------------------------------------
create or replace function public.feed_activities(
  p_scope text default 'following',
  p_user uuid default null,
  p_id uuid default null,
  p_activity text default null,
  p_before timestamptz default null,
  p_limit int default 15,
  p_full_track boolean default false
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  activity_type text,
  title text,
  description text,
  started_at timestamptz,
  created_at timestamptz,
  distance_m int,
  duration_sec int,
  avg_pace_sec_per_km int,
  elevation_gain_m int,
  district text,
  track jsonb,
  photos text[],
  kudos_count int,
  comment_count int,
  kudosed boolean,
  last_comment_author text,
  last_comment_body text,
  mine boolean
)
language sql
stable
set search_path = public, extensions
as $$
  select
    a.id, a.user_id, p.username, coalesce(p.display_name, p.username), p.avatar_url,
    a.activity_type, a.title, a.description, a.started_at, a.created_at,
    a.distance_m, a.duration_sec, a.avg_pace_sec_per_km, a.elevation_gain_m,
    r.district,
    case
      when a.track is null then null
      when p_full_track then st_asgeojson(st_simplifypreservetopology(a.track::geometry, 0.00002), 5)::jsonb
      else st_asgeojson(st_simplifypreservetopology(a.track::geometry, 0.0002), 5)::jsonb
    end,
    array(select ph.url from public.route_photos ph where ph.activity_id = a.id order by ph.created_at limit 4),
    (select count(*)::int from public.kudos k where k.activity_id = a.id),
    (select count(*)::int from public.comments c where c.activity_id = a.id),
    exists (select 1 from public.kudos k where k.activity_id = a.id and k.user_id = (select auth.uid())),
    lc.author,
    lc.body,
    a.user_id = (select auth.uid())
  from public.activities a
  join public.profiles p on p.user_id = a.user_id
  left join public.routes r on r.id = a.route_id
  left join lateral (
    select coalesce(cp.display_name, cp.username) as author, c.body
    from public.comments c
    join public.profiles cp on cp.user_id = c.user_id
    where c.activity_id = a.id
    order by c.created_at desc
    limit 1
  ) lc on true
  where (
      (p_scope = 'following' and (
        a.user_id = (select auth.uid())
        or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid()) and f.following_id = a.user_id and f.status = 'accepted'
        )
      ))
      or (p_scope = 'user' and a.user_id = p_user)
      or (p_scope = 'one' and a.id = p_id)
    )
    and (p_activity is null or a.activity_type = p_activity)
    and (p_before is null or a.created_at < p_before)
  order by a.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.feed_activities(text, uuid, uuid, text, timestamptz, int, boolean) from public, anon;
grant execute on function public.feed_activities(text, uuid, uuid, text, timestamptz, int, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Yorum listesi
-- ---------------------------------------------------------------------------
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
  order by c.created_at asc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.activity_comments(uuid, int, int) from public, anon;
grant execute on function public.activity_comments(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Profil kartı (başkasının profili). Sayaçlar yalnızca görebildiğim aktiviteleri sayar.
-- ---------------------------------------------------------------------------
create or replace function public.profile_card(p_user uuid)
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
  can_view boolean
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
    (not p.is_private) or public.follow_state_of(p.user_id) in ('self', 'following')
  from public.profiles p
  where p.user_id = p_user;
$$;

revoke all on function public.profile_card(uuid) from public, anon;
grant execute on function public.profile_card(uuid) to authenticated;

-- Kendi sayaçlarım (profil sekmesi): takipçi, takip edilen, bekleyen istek, rota
create or replace function public.my_social_counts()
returns table (followers_count int, following_count int, pending_requests int, route_count int)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.follows f where f.following_id = (select auth.uid()) and f.status = 'accepted'),
    (select count(*)::int from public.follows f where f.follower_id = (select auth.uid()) and f.status = 'accepted'),
    (select count(*)::int from public.follows f where f.following_id = (select auth.uid()) and f.status = 'pending'),
    (select count(*)::int from public.routes r where r.creator_id = (select auth.uid()));
$$;

revoke all on function public.my_social_counts() from public, anon;
grant execute on function public.my_social_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- Takipçi / takip edilen listesi. Gizli hesabın listesini yalnızca kendisi ve onaylı takipçileri görür.
-- ---------------------------------------------------------------------------
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
    and (
      p_user = (select auth.uid())
      or not exists (select 1 from public.profiles t where t.user_id = p_user and t.is_private)
      or public.follow_state_of(p_user) = 'following'
    )
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.follow_list(uuid, text, int, int) from public, anon;
grant execute on function public.follow_list(uuid, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Kişi arama (kullanıcı adı öneki ya da ad içinde), en az 2 karakter
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
    and (
      p.username ilike replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%'
      or p.display_name ilike '%' || replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%'
    )
  order by (p.username ilike replace(replace(btrim(p_query), '%', '\%'), '_', '\_') || '%') desc, p.username
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.search_profiles(text, int) from public, anon;
grant execute on function public.search_profiles(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Bana gelen bekleyen takip istekleri
-- ---------------------------------------------------------------------------
create or replace function public.follow_requests(p_limit int default 30, p_offset int default 0)
returns table (user_id uuid, username text, display_name text, avatar_url text, requested_at timestamptz)
language sql
stable
set search_path = public
as $$
  select p.user_id, p.username, coalesce(p.display_name, p.username), p.avatar_url, f.created_at
  from public.follows f
  join public.profiles p on p.user_id = f.follower_id
  where f.following_id = (select auth.uid()) and f.status = 'pending'
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.follow_requests(int, int) from public, anon;
grant execute on function public.follow_requests(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: yeni aktivite akışa "Yeni gönderiler" olarak düşebilsin (RLS abone için geçerli)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activities'
     ) then
    alter publication supabase_realtime add table public.activities;
  end if;
end
$$;
