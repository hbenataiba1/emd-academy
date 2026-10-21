import {
  academyRestFetch,
  getAcademyCourseForAccess,
  getAcademyDisplayName,
  getAcademyEnrollmentForUser,
  getAcademyUserFromRequest,
  isFreeCourse,
  json,
  readJson,
} from '@/lib/academy-auth';
import { isEligibleForCertificate } from '@/lib/academy-certificates';

type Review = { rating: number; comment: string | null; updated_at: string };

// The learner's own review of a course (if they already sent one).
export async function GET(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id) {
      return json({ message: 'Please log in to continue.' }, 401);
    }

    const courseId = new URL(request.url).searchParams.get('courseId');
    if (!courseId) {
      return json({ message: 'Missing course.' }, 400);
    }

    const response = await academyRestFetch(
      `course_reviews?select=rating,comment,updated_at&user_id=eq.${encodeURIComponent(user.id)}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`,
      { useServiceRole: true },
    );

    // The reviews table has not been created yet: the survey is simply not offered.
    if (!response.ok) {
      return json({ available: false, review: null });
    }

    const review = ((await response.json()) as Review[])[0] || null;
    return json({ available: true, review });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'The survey could not be loaded.' },
      500,
    );
  }
}

// Saves (or updates) the learner's review once they have finished the course.
export async function POST(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id || !user.email) {
      return json({ message: 'Please log in to continue.' }, 401);
    }

    const body = await readJson<{ courseId?: string; rating?: number; comment?: string }>(
      request,
      {},
    );
    const rating = Math.round(Number(body.rating));

    if (!body.courseId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return json({ message: 'Choose a rating from 1 to 5 stars.' }, 400);
    }

    const enrollment = await getAcademyEnrollmentForUser({
      userId: user.id,
      learnerEmail: user.email,
      courseId: body.courseId,
    });

    if (!['active', 'completed'].includes(enrollment?.status || '')) {
      const course = await getAcademyCourseForAccess(body.courseId);
      if (!course || !isFreeCourse(course)) {
        return json({ message: 'Enroll in this course to review it.' }, 403);
      }
    }

    if (!(await isEligibleForCertificate(user.id, body.courseId))) {
      return json({ message: 'Finish the course to share your feedback.' }, 409);
    }

    const now = new Date().toISOString();
    const response = await academyRestFetch('course_reviews?on_conflict=user_id,course_id', {
      method: 'POST',
      body: JSON.stringify({
        course_id: body.courseId,
        user_id: user.id,
        learner_name: getAcademyDisplayName(user),
        learner_email: user.email,
        rating,
        comment: String(body.comment || '').trim().slice(0, 1000) || null,
        updated_at: now,
      }),
      prefer: 'resolution=merge-duplicates,return=minimal',
      useServiceRole: true,
    });

    if (!response.ok) {
      const text = await response.text();
      return json(
        {
          message: /course_reviews|schema cache|does not exist/i.test(text)
            ? 'The survey is not available yet.'
            : text || 'Your feedback could not be saved.',
        },
        502,
      );
    }

    return json({ saved: true });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'Your feedback could not be saved.' },
      500,
    );
  }
}
