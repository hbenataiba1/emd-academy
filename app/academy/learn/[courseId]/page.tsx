import type { Metadata } from 'next';
import { CoursePlayer } from '@/components/course-player';
import { getAcademyCourseForAccess, isFreeCourse } from '@/lib/academy-auth';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type LearnCoursePageProps = {
  params: Promise<{
    courseId: string;
  }>;
};

export default async function LearnCoursePage({ params }: LearnCoursePageProps) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId || 'eu-mdr-technical-file';
  const course = await getAcademyCourseForAccess(courseId);

  return <CoursePlayer courseId={courseId} freeCourse={course ? isFreeCourse(course) : false} />;
}
