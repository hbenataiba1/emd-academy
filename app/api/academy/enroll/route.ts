import {
  academyRestFetch,
  getAcademyCourseForAccess,
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  isFreeCourse,
  json,
  readJson,
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

  const existingResponse = await academyRestFetch(
    `enrollments?select=*&user_id=eq.${encodeURIComponent(user.id)}&course_id=eq.${encodeURIComponent(course.id)}&limit=1`,
    { useServiceRole: true },
  );
  const existing = existingResponse.ok
    ? ((await existingResponse.json()) as { status?: string }[])
    : [];

  if (existing[0]?.status === 'active' || existing[0]?.status === 'completed') {
    return json({ enrolled: true, course, status: existing[0].status });
  }

  if (!isFreeCourse(course)) {
    return json(
      {
        requiresPayment: true,
        course,
        message: 'This course is paid. Complete checkout to unlock it.',
      },
      402,
    );
  }

  const payload = {
    user_id: user.id,
    learner_email: user.email,
    learner_name: getAcademyDisplayName(user),
    course_id: course.id,
    amount_cents: 0,
    currency: 'usd',
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  const response = await academyRestFetch('enrollments?on_conflict=user_id,course_id', {
    method: 'POST',
    body: JSON.stringify(payload),
    prefer: 'resolution=merge-duplicates,return=representation',
    useServiceRole: true,
  });

  if (!response.ok) {
    const detail = await response.text();
    return json(
      {
        message:
          detail ||
          'Enrollment could not be saved. Check the Academy Supabase schema.',
      },
      502,
    );
  }

  const enrollment = await response.json();

  return json({ enrolled: true, course, enrollment });
}
