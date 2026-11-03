import type { Metadata } from 'next';

import { JsonLd } from '@/components/json-ld';
import { AcademyPage } from '@/components/academy-page';
import { ACADEMY_FAQ } from '@/lib/academy-faq';
import { getPublishedCommunityPosts } from '@/lib/community-posts';
import { ACADEMY_URL, SITE_URL } from '@/lib/site';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Medical Device Courses | EU MDR, IVDR & ISO 13485 Training',
  description:
    'Medical device courses on EU MDR, IVDR, ISO 13485, SaMD, risk management and market access. Learn at your own pace from real experts and get a verifiable certificate. Free courses available.',
  keywords: [
    'medical device courses',
    'medical device courses online',
    'medical device academy',
    'medical device training',
    'MDR training',
    'IVDR training',
    'ISO 13485 course',
    'medical device regulatory affairs course',
  ],
  alternates: { canonical: '/academy' },
  openGraph: {
    title: 'Medical Device Courses | Easy Medical Device Academy',
    description:
      'Medical device courses on EU MDR, IVDR and ISO 13485, taught by real experts, with a verifiable certificate.',
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
                'Medical device courses on EU MDR, IVDR, ISO 13485, SaMD, risk management and market access, with a verifiable certificate.',
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
              '@type': 'FAQPage',
              mainEntity: ACADEMY_FAQ.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: { '@type': 'Answer', text: item.answer },
              })),
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
