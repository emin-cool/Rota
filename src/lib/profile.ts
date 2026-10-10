import { supabase } from '@/lib/supabase';
import type { ProfileRow, ProfileUpdate } from '@/types/database';

/**
 * `privacy_zone` kolonuna istemcinin SELECT izni yok (ev konumu sızmasın),
 * bu yüzden `select('*')` yerine açık kolon listesi kullanılır.
 */
export const PROFILE_COLUMNS =
  'id,user_id,username,display_name,avatar_url,level,activity_prefs,default_pace_sec_per_km,is_private,onboarding_completed,created_at,updated_at';

export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

export async function updateMyProfile(userId: string, patch: ProfileUpdate): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return data as ProfileRow;
}
