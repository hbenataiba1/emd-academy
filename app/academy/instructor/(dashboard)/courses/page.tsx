import type { Metadata } from 'next';

import { AcademyInstructorCoursesPage } from '@/components/academy-instructor-courses-page';

export const metadata: Metadata = {
  title: 'My Courses | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export default function InstructorCoursesRoute() {
  return <AcademyInstructorCoursesPage />;
}
