// generate-routes'u gerçek Supabase projesine karşı dener (Docker gerekmez).
// Çalıştır: node scripts/test-generate-routes.mjs
// .env içinde: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD
// (TEST_* kendi test hesabın; .env git'e girmez). Şifre hiçbir yere yazdırılmaz.
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
for (const k of [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'TEST_EMAIL',
  'TEST_PASSWORD',
]) {
  if (!env[k]) {
    console.error(`✗ .env içinde ${k} yok.`);
    process.exit(1);
  }
}
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Emirgan, 60 dk, dönüşlü yürüyüş, sahil + düz (P1.2 kontrol isteği)
const input = {
  activityType: 'walk',
  routeType: 'loop',
  start: [29.056, 41.108],
  durationMin: 60,
  scenery: ['coast'],
  slope: 'flat',
  extras: { amenities: true },
  debug: true,
};

const login = await fetch(`${base}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TEST_EMAIL, password: env.TEST_PASSWORD }),
});
if (!login.ok) {
  console.error('✗ Giriş başarısız:', login.status, (await login.json()).msg ?? '');
  process.exit(1);
}
const { access_token: token } = await login.json();

const started = Date.now();
const res = await fetch(`${base}/functions/v1/generate-routes`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});
const body = await res.json();
console.log(`HTTP ${res.status} — ${((Date.now() - started) / 1000).toFixed(1)} sn`);

if (!res.ok) {
  console.log(body);
  process.exit(1);
}
console.log(
  `cached: ${body.cached}${body.warnings ? ` | uyarılar: ${body.warnings.join(', ')}` : ''}`,
);
for (const line of body.debug ?? []) console.log(`  · ${line}`);
for (const r of body.routes) {
  console.log(
    `- ${r.label}: ${(r.distanceM / 1000).toFixed(1)} km, ${r.estDurationMin} dk, ` +
      `+${r.elevationGainM} m, manzara ${r.scenicScore}, ${r.pois.length} mola noktası, ` +
      `${r.geojson.coordinates.length} nokta`,
  );
}
