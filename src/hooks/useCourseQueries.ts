import { useFocusEffect } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  enrollInCourse,
  fetchCourse,
  fetchCourseDay,
  fetchCourseDays,
  fetchCourses,
  fetchMyEnrollments,
  leaveCourse,
} from '@/lib/coursesApi';
import { useSessionStore } from '@/stores/sessionStore';

const useMyId = () => useSessionStore((s) => s.session?.user.id);

/** Katalog neredeyse hiç değişmez. */
export function useCourses() {
  return useQuery({ queryKey: ['courses'], queryFn: fetchCourses, staleTime: 10 * 60_000 });
}

export function useCourse(id: string | undefined) {
  return useQuery({
    queryKey: ['courses', id],
    enabled: !!id,
    queryFn: () => fetchCourse(id!),
    staleTime: 10 * 60_000,
  });
}

export function useCourseDays(courseId: string | undefined) {
  return useQuery({
    queryKey: ['course-days', courseId],
    enabled: !!courseId,
    queryFn: () => fetchCourseDays(courseId!),
    staleTime: 10 * 60_000,
  });
}

export function useCourseDay(id: string | undefined) {
  return useQuery({
    queryKey: ['course-day', id],
    enabled: !!id,
    queryFn: () => fetchCourseDay(id!),
    staleTime: 10 * 60_000,
  });
}

/** Kayıtlarım: antrenman bittikten sonra güncel görünsün diye ekrana her dönüşte yenilenir. */
export function useMyEnrollments() {
  const userId = useMyId();
  const query = useQuery({
    queryKey: ['enrollments', userId],
    enabled: !!userId,
    queryFn: fetchMyEnrollments,
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (userId) void refetch();
    }, [userId, refetch]),
  );
  return query;
}

export function useEnrollmentOp() {
  const userId = useMyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ op, courseId }: { op: 'join' | 'leave'; courseId: string }) => {
      if (!userId) throw new Error('oturum yok');
      if (op === 'join') await enrollInCourse(userId, courseId);
      else await leaveCourse(userId, courseId);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['enrollments', userId] }),
  });
}
