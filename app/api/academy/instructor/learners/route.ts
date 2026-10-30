import { academyRestFetch, json } from '@/lib/academy-auth';
import { getOwnCourses, inFilter, requireInstructor } from '@/lib/academy-instructor';

type Enrollment = {
  id: string;
  user_id: string;
  course_id: string;
  learner_email: string;
  learner_name: string | null;
  amount_cents: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
};

async function rows<T>(path: string): Promise<T[]> {
  const response = await academyRestFetch(path, { useServiceRole: true });
  return response.ok ? ((await response.json()) as T[]) : [];
}

// Everyone enrolled in the instructor's courses, with their progress and certificate.
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const courses = await getOwnCourses(auth.user.id);
  const filter = inFilter(courses.map((course) => course.id));
  if (!filter) return json({ rows: [] });

  const [enrollments, lessons, progress, certificates] = await Promise.all([
    rows<Enrollment>(
      `enrollments?select=id,user_id,course_id,learner_email,learner_name,amount_cents,status,created_at,completed_at&course_id=${filter}&status=in.(active,completed,refunded)&order=created_at.desc&limit=2000`,
    ),
    rows<{ id: string; course_id: string }>(`lessons?select=id,course_id&course_id=${filter}`),
    rows<{ user_id: string; course_id: string; lesson_id: string; completed: boolean; last_accessed_at: string | null }>(
      `lesson_progress?select=user_id,course_id,lesson_id,completed,last_accessed_at&course_id=${filter}&limit=50000`,
    ),
    rows<{ user_id: string; course_id: string; certificate_number: string; issued_at: string }>(
      `certificates?select=user_id,course_id,certificate_number,issued_at&course_id=${filter}`,
    ),
  ]);

  const titles = new Map(courses.map((course) => [course.id, course.title]));
  const lessonIds = new Map<string, string[]>();
  lessons.forEach((lesson) => lessonIds.set(lesson.course_id, [...(lessonIds.get(lesson.course_id) || []), lesson.id]));

  const done = new Map<string, { lessons: Set<string>; last: string | null }>();
  progress.forEach((row) => {
    const key = `${row.user_id}:${row.course_id}`;
    const entry = done.get(key) || { lessons: new Set<string>(), last: null };
    if (row.completed) entry.lessons.add(row.lesson_id);
    if (row.last_accessed_at && (!entry.last || row.last_accessed_at > entry.last)) entry.last = row.last_accessed_at;
    done.set(key, entry);
  });

  const certificateByKey = new Map(certificates.map((item) => [`${item.user_id}:${item.course_id}`, item]));

  return json({
    rows: enrollments.map((enrollment) => {
      const key = `${enrollment.user_id}:${enrollment.course_id}`;
      const ids = lessonIds.get(enrollment.course_id) || [];
      const entry = done.get(key);
      const certificate = certificateByKey.get(key);
      const finished = enrollment.status === 'completed' || Boolean(enrollment.completed_at) || Boolean(certificate);
      const lessonsDone = ids.filter((id) => entry?.lessons.has(id)).length;

      return {
        id: enrollment.id,
        userId: enrollment.user_id,
        name: enrollment.learner_name || enrollment.learner_email.split('@')[0],
        email: enrollment.learner_email,
        courseId: enrollment.course_id,
        courseTitle: titles.get(enrollment.course_id) || enrollment.course_id,
        amountCents: enrollment.amount_cents || 0,
        status: enrollment.status,
        enrolledAt: enrollment.created_at,
        completedAt: enrollment.completed_at || certificate?.issued_at || null,
        progress: finished ? 100 : ids.length ? Math.min(100, Math.round((lessonsDone / ids.length) * 100)) : 0,
        lessonsDone: finished ? ids.length : lessonsDone,
        lessonsTotal: ids.length,
        lastActivity: entry?.last || null,
        certificateNumber: certificate?.certificate_number || null,
        certificateIssuedAt: certificate?.issued_at || null,
      };
    }),
  });
}
