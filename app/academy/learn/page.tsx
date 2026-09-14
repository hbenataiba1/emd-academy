import { CoursePlayer } from '@/components/course-player';

type LearnPageProps = {
  searchParams?: Promise<{
    course?: string;
  }>;
};

export default async function LearnPage({ searchParams }: LearnPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const courseId = resolvedParams.course || 'eu-mdr-technical-file';

  return <CoursePlayer courseId={courseId} />;
}

