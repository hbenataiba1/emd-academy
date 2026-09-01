import { AcademyPage } from '@/components/academy-page';
import { featuredCourses } from '@/lib/academy-data';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

export default async function AcademyRoute() {
  const supabaseCourses = await getPublishedCoursesFromSupabase();
  const courses = supabaseCourses?.length ? supabaseCourses : featuredCourses;

  return <AcademyPage initialCourses={courses} />;
}
