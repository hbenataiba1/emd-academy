import type { Metadata } from 'next';

import { AcademyBecomeInstructorPage } from '@/components/academy-become-instructor-page';

export const metadata: Metadata = {
  title: 'Become an Instructor | Easy Medical Device Academy',
  description:
    'Teach medical device professionals worldwide. Apply to become an instructor on Easy Medical Device Academy, create your course and earn from every sale.',
  alternates: { canonical: '/academy/become-instructor' },
};

export default function BecomeInstructorRoute() {
  return <AcademyBecomeInstructorPage />;
}
