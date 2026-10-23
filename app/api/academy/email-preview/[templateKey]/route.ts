import { welcomeEmail } from '@/lib/academy-email-templates';
import {
  abandonedCheckoutEmail,
  certificateReadyEmail,
  enrollmentFreeEmail,
  paymentFailedEmail,
  paymentReceiptEmail,
  purchaseConfirmationEmail,
  surveyRequestEmail,
} from '@/lib/academy-email-messages';

export const dynamic = 'force-dynamic';

const NAME = 'Alex Morgan';
const COURSE = { courseTitle: 'EU MDR Essentials', courseId: 'eu-mdr-essentials' };

// Sample content for every automated email, used by the CRM "Automated Emails" preview.
const PREVIEWS: Record<string, () => { html: string }> = {
  welcome: () => welcomeEmail({ name: NAME }),
  enrollment_free: () => enrollmentFreeEmail({ name: NAME, ...COURSE }),
  purchase_confirmation: () => purchaseConfirmationEmail({ name: NAME, ...COURSE }),
  payment_receipt: () =>
    paymentReceiptEmail({
      name: NAME,
      courseTitle: COURSE.courseTitle,
      amountCents: 4900,
      currency: 'usd',
      receiptUrl: 'https://easymedicaldevice.com/academy/billing',
    }),
  payment_failed: () => paymentFailedEmail({ name: NAME, ...COURSE, reason: 'Your card was declined.' }),
  abandoned_checkout: () => abandonedCheckoutEmail({ name: NAME, ...COURSE }),
  certificate_ready: () =>
    certificateReadyEmail({
      name: NAME,
      courseTitle: COURSE.courseTitle,
      certificateNumber: 'EMDA-2026-3FA9C1D2',
    }),
  survey_request: () => surveyRequestEmail({ name: NAME, ...COURSE }),
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateKey: string }> },
) {
  const { templateKey } = await params;
  const build = PREVIEWS[templateKey];

  if (!build) {
    return new Response('Email preview not found', { status: 404 });
  }

  return new Response(build().html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
