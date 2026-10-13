// .env içindeki istemci değişkenlerini EAS (bulut build) ortam değişkenlerine yükler.
// Çalıştır: node scripts/eas-env-push.mjs
// Değerler ekrana yazdırılmaz. ORS_API_KEY gibi sunucu sırları BURAYA GİRMEZ (Supabase secret olur).
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const ENVIRONMENTS = ['development', 'preview', 'production'];

/** ad -> görünürlük. EXPO_PUBLIC_* uygulama paketine gömülür, bu yüzden plaintext olmak zorunda. */
const VARS = {
  EXPO_PUBLIC_SUPABASE_URL: 'plaintext',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'plaintext',
  EXPO_PUBLIC_MAPBOX_TOKEN: 'plaintext',
  EXPO_PUBLIC_SENTRY_DSN: 'plaintext',
  RNMAPBOX_MAPS_DOWNLOAD_TOKEN: 'secret',
};

const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

/** Boş olabilen değişkenler: .env'de yoksa sessizce atlanır (hata sayılmaz). */
const OPTIONAL = new Set(['EXPO_PUBLIC_SENTRY_DSN']);

let failed = false;
for (const [name, visibility] of Object.entries(VARS)) {
  const value = env[name];
  if (!value && OPTIONAL.has(name)) {
    console.log(`– ${name}: boş, atlandı (isteğe bağlı).`);
    continue;
  }
  if (!value || value.includes('xxxx')) {
    console.error(`✗ ${name}: .env içinde gerçek bir değer yok, atlandı.`);
    failed = true;
    continue;
  }
  const res = spawnSync(
    'npx',
    [
      'eas-cli',
      'env:create',
      '--name',
      name,
      '--value',
      value,
      '--visibility',
      visibility,
      ...ENVIRONMENTS.flatMap((e) => ['--environment', e]),
      '--force',
      '--non-interactive',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'], shell: true, encoding: 'utf8' },
  );
  if (res.status === 0) {
    console.log(`✓ ${name} (${visibility})`);
  } else {
    failed = true;
    // Hata çıktısında değer geçebilir; yalnızca son satırları göster.
    console.error(
      `✗ ${name}: ${(res.stderr || '').split('\n').slice(-4).join('\n').replaceAll(value, '***')}`,
    );
  }
}
process.exit(failed ? 1 : 0);
