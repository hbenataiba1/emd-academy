import {
  explainSupabaseEnrollmentError,
  getAcademyEnrollmentForUser,
  getAcademyCourseForAccess,
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  isFreeCourse,
  json,
  readJson,
  saveAcademyEnrollment,
} from '@/lib/academy-auth';

type EnrollBody = {
  courseId?: string;
};

export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to continue.' }, 401);
  }

  const body = await readJson<EnrollBody>(request, {});
  if (!body.courseId) {
    return json({ message: 'Choose a course before enrolling.' }, 400);
  }

  const course = await getAcademyCourseForAccess(body.courseId);
  if (!course) {
    return json({ message: 'This course is not available.' }, 404);
  }

  const freeCourse = isFreeCourse(course);

  try {
    const existing = await getAcademyEnrollmentForUser({
      userId: user.id,
      learnerEmail: user.email,
      courseId: course.id,
    });

    if (existing?.status === 'active' || existing?.status === 'completed') {
      return json({ enrolled: true, course, status: existing.status });
    }
  } catch (error) {
    if (freeCourse) {
      return json({
        enrolled: true,
        course,
        enrollmentWarning: explainSupabaseEnrollmentError(
          error instanceof Error ? error.message : '',
        ),
      });
    }

    return json(
      {
        message: explainSupabaseEnrollmentError(
          error instanceof Error ? error.message : '',
        ),
      },
      502,
    );
  }

  if (!freeCourse) {
    return json(
      {
        requiresPayment: true,
        course,
        message: 'This course is paid. Complete checkout to unlock it.',
      },
      402,
    );
  }

  try {
    const enrollment = await saveAcademyEnrollment({
      userId: user.id,
      learnerEmail: user.email,
      learnerName: getAcademyDisplayName(user),
      courseId: course.id,
      amountCents: 0,
      currency: 'usd',
      status: 'active',
    });

    return json({ enrolled: true, course, enrollment });
  } catch (error) {
    return json({
      enrolled: true,
      course,
      enrollmentWarning: explainSupabaseEnrollmentError(
        error instanceof Error ? error.message : '',
      ),
    });
  }
}
