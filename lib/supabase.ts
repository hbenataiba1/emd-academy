import { formatMinutes } from '@/lib/format-duration';
import {
  mapSupabaseCourse,
  type AcademyCourse,
  type SupabaseCourseRow,
} from '@/lib/academy-data';

export async function getPublishedCoursesFromSupabase(): Promise<
  AcademyCourse[] | null
> {
  const supabaseUrl = cleanEnv(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const supabaseKey = cleanEnv(
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const endpoint = new URL('/rest/v1/courses', supabaseUrl);
  endpoint.searchParams.set('select', '*');
  endpoint.searchParams.set('is_published', 'eq.true');
  endpoint.searchParams.set('order', 'sort_order.asc,title.asc');

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const rows = (await response.json()) as SupabaseCourseRow[];

    const courses = rows
      .map((row, index) => mapSupabaseCourse(row, index))
      .filter((course): course is AcademyCourse => Boolean(course));

    // The company of each instructor, shown next to their name on the course page.
    // Courses made by the team itself belong to Easy Medical Device.
    try {
      const instructorByCourse = new Map<string, string>();
      rows.forEach((row) => {
        const courseKey = row.id || row.slug;
        if (courseKey && row.instructor_id) instructorByCourse.set(courseKey, row.instructor_id);
      });

      const companies = new Map<string, string>();
      if (instructorByCourse.size > 0) {
        const ids = [...new Set(instructorByCourse.values())];
        const instructorsEndpoint = new URL('/rest/v1/instructors', supabaseUrl);
        instructorsEndpoint.searchParams.set('select', 'user_id,company');
        instructorsEndpoint.searchParams.set('user_id', `in.(${ids.join(',')})`);
        // The instructors table is private, so this server-side read uses the service key.
        const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
        if (serviceKey) {
          const instructorsResponse = await fetch(instructorsEndpoint, {
            headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
            cache: 'no-store',
          });
          if (instructorsResponse.ok) {
            ((await instructorsResponse.json()) as { user_id: string; company?: string | null }[]).forEach(
              (item) => {
                if (item.company?.trim()) companies.set(item.user_id, item.company.trim());
              },
            );
          }
        }
      }

      courses.forEach((course) => {
        const instructorId = instructorByCourse.get(course.id);
        course.instructorCompany = instructorId ? companies.get(instructorId) : 'Easy Medical Device';
      });
    } catch {
      // the course page simply shows the instructor without a company
    }

    // Show how many real lessons each course has (the final exam is not counted).
    // This is read from the lessons themselves, so it can never drift.
    try {
      const lessonsEndpoint = new URL('/rest/v1/lessons', supabaseUrl);
      lessonsEndpoint.searchParams.set('select', 'course_id,lesson_type,duration_minutes');
      // Lessons are not public, so this server-side read uses the service key.
      const lessonsKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || supabaseKey;
      const lessonsResponse = await fetch(lessonsEndpoint, {
        headers: {
          apikey: lessonsKey,
          authorization: `Bearer ${lessonsKey}`,
        },
        cache: 'no-store',
      });

      if (lessonsResponse.ok) {
        const lessons = (await lessonsResponse.json()) as {
          course_id: string;
          lesson_type?: string;
          duration_minutes?: number | null;
        }[];
        const counts = new Map<string, number>();
        const minutes = new Map<string, number>();
        lessons.forEach((lesson) => {
          if (lesson.lesson_type !== 'quiz') {
            counts.set(lesson.course_id, (counts.get(lesson.course_id) || 0) + 1);
            minutes.set(
              lesson.course_id,
              (minutes.get(lesson.course_id) || 0) + (lesson.duration_minutes || 0),
            );
          }
        });

        courses.forEach((course) => {
          if (counts.has(course.id)) course.lessons = counts.get(course.id)!;
          // The real length of the lessons (the exam is not counted); empty when the
          // lesson lengths have not been filled in, so no made-up number is shown.
          if (minutes.has(course.id)) course.duration = formatMinutes(minutes.get(course.id)!);
        });
      }
    } catch {
      // keep the stored lesson counts
    }

    return courses;
  } catch {
    return null;
  }
}

function cleanEnv(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.replace(/\/$/, '') : undefined;
}
