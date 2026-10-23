import { academyRestFetch, cleanEnv } from '@/lib/academy-auth';
import { sendAcademyEmail } from '@/lib/academy-email';
import {
  abandonedCheckoutEmail,
  certificateReadyEmail,
  enrollmentFreeEmail,
  paymentFailedEmail,
  paymentReceiptEmail,
  purchaseConfirmationEmail,
  surveyRequestEmail,
} from '@/lib/academy-email-messages';

// One place that decides when each automated email goes out. Every function is
// safe to call more than once: the email log makes sure nobody gets it twice, and
// a problem sending never reaches the learner's page.

type Learner = { userId: string; email: string; name?: string | null };

/** The learner's name for the greeting: profile, then enrollment, then the email. */
async function learnerName({ userId, email, name }: Learner) {
  if (name) return name;

  try {
    const profile = await academyRestFetch(
      `profiles?select=full_name&id=eq.${encodeURIComponent(userId)}&limit=1`,
      { useServiceRole: true },
    );
    if (profile.ok) {
      const row = ((await profile.json()) as { full_name?: string | null }[])[0];
      if (row?.full_name) return row.full_name;
    }

    const enrollment = await academyRestFetch(
      `enrollments?select=learner_name&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { useServiceRole: true },
    );
    if (enrollment.ok) {
      const row = ((await enrollment.json()) as { learner_name?: string | null }[])[0];
      if (row?.learner_name) return row.learner_name;
    }
  } catch {
    // Fall back to the email address below.
  }

  return email.split('@')[0];
}

async function isEnrolled(userId: string, courseId: string) {
  try {
    const response = await academyRestFetch(
      `enrollments?select=status&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&status=in.(active,completed)&limit=1`,
      { useServiceRole: true },
    );
    if (!response.ok) return false;
    return ((await response.json()) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

export async function notifyFreeEnrollment(
  learner: Learner & { courseId: string; courseTitle: string },
) {
  const name = await learnerName(learner);
  const mail = enrollmentFreeEmail({ name, courseTitle: learner.courseTitle, courseId: learner.courseId });

  await sendAcademyEmail({
    to: learner.email,
    ...mail,
    templateKey: 'enrollment_free',
    templateName: 'Free course enrollment',
    recipientName: name,
    recipientUserId: learner.userId,
    dedupeKey: `enrolled:${learner.userId}:${learner.courseId}`,
    metadata: { course_id: learner.courseId },
  });
}

type PaidSession = {
  id: string;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: { course_id?: string; course_title?: string } | null;
};

async function stripeReceiptUrl(paymentIntentId: string) {
  const secret = cleanEnv(process.env.STRIPE_SECRET_KEY);
  if (!secret) return null;

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
      {
        headers: { authorization: `Bearer ${secret}`, 'stripe-version': '2024-06-20' },
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { latest_charge?: { receipt_url?: string } | null };
    return payload.latest_charge?.receipt_url || null;
  } catch {
    return null;
  }
}

/** A paid checkout: the "access is ready" email and the receipt. */
export async function notifyPurchase(learner: Learner, session: PaidSession) {
  const courseId = session.metadata?.course_id;
  if (!courseId) return;

  const name = await learnerName(learner);
  const courseTitle = session.metadata?.course_title || 'your course';
  const common = {
    to: learner.email,
    recipientName: name,
    recipientUserId: learner.userId,
    metadata: { course_id: courseId, checkout_session: session.id },
  };

  const confirmation = purchaseConfirmationEmail({ name, courseTitle, courseId });
  await sendAcademyEmail({
    ...common,
    ...confirmation,
    templateKey: 'purchase_confirmation',
    templateName: 'Purchase confirmation',
    dedupeKey: `purchase:${session.id}`,
  });

  const amountCents = session.amount_total || 0;
  if (amountCents <= 0) return;

  const receiptUrl =
    typeof session.payment_intent === 'string' ? await stripeReceiptUrl(session.payment_intent) : null;
  const receipt = paymentReceiptEmail({
    name,
    courseTitle,
    amountCents,
    currency: session.currency || 'usd',
    receiptUrl,
  });
  await sendAcademyEmail({
    ...common,
    ...receipt,
    templateKey: 'payment_receipt',
    templateName: 'Payment receipt',
    dedupeKey: `receipt:${session.id}`,
  });
}

export async function notifyPaymentFailed(
  intent: {
    id: string;
    metadata?: { user_id?: string; learner_email?: string; course_id?: string; course_title?: string } | null;
    last_payment_error?: { message?: string } | null;
  },
) {
  const { user_id: userId, learner_email: email, course_id: courseId } = intent.metadata || {};
  if (!userId || !email || !courseId) return;

  const name = await learnerName({ userId, email });
  const mail = paymentFailedEmail({
    name,
    courseTitle: intent.metadata?.course_title || 'your course',
    courseId,
    reason: intent.last_payment_error?.message,
  });

  await sendAcademyEmail({
    to: email,
    ...mail,
    templateKey: 'payment_failed',
    templateName: 'Payment failed',
    recipientName: name,
    recipientUserId: userId,
    dedupeKey: `payment_failed:${intent.id}`,
    metadata: { course_id: courseId, payment_intent: intent.id },
  });
}

/** A checkout that expired without being paid (a few hours after it was started). */
export async function notifyAbandonedCheckout(session: {
  id: string;
  metadata?: { user_id?: string; learner_email?: string; course_id?: string; course_title?: string } | null;
}) {
  const { user_id: userId, learner_email: email, course_id: courseId } = session.metadata || {};
  if (!userId || !email || !courseId) return;

  // They paid in the meantime (a newer checkout): nothing to chase.
  if (await isEnrolled(userId, courseId)) return;

  const name = await learnerName({ userId, email });
  const mail = abandonedCheckoutEmail({
    name,
    courseTitle: session.metadata?.course_title || 'your course',
    courseId,
  });

  await sendAcademyEmail({
    to: email,
    ...mail,
    templateKey: 'abandoned_checkout',
    templateName: 'Abandoned checkout',
    recipientName: name,
    recipientUserId: userId,
    // At most one reminder per learner, course and day.
    dedupeKey: `abandoned:${userId}:${courseId}:${new Date().toISOString().slice(0, 10)}`,
    metadata: { course_id: courseId, checkout_session: session.id },
  });
}

/** Only for a certificate that was just issued, so old certificates never trigger it. */
export async function notifyCertificateReady(
  learner: Learner & {
    courseTitle: string;
    certificate: { certificate_number: string; issued_at: string };
  },
) {
  const issued = new Date(learner.certificate.issued_at).getTime();
  if (!Number.isFinite(issued) || Date.now() - issued > 10 * 60_000) return;

  const name = await learnerName(learner);
  const mail = certificateReadyEmail({
    name,
    courseTitle: learner.courseTitle,
    certificateNumber: learner.certificate.certificate_number,
  });

  await sendAcademyEmail({
    to: learner.email,
    ...mail,
    templateKey: 'certificate_ready',
    templateName: 'Certificate ready',
    recipientName: name,
    recipientUserId: learner.userId,
    dedupeKey: `certificate:${learner.certificate.certificate_number}`,
    metadata: { certificate_number: learner.certificate.certificate_number },
  });
}

/** Sent by the daily job, a day after the learner earned the certificate. */
export async function notifySurveyRequest(
  learner: Learner & { courseId: string; courseTitle: string },
) {
  const name = await learnerName(learner);
  const mail = surveyRequestEmail({ name, courseTitle: learner.courseTitle, courseId: learner.courseId });

  return sendAcademyEmail({
    to: learner.email,
    ...mail,
    templateKey: 'survey_request',
    templateName: 'Survey request',
    recipientName: name,
    recipientUserId: learner.userId,
    dedupeKey: `survey:${learner.userId}:${learner.courseId}`,
    metadata: { course_id: learner.courseId },
  });
}
