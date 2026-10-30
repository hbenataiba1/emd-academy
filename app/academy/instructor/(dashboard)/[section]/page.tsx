import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { InstructorWorkspace, type WorkspaceSection } from '@/components/academy-instructor-workspace';

export const metadata: Metadata = {
  title: 'Instructor Dashboard | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

const SECTIONS: WorkspaceSection[] = ['enrollments', 'learners', 'certificates', 'questions', 'coupons', 'reviews', 'earnings', 'payment', 'profile'];

export default async function InstructorSectionRoute({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!SECTIONS.includes(section as WorkspaceSection)) notFound();
  return <InstructorWorkspace section={section as WorkspaceSection} />;
}
