import { welcomeEmail } from '@/lib/academy-email-templates';
import {
  abandonedCheckoutEmail,
  certificateReadyEmail,
  courseChangesRequestedEmail,
  coursePublishedEmail,
  enrollmentFreeEmail,
  instructorApplicationEmail,
  instructorApprovedEmail,
  instructorPayoutEmail,
  instructorQuestionReminderEmail,
  instructorRejectedEmail,
  paymentFailedEmail,
  paymentReceiptEmail,
  purchaseConfirmationEmail,
  questionAnsweredEmail,
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
  course_changes_requested: () =>
    courseChangesRequestedEmail({
      ...COURSE,
      name: NAME,
      note: 'Please add a short description for lesson 3 and upload the slides as a PDF resource.',
    }),
  course_published: () => coursePublishedEmail({ ...COURSE, name: NAME }),
  instructor_question_reminder: () =>
    instructorQuestionReminderEmail({
      name: NAME,
      total: 2,
      items: [
        { courseTitle: COURSE.courseTitle, lessonTitle: 'Classification rules', question: 'Does a software app that only stores patient data count as a medical device?', waitingDays: 4 },
        { courseTitle: COURSE.courseTitle, lessonTitle: 'Technical documentation', question: 'Where do we place the GSPR checklist in the technical file?', waitingDays: 6 },
      ],
    }),
  instructor_payout: () =>
    instructorPayoutEmail({ name: NAME, amountCents: 48500, currency: 'usd', method: 'Bank transfer', reference: 'EMD-PAY-0042' }),
  instructor_application: () => instructorApplicationEmail({ name: NAME }),
  instructor_approved: () =>
    instructorApprovedEmail({ name: NAME, note: 'We loved your experience in post-market surveillance.' }),
  instructor_rejected: () =>
    instructorRejectedEmail({ name: NAME, note: 'Please add more detail about your hands-on regulatory experience.' }),
  question_answered: () =>
    questionAnsweredEmail({
      name: NAME,
      ...COURSE,
      lessonTitle: 'Classification rules',
      question: 'Does a software app that only stores patient data count as a medical device?',
      answer:
        'It depends on the intended purpose. If the software only stores and displays data without a medical function, it is usually not a device. I added an example in the lesson resources.',
      answeredBy: 'Monir',
    }),
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
