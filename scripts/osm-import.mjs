// İstanbul'un manzara/mola verisini (OSM) Overpass'tan çekip Supabase'deki osm_features tablosuna yükler.
// Neden: canlı Overpass, Supabase Edge'den güvenilir çalışmıyor; generate-routes bu tabloyu kullanır.
//
// Kullanım:
//   node scripts/osm-import.mjs --dry          # yalnızca 1 karoyu çeker, sayıları gösterir (yazmaz)
//   node scripts/osm-import.mjs                # tüm İstanbul (≈10–20 dk; kesilirse kaldığı yerden devam eder)
//   node scripts/osm-import.mjs --reset        # ilerleme dosyasını silip baştan başla
//   node scripts/osm-import.mjs --bbox 28.9,41.0,29.1,41.15   # özel alan (west,south,east,north)
//
// .env içinde: EXPO_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY (gizli anahtar; .env git'e girmez).
// Anahtar hiçbir yere yazdırılmaz.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

import { fetchOsmFeatures, featureToRow } from '../supabase/functions/_shared/osm.ts';
import { tileId, tilesCovering } from '../supabase/functions/_shared/tiles.ts';

const PROGRESS_FILE = '.osm-import-progress.json';
/** İstanbul çekirdeği (Avrupa + Anadolu yakası, Boğaz). */
const DEFAULT_AREA = { west: 28.6, south: 40.85, east: 29.35, north: 41.25 };
const TILE_DEG = 0.05; // ≈ 4,2 × 5,6 km
const PAUSE_MS = 1500; // Overpass'a nazik davran
const BATCH = 100; // uzun çizgiler yüzünden büyük gövdeler 522 (zaman aşımı) veriyordu
const UPLOAD_ATTEMPTS = 5;
const MAX_TILE_ATTEMPTS = 2;
const MAX_SPLIT_DEPTH = 2; // başarısız karo 4 parçaya, o da gerekirse yine 4'e bölünür

const args = process.argv.slice(2);
const dry = args.includes('--dry');
if (args.includes('--reset') && existsSync(PROGRESS_FILE)) unlinkSync(PROGRESS_FILE);

let area = DEFAULT_AREA;
const bboxArg = args[args.indexOf('--bbox') + 1];
if (args.includes('--bbox')) {
  const [west, south, east, north] = (bboxArg ?? '').split(',').map(Number);
  if ([west, south, east, north].some((n) => Number.isNaN(n))) {
    console.error('✗ --bbox west,south,east,north biçiminde olmalı.');
    process.exit(1);
  }
  area = { west, south, east, north };
}

const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!dry && (!base || !serviceKey)) {
  console.error('✗ .env içinde EXPO_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = new Set(
  existsSync(PROGRESS_FILE) ? JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')) : [],
);
const saveProgress = () => writeFileSync(PROGRESS_FILE, JSON.stringify([...done]));

async function uploadBatch(batch) {
  let lastError;
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${base}/rest/v1/osm_features?on_conflict=osm_type,osm_id,part`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          // Eski JWT biçimli anahtarlar Authorization'da da gönderilir; yeni sb_secret_ anahtarları yalnızca apikey ile.
          ...(serviceKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${serviceKey}` }),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) return;
      const text = await res.text();
      // 4xx (522 dışı) kalıcı hatadır: tekrar denemenin anlamı yok.
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        throw Object.assign(new Error(`Yükleme hatası HTTP ${res.status}: ${text.slice(0, 200)}`), {
          fatal: true,
        });
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (e?.fatal) throw e;
      lastError = e;
    }
    await sleep(2000 * attempt);
  }
  throw new Error(
    `Yükleme ${UPLOAD_ATTEMPTS} denemede başarısız: ${lastError instanceof Error ? lastError.message : lastError}`,
  );
}

async function upload(rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await uploadBatch(rows.slice(i, i + BATCH));
  }
}

const tiles = tilesCovering(area, TILE_DEG);
const todo = tiles.filter((t) => !done.has(tileId(t)));
console.log(
  `${tiles.length} karo, ${tiles.length - todo.length} tamamlanmış, ${todo.length} yapılacak${dry ? ' (dry-run: sadece ilk karo)' : ''}.`,
);

let total = 0;
const failed = [];
const started = Date.now();

/** Karodaki nesneleri Overpass'tan çeker (birkaç deneme); olmazsa null. */
async function fetchTileRows(tile) {
  for (let attempt = 1; attempt <= MAX_TILE_ATTEMPTS; attempt++) {
    try {
      const features = await fetchOsmFeatures(tile, fetch, 40_000, undefined, {
        fullGeometry: true,
        timeoutSec: 50,
        overallTimeoutMs: 90_000,
      });
      // Aynı nesne bir karoda birden çok kez gelebilir; anahtara göre tekilleştir.
      const unique = new Map();
      for (const f of features) {
        const row = featureToRow(f);
        if (row) unique.set(`${row.osm_type}:${row.osm_id}:${row.part}`, row);
      }
      return [...unique.values()];
    } catch (e) {
      console.log(
        `  karo ${tileId(tile)} deneme ${attempt} başarısız: ${e instanceof Error ? e.message : e}`,
      );
      await sleep(3000 * attempt);
    }
  }
  return null;
}

/** Karoyu 4 eşit parçaya böler. */
function splitTile(t) {
  const midLng = Math.round(((t.west + t.east) / 2) * 1e6) / 1e6;
  const midLat = Math.round(((t.south + t.north) / 2) * 1e6) / 1e6;
  return [
    { west: t.west, south: t.south, east: midLng, north: midLat },
    { west: midLng, south: t.south, east: t.east, north: midLat },
    { west: t.west, south: midLat, east: midLng, north: t.north },
    { west: midLng, south: midLat, east: t.east, north: t.north },
  ];
}

function describeRows(rows) {
  const byKind = rows.reduce((acc, r) => {
    const k = r.category ?? r.poi_type;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(byKind)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
}

/**
 * Karoyu çeker ve yükler. Overpass yoğun bir karoyu veremiyorsa karo 4 parçaya bölünüp parça parça
 * denenir (en çok MAX_SPLIT_DEPTH kez). Başarılıysa true.
 */
async function processTile(tile, depth, label) {
  const id = tileId(tile);
  if (done.has(id)) return true;
  const indent = '  '.repeat(depth);

  const rows = await fetchTileRows(tile);
  if (rows) {
    if (!dry) {
      try {
        await upload(rows);
      } catch (e) {
        if (e?.fatal) throw e; // yetki/şema gibi kalıcı hata: devam etmenin anlamı yok
        console.log(`${indent}  karo ${id} yüklenemedi: ${e instanceof Error ? e.message : e}`);
        return false;
      }
      done.add(id);
      saveProgress();
    }
    total += rows.length;
    console.log(`${indent}${label} ${id}: ${rows.length} nesne (${describeRows(rows)})`);
    await sleep(PAUSE_MS);
    return true;
  }

  if (depth >= MAX_SPLIT_DEPTH) return false;
  console.log(`${indent}  karo ${id} çekilemedi, 4 parçaya bölünüyor…`);
  let allOk = true;
  for (const [i, part] of splitTile(tile).entries()) {
    allOk = (await processTile(part, depth + 1, `↳${i + 1}/4`)) && allOk;
  }
  if (allOk && !dry) {
    done.add(id);
    saveProgress();
  }
  return allOk;
}

const queue = dry ? todo.slice(0, 1) : todo;
for (const [index, tile] of queue.entries()) {
  const ok = await processTile(tile, 0, `[${index + 1}/${queue.length}]`);
  if (!ok) failed.push(tileId(tile));
}

const minutes = ((Date.now() - started) / 60000).toFixed(1);
console.log(`
Bitti: ${total} nesne işlendi, ${failed.length} karo başarısız, ${minutes} dk.`);
if (failed.length > 0) {
  console.log('Başarısız karolar (komutu tekrar çalıştırınca yeniden denenir):');
  for (const f of failed) console.log(`  ${f}`);
  process.exit(1);
}
