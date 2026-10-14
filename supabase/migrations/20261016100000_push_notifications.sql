-- P2.1b: push bildirimleri — cihaz token'ları, bildirim tercihleri ve bildirim kayıtları.
-- Akış: follows / kudos / comments tetikleyicileri `notifications` tablosuna satır yazar;
-- `notifications` INSERT'inde Database Webhook → Edge Function `send-push` → Expo Push Service.
-- Bildirim metni ve gönderim Edge Function'da; veritabanı yalnızca "kim kime ne yaptı"yı kaydeder.

-- ---------------------------------------------------------------------------
-- push_tokens: bir cihazın Expo push token'ı. Token birincil anahtardır; aynı cihazda hesap değişirse
-- token yeni kullanıcıya geçer (register_push_token), bu yüzden istemci doğrudan yazamaz.
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens: kendi token'larını oku"
  on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_tokens: kendi token'ını sil"
  on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null then
    raise exception 'unauthorized';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid_platform';
  end if;
  -- Kullanıcı başına makul sınır: en eski token'lar silinir (kaybolan cihazlar birikmesin).
  delete from public.push_tokens
  where user_id = v_me
    and token <> p_token
    and token not in (
      select token from public.push_tokens
      where user_id = v_me and token <> p_token
      order by updated_at desc
      limit 4
    );
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, v_me, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- notification_settings: hangi bildirimleri almak istediği (satır yoksa hepsi açık sayılır)
-- ---------------------------------------------------------------------------
create table public.notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  follows boolean not null default true,
  kudos boolean not null default true,
  comments boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

create policy "notification_settings: kendi ayarını oku"
  on public.notification_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_settings: kendi ayarını ekle"
  on public.notification_settings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notification_settings: kendi ayarını güncelle"
  on public.notification_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notification_settings from anon, authenticated;
grant select on public.notification_settings to authenticated;
grant insert (user_id, follows, kudos, comments) on public.notification_settings to authenticated;
-- user_id de güncellenebilir olmalı: PostgREST upsert (ON CONFLICT DO UPDATE) yazılan tüm sütunları SET eder;
-- politika (with check) başkasının kimliğine geçişi zaten engeller.
grant update (user_id, follows, kudos, comments) on public.notification_settings to authenticated;

create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications: bildirim kayıtları (gelen kutusu için de temel). İstemci yalnızca kendi kayıtlarını OKUR;
-- yazma yalnızca aşağıdaki tetikleyiciler (security definer) ve Edge Function (service role) ile olur.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('follow', 'follow_request', 'follow_accepted', 'kudos', 'comment')),
  activity_id uuid references public.activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz,
  check (recipient_id <> actor_id)
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications: kendi bildirimlerini oku"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- Ortak yazıcı: kendine, engelli çiftlere bildirim yok; aynı eylem (takip, alkış) tekrar tekrar bildirim üretmez
-- (takip–bırak–takip ya da alkış–geri al–alkış ile spam yapılamasın). Yorum her seferinde yeni bildirimdir.
create or replace function public.enqueue_notification(
  p_recipient uuid,
  p_actor uuid,
  p_type text,
  p_activity uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;
  if public.is_blocked_between(p_recipient, p_actor) then
    return;
  end if;
  if p_type <> 'comment' and exists (
    select 1 from public.notifications n
    where n.recipient_id = p_recipient
      and n.actor_id = p_actor
      and n.type = p_type
      and n.activity_id is not distinct from p_activity
  ) then
    return;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, activity_id)
  values (p_recipient, p_actor, p_type, p_activity);
end;
$$;

revoke all on function public.enqueue_notification(uuid, uuid, text, uuid) from public, anon, authenticated;

-- Takip / takip isteği
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_notification(
    new.following_id,
    new.follower_id,
    case new.status when 'pending' then 'follow_request' else 'follow' end
  );
  return new;
end;
$$;
revoke all on function public.notify_on_follow() from public, anon, authenticated;

create trigger notify_on_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- Takip isteği kabul edildi: istek sahibine haber
create or replace function public.notify_on_follow_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    perform public.enqueue_notification(new.follower_id, new.following_id, 'follow_accepted');
  end if;
  return new;
end;
$$;
revoke all on function public.notify_on_follow_accepted() from public, anon, authenticated;

create trigger notify_on_follow_accepted
  after update of status on public.follows
  for each row execute function public.notify_on_follow_accepted();

-- Alkış: aktivitenin sahibine
create or replace function public.notify_on_kudos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select a.user_id into v_owner from public.activities a where a.id = new.activity_id;
  perform public.enqueue_notification(v_owner, new.user_id, 'kudos', new.activity_id);
  return new;
end;
$$;
revoke all on function public.notify_on_kudos() from public, anon, authenticated;

create trigger notify_on_kudos
  after insert on public.kudos
  for each row execute function public.notify_on_kudos();

-- Yorum: aktivitenin sahibine
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select a.user_id into v_owner from public.activities a where a.id = new.activity_id;
  perform public.enqueue_notification(v_owner, new.user_id, 'comment', new.activity_id);
  return new;
end;
$$;
revoke all on function public.notify_on_comment() from public, anon, authenticated;

create trigger notify_on_comment
  after insert on public.comments
  for each row execute function public.notify_on_comment();
