import type { Metadata } from 'next';
import { AcademyProfilePage } from '@/components/academy-profile-page';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ProfileRoute() {
  return <AcademyProfilePage />;
}
