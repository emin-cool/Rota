// 30 başlangıç rotasını üretip Supabase `routes` tablosuna yazar (is_featured = true, herkese açık).
// Geometri ve yükseklik: OpenRouteService. Manzara skoru: generate-routes ile aynı modül
// (supabase/functions/_shared/scoring.ts) ve `osm_features` tablosu. Geçiş noktaları: scripts/seed-routes.data.mjs
//
// Kullanım (Windows PowerShell, proje klasöründe):
//   node scripts/seed-routes.mjs --check              # hiçbir şey yazmaz: noktaları doğrular, rotaları üretip özet tablo basar
//   node scripts/seed-routes.mjs --check --only=bebek # başlığında "bebek" geçenleri dene
//   node scripts/seed-routes.mjs --points            # ORS gerektirmez: her geçiş noktasının OSM'de hangi yola/mahalleye düştüğünü yazar
//   node scripts/seed-routes.mjs                      # veritabanına yazar (aynı başlıklı rotalar güncellenir)
//   node scripts/seed-routes.mjs --keep-old           # eski "ÖRNEK VERİ" rotalarını silme
//
// .env içinde: ORS_API_KEY, EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (gizli; yazdırılmaz).
// ORS ücretsiz kotası dakikada 40 istek: script istekler arasında bekler. Sonuçlar `.seed-cache.json`
// içinde saklanır; tekrar çalıştırmak ORS'u yeniden harcamaz (`--fresh` önbelleği yok sayar).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

import { bboxOf, distPointToPolylineM, resample } from '../supabase/functions/_shared/geo.ts';
import { toCandidate } from '../supabase/functions/_shared/ors.ts';
import { categoriesPerSample, featureFromDb } from '../supabase/functions/_shared/osm.ts';
import { estimateDurationMin } from '../supabase/functions/_shared/pace.ts';
import {
  BUFFER_M,
  SAMPLE_STEP_M,
  ascentFromSamples,
  scenicScore,
} from '../supabase/functions/_shared/scoring.ts';
import { ROUTES } from './seed-routes.data.mjs';

const CACHE_FILE = '.seed-cache.json';
const UA = 'RotaApp-seed/0.1 (+https://github.com/emin-cool/Rota)';
const ORS_BASE = 'https://api.openrouteservice.org/v2/directions';
const ORS_PAUSE_MS = 1700; // dakikada ≤ 40 istek
const ORS_TIMEOUT_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3; // üst üste bu kadar ORS hatasında dur (servis kapalıdır)
const NOMINATIM_PAUSE_MS = 1200; // Nominatim politikası: saniyede en çok 1 istek
const MAX_PROFILE_POINTS = 300;
// İstanbul kutusu: west,north,east,south
const VIEWBOX = '28.5,41.3,29.5,40.8';

const args = process.argv.slice(2);
const check = args.includes('--check');
const keepOld = args.includes('--keep-old');
const fresh = args.includes('--fresh');
const pointsOnly = args.includes('--points');
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).toLocaleLowerCase('tr-TR');

const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
for (const k of pointsOnly
  ? ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  : ['ORS_API_KEY', 'EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[k]) {
    console.error(`✗ .env içinde ${k} gerekli.`);
    process.exit(1);
  }
}

const cache = existsSync(CACHE_FILE) && !fresh ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
const saveCache = () => writeFileSync(CACHE_FILE, JSON.stringify(cache));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Önbellekli çağrı; yalnızca gerçekten ağa çıkınca `pauseMs` bekler. */
async function cached(key, pauseMs, fn) {
  if (cache[key] !== undefined) return cache[key];
  const value = await fn();
  cache[key] = value;
  saveCache();
  await sleep(pauseMs);
  return value;
}

async function nominatim(path) {
  const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'tr' },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  return res.json();
}

/** { q } noktasını Nominatim ile [lng, lat]'e çevirir; sonuç yoksa null. */
async function resolveQuery(q) {
  return cached(`nom:${q}`, NOMINATIM_PAUSE_MS, async () => {
    const r = await nominatim(
      `search?format=jsonv2&limit=1&bounded=1&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`,
    );
    return r[0] ? { point: [Number(r[0].lon), Number(r[0].lat)], name: r[0].display_name } : null;
  });
}

async function reverse([lng, lat]) {
  return cached(`rev:${lng.toFixed(4)},${lat.toFixed(4)}`, NOMINATIM_PAUSE_MS, async () => {
    const r = await nominatim(`reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`);
    const a = r.address ?? {};
    return (
      [a.road, a.suburb ?? a.neighbourhood ?? a.quarter, a.city_district ?? a.town ?? a.county]
        .filter(Boolean)
        .join(', ') ||
      r.display_name ||
      '?'
    );
  });
}

const PROFILE = { walk: 'foot-walking', run: 'foot-walking', bike: 'cycling-regular' };

async function orsRoute(route, points) {
  const profile = route.profile ?? PROFILE[route.activity];
  const body = {
    coordinates: points,
    elevation: true,
    extra_info: ['surface', 'waytype'],
    instructions: false,
    radiuses: points.map(() => route.radius ?? 500),
  };
  const key = `ors:${profile}:${JSON.stringify(points)}`;
  return cached(key, ORS_PAUSE_MS, async () => {
    const res = await fetch(`${ORS_BASE}/${profile}/geojson`, {
      method: 'POST',
      headers: { Authorization: env.ORS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // ORS yürüyüş/bisiklet sunucuları zaman zaman yanıt vermez; sonsuza kadar bekleme.
      signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`ORS HTTP ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text).features[0];
  });
}

const admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function featuresFor(coords) {
  const bbox = bboxOf(
    coords.map((c) => [c[0], c[1]]),
    BUFFER_M,
  );
  const { data, error } = await admin.rpc('osm_features_in_bbox', {
    p_west: bbox.west,
    p_south: bbox.south,
    p_east: bbox.east,
    p_north: bbox.north,
  });
  if (error) throw new Error(`osm_features_in_bbox: ${error.message}`);
  return (data ?? []).map(featureFromDb);
}

/** routes.difficulty — src/lib/wizard.ts difficultyOf ile aynı eşikler. */
function difficultyOf(distanceM, ascentM) {
  const perKm = ascentM / Math.max(distanceM / 1000, 0.1);
  if (perKm < 15) return 'easy';
  if (perKm < 35) return 'medium';
  return 'hard';
}

const round5 = (n) => Math.round(n * 1e5) / 1e5;

async function build(route) {
  // 1) Noktaları çöz
  const notes = [];
  const points = [];
  for (const w of route.wp) {
    if (Array.isArray(w)) {
      points.push(w);
      continue;
    }
    const r = await resolveQuery(w.q);
    if (!r) throw new Error(`"${w.q}" Nominatim'de bulunamadı`);
    const point = [r.point[0] + (w.dLng ?? 0), r.point[1] + (w.dLat ?? 0)];
    notes.push(`"${w.q}" → ${point[0].toFixed(5)},${point[1].toFixed(5)} (${r.name.slice(0, 60)})`);
    points.push(point);
  }

  // 2) Rota
  const feature = await orsRoute(route, points);
  const cand = toCandidate(feature, false);
  const coords = cand.coords;

  // 3) Manzara skoru (generate-routes ile aynı: 100 m örnek, 50 m tampon, manzara tercihi yok)
  const samples = resample(coords, SAMPLE_STEP_M);
  const features = await featuresFor(coords);
  const scenic = features.length ? scenicScore(categoriesPerSample(samples, features), []) : 50;
  const ascent = cand.ascentM > 0 ? cand.ascentM : ascentFromSamples(samples);

  // 4) Yükseklik profili (≤ 300 nokta)
  const stride = Math.max(1, Math.ceil(samples.length / MAX_PROFILE_POINTS));
  const profile = samples
    .filter((_, i) => i % stride === 0 || i === samples.length - 1)
    .map((p) => ({ d: Math.round(p.d), z: Math.round(p.z * 10) / 10 }));

  // 5) Her istenen noktanın rotaya uzaklığı (m): büyükse nokta yola oturmamış demektir
  const line = coords.map((c) => [c[0], c[1]]);
  const offsets = points.map((p) => Math.round(distPointToPolylineM(p, line)));

  return {
    route,
    points,
    notes,
    coords,
    distanceM: cand.distanceM,
    ascentM: ascent,
    scenic,
    profile,
    durationMin: estimateDurationMin(route.activity, cand.distanceM, ascent),
    difficulty: difficultyOf(cand.distanceM, ascent),
    maxOffsetM: Math.max(...offsets),
    featureCount: features.length,
  };
}

async function write(b) {
  const { route } = b;
  const ewktLine = `SRID=4326;LINESTRING(${b.coords.map((c) => `${round5(c[0])} ${round5(c[1])}`).join(',')})`;
  const start = b.coords[0];
  const row = {
    creator_id: null,
    title: route.title,
    description: route.description,
    activity_type: route.activity,
    route_type: route.type === 'loop' ? 'loop' : route.type === 'out_back' ? 'out_back' : 'a_b',
    geom: ewktLine,
    start_point: `SRID=4326;POINT(${round5(start[0])} ${round5(start[1])})`,
    distance_m: b.distanceM,
    elevation_gain_m: b.ascentM,
    est_duration_min: b.durationMin,
    scenic_score: b.scenic,
    difficulty: b.difficulty,
    district: route.district,
    is_featured: true,
    is_public: true,
    elevation_profile: b.profile,
  };
  const { data: existing, error: findError } = await admin
    .from('routes')
    .select('id')
    .is('creator_id', null)
    .eq('title', route.title)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    // Yorumlar ve puanlar korunur: yalnızca rota verisi güncellenir.
    const { error } = await admin.from('routes').update(row).eq('id', existing.id);
    if (error) throw error;
    return 'güncellendi';
  }
  const { error } = await admin.from('routes').insert(row);
  if (error) throw error;
  return 'eklendi';
}

const list = ROUTES.filter((r) => !only || r.title.toLocaleLowerCase('tr-TR').includes(only));
console.log(
  `${list.length} rota işlenecek (${check ? 'KONTROL: veritabanına yazılmaz' : 'YAZILACAK'}).\n`,
);

if (pointsOnly) {
  for (const [i, route] of list.entries()) {
    console.log(`${String(i + 1).padStart(2)}. ${route.title}`);
    for (const w of route.wp) {
      let point = w;
      let label = '';
      if (!Array.isArray(w)) {
        const r = await resolveQuery(w.q);
        if (!r) {
          console.log(`    ✗ "${w.q}" bulunamadı`);
          continue;
        }
        point = [r.point[0] + (w.dLng ?? 0), r.point[1] + (w.dLat ?? 0)];
        label = `"${w.q}" → `;
      }
      console.log(
        `    ${label}${point[0].toFixed(5)},${point[1].toFixed(5)}  ${await reverse(point)}`,
      );
    }
  }
  process.exit(0);
}

const built = [];
const failed = [];
let streak = 0;
for (const [i, route] of list.entries()) {
  try {
    const b = await build(route);
    streak = 0;
    built.push(b);
    const km = (b.distanceM / 1000).toFixed(1);
    const warn = b.maxOffsetM > 150 ? `  ⚠ nokta rotadan ${b.maxOffsetM} m uzakta` : '';
    console.log(
      `${String(i + 1).padStart(2)}. ${route.title}\n    ${route.activity}/${route.type} • ${km} km • +${b.ascentM} m • ~${b.durationMin} dk • manzara ${b.scenic} • ${b.difficulty}${warn}`,
    );
    for (const n of b.notes) console.log(`    ${n}`);
    if (check) {
      const a = await reverse(b.points[0]);
      const z = await reverse(b.points[b.points.length - 1]);
      console.log(`    başlangıç: ${a}\n    bitiş:     ${z}`);
    }
  } catch (e) {
    failed.push({ title: route.title, error: e instanceof Error ? e.message : String(e) });
    console.log(`${String(i + 1).padStart(2)}. ${route.title}\n    ✗ ${failed.at(-1).error}`);
  }
}

if (!check) {
  if (failed.length > 0) {
    console.log(
      `\n${failed.length} rota üretilemedi; yazma işlemi yapılmadı. Önce --check ile düzelt.`,
    );
    process.exit(1);
  }
  if (!keepOld) {
    const { error } = await admin.from('routes').delete().like('description', 'ÖRNEK VERİ%');
    if (error) throw error;
    console.log('\nEski "ÖRNEK VERİ" rotaları silindi.');
  }
  for (const b of built) console.log(`  ${await write(b)}: ${b.route.title}`);
  console.log(`\nBitti: ${built.length} rota yazıldı.`);
} else {
  console.log(
    `\nKontrol bitti: ${built.length} başarılı, ${failed.length} başarısız. Hiçbir şey yazılmadı.`,
  );
}
