import { academyRestFetch, json } from '@/lib/academy-auth';
import { getOwnCourses, inFilter, requireInstructor } from '@/lib/academy-instructor';

async function rows<T>(path: string): Promise<T[]> {
  const response = await academyRestFetch(path, { useServiceRole: true });
  return response.ok ? ((await response.json()) as T[]) : [];
}

// The numbers shown at the top of the instructor dashboard.
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const courses = await getOwnCourses(auth.user.id);
  const filter = inFilter(courses.map((course) => course.id));

  if (!filter) {
    return json({ courses: 0, published: 0, enrollments: 0, learners: 0, certificates: 0, reviews: 0, rating: 0, unanswered: 0 });
  }

  const [enrollments, certificates, reviews, comments] = await Promise.all([
    rows<{ user_id: string }>(`enrollments?select=user_id&course_id=${filter}&status=in.(active,completed)&limit=5000`),
    rows<{ id: string }>(`certificates?select=id&course_id=${filter}&limit=5000`),
    rows<{ rating: number }>(`course_reviews?select=rating&course_id=${filter}&limit=5000`),
    rows<{ id: string; parent_id: string | null; is_staff: boolean }>(
      `lesson_comments?select=id,parent_id,is_staff&course_id=${filter}&limit=5000`,
    ),
  ]);

  const answered = new Set(comments.filter((row) => row.is_staff && row.parent_id).map((row) => row.parent_id));
  const unanswered = comments.filter((row) => !row.parent_id && !row.is_staff && !answered.has(row.id)).length;

  return json({
    courses: courses.length,
    published: courses.filter((course) => course.is_published).length,
    enrollments: enrollments.length,
    learners: new Set(enrollments.map((row) => row.user_id)).size,
    certificates: certificates.length,
    reviews: reviews.length,
    rating: reviews.length ? reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length : 0,
    unanswered,
  });
}
