import { supabase } from '@/lib/supabase';
import type { CourseDayRow, CourseEnrollmentRow, CourseRow } from '@/types/database';

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
