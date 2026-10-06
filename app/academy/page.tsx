import type { Metadata } from 'next';

import { JsonLd } from '@/components/json-ld';
import { AcademyPage } from '@/components/academy-page';
import { getPublishedCommunityPosts } from '@/lib/community-posts';
import { ACADEMY_URL, SITE_URL } from '@/lib/site';
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
  const courses = supabaseCourses ?? [];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'EducationalOrganization',
              name: 'Easy Medical Device Academy',
              url: ACADEMY_URL,
              parentOrganization: { '@type': 'Organization', name: 'Easy Medical Device', url: SITE_URL },
            },
            {
              '@type': 'ItemList',
              itemListElement: courses.map((course, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `${ACADEMY_URL}/course/${course.slug || course.id}`,
                name: course.title,
              })),
            },
          ],
        }}
      />
      <AcademyPage initialCourses={courses} communityPosts={communityPosts} />
    </>
  );
}
