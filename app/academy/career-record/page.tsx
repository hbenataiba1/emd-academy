import type { Metadata } from 'next';

import { AcademyCareerRecordPage } from '@/components/academy-career-record-page';

export const metadata: Metadata = {
  title: 'Career Record | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export default function CareerRecordRoute() {
  return <AcademyCareerRecordPage />;
}
