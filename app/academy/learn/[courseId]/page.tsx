import { CoursePlayer } from '@/components/course-player';

type LearnCoursePageProps = {
  params: Promise<{
    courseId: string;
  }>;
};

export default async function LearnCoursePage({ params }: LearnCoursePageProps) {
  const resolvedParams = await params;
  const courseId = resolvedParams.courseId || 'eu-mdr-technical-file';

  return <CoursePlayer courseId={courseId} />;
}

