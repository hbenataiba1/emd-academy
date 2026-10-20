import {
  academyRestFetch,
  getAcademyEnrollmentForUser,
  getAcademyCourseForAccess,
  getAcademyUserFromRequest,
  isFreeCourse,
  json,
  readJson,
} from '@/lib/academy-auth';
import {
  ensureCertificate,
  isEligibleForCertificate,
} from '@/lib/academy-certificates';
import { saveLessonProgress } from '@/lib/academy-progress';

type ProgressBody = {
  courseId?: string;
  lessonId?: string;
  completed?: boolean;
  progressPercent?: number;
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

  const enrollment = await getAcademyEnrollmentForUser({
    userId: user.id,
    learnerEmail: user.email,
    courseId: body.courseId,
  });

  if (!['active', 'completed'].includes(enrollment?.status || '')) {
    const course = await getAcademyCourseForAccess(body.courseId);
    if (!course || !isFreeCourse(course)) {
      return json({ message: 'Enroll in this course before saving progress.' }, 403);
    }
  }

  const completed = body.completed !== false;
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(body.progressPercent ?? (completed ? 100 : 0))),
  );

  try {
    await saveLessonProgress({
      userId: user.id,
      learnerEmail: user.email,
      courseId: body.courseId,
      lessonId: body.lessonId,
      completed,
      progressPercent,
    });
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Progress could not be saved.',
      },
      502,
    );
  }

  // Issue the certificate as soon as it has been earned (exam passed, or every
  // lesson done for a course without an exam).
  let certificate = null;
  try {
    if (completed && (await isEligibleForCertificate(user.id, body.courseId))) {
      certificate = await ensureCertificate(user.id, body.courseId);
    }
  } catch {
    // The player asks for the certificate explicitly, so this is not fatal.
  }

  return json({ saved: true, certificate });
}

