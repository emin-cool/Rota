-- P2.2a: Başlangıç kursları (4 ücretsiz program). Yeniden çalıştırılabilir: başlığa göre günceller.
-- İçerik genel yürüme/koşma/bisiklet rehberliğidir; tıbbi iddia içermez. Uygulamada "Sağlık sorunun varsa
-- başlamadan önce doktoruna danış" notu gösterilir (src/i18n/tr.courses.ts).
-- workout_json fazları: warmup | run | walk | ride | cooldown; repeat + rest ile aralık tanımlanır.

set search_path = public, extensions;

insert into public.courses (title, description, level, activity_type, weeks, sessions_per_week, tags, sort_order)
values
  ('0''dan 5K''ya – 8 Hafta Koşu Programı',
   'Yürüyüş-koşu aralıklarıyla sıfırdan kesintisiz 5 kilometre koşma seviyesine ulaş.',
   'beginner', 'run', 8, 3, array['Başlangıç', 'Koşu'], 1),
  ('30 Günlük Yürüyüş Alışkanlığı',
   'Her hafta biraz daha uzun yürüyüşlerle düzenli hareket alışkanlığı kazan, İstanbul sahillerini keşfet.',
   'beginner', 'walk', 4, 4, array['Başlangıç', 'Yürüyüş', 'Sahil & Park'], 2),
  ('Şehirde Güvenli Bisiklet',
   'Ekipman kontrolü, vites ve denge, el işaretleri ve sahil bisiklet yollarında güvenli sürüş.',
   'intermediate', 'bike', 2, 3, array['Bisiklet', 'Trafik & Sahil'], 3),
  ('10K''ya Hazırlık & Hız Geliştirme',
   'Interval, tempo ve uzun koşularla 10 kilometreye hazırlan ve hızını geliştir.',
   'advanced', 'run', 10, 3, array['Koşu', 'İnterval & Tempo'], 4)
on conflict (title) do update set
  description = excluded.description,
  level = excluded.level,
  activity_type = excluded.activity_type,
  weeks = excluded.weeks,
  sessions_per_week = excluded.sessions_per_week,
  tags = excluded.tags,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 0'dan 5K'ya: 8 hafta × 3 gün (hafta, tekrar, koşu dk, yürüyüş dk)
-- ---------------------------------------------------------------------------
insert into public.course_days (course_id, week_no, day_no, title, workout_json, target_duration_min, coach_tip)
select
  c.id, w.week_no, d.day_no,
  case when w.rest_min > 0
    then format('%s× %s dk koşu, %s dk yürüyüş', w.reps, w.run_min, w.rest_min)
    else format('%s dk kesintisiz koşu', w.run_min) end,
  jsonb_build_array(
    jsonb_build_object('type', 'warmup', 'duration_sec', 300),
    case when w.rest_min > 0
      then jsonb_build_object('type', 'run', 'duration_sec', w.run_min * 60, 'repeat', w.reps,
             'rest', jsonb_build_object('type', 'walk', 'duration_sec', w.rest_min * 60))
      else jsonb_build_object('type', 'run', 'duration_sec', w.run_min * 60) end,
    jsonb_build_object('type', 'cooldown', 'duration_sec', 300)
  ),
  10 + w.reps * (w.run_min + w.rest_min),
  (array[
    'Konuşabileceğin bir tempoda kal; hızlanmaya çalışma.',
    'Adımlarını kısa ve rahat tut, omuzlarını gevşet.',
    'Zorlanırsan yürüyüş aralıklarını uzatmaktan çekinme.'
  ])[d.day_no]
from public.courses c
cross join (values
  (1, 8, 1, 2), (2, 6, 2, 2), (3, 5, 3, 2), (4, 4, 5, 2),
  (5, 3, 8, 2), (6, 2, 10, 2), (7, 2, 14, 2), (8, 1, 30, 0)
) as w (week_no, reps, run_min, rest_min)
cross join generate_series(1, 3) as d (day_no)
where c.title = '0''dan 5K''ya – 8 Hafta Koşu Programı'
on conflict (course_id, week_no, day_no) do update set
  title = excluded.title, workout_json = excluded.workout_json,
  target_duration_min = excluded.target_duration_min, coach_tip = excluded.coach_tip;

-- ---------------------------------------------------------------------------
-- 30 Günlük Yürüyüş Alışkanlığı: 4 hafta × 4 gün (4. gün uzun yürüyüş)
-- ---------------------------------------------------------------------------
insert into public.course_days (course_id, week_no, day_no, title, workout_json, target_duration_min, coach_tip)
select
  c.id, w.week_no, d.day_no,
  case when d.day_no = 4 then 'Uzun yürüyüş' else 'Tempolu yürüyüş' end,
  jsonb_build_array(
    jsonb_build_object('type', 'warmup', 'duration_sec', 180),
    jsonb_build_object('type', 'walk',
      'duration_sec', (w.base_min + case when d.day_no = 4 then 10 else 0 end) * 60),
    jsonb_build_object('type', 'cooldown', 'duration_sec', 180)
  ),
  w.base_min + case when d.day_no = 4 then 10 else 0 end + 6,
  (array[
    'Dik dur, kollarını doğal salla; rahat ama canlı bir adım tut.',
    'Konuşabilecek ama şarkı söyleyemeyecek bir tempo iyi bir hedef.',
    'Rahat, destekli bir ayakkabı yürüyüşünü çok daha keyifli yapar.',
    'Bugün süreyi sevdiğin bir sahil ya da parkta geçir.'
  ])[d.day_no]
from public.courses c
cross join (values (1, 20), (2, 25), (3, 30), (4, 35)) as w (week_no, base_min)
cross join generate_series(1, 4) as d (day_no)
where c.title = '30 Günlük Yürüyüş Alışkanlığı'
on conflict (course_id, week_no, day_no) do update set
  title = excluded.title, workout_json = excluded.workout_json,
  target_duration_min = excluded.target_duration_min, coach_tip = excluded.coach_tip;

-- ---------------------------------------------------------------------------
-- Şehirde Güvenli Bisiklet: 2 hafta × 3 ders
-- ---------------------------------------------------------------------------
insert into public.course_days (course_id, week_no, day_no, title, workout_json, target_duration_min, coach_tip)
select
  c.id, l.week_no, l.day_no, l.title,
  jsonb_build_array(
    jsonb_build_object('type', 'warmup', 'duration_sec', 300),
    jsonb_build_object('type', 'ride', 'duration_sec', l.main_min * 60),
    jsonb_build_object('type', 'cooldown', 'duration_sec', 300)
  ),
  l.main_min + 10,
  l.tip
from public.courses c
cross join (values
  (1, 1, 'Ekipman ve bisiklet kontrolü', 25,
   'Kask tak; sürüşten önce frenleri, lastik havasını ve zinciri kontrol et.'),
  (1, 2, 'Vites ve denge', 30,
   'Yokuştan önce vites küçült; pedalı kesmeden, düzgün bir ritimle çevir.'),
  (1, 3, 'Sahil bisiklet yolunda tempo', 35,
   'Bisiklet yolunda sağda kal; yayaları ve diğer sürücüleri önceden uyar.'),
  (2, 1, 'Dönüşler ve el işaretleri', 35,
   'Dönmeden önce arkanı kontrol et, kolunla niyetini net göster.'),
  (2, 2, 'Yaya ve diğer kullanıcılarla paylaşım', 40,
   'Kalabalık bölgelerde hızını düşür; zili kısa ve nazik kullan.'),
  (2, 3, 'Uzun sürüş', 45,
   'Su al, yorulunca mola ver; trafik kurallarına her zaman uy.')
) as l (week_no, day_no, title, main_min, tip)
where c.title = 'Şehirde Güvenli Bisiklet'
on conflict (course_id, week_no, day_no) do update set
  title = excluded.title, workout_json = excluded.workout_json,
  target_duration_min = excluded.target_duration_min, coach_tip = excluded.coach_tip;

-- ---------------------------------------------------------------------------
-- 10K'ya Hazırlık: 10 hafta × 3 gün (1 interval, 2 tempo, 3 uzun koşu)
-- ---------------------------------------------------------------------------
insert into public.course_days (course_id, week_no, day_no, title, workout_json, target_duration_min, coach_tip)
select
  c.id, w.week_no, d.day_no,
  (array['İnterval antrenmanı', 'Tempo koşusu', 'Uzun koşu'])[d.day_no],
  case d.day_no
    when 1 then jsonb_build_array(
      jsonb_build_object('type', 'warmup', 'duration_sec', 600),
      jsonb_build_object('type', 'run', 'duration_sec', 180, 'repeat', 4 + w.week_no / 3,
        'rest', jsonb_build_object('type', 'walk', 'duration_sec', 90)),
      jsonb_build_object('type', 'cooldown', 'duration_sec', 600))
    when 2 then jsonb_build_array(
      jsonb_build_object('type', 'warmup', 'duration_sec', 600),
      jsonb_build_object('type', 'run', 'duration_sec', (15 + w.week_no) * 60),
      jsonb_build_object('type', 'cooldown', 'duration_sec', 600))
    else jsonb_build_array(
      jsonb_build_object('type', 'warmup', 'duration_sec', 300),
      jsonb_build_object('type', 'run', 'duration_sec', (30 + 3 * w.week_no) * 60),
      jsonb_build_object('type', 'cooldown', 'duration_sec', 300))
  end,
  case d.day_no
    when 1 then round(20 + (4 + w.week_no / 3) * 4.5)::int
    when 2 then 35 + w.week_no
    else 40 + 3 * w.week_no
  end,
  (array[
    'Hızlı bölümler zorlayıcı ama kontrollü olsun; son tekrar ilkiyle aynı hızda bitmeli.',
    'Tempo koşusu "zor ama sürdürülebilir" hissettirmeli.',
    'Uzun koşuda hız değil süre hedeftir; sohbet edebileceğin tempoda kal.'
  ])[d.day_no]
from public.courses c
cross join generate_series(1, 10) as w (week_no)
cross join generate_series(1, 3) as d (day_no)
where c.title = '10K''ya Hazırlık & Hız Geliştirme'
on conflict (course_id, week_no, day_no) do update set
  title = excluded.title, workout_json = excluded.workout_json,
  target_duration_min = excluded.target_duration_min, coach_tip = excluded.coach_tip;
