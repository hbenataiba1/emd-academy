import {
  academyRestFetch,
  getAcademyUserFromRequest,
  json,
  readJson,
} from '@/lib/academy-auth';
import { getCurriculumForCourse } from '@/lib/curriculum-data';

type ProgressBody = {
  courseId?: string;
  lessonId?: string;
  completed?: boolean;
  progressPercent?: number;
};

type ProgressRow = {
  lesson_id: string;
  completed: boolean;
};

export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to save progress.' }, 401);
  }

  const body = await readJson<ProgressBody>(request, {});
  if (!body.courseId || !body.lessonId) {
    return json({ message: 'Missing course or lesson.' }, 400);
  }

  const enrollmentResponse = await academyRestFetch(
    `enrollments?select=id,status&user_id=eq.${encodeURIComponent(user.id)}&course_id=eq.${encodeURIComponent(body.courseId)}&limit=1`,
    { useServiceRole: true },
  );
  const enrollment = enrollmentResponse.ok
    ? ((await enrollmentResponse.json()) as { status?: string }[])
    : [];

  if (!['active', 'completed'].includes(enrollment[0]?.status || '')) {
    return json({ message: 'Enroll in this course before saving progress.' }, 403);
  }

  const completed = body.completed !== false;
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(body.progressPercent ?? (completed ? 100 : 0))),
  );

  const response = await academyRestFetch(
    'lesson_progress?on_conflict=user_id,course_id,lesson_id',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        learner_email: user.email,
        course_id: body.courseId,
        lesson_id: body.lessonId,
        completed,
        progress_percent: progressPercent,
        last_accessed_at: new Date().toISOString(),
      }),
      prefer: 'resolution=merge-duplicates,return=representation',
      useServiceRole: true,
    },
  );

  if (!response.ok) {
    return json({ message: await response.text() }, 502);
  }

  const certificate = await maybeIssueCertificate(user.id, body.courseId);

  return json({ saved: true, certificate });
}

async function maybeIssueCertificate(userId: string, courseId: string) {
  const curriculum = getCurriculumForCourse(courseId);
  const totalLessons = curriculum.sections.flatMap((section) => section.lessons)
    .length;

  if (!totalLessons) {
    return null;
  }

  const response = await academyRestFetch(
    `lesson_progress?select=lesson_id,completed&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&completed=eq.true`,
    { useServiceRole: true },
  );

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as ProgressRow[];
  const completedCount = new Set(rows.map((row) => row.lesson_id)).size;

  if (completedCount < totalLessons) {
    return null;
  }

  const certificateNumber = `EMDA-${new Date().getFullYear()}-${courseId
    .slice(0, 4)
    .toUpperCase()}-${userId.slice(0, 8).toUpperCase()}`;
  const certificateResponse = await academyRestFetch(
    'certificates?on_conflict=user_id,course_id',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        course_id: courseId,
        certificate_number: certificateNumber,
      }),
      prefer: 'resolution=ignore-duplicates,return=representation',
      useServiceRole: true,
    },
  );

  if (!certificateResponse.ok) {
    return null;
  }

  const certificateRows = (await certificateResponse.json()) as unknown[];

  await academyRestFetch(
    `enrollments?user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      prefer: 'return=minimal',
      useServiceRole: true,
    },
  );

  return certificateRows[0] || { certificate_number: certificateNumber };
}
