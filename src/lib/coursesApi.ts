import { supabase } from '@/lib/supabase';
import type { BadgeRow, CourseDayRow, CourseEnrollmentRow, CourseRow } from '@/types/database';

export async function fetchCourses(): Promise<CourseRow[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourse(id: string): Promise<CourseRow | null> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchCourseDays(courseId: string): Promise<CourseDayRow[]> {
  const { data, error } = await supabase
    .from('course_days')
    .select('*')
    .eq('course_id', courseId)
    .order('week_no', { ascending: true })
    .order('day_no', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCourseDay(id: string): Promise<CourseDayRow | null> {
  const { data, error } = await supabase.from('course_days').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Yalnızca kendi kayıtların (RLS). */
export async function fetchMyEnrollments(): Promise<CourseEnrollmentRow[]> {
  const { data, error } = await supabase
    .from('course_enrollments')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

const PG_UNIQUE_VIOLATION = '23505';

/** Zaten kayıtlıysa sessizce başarılı sayılır. */
export async function enrollInCourse(userId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from('course_enrollments')
    .insert({ user_id: userId, course_id: courseId });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw error;
}

export async function leaveCourse(userId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from('course_enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('course_id', courseId);
  if (error) throw error;
}

/** Bugün (yerel gün) bir kurs antrenmanı kaydedildi mi? Hatırlatıcı bugünü atlasın diye. */
export async function hasCourseWorkoutToday(userId: string, now = new Date()): Promise<boolean> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { count, error } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('course_day_id', 'is', null)
    .gte('started_at', startOfToday.toISOString());
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Kazandığım rozetler (kurs başlığıyla), yeniden eskiye. */
export async function fetchMyBadges(): Promise<{ badge: BadgeRow; earnedAt: string }[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('earned_at, badge_id')
    .order('earned_at', { ascending: false });
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.badge_id);
  if (ids.length === 0) return [];
  const badges = await supabase.from('badges').select('*').in('id', ids);
  if (badges.error) throw badges.error;
  const byId = new Map((badges.data ?? []).map((b) => [b.id, b]));
  return (data ?? []).flatMap((r) => {
    const badge = byId.get(r.badge_id);
    return badge ? [{ badge, earnedAt: r.earned_at }] : [];
  });
}
