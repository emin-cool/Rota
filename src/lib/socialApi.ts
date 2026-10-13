import { supabase } from '@/lib/supabase';
import type {
  ActivityComment,
  ActivityType,
  FeedActivity,
  FollowRequest,
  PersonRow,
  ProfileCard,
  SocialCounts,
} from '@/types/database';

export const FEED_PAGE = 10;
export const COMMENTS_PAGE = 50;
export const PEOPLE_PAGE = 30;

export async function fetchFeed(opts: {
  scope?: 'following' | 'user';
  userId?: string;
  activity?: ActivityType | null;
  before?: string | null;
}): Promise<FeedActivity[]> {
  const { data, error } = await supabase.rpc('feed_activities', {
    p_scope: opts.scope ?? 'following',
    p_user: opts.userId ?? null,
    p_activity: opts.activity ?? null,
    p_before: opts.before ?? null,
    p_limit: FEED_PAGE,
  });
  if (error) throw error;
  return data ?? [];
}

export async function fetchActivity(id: string): Promise<FeedActivity | null> {
  const { data, error } = await supabase.rpc('feed_activities', {
    p_scope: 'one',
    p_id: id,
    p_limit: 1,
    p_full_track: true,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchComments(
  activityId: string,
  offset: number,
): Promise<ActivityComment[]> {
  const { data, error } = await supabase.rpc('activity_comments', {
    p_id: activityId,
    p_limit: COMMENTS_PAGE,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

export async function addComment(userId: string, activityId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .insert({ activity_id: activityId, user_id: userId, body });
  if (error) throw error;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

/** Alkış ekle / geri al. Zaten alkışlanmışsa (23505) sorun değil. */
export async function setKudos(userId: string, activityId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from('kudos')
      .insert({ activity_id: activityId, user_id: userId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase
      .from('kudos')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export async function fetchProfileCard(userId: string): Promise<ProfileCard | null> {
  const { data, error } = await supabase.rpc('profile_card', { p_user: userId });
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchSocialCounts(): Promise<SocialCounts> {
  const { data, error } = await supabase.rpc('my_social_counts');
  if (error) throw error;
  return (
    data?.[0] ?? { followers_count: 0, following_count: 0, pending_requests: 0, route_count: 0 }
  );
}

export async function fetchFollowList(
  userId: string,
  kind: 'followers' | 'following',
  offset: number,
): Promise<PersonRow[]> {
  const { data, error } = await supabase.rpc('follow_list', {
    p_user: userId,
    p_kind: kind,
    p_limit: PEOPLE_PAGE,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

export async function searchProfiles(query: string): Promise<PersonRow[]> {
  const { data, error } = await supabase.rpc('search_profiles', { p_query: query, p_limit: 20 });
  if (error) throw error;
  return data ?? [];
}

export async function fetchFollowRequests(offset: number): Promise<FollowRequest[]> {
  const { data, error } = await supabase.rpc('follow_requests', {
    p_limit: PEOPLE_PAGE,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

/** Takip et: gizli hesapta istek olarak, değilse hemen kabul edilmiş olarak oluşur (durumu sunucu seçer). */
export async function followUser(myId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: myId, following_id: targetId });
  if (error && error.code !== '23505') throw error;
}

/** Takibi bırak ya da gönderilmiş isteği geri çek. */
export async function unfollowUser(myId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', myId)
    .eq('following_id', targetId);
  if (error) throw error;
}

/** Bana gelen isteği kabul et. */
export async function acceptRequest(myId: string, followerId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('follower_id', followerId)
    .eq('following_id', myId);
  if (error) throw error;
}

/** Bana gelen isteği reddet ya da takipçiyi çıkar. */
export async function removeFollower(myId: string, followerId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', myId);
  if (error) throw error;
}
