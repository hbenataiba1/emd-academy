import type { Metadata } from 'next';

import { CourseDetailPage } from '@/components/course-detail-page';
import { featuredCourses } from '@/lib/academy-data';
import { getAcademyCourseForAccess } from '@/lib/academy-auth';
import { getCurriculumForCourse } from '@/lib/curriculum-data';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

type CourseDetailRouteProps = {
  params: Promise<{
    courseId: string;
  }>;
};

async function resolveCourse(courseId: string) {
  const [liveCourse, publishedCourses] = await Promise.all([
    getAcademyCourseForAccess(courseId),
    getPublishedCoursesFromSupabase(),
  ]);

  return (
    liveCourse ||
    publishedCourses?.find(
      (item) => item.id === courseId || item.slug === courseId,
    ) ||
    featuredCourses.find((item) => item.id === courseId || item.slug === courseId) ||
    featuredCourses[0]
  );
}

export async function generateMetadata({
  params,
}: CourseDetailRouteProps): Promise<Metadata> {
  const { courseId } = await params;
  const course = await resolveCourse(courseId || 'eu-mdr-technical-file');
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
  const course = await resolveCourse(
    resolvedParams.courseId || 'eu-mdr-technical-file',
  );

  return (
    <CourseDetailPage
      course={course}
      initialCurriculum={getCurriculumForCourse(course.id)}
    />
  );
}
