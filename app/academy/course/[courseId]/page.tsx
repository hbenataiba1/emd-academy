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

export default async function AcademyCourseDetailRoute({
  params,
}: CourseDetailRouteProps) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId || 'eu-mdr-technical-file';

  const [liveCourse, publishedCourses] = await Promise.all([
    getAcademyCourseForAccess(courseId),
    getPublishedCoursesFromSupabase(),
  ]);

  const course =
    liveCourse ||
    publishedCourses?.find(
      (item) => item.id === courseId || item.slug === courseId,
    ) ||
    featuredCourses.find((item) => item.id === courseId || item.slug === courseId) ||
    featuredCourses[0];

  return (
    <CourseDetailPage
      course={course}
      initialCurriculum={getCurriculumForCourse(course.id)}
    />
  );
}
