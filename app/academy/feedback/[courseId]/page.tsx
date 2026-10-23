import type { Metadata } from 'next';

import { AcademyFeedbackPage } from '@/components/academy-feedback-page';

export const metadata: Metadata = {
  title: 'Rate your course | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export default async function FeedbackRoute({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  return <AcademyFeedbackPage courseId={decodeURIComponent(courseId)} />;
}
