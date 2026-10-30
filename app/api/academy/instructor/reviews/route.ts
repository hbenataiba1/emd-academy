import { academyRestFetch, json } from '@/lib/academy-auth';
import { getOwnCourses, inFilter, requireInstructor } from '@/lib/academy-instructor';

// The ratings and comments learners left on the instructor's courses.
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const courses = await getOwnCourses(auth.user.id);
  const filter = inFilter(courses.map((course) => course.id));
  if (!filter) return json({ reviews: [] });

  const response = await academyRestFetch(
    `course_reviews?select=id,course_id,learner_name,rating,comment,updated_at&course_id=${filter}&order=updated_at.desc&limit=1000`,
    { useServiceRole: true },
  );
  if (!response.ok) return json({ reviews: [] });

  const titles = new Map(courses.map((course) => [course.id, course.title]));
  const reviews = (await response.json()) as {
    id: string;
    course_id: string;
    learner_name: string | null;
    rating: number;
    comment: string | null;
    updated_at: string;
  }[];

  return json({
    reviews: reviews.map((review) => ({
      id: review.id,
      courseTitle: titles.get(review.course_id) || review.course_id,
      learnerName: review.learner_name || 'Learner',
      rating: review.rating,
      comment: review.comment,
      date: review.updated_at,
    })),
  });
}
