import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { JsonLd } from '@/components/json-ld';
import { CourseDetailPage } from '@/components/course-detail-page';
import { getCurriculumForCourse } from '@/lib/curriculum-data';
import { ACADEMY_URL, SITE_URL } from '@/lib/site';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

type CourseDetailRouteProps = {
  params: Promise<{
    courseId: string;
  }>;
};

async function resolveCourse(courseId: string) {
  const publishedCourses = await getPublishedCoursesFromSupabase();

  return (
    publishedCourses?.find(
      (item) => item.id === courseId || item.slug === courseId,
    ) || null
  );
}

export async function generateMetadata({
  params,
}: CourseDetailRouteProps): Promise<Metadata> {
  const { courseId } = await params;
  const course = await resolveCourse(courseId);

  if (!course) {
    return { title: 'Course not found', robots: { index: false } };
  }

  const path = `/academy/course/${course.slug || course.id}`;
  const description = course.subtitle || `${course.title} - online course.`;

  return {
    title: `${course.title} | Easy Medical Device Academy`,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: course.title,
      description,
      url: path,
      type: 'website',
      images: course.image ? [course.image] : undefined,
    },
  };
}

export default async function AcademyCourseDetailRoute({
  params,
}: CourseDetailRouteProps) {
  const resolvedParams = await params;
  const course = await resolveCourse(resolvedParams.courseId);

  if (!course) {
    notFound();
  }

  const url = `${ACADEMY_URL}/course/${course.slug || course.id}`;
  const provider = {
    '@type': 'Organization',
    name: 'Easy Medical Device',
    url: SITE_URL,
  };

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Course',
              name: course.title,
              description: course.subtitle,
              url,
              image: course.image || undefined,
              provider,
              educationalLevel: course.level,
              inLanguage: 'en',
              offers: {
                '@type': 'Offer',
                price: course.price,
                priceCurrency: 'USD',
                availability: 'https://schema.org/InStock',
                url,
              },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Academy', item: ACADEMY_URL },
                { '@type': 'ListItem', position: 2, name: course.title, item: url },
              ],
            },
          ],
        }}
      />
      <CourseDetailPage
        course={course}
        initialCurriculum={getCurriculumForCourse(course.id)}
      />
    </>
  );
}
