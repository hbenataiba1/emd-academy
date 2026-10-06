import { AcademyPage } from '@/components/academy-page';
import { featuredCourses } from '@/lib/academy-data';
import { getPublishedCommunityPosts } from '@/lib/community-posts';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

export default async function AcademyRoute() {
  const [supabaseCourses, communityPosts] = await Promise.all([
    getPublishedCoursesFromSupabase(),
    getPublishedCommunityPosts(),
  ]);
  const courses = supabaseCourses?.length ? supabaseCourses : featuredCourses;

  return <AcademyPage initialCourses={courses} communityPosts={communityPosts} />;
}
