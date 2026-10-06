import type { MetadataRoute } from 'next';

import { featuredCourses } from '@/lib/academy-data';
import { ACADEMY_URL } from '@/lib/site';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = await getPublishedCoursesFromSupabase().catch(() => null);
  const courses = published?.length ? published : featuredCourses;

  return [
    { url: ACADEMY_URL, changeFrequency: 'weekly', priority: 1 },
    ...courses.map((course) => ({
      url: `${ACADEMY_URL}/course/${course.slug || course.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
