import { clearAllLocalData } from '@/lib/trackingDb';
import { supabase } from '@/lib/supabase';
import type { ActivityListItem, MyStats, PrivacyZoneInfo } from '@/types/database';

export const AVATAR_BUCKET = 'avatars';
export const ACTIVITIES_PAGE = 15;

export async function fetchMyStats(): Promise<MyStats> {
  const { data, error } = await supabase.rpc('my_stats');
  if (error) throw error;
  return data?.[0] ?? { total_distance_m: 0, activity_count: 0, total_duration_sec: 0 };
}

export async function fetchWeekly() {
  const { data, error } = await supabase.rpc('my_weekly_distance');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyActivities(
  userId: string,
  offset: number,
): Promise<ActivityListItem[]> {
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, title, activity_type, started_at, duration_sec, distance_m, avg_pace_sec_per_km, elevation_gain_m, route_id',
    )
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .range(offset, offset + ACTIVITIES_PAGE - 1);
  if (error) throw error;
  return data ?? [];
}

/**
 * Avatarı `avatars/{userId}/avatar.jpg` yoluna yükler (üzerine yazar) ve herkese açık adresi döner.
 * Önbellekteki eski görsel görünmesin diye adrese zaman damgası eklenir.
 */
export async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${userId}/avatar.jpg`;
  const up = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw up.error;
  const url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
  return `${url}?v=${Date.now()}`;
}

export async function fetchPrivacyZone(): Promise<PrivacyZoneInfo | null> {
  const { data, error } = await supabase.rpc('my_privacy_zone_info');
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function savePrivacyZone(lng: number, lat: number, radiusM: number): Promise<void> {
  const { error } = await supabase.rpc('set_privacy_zone', {
    p_lng: lng,
    p_lat: lat,
    p_radius_m: radiusM,
  });
  if (error) throw error;
}

export async function removePrivacyZone(): Promise<void> {
  const { error } = await supabase.rpc('clear_privacy_zone');
  if (error) throw error;
}

/**
 * Hesabı kalıcı siler (Edge Function: dosyalar, özel rotalar, auth kullanıcısı; kalan satırlar cascade).
 * Başarılı olunca bu cihazdaki yerel kayıtlar da silinir; oturum çıkışını çağıran yapar.
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
  await clearAllLocalData();
}
