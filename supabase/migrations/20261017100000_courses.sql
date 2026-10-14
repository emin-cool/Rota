-- P2.2a: Kurslar — program kataloğu, günlük antrenmanlar, kullanıcı kayıtları.
-- Katalog herkese (giriş yapmış) açık okunur, istemci yazamaz; kayıt yalnızca sahibine aittir.
-- Aktivite bir antrenmandan başladıysa activities.course_day_id dolu olur; gün complete_course_day ile işaretlenir.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null unique check (char_length(title) between 1 and 120),
  description text not null default '',
  level text not null check (level in ('beginner', 'intermediate', 'advanced')),
  activity_type text not null check (activity_type in ('walk', 'run', 'bike')),
  weeks int not null check (weeks > 0),
  sessions_per_week int not null check (sessions_per_week > 0),
  tags text[] not null default '{}',
  cover_url text,
  is_free boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;
create policy "courses: herkes okur" on public.courses for select to authenticated using (true);
revoke all on public.courses from anon, authenticated;
grant select on public.courses to authenticated;

-- ---------------------------------------------------------------------------
-- course_days
-- ---------------------------------------------------------------------------
create table public.course_days (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  week_no int not null check (week_no > 0),
  day_no int not null check (day_no > 0),
  title text not null,
  workout_json jsonb not null,
  target_duration_min int not null check (target_duration_min > 0),
  coach_tip text,
  created_at timestamptz not null default now(),
  unique (course_id, week_no, day_no)
);

alter table public.course_days enable row level security;
create policy "course_days: herkes okur" on public.course_days for select to authenticated using (true);
revoke all on public.course_days from anon, authenticated;
grant select on public.course_days to authenticated;

-- ---------------------------------------------------------------------------
-- course_enrollments
-- ---------------------------------------------------------------------------
create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed_days uuid[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index course_enrollments_user_idx on public.course_enrollments (user_id);

alter table public.course_enrollments enable row level security;

create policy "course_enrollments: kendi kaydını oku"
  on public.course_enrollments for select to authenticated
  using (user_id = (select auth.uid()));

create policy "course_enrollments: kendine kaydol"
  on public.course_enrollments for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "course_enrollments: programdan ayrıl"
  on public.course_enrollments for delete to authenticated
  using (user_id = (select auth.uid()));

-- completed_days / completed_at yalnızca complete_course_day ile değişir (istemci güncelleyemez).
revoke all on public.course_enrollments from anon, authenticated;
grant select, delete on public.course_enrollments to authenticated;
grant insert (user_id, course_id) on public.course_enrollments to authenticated;

-- ---------------------------------------------------------------------------
-- activities.course_day_id
-- ---------------------------------------------------------------------------
alter table public.activities
  add column course_day_id uuid references public.course_days (id) on delete set null;

-- ---------------------------------------------------------------------------
-- complete_course_day: kendi aktivitesi bir antrenmandan geldiyse günü işaretler (idempotent).
-- Kayıtlı olmadığın bir kursun günü ya da başkasının aktivitesi sessizce etkisizdir.
-- ---------------------------------------------------------------------------
create or replace function public.complete_course_day(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day uuid;
  v_course uuid;
  v_total int;
begin
  if v_uid is null then
    return;
  end if;

  select a.course_day_id into v_day
  from public.activities a
  where a.id = p_activity_id and a.user_id = v_uid;
  if v_day is null then
    return;
  end if;

  select cd.course_id into v_course from public.course_days cd where cd.id = v_day;
  select count(*) into v_total from public.course_days cd where cd.course_id = v_course;

  update public.course_enrollments e
  set completed_days = case
        when v_day = any (e.completed_days) then e.completed_days
        else array_append(e.completed_days, v_day)
      end
  where e.user_id = v_uid and e.course_id = v_course;

  update public.course_enrollments e
  set completed_at = now()
  where e.user_id = v_uid
    and e.course_id = v_course
    and e.completed_at is null
    and cardinality(e.completed_days) >= v_total;
end;
$$;

revoke all on function public.complete_course_day(uuid) from public, anon;
grant execute on function public.complete_course_day(uuid) to authenticated;
