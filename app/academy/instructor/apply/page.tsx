import type { Metadata } from 'next';

import { AcademyInstructorApplyPage } from '@/components/academy-instructor-apply-page';

export const metadata: Metadata = {
  title: 'Instructor Application | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export default function InstructorApplyRoute() {
  return <AcademyInstructorApplyPage />;
}
