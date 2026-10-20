import { academyRestFetch } from '@/lib/academy-auth';

export async function saveLessonProgress({
  userId,
  learnerEmail,
  courseId,
  lessonId,
  completed,
  progressPercent,
}: {
  userId: string;
  learnerEmail: string;
  courseId: string;
  lessonId: string;
  completed: boolean;
  progressPercent: number;
}) {
  const now = new Date().toISOString();
  const modernResponse = await academyRestFetch(
    'lesson_progress?on_conflict=user_id,course_id,lesson_id',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        learner_email: learnerEmail,
        course_id: courseId,
        lesson_id: lessonId,
        completed,
        progress_percent: progressPercent,
        last_accessed_at: now,
        updated_at: now,
      }),
      prefer: 'resolution=merge-duplicates,return=representation',
      useServiceRole: true,
    },
  );

  if (modernResponse.ok) {
    return;
  }

  const legacyResponse = await academyRestFetch(
    'lesson_progress?on_conflict=learner_email,course_id,lesson_id',
    {
      method: 'POST',
      body: JSON.stringify({
        learner_email: learnerEmail,
        course_id: courseId,
        lesson_id: lessonId,
        completed,
        progress_percent: progressPercent,
        last_accessed_at: now,
      }),
      prefer: 'resolution=merge-duplicates,return=representation',
      useServiceRole: true,
    },
  );

  if (!legacyResponse.ok) {
    throw new Error(await legacyResponse.text());
  }
}
