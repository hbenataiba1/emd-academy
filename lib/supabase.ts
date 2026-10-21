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

    // Show how many real lessons each course has (the final exam is not counted).
    // This is read from the lessons themselves, so it can never drift.
    try {
      const lessonsEndpoint = new URL('/rest/v1/lessons', supabaseUrl);
      lessonsEndpoint.searchParams.set('select', 'course_id,lesson_type');
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
        }[];
        const counts = new Map<string, number>();
        lessons.forEach((lesson) => {
          if (lesson.lesson_type !== 'quiz') {
            counts.set(lesson.course_id, (counts.get(lesson.course_id) || 0) + 1);
          }
        });

        courses.forEach((course) => {
          if (counts.has(course.id)) course.lessons = counts.get(course.id)!;
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
