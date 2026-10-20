import type { Metadata } from 'next';

import { AcademyBillingPage } from '@/components/academy-billing-page';

export const metadata: Metadata = {
  title: 'Billing & invoices | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export default function BillingRoute() {
  return <AcademyBillingPage />;
}
