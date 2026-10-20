import {
  academyRestFetch,
  getAcademyCourseForAccess,
  getAcademyEnrollmentForUser,
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

type CertificateBody = {
  courseId?: string;
  /** The exam lesson the learner has just passed. */
  lessonId?: string;
  examPassed?: boolean;
};

// Returns the learner's certificate record for a course, creating it when they
// have earned it. Every certificate shown or downloaded comes from here, so the
// QR code on it always leads to a record that exists.
export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to get your certificate.' }, 401);
  }

  const body = await readJson<CertificateBody>(request, {});
  if (!body.courseId) {
    return json({ message: 'Missing course.' }, 400);
  }

  const enrollment = await getAcademyEnrollmentForUser({
    userId: user.id,
    learnerEmail: user.email,
    courseId: body.courseId,
  });

  if (!['active', 'completed'].includes(enrollment?.status || '')) {
    const course = await getAcademyCourseForAccess(body.courseId);
    if (!course || !isFreeCourse(course)) {
      return json({ message: 'Enroll in this course to get its certificate.' }, 403);
    }
  }

  try {
    // The exam is graded in the player. Record it, so the certificate does not
    // depend on an earlier progress request having reached the server.
    if (body.examPassed && body.lessonId) {
      const lesson = await academyRestFetch(
        `lessons?select=id,lesson_type&id=eq.${encodeURIComponent(body.lessonId)}&course_id=eq.${encodeURIComponent(body.courseId)}&limit=1`,
        { useServiceRole: true },
      );
      const row = lesson.ok
        ? ((await lesson.json()) as { id: string; lesson_type?: string }[])[0]
        : null;

      if (row?.lesson_type === 'quiz') {
        await saveLessonProgress({
          userId: user.id,
          learnerEmail: user.email,
          courseId: body.courseId,
          lessonId: row.id,
          completed: true,
          progressPercent: 100,
        });
      }
    }

    if (!(await isEligibleForCertificate(user.id, body.courseId))) {
      return json(
        { message: 'Pass the certification exam to unlock your certificate.' },
        409,
      );
    }

    const certificate = await ensureCertificate(user.id, body.courseId);
    return json({ certificate });
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'The certificate could not be created.',
      },
      502,
    );
  }
}
