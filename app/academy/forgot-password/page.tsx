import type { Metadata } from 'next';
import { AcademyForgotPasswordPage } from '@/components/academy-password-pages';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ForgotPasswordRoute() {
  return <AcademyForgotPasswordPage />;
}
