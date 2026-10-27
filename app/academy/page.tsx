import type { Metadata } from 'next';

import { JsonLd } from '@/components/json-ld';
import { AcademyPage } from '@/components/academy-page';
import { getPublishedCommunityPosts } from '@/lib/community-posts';
import { ACADEMY_URL, SITE_URL } from '@/lib/site';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Medical Device Academy | Online MDR, IVDR & ISO 13485 Courses',
  description:
    'Easy Medical Device Academy: online medical device courses on EU MDR, IVDR, ISO 13485, SaMD, risk management and market access, taught by experts, with a verifiable certificate.',
  keywords: [
    'medical device academy',
    'medical device courses',
    'medical device training',
    'MDR training',
    'IVDR training',
    'ISO 13485 course',
    'medical device regulatory affairs course',
  ],
  alternates: { canonical: '/academy' },
  openGraph: {
    title: 'Medical Device Academy | Online MDR, IVDR & ISO 13485 Courses',
    description:
      'Online medical device courses and certificates from Easy Medical Device Academy.',
    url: '/academy',
    type: 'website',
  },
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
              alternateName: 'Medical Device Academy',
              url: ACADEMY_URL,
              description:
                'Online medical device courses on EU MDR, IVDR, ISO 13485, SaMD, risk management and market access.',
              parentOrganization: { '@type': 'Organization', name: 'Easy Medical Device', url: SITE_URL },
            },
            {
              '@type': 'WebSite',
              name: 'Easy Medical Device Academy',
              alternateName: 'Medical Device Academy',
              url: ACADEMY_URL,
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Easy Medical Device', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Academy', item: ACADEMY_URL },
              ],
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
