import { summarize, toLineEwkt } from '@/lib/activitySummary';
import { supabase } from '@/lib/supabase';
import { listQueuedUploads, loadPoints, updateSession, type SessionRow } from '@/lib/trackingDb';

/**
 * Bitirilen kaydı Supabase'e yükler. Her adım tekrar denemeye dayanıklıdır (idempotent):
 *  - activities.id = yerel oturum UUID'si → ikinci insert 23505 verir, "yüklenmiş" sayılır
 *    (completion_count trigger'ı yalnızca gerçek insert'te çalışır, çift sayılmaz).
 *  - Fotoğraf dosya yolu sabit (upsert) ve her fotoğrafın durumu yerelde işaretlenir.
 *  - Yorum: insert, çakışırsa update.
 * Gizlilik bölgesi kırpması veritabanı trigger'ında yapılır (istemciye güvenilmez).
 */

export type ReviewDraft = { rating: number; tags: string[]; comment: string };
export type PhotoDraft = { uri: string; done: boolean };

const PG_UNIQUE_VIOLATION = '23505';
export const PHOTO_BUCKET = 'route-photos';
export const MAX_PHOTOS = 5;

export function parseReview(json: string | null): ReviewDraft | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as ReviewDraft;
    return r.rating >= 1 && r.rating <= 5 ? r : null;
  } catch {
    return null;
  }
}

export function parsePhotos(json: string | null): PhotoDraft[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as PhotoDraft[];
  } catch {
    return [];
  }
}

async function insertActivity(row: SessionRow, userId: string): Promise<void> {
  const points = await loadPoints(row.id);
  const s = summarize(row, points);
  const { error } = await supabase.from('activities').insert({
    id: row.id,
    user_id: userId,
    route_id: row.route_id,
    activity_type: row.activity_type,
    started_at: new Date(row.started_at).toISOString(),
    duration_sec: s.durationSec,
    moving_sec: s.movingSec,
    distance_m: s.distanceM,
    avg_pace_sec_per_km: s.avgPaceSecPerKm,
    elevation_gain_m: s.ascentM,
    track: toLineEwkt(s.track),
    visibility: row.visibility ?? 'followers',
    title: row.title,
  });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;
}

/** Fotoğrafı `route-photos/{userId}/{name}` yoluna yükler ve `route_photos` satırını ekler. */
export async function uploadRoutePhoto(
  userId: string,
  routeId: string,
  name: string,
  body: ArrayBuffer,
): Promise<void> {
  const path = `${userId}/${name}`;
  const up = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabase
    .from('route_photos')
    .insert({ route_id: routeId, user_id: userId, url });
  if (error) throw error;
}

async function uploadPhotos(row: SessionRow, userId: string): Promise<void> {
  if (!row.route_id) return;
  const photos = parsePhotos(row.photos_json);
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    if (photo.done) continue;
    let body: ArrayBuffer;
    try {
      body = await (await fetch(photo.uri)).arrayBuffer();
    } catch {
      // Yerel dosya silinmiş (önbellek temizlenmiş olabilir): bu fotoğraftan vazgeç, kuyruğu tıkama.
      photos[i] = { ...photo, done: true };
      continue;
    }
    await uploadRoutePhoto(userId, row.route_id, `${row.id}-${i}.jpg`, body);
    photos[i] = { ...photo, done: true };
    await updateSession(row.id, { photos_json: JSON.stringify(photos) });
  }
}

/** Yorumu ekler; bu rotaya zaten yorum yazılmışsa günceller (route_id/user_id kolonları güncellenemez). */
export async function saveReview(
  userId: string,
  routeId: string,
  review: ReviewDraft,
): Promise<void> {
  const comment = review.comment.trim() || null;
  const { error } = await supabase.from('route_reviews').insert({
    route_id: routeId,
    user_id: userId,
    rating: review.rating,
    comment,
    tags: review.tags,
  });
  if (!error) return;
  if (error.code !== PG_UNIQUE_VIOLATION) throw error;
  const upd = await supabase
    .from('route_reviews')
    .update({ rating: review.rating, comment, tags: review.tags })
    .eq('route_id', routeId)
    .eq('user_id', userId);
  if (upd.error) throw upd.error;
}

async function uploadReview(row: SessionRow, userId: string): Promise<void> {
  const review = parseReview(row.review_json);
  if (!review || !row.route_id) return;
  await saveReview(userId, row.route_id, review);
}

/** Sırayla: aktivite → fotoğraflar → yorum. Hata atarsa kayıt kuyrukta kalır. */
export async function uploadSession(row: SessionRow, userId: string): Promise<void> {
  await insertActivity(row, userId);
  await uploadPhotos(row, userId);
  await uploadReview(row, userId);
  await updateSession(row.id, { uploaded: 1, queued: 0 });
}

let running = false;

/** Kuyruktaki kayıtları yükler; eşzamanlı çağrılar tek çalışmaya indirilir. Yüklenen sayıyı döner. */
export async function processUploadQueue(userId: string): Promise<number> {
  if (running) return 0;
  running = true;
  let done = 0;
  try {
    for (const row of await listQueuedUploads()) {
      try {
        await uploadSession(row, userId);
        done++;
      } catch (e) {
        // İnternet yok / geçici hata: sonra tekrar denenecek.
        if (__DEV__) console.warn('[upload] ertelendi:', e instanceof Error ? e.message : e);
      }
    }
  } finally {
    running = false;
  }
  return done;
}
