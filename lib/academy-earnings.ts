import { academyRestFetch } from '@/lib/academy-auth';

/** What the instructor keeps of a sale (percent): a normal sale, and a sale made with the instructor's own coupon. */
export const INSTRUCTOR_SHARE_PERCENT = 30;
export const INSTRUCTOR_COUPON_SHARE_PERCENT = 70;

/** Days a sale waits before it can be paid out (the refund window). */
export const EARNINGS_HOLD_DAYS = 14;

type SaleInput = {
  sessionId: string;
  paymentIntentId?: string | null;
  userId: string;
  learnerEmail: string;
  learnerName?: string | null;
  courseId: string;
  amountCents: number;
  currency: string;
  /** The Academy coupon used for this purchase, if any. */
  couponId?: string | null;
};

type EarningRow = {
  id: string;
  instructor_id: string;
  course_id: string;
  kind: 'sale' | 'refund';
  gross_cents: number;
  commission_percent: number;
  available_at: string;
  stripe_payment_intent_id: string | null;
  user_id: string | null;
  learner_email: string | null;
  learner_name: string | null;
  currency: string;
  status: 'pending' | 'paid';
};

/**
 * A paid sale of an instructor's course becomes an earning: what the learner paid,
 * the Academy's share (fixed now) and what the instructor earns. The instructor keeps 30%,
 * or 70% when the learner bought with a coupon created by that same instructor. Safe to run twice for the same checkout. It never throws.
 */
export async function recordInstructorEarning(sale: SaleInput) {
  try {
    if (sale.amountCents <= 0) return;

    const courseResponse = await academyRestFetch(
      `courses?select=instructor_id&id=eq.${encodeURIComponent(sale.courseId)}&limit=1`,
      { useServiceRole: true },
    );
    const course = courseResponse.ok
      ? ((await courseResponse.json()) as { instructor_id: string | null }[])[0]
      : null;
    if (!course?.instructor_id) return;

    // Was it the instructor's own coupon?
    let ownCoupon = false;
    if (sale.couponId) {
      const couponResponse = await academyRestFetch(
        `coupons?select=instructor_id&id=eq.${encodeURIComponent(sale.couponId)}&limit=1`,
        { useServiceRole: true },
      );
      const coupon = couponResponse.ok
        ? ((await couponResponse.json()) as { instructor_id: string | null }[])[0]
        : null;
      ownCoupon = Boolean(coupon?.instructor_id && coupon.instructor_id === course.instructor_id);
    }
    const instructorShare = ownCoupon ? INSTRUCTOR_COUPON_SHARE_PERCENT : INSTRUCTOR_SHARE_PERCENT;
    // "commission_percent" is the Academy's part
    const percent = 100 - instructorShare;

    const platform = Math.round((sale.amountCents * percent) / 100);
    const availableAt = new Date(Date.now() + EARNINGS_HOLD_DAYS * 86_400_000).toISOString();

    await academyRestFetch('instructor_earnings?on_conflict=stripe_checkout_session_id', {
      method: 'POST',
      body: JSON.stringify({
        instructor_id: course.instructor_id,
        course_id: sale.courseId,
        kind: 'sale',
        stripe_checkout_session_id: sale.sessionId,
        stripe_payment_intent_id: sale.paymentIntentId || null,
        user_id: sale.userId,
        learner_email: sale.learnerEmail,
        learner_name: sale.learnerName || null,
        gross_cents: sale.amountCents,
        commission_percent: percent,
        platform_cents: platform,
        net_cents: sale.amountCents - platform,
        currency: sale.currency || 'usd',
        status: 'pending',
        available_at: availableAt,
      }),
      prefer: 'resolution=ignore-duplicates,return=minimal',
      useServiceRole: true,
    });
  } catch {
    // The sale and the enrollment are already saved: the CRM can still be corrected by hand.
  }
}

/**
 * A refund (from Stripe) takes back the instructor's part of what was refunded.
 * `refundedTotalCents` is the total refunded so far on the payment, so running it
 * again for the same refund adds nothing.
 */
export async function recordInstructorRefund(paymentIntentId: string, refundedTotalCents: number) {
  try {
    const response = await academyRestFetch(
      `instructor_earnings?select=*&stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}`,
      { useServiceRole: true },
    );
    if (!response.ok) return;

    const rows = (await response.json()) as EarningRow[];
    const sale = rows.find((row) => row.kind === 'sale');
    if (!sale) return;

    const alreadyRefunded = rows
      .filter((row) => row.kind === 'refund')
      .reduce((sum, row) => sum + Math.abs(row.gross_cents), 0);
    const delta = Math.min(refundedTotalCents, sale.gross_cents) - alreadyRefunded;
    if (delta <= 0) return;

    const percent = Number(sale.commission_percent);
    const platform = Math.round((delta * percent) / 100);

    await academyRestFetch('instructor_earnings', {
      method: 'POST',
      body: JSON.stringify({
        instructor_id: sale.instructor_id,
        course_id: sale.course_id,
        kind: 'refund',
        parent_id: sale.id,
        stripe_payment_intent_id: paymentIntentId,
        user_id: sale.user_id,
        learner_email: sale.learner_email,
        learner_name: sale.learner_name,
        gross_cents: -delta,
        commission_percent: percent,
        platform_cents: -platform,
        net_cents: -(delta - platform),
        currency: sale.currency,
        status: 'pending',
        // Netted against the sale: at the same moment, or right away if the sale was paid.
        available_at: sale.status === 'paid' ? new Date().toISOString() : sale.available_at,
      }),
      prefer: 'return=minimal',
      useServiceRole: true,
    });
  } catch {
    // Refunds stay visible in Stripe: the team can correct it by hand.
  }
}
