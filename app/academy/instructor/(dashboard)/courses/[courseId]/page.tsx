import type { Metadata } from 'next';

import { AcademyInstructorCourseEditor } from '@/components/academy-instructor-course-editor';

export const metadata: Metadata = {
  title: 'Edit Course | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export default async function InstructorCourseEditorRoute({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <AcademyInstructorCourseEditor courseId={courseId} />;
}
