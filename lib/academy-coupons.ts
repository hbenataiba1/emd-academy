import { academyRestFetch } from '@/lib/academy-auth';

export type CouponRow = {
  id: string;
  code: string;
  description?: string | null;
  discount_type: 'percent' | 'amount';
  percent_off?: number | null;
  amount_off_cents?: number | null;
  currency?: string | null;
  max_redemptions?: number | null;
  max_per_user: number;
  starts_at?: string | null;
  expires_at?: string | null;
  course_ids?: string[] | null;
  is_active: boolean;
};

type RedemptionRow = {
  id: string;
  user_id: string;
  course_id: string;
  status: 'pending' | 'redeemed' | 'expired';
  created_at: string;
};

export type CouponValidation =
  | {
      ok: true;
      coupon: CouponRow;
      priceCents: number;
      discountCents: number;
      finalCents: number;
    }
  | { ok: false; message: string };

/** A checkout that was opened but not paid counts as "in use" for this long. */
export const RESERVATION_MINUTES = 30;
/** Stripe requires embedded sessions to live at least 30 minutes. */
export const SESSION_LIFETIME_SECONDS = 31 * 60;
export const MIN_CHARGE_CENTS = 50;

export function normalizeCouponCode(value?: string | null) {
  return (value || '').trim().toUpperCase();
}

export function calculateDiscount(priceCents: number, coupon: CouponRow) {
  const raw =
    coupon.discount_type === 'percent'
      ? Math.floor((priceCents * Number(coupon.percent_off || 0)) / 100)
      : Number(coupon.amount_off_cents || 0);

  return Math.min(Math.max(raw, 0), priceCents);
}

export async function validateCoupon({
  code,
  userId,
  courseId,
  priceCents,
}: {
  code: string;
  userId: string;
  courseId: string;
  priceCents: number;
}): Promise<CouponValidation> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) {
    return { ok: false, message: 'Enter a coupon code.' };
  }

  const response = await academyRestFetch(
    `coupons?select=*&code=eq.${encodeURIComponent(normalized)}&limit=1`,
    { useServiceRole: true },
  );

  if (!response.ok) {
    return { ok: false, message: 'Coupons are not available right now.' };
  }

  const coupon = ((await response.json()) as CouponRow[])[0];
  const invalid = 'This coupon code is not valid.';

  if (!coupon || !coupon.is_active) {
    return { ok: false, message: invalid };
  }

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { ok: false, message: 'This coupon is not active yet.' };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
    return { ok: false, message: 'This coupon has expired.' };
  }

  if (coupon.course_ids?.length && !coupon.course_ids.includes(courseId)) {
    return { ok: false, message: 'This coupon does not apply to this course.' };
  }

  const usage = await getUsage(coupon.id, userId, courseId);
  if (coupon.max_redemptions && usage.total >= coupon.max_redemptions) {
    return { ok: false, message: 'This coupon has already been fully used.' };
  }
  if (usage.byUser >= coupon.max_per_user) {
    return { ok: false, message: 'You have already used this coupon.' };
  }

  const discountCents = calculateDiscount(priceCents, coupon);
  const finalCents = priceCents - discountCents;

  if (discountCents <= 0) {
    return { ok: false, message: 'This coupon does not reduce the price.' };
  }
  if (finalCents > 0 && finalCents < MIN_CHARGE_CENTS) {
    return {
      ok: false,
      message: 'This coupon cannot be applied to this course price.',
    };
  }

  return { ok: true, coupon, priceCents, discountCents, finalCents };
}

// Redeemed uses plus checkouts opened in the last RESERVATION_MINUTES. The
// learner's own unfinished checkout for the same course does not count against
// them (they can change or re-apply the code).
async function getUsage(couponId: string, userId: string, courseId: string) {
  const since = new Date(Date.now() - RESERVATION_MINUTES * 60_000).toISOString();
  const response = await academyRestFetch(
    `coupon_redemptions?select=id,user_id,course_id,status,created_at&coupon_id=eq.${encodeURIComponent(couponId)}&status=in.(pending,redeemed)`,
    { useServiceRole: true },
  );
  const rows = response.ok ? ((await response.json()) as RedemptionRow[]) : [];
  const active = rows.filter(
    (row) => row.status === 'redeemed' || row.created_at >= since,
  );
  const counted = active.filter(
    (row) =>
      !(row.status === 'pending' && row.user_id === userId && row.course_id === courseId),
  );

  return {
    total: counted.length,
    byUser: counted.filter((row) => row.user_id === userId).length,
  };
}

export async function reserveRedemption({
  coupon,
  userId,
  courseId,
  learnerEmail,
  sessionId,
  discountCents,
}: {
  coupon: CouponRow;
  userId: string;
  courseId: string;
  learnerEmail: string;
  sessionId: string;
  discountCents: number;
}) {
  const insert = await academyRestFetch('coupon_redemptions', {
    method: 'POST',
    body: JSON.stringify({
      coupon_id: coupon.id,
      user_id: userId,
      course_id: courseId,
      learner_email: learnerEmail,
      stripe_checkout_session_id: sessionId,
      discount_cents: discountCents,
      status: 'pending',
    }),
    prefer: 'return=representation',
    useServiceRole: true,
  });

  if (!insert.ok) return false;

  // Re-check after inserting: if two learners raced for the last use, only the
  // earlier reservations survive.
  const since = new Date(Date.now() - RESERVATION_MINUTES * 60_000).toISOString();
  const all = await academyRestFetch(
    `coupon_redemptions?select=id,created_at,status&coupon_id=eq.${encodeURIComponent(coupon.id)}&status=in.(pending,redeemed)&order=created_at.asc,id.asc`,
    { useServiceRole: true },
  );
  const rows = all.ok
    ? ((await all.json()) as { id: string; created_at: string; status: string }[])
    : [];
  const active = rows.filter((row) => row.status === 'redeemed' || row.created_at >= since);
  const mine = ((await insert.json().catch(() => [])) as { id: string }[])[0];

  if (
    coupon.max_redemptions &&
    mine &&
    active.findIndex((row) => row.id === mine.id) >= coupon.max_redemptions
  ) {
    await academyRestFetch(`coupon_redemptions?id=eq.${mine.id}`, {
      method: 'DELETE',
      useServiceRole: true,
    });
    return false;
  }

  return true;
}

/** A coupon that takes the price to zero: grant access and record the use. */
export async function recordFreeRedemption({
  coupon,
  userId,
  courseId,
  learnerEmail,
  discountCents,
}: {
  coupon: CouponRow;
  userId: string;
  courseId: string;
  learnerEmail: string;
  discountCents: number;
}) {
  const response = await academyRestFetch('coupon_redemptions', {
    method: 'POST',
    body: JSON.stringify({
      coupon_id: coupon.id,
      user_id: userId,
      course_id: courseId,
      learner_email: learnerEmail,
      discount_cents: discountCents,
      status: 'redeemed',
    }),
    prefer: 'return=minimal',
    useServiceRole: true,
  });

  return response.ok;
}

/**
 * Cancels the learner's earlier unfinished checkouts for this course, so a
 * changed or removed coupon never leaves a stale reservation or a second open
 * Stripe session behind.
 */
export async function cancelPendingRedemptions(
  userId: string,
  courseId: string,
  stripeSecret?: string,
) {
  try {
    const response = await academyRestFetch(
      `coupon_redemptions?select=id,stripe_checkout_session_id&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&status=eq.pending`,
      { useServiceRole: true },
    );
    if (!response.ok) return;

    const rows = (await response.json()) as {
      id: string;
      stripe_checkout_session_id?: string | null;
    }[];

    await Promise.all(
      rows.map(async (row) => {
        if (stripeSecret && row.stripe_checkout_session_id) {
          await fetch(
            `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(row.stripe_checkout_session_id)}/expire`,
            {
              method: 'POST',
              headers: { authorization: `Bearer ${stripeSecret}` },
            },
          ).catch(() => undefined);
        }

        await academyRestFetch(`coupon_redemptions?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'expired' }),
          prefer: 'return=minimal',
          useServiceRole: true,
        });
      }),
    );
  } catch {
    // Coupons tables missing or unreachable: nothing to cancel.
  }
}

export async function markRedemptionRedeemed(sessionId: string) {
  await academyRestFetch(
    `coupon_redemptions?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'redeemed' }),
      prefer: 'return=minimal',
      useServiceRole: true,
    },
  );
}
