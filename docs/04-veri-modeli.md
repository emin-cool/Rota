# 04 — Veri modeli (Supabase + PostGIS)

Tüm tablolarda `id uuid primary key default gen_random_uuid()` ve `created_at timestamptz default now()` var. RLS her tabloda açık. Coğrafi kolonlar `geography` tipinde, GIST indeksli.

## MVP tabloları

| Tablo | Alanlar |
| --- | --- |
| `profiles` | user_id (auth.users fk), username (unique), display_name, avatar_url, level (beginner/intermediate/advanced), activity_prefs text[], default_pace_sec_per_km int, privacy_zone geography(Polygon), is_private bool |
| `routes` | creator_id, title, description, activity_type (walk/run/bike), route_type (loop/a_b/out_back), geom geography(LineString), start_point geography(Point), distance_m int, elevation_gain_m int, est_duration_min int, scenic_score int, difficulty (easy/medium/hard), district text, is_featured bool, is_public bool, avg_rating numeric(2,1), rating_count int, completion_count int |
| `route_photos` | route_id, user_id, url, location geography(Point) |
| `route_reviews` | route_id, user_id, rating smallint (1–5), comment text, tags text[], is_verified bool — unique(route_id, user_id) |
| `activities` | user_id, route_id (nullable), activity_type, started_at, duration_sec, moving_sec, distance_m, avg_pace_sec_per_km, elevation_gain_m, track geography(LineString), visibility (public/followers/private), title |
| `saved_routes` | user_id, route_id — unique |
| `route_cache` | input_hash text unique, result jsonb, expires_at timestamptz |

## V2 tabloları

| Tablo | Alanlar |
| --- | --- |
| `follows` | follower_id, following_id — unique |
| `kudos` | activity_id, user_id — unique |
| `comments` | activity_id, user_id, body |
| `segments` | name, geom geography(LineString), distance_m, activity_type |
| `segment_efforts` | segment_id, activity_id, user_id, elapsed_sec |
| `courses` | title, description, level, weeks, cover_url, is_free |
| `course_days` | course_id, week_no, day_no, title, workout_json jsonb, target_duration_min, coach_tip |
| `course_enrollments` | user_id, course_id, current_day int, completed_days int[], started_at |
| `events` | host_id, route_id, title, starts_at, level, max_people |
| `event_participants` | event_id, user_id — unique |
| `challenges` / `badges` / `user_badges` | hedef türü, hedef değer, başlangıç/bitiş; rozet ikonu; kazanma tarihi |

`workout_json` formatı:
```json
[
  {"type": "warmup", "duration_sec": 300},
  {"type": "run", "duration_sec": 60, "repeat": 6, "rest": {"type": "walk", "duration_sec": 120}},
  {"type": "cooldown", "duration_sec": 300}
]
```

## Trigger ve fonksiyonlar
- `route_reviews` insert/update/delete → `routes.avg_rating`, `rating_count` güncelle.
- `activities` insert (route_id dolu) → `routes.completion_count += 1`.
- `nearby_routes(lng, lat, radius_m, activity)` RPC fonksiyonu.
- Zamanlanmış (V2): puan ≥ 4,3 ve completion_count ≥ 20 → `is_featured = true`.

## Örnek sorgu — yakındaki popüler rotalar
```sql
select id, title, distance_m, avg_rating
from routes
where is_public
  and activity_type = 'walk'
  and st_dwithin(start_point, st_makepoint(29.05, 41.11)::geography, 3000)
order by avg_rating desc, completion_count desc
limit 20;
```

## RLS özet
- `profiles`: herkes okur (is_private değilse), sahibi yazar.
- `routes`: is_public olanı herkes okur; creator yazar/siler.
- `route_reviews`: herkes okur; sahibi yazar; insert sadece o rotada `activities` kaydı varsa (is_verified).
- `activities`: visibility'ye göre okuma (public herkes, followers takipçiler, private sadece sahibi); sahibi yazar.
