import type { Metadata } from 'next';
import { AcademyResetPasswordPage } from '@/components/academy-password-pages';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResetPasswordRoute() {
  return <AcademyResetPasswordPage />;
}
