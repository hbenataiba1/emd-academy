import type { Metadata } from 'next';
import { AcademyAuthPage } from '@/components/academy-auth-page';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AcademyLoginPage() {
  return <AcademyAuthPage mode="login" />;
}
