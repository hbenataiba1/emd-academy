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

    return rows
      .map((row, index) => mapSupabaseCourse(row, index))
      .filter((course): course is AcademyCourse => Boolean(course));
  } catch {
    return null;
  }
}

function cleanEnv(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.replace(/\/$/, '') : undefined;
}
