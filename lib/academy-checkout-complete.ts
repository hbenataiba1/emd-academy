import { academyRestFetch, saveAcademyEnrollment } from '@/lib/academy-auth';
import { markRedemptionRedeemed } from '@/lib/academy-coupons';

export type StripeCheckoutSession = {
  id: string;
  customer?: string | null;
  customer_email?: string | null;
  payment_intent?: string | null;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: {
    user_id?: string;
    learner_email?: string;
    course_id?: string;
    course_title?: string;
    coupon_id?: string;
  } | null;
};

/**
 * Records a paid checkout: unlocks the course for the learner, counts the coupon
 * as used and keeps the purchase. Safe to run more than once for the same
 * session (the Stripe webhook and the instant check after payment both call it).
 */
export async function completeCheckoutSession(session: StripeCheckoutSession) {
  const userId = session.metadata?.user_id;
  const courseId = session.metadata?.course_id;
  const learnerEmail = session.metadata?.learner_email || session.customer_email;

  if (!userId || !courseId || !learnerEmail) {
    return;
  }

  const now = new Date().toISOString();
  const amountCents = session.amount_total || 0;
  const currency = session.currency || 'usd';

  await saveAcademyEnrollment({
    userId,
    learnerEmail,
    courseId,
    amountCents,
    currency,
    stripeCheckoutSessionId: session.id,
    stripeCustomerId:
      typeof session.customer === 'string' ? session.customer : null,
    status: 'active',
  });

  // A coupon only counts as used once the payment has completed.
  if (session.metadata?.coupon_id) {
    await markRedemptionRedeemed(session.id);
  }

  await academyRestFetch('purchases?on_conflict=stripe_checkout_session_id', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      learner_email: learnerEmail,
      course_id: courseId,
      amount_cents: amountCents,
      currency,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : null,
      status: 'completed',
      updated_at: now,
    }),
    prefer: 'resolution=merge-duplicates,return=minimal',
    useServiceRole: true,
  });
}
