import {
  cleanEnv,
  getAcademyCourseForAccess,
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  isFreeCourse,
  json,
  saveAcademyEnrollment,
  explainSupabaseEnrollmentError,
} from '@/lib/academy-auth';
import {
  MIN_CHARGE_CENTS,
  SESSION_LIFETIME_SECONDS,
  cancelPendingRedemptions,
  normalizeCouponCode,
  recordFreeRedemption,
  reserveRedemption,
  validateCoupon,
  type CouponValidation,
} from '@/lib/academy-coupons';

type CheckoutBody = {
  courseId?: string;
  /** Embedded checkout: the payment form is shown inside the academy page. */
  embedded?: boolean;
  couponCode?: string;
};

export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in before buying a course.' }, 401);
  }

  const body = await readCheckoutBody(request);
  const course = body.courseId
    ? await getAcademyCourseForAccess(body.courseId)
    : undefined;

  if (!body.courseId || !course) {
    return json(
      { message: 'Choose a valid course before starting checkout.' },
      400,
    );
  }

  if (isFreeCourse(course)) {
    try {
      await saveAcademyEnrollment({
        userId: user.id,
        learnerEmail: user.email,
        learnerName: getAcademyDisplayName(user),
        courseId: course.id,
        amountCents: 0,
        currency: 'usd',
        status: 'active',
      });
    } catch (error) {
      return json(
        {
          message: explainSupabaseEnrollmentError(
            error instanceof Error ? error.message : '',
          ),
        },
        502,
      );
    }

    const siteUrl = cleanEnv(process.env.NEXT_PUBLIC_SITE_URL);
    const origin = siteUrl || new URL(request.url).origin;

    return json({
      enrolled: true,
      course,
      url: `${origin}/academy/learn/${course.id}`,
    });
  }

  const stripeSecret = cleanEnv(process.env.STRIPE_SECRET_KEY);
  if (!stripeSecret) {
    return json(
      {
        message:
          'Stripe is not configured yet. Add STRIPE_SECRET_KEY to accept paid enrollments.',
      },
      503,
    );
  }

  // Any earlier unfinished checkout of this learner for this course is cancelled
  // first, so a changed or removed coupon never leaves a stale reservation.
  await cancelPendingRedemptions(user.id, course.id, stripeSecret);

  const basePriceCents = Math.max(0, Math.round(course.price * 100));
  const couponCode = normalizeCouponCode(body.couponCode);
  let applied: Extract<CouponValidation, { ok: true }> | null = null;

  if (couponCode) {
    const result = await validateCoupon({
      code: couponCode,
      userId: user.id,
      courseId: course.id,
      priceCents: basePriceCents,
    });

    if (!result.ok) {
      return json({ message: result.message }, 400);
    }

    // The coupon covers the whole price: unlock the course without a payment.
    if (result.finalCents <= 0) {
      try {
        await saveAcademyEnrollment({
          userId: user.id,
          learnerEmail: user.email,
          learnerName: getAcademyDisplayName(user),
          courseId: course.id,
          amountCents: 0,
          currency: 'usd',
          status: 'active',
        });
      } catch (error) {
        return json(
          {
            message: explainSupabaseEnrollmentError(
              error instanceof Error ? error.message : '',
            ),
          },
          502,
        );
      }

      await recordFreeRedemption({
        coupon: result.coupon,
        userId: user.id,
        courseId: course.id,
        learnerEmail: user.email,
        discountCents: result.discountCents,
      });

      return json({ enrolled: true, course });
    }

    applied = result;
  }

  const siteUrl = cleanEnv(process.env.NEXT_PUBLIC_SITE_URL);
  const origin = siteUrl || new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  // Stripe's Managed Payments (Stripe as the seller of record) is on by default in
  // the account and needs product tax codes. The academy sells as itself, so it is
  // switched off for these sessions.
  params.set('managed_payments[enabled]', 'false');

  // The price is created on the fly from the price set in the CRM. No Stripe price
  // id or product has to be created or configured anywhere.
  const amountCents = Math.max(MIN_CHARGE_CENTS, basePriceCents);
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(amountCents));
  params.set('line_items[0][price_data][product_data][name]', course.title);
  if (course.subtitle) {
    params.set(
      'line_items[0][price_data][product_data][description]',
      course.subtitle.slice(0, 500),
    );
  }
  if (course.image && course.image.startsWith('http')) {
    params.set(
      'line_items[0][price_data][product_data][images][0]',
      course.image,
    );
  }
  params.set('line_items[0][quantity]', '1');

  if (applied) {
    // One-off Stripe coupon that mirrors the academy coupon for this purchase.
    const stripeCoupon = new URLSearchParams();
    if (applied.coupon.discount_type === 'percent') {
      stripeCoupon.set('percent_off', String(applied.coupon.percent_off));
    } else {
      stripeCoupon.set('amount_off', String(applied.discountCents));
      stripeCoupon.set('currency', 'usd');
    }
    stripeCoupon.set('duration', 'once');
    stripeCoupon.set('max_redemptions', '1');
    stripeCoupon.set('name', applied.coupon.code);
    stripeCoupon.set('metadata[academy_coupon_id]', applied.coupon.id);

    const couponResponse = await fetch('https://api.stripe.com/v1/coupons', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${stripeSecret}`,
        'content-type': 'application/x-www-form-urlencoded',
        'stripe-version': '2024-06-20',
      },
      body: stripeCoupon,
    });
    const stripeCouponPayload = (await couponResponse.json()) as {
      id?: string;
      error?: { message?: string };
    };

    if (!couponResponse.ok || !stripeCouponPayload.id) {
      return json(
        {
          message:
            stripeCouponPayload.error?.message ||
            'The coupon could not be applied. Please try again.',
        },
        502,
      );
    }

    params.set('discounts[0][coupon]', stripeCouponPayload.id);
    // The checkout must outlive the 30-minute reservation window of the coupon.
    params.set(
      'expires_at',
      String(Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS),
    );
    params.set('metadata[coupon_id]', applied.coupon.id);
    params.set('metadata[coupon_code]', applied.coupon.code);
  } else {
    // Stripe does not allow its own promotion-code box together with a discount.
    params.set('allow_promotion_codes', 'true');
  }
  params.set('client_reference_id', `${user.id}:${course.id}`);
  params.set('customer_email', user.email);
  if (body.embedded) {
    // The form is rendered on our own page. Card payments finish in place; only
    // redirect-based payment methods come back to this return URL.
    params.set('ui_mode', 'embedded');
    params.set('redirect_on_completion', 'if_required');
    params.set(
      'return_url',
      `${origin}/academy/checkout/${encodeURIComponent(course.id)}?payment=return`,
    );
  } else {
    params.set(
      'success_url',
      `${origin}/academy/my-learning?checkout=success&course=${course.id}`,
    );
    params.set('cancel_url', `${origin}/academy?checkout=cancelled`);
  }
  params.set('metadata[course_id]', course.id);
  params.set('metadata[course_title]', course.title);
  params.set('metadata[user_id]', user.id);
  params.set('metadata[learner_email]', user.email);

  const stripeResponse = await fetch(
    'https://api.stripe.com/v1/checkout/sessions',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${stripeSecret}`,
        'content-type': 'application/x-www-form-urlencoded',
        // Pinned so the embedded checkout parameters stay stable.
        'stripe-version': '2024-06-20',
      },
      body: params,
    },
  );
  const payload = (await stripeResponse.json()) as {
    id?: string;
    url?: string;
    client_secret?: string;
    error?: { message?: string };
  };

  const created = body.embedded ? payload.client_secret : payload.url;

  if (!stripeResponse.ok || !created) {
    return json(
      {
        message:
          payload.error?.message ||
          'Stripe did not return a checkout session URL.',
      },
      502,
    );
  }

  if (applied && payload.id) {
    const reserved = await reserveRedemption({
      coupon: applied.coupon,
      userId: user.id,
      courseId: course.id,
      learnerEmail: user.email,
      sessionId: payload.id,
      discountCents: applied.discountCents,
    });

    if (!reserved) {
      await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(payload.id)}/expire`,
        { method: 'POST', headers: { authorization: `Bearer ${stripeSecret}` } },
      ).catch(() => undefined);

      return json({ message: 'This coupon has just been fully used.' }, 409);
    }
  }

  await savePendingEnrollment({
    courseId: course.id,
    userId: user.id,
    learnerEmail: user.email,
    learnerName: getAcademyDisplayName(user),
    amountCents: applied ? applied.finalCents : basePriceCents,
    checkoutSessionId: payload.id,
  });

  if (body.embedded) {
    return json({ clientSecret: payload.client_secret });
  }

  return json({ url: payload.url });
}

async function readCheckoutBody(request: Request): Promise<CheckoutBody> {
  try {
    return (await request.json()) as CheckoutBody;
  } catch {
    return {};
  }
}

async function savePendingEnrollment({
  courseId,
  userId,
  learnerEmail,
  learnerName,
  amountCents,
  checkoutSessionId,
}: {
  courseId: string;
  userId: string;
  learnerEmail: string;
  learnerName: string;
  amountCents: number;
  checkoutSessionId?: string;
}) {
  if (!checkoutSessionId) {
    return;
  }

  try {
    await saveAcademyEnrollment({
      userId,
      learnerEmail,
      learnerName,
      courseId,
      amountCents,
      currency: 'usd',
      stripeCheckoutSessionId: checkoutSessionId,
      status: 'pending_payment',
    });
  } catch {
    // Checkout should still open if reporting is temporarily unavailable.
  }
}
