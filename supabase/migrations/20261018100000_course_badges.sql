-- P2.2c: kurs bitirme rozeti.
-- badges: rozet kataloğu (herkes okur, istemci yazamaz). user_badges: kazanılanlar (yalnızca sahibi okur).
-- Rozet yalnızca complete_course_day içinde, kurs son günle ilk kez bittiğinde verilir (idempotent).
-- complete_course_day artık "kurs bu çağrıyla bitti mi" döner (boolean); eski istemciler dönüşü yok sayar.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- badges
-- ---------------------------------------------------------------------------
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  icon text not null default 'emoji-events',
  -- Kurs bitirme rozeti ise ilgili kurs (kurs başına en fazla bir rozet).
  course_id uuid unique references public.courses (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.badges enable row level security;
create policy "badges: herkes okur" on public.badges for select to authenticated using (true);
revoke all on public.badges from anon, authenticated;
grant select on public.badges to authenticated;

-- ---------------------------------------------------------------------------
-- user_badges
-- ---------------------------------------------------------------------------
create table public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;
create policy "user_badges: kendi rozetlerini oku"
  on public.user_badges for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: her kurs için bir bitirme rozeti (yeniden çalıştırılabilir)
-- ---------------------------------------------------------------------------
insert into public.badges (code, title, description, icon, course_id)
select
  'course-complete-' || c.sort_order,
  c.title,
  'Programı tamamladın.',
  case c.activity_type when 'run' then 'directions-run' when 'bike' then 'directions-bike' else 'directions-walk' end,
  c.id
from public.courses c
where c.sort_order between 1 and 4
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- complete_course_day: günü işaretler; son günde kursu bitirir ve rozeti verir.
-- Döner: kurs BU çağrıyla tamamlandıysa true (tekrar çağrılarda false).
-- ---------------------------------------------------------------------------
drop function public.complete_course_day(uuid);

create function public.complete_course_day(p_activity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_day uuid;
  v_course uuid;
  v_total int;
  v_rows int;
begin
  if v_uid is null then
    return false;
  end if;

  select a.course_day_id into v_day
  from public.activities a
  where a.id = p_activity_id and a.user_id = v_uid;
  if v_day is null then
    return false;
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
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return false;
  end if;

  insert into public.user_badges (user_id, badge_id)
  select v_uid, b.id from public.badges b where b.course_id = v_course
  on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.complete_course_day(uuid) from public, anon;
grant execute on function public.complete_course_day(uuid) to authenticated;
