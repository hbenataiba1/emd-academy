import { CoursePlayer } from '@/components/course-player';
import { getAcademyCourseForAccess, isFreeCourse } from '@/lib/academy-auth';

type LearnPageProps = {
  searchParams?: Promise<{
    course?: string;
  }>;
};

export default async function LearnPage({ searchParams }: LearnPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const courseId = resolvedParams.course || 'eu-mdr-technical-file';
  const course = await getAcademyCourseForAccess(courseId);

  return <CoursePlayer courseId={courseId} freeCourse={course ? isFreeCourse(course) : false} />;
}
