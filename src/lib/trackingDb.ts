import * as SQLite from 'expo-sqlite';

import type { TrackPoint } from '@/lib/tracking';
import type { ActivityType } from '@/types/routes';

/**
 * Canlı takip kayıtları yerel SQLite'ta tutulur: uygulama kapansa/çökse bile noktalar kaybolmaz.
 * Bitirilen kayıtlar Supabase'e P1.5'te tek seferde gönderilir (docs/03 "Canlı takip").
 */

export type SessionStatus = 'recording' | 'paused' | 'finished';

export type SessionRow = {
  id: string;
  status: SessionStatus;
  activity_type: ActivityType;
  started_at: number;
  ended_at: number | null;
  /** Toplam duraklatma süresi (ms). */
  paused_ms: number;
  /** Şu an duraklatılmışsa duraklatmanın başladığı an. */
  pause_started_at: number | null;
  /** Mevcut bölüm numarası (her devam ettirmede artar). */
  segment: number;
  /** Planlı rota: [[lng,lat], …] JSON; serbest kayıtta null. */
  route_json: string | null;
  route_title: string | null;
  /** Supabase'e yüklendi mi (P1.5). */
  uploaded: number;
  /** Planlı rotanın `routes.id`'si (yorum, fotoğraf, completion_count için); serbest kayıtta null. */
  route_id: string | null;
  /** Kullanıcının düzenlediği başlık. */
  title: string | null;
  visibility: 'public' | 'followers' | 'private' | null;
  /** Kaydet'e basıldı, yükleme bekliyor (internet yoksa kuyrukta kalır). */
  queued: number;
  /** ReviewDraft JSON (rating, tags, comment). */
  review_json: string | null;
  /** PhotoDraft[] JSON. */
  photos_json: string | null;
  /** Aktivite notu (akışta görünür). */
  description: string | null;
  /** 1 ise rota Kaydet'te herkese açılır (yalnızca kendi özel rotan). */
  share_route: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync('rota.db').then(async (db) => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        paused_ms INTEGER NOT NULL DEFAULT 0,
        pause_started_at INTEGER,
        segment INTEGER NOT NULL DEFAULT 0,
        route_json TEXT,
        route_title TEXT,
        uploaded INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        seg INTEGER NOT NULL,
        ts INTEGER NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        alt REAL,
        acc REAL
      );
      CREATE INDEX IF NOT EXISTS points_session_idx ON points (session_id, id);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    await addMissingColumns(db);
    return db;
  });
  return dbPromise;
}

/** P1.5 ile gelen kolonlar: eski kurulumlarda tabloyu bozmadan eklenir. */
const ADDED_COLUMNS: [name: string, ddl: string][] = [
  ['route_id', 'TEXT'],
  ['title', 'TEXT'],
  ['visibility', 'TEXT'],
  ['queued', 'INTEGER NOT NULL DEFAULT 0'],
  ['review_json', 'TEXT'],
  ['photos_json', 'TEXT'],
  ['description', 'TEXT'],
  ['share_route', 'INTEGER NOT NULL DEFAULT 0'],
];

async function addMissingColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(sessions)`);
  const have = new Set(info.map((c) => c.name));
  for (const [name, ddl] of ADDED_COLUMNS) {
    if (!have.has(name)) await db.execAsync(`ALTER TABLE sessions ADD COLUMN ${name} ${ddl}`);
  }
}

export async function createSession(row: SessionRow): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sessions (id, status, activity_type, started_at, ended_at, paused_ms, pause_started_at, segment, route_json, route_title, uploaded, route_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.status,
      row.activity_type,
      row.started_at,
      row.ended_at,
      row.paused_ms,
      row.pause_started_at,
      row.segment,
      row.route_json,
      row.route_title,
      row.uploaded,
      row.route_id,
    ],
  );
}

/** Devam eden (kaydediyor ya da duraklatılmış) kayıt; en fazla bir tane olur. */
export async function getOpenSession(): Promise<SessionRow | null> {
  const db = await getDb();
  return db.getFirstAsync<SessionRow>(
    `SELECT * FROM sessions WHERE status IN ('recording', 'paused') ORDER BY started_at DESC LIMIT 1`,
  );
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const db = await getDb();
  return db.getFirstAsync<SessionRow>(`SELECT * FROM sessions WHERE id = ?`, [id]);
}

export async function updateSession(
  id: string,
  patch: Partial<Omit<SessionRow, 'id'>>,
): Promise<void> {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const db = await getDb();
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  await db.runAsync(`UPDATE sessions SET ${sets} WHERE id = ?`, [
    ...keys.map((k) => patch[k] as string | number | null),
    id,
  ]);
}

/** Noktaları tek işlemde ekler (toplu yazım pil ve disk için daha ucuz). */
export async function insertPoints(sessionId: string, points: TrackPoint[]): Promise<void> {
  if (points.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const p of points) {
      await db.runAsync(
        `INSERT INTO points (session_id, seg, ts, lat, lng, alt, acc) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, p.seg, p.ts, p.lat, p.lng, p.alt, p.accuracy],
      );
    }
  });
}

export async function loadPoints(sessionId: string): Promise<TrackPoint[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    seg: number;
    ts: number;
    lat: number;
    lng: number;
    alt: number | null;
    acc: number | null;
  }>(`SELECT seg, ts, lat, lng, alt, acc FROM points WHERE session_id = ? ORDER BY id`, [
    sessionId,
  ]);
  return rows.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    alt: r.alt,
    accuracy: r.acc,
    ts: r.ts,
    seg: r.seg,
  }));
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM points WHERE session_id = ?`, [id]);
    await db.runAsync(`DELETE FROM sessions WHERE id = ?`, [id]);
  });
}

/** Hesap silinince bu cihazdaki tüm yerel kayıtları (oturumlar, noktalar, ayarlar) temizler. */
export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM points`);
    await db.runAsync(`DELETE FROM sessions`);
    await db.runAsync(`DELETE FROM settings`);
  });
}

/** Bitirilmiş ama henüz yüklenmemiş kayıtlar (kullanıcı Kaydet'e basmamış olanlar dahil). */
export async function listPendingUploads(): Promise<SessionRow[]> {
  const db = await getDb();
  return db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE status = 'finished' AND uploaded = 0 ORDER BY started_at`,
  );
}

/** Kullanıcının Kaydet'e bastığı ama yüklenemeyen kayıtlar: yükleme kuyruğu. */
export async function listQueuedUploads(): Promise<SessionRow[]> {
  const db = await getDb();
  return db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE status = 'finished' AND uploaded = 0 AND queued = 1 ORDER BY started_at`,
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/** Ayar anahtarları. Ayarlar ekranı (P1.7) aynı anahtarları kullanacak. */
export const SETTING_VOICE = 'voice_enabled';
