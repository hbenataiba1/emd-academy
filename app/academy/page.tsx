import type { Metadata } from 'next';

import { AcademyPage } from '@/components/academy-page';
import { featuredCourses } from '@/lib/academy-data';
import { getPublishedCommunityPosts } from '@/lib/community-posts';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Medical Device Compliance Courses | Easy Medical Device Academy',
  description:
    'Online medical device compliance courses for MDR, IVDR, ISO 13485, SaMD, risk management, and market access.',
  alternates: { canonical: '/academy' },
};

export default async function AcademyRoute() {
  const [supabaseCourses, communityPosts] = await Promise.all([
    getPublishedCoursesFromSupabase(),
    getPublishedCommunityPosts(),
  ]);
  const courses = supabaseCourses?.length ? supabaseCourses : featuredCourses;

  return <AcademyPage initialCourses={courses} communityPosts={communityPosts} />;
}
