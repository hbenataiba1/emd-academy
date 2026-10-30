import type { Metadata } from 'next';

import { InstructorWorkspace } from '@/components/academy-instructor-workspace';

export const metadata: Metadata = {
  title: 'Instructor Dashboard | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export default function InstructorDashboardRoute() {
  return <InstructorWorkspace section="overview" />;
}
