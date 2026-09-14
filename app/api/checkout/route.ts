import {
  academyRestFetch,
  cleanEnv,
  getAcademyCourseForAccess,
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  isFreeCourse,
  json,
} from '@/lib/academy-auth';

type CheckoutBody = {
  courseId?: string;
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
    const now = new Date().toISOString();
    await academyRestFetch('enrollments?on_conflict=user_id,course_id', {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        learner_email: user.email,
        learner_name: getAcademyDisplayName(user),
        course_id: course.id,
        amount_cents: 0,
        currency: 'usd',
        status: 'active',
        updated_at: now,
      }),
      prefer: 'resolution=merge-duplicates,return=minimal',
      useServiceRole: true,
    });

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

  const priceId =
    course.stripePriceId || getStripePriceId(course.id, course.stripePriceEnv);

  const siteUrl = cleanEnv(process.env.NEXT_PUBLIC_SITE_URL);
  const origin = siteUrl || new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set('mode', 'payment');

  if (priceId) {
    params.set('line_items[0][price]', priceId);
  } else {
    // Dynamic on-the-fly pricing: uses the price set in CRM automatically
    const amountCents = Math.max(50, Math.round(course.price * 100));
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
  }
  params.set('line_items[0][quantity]', '1');
  params.set('allow_promotion_codes', 'true');
  params.set('client_reference_id', `${user.id}:${course.id}`);
  params.set('customer_email', user.email);
  params.set(
    'success_url',
    `${origin}/academy/my-learning?checkout=success&course=${course.id}`,
  );
  params.set('cancel_url', `${origin}/academy?checkout=cancelled`);
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
      },
      body: params,
    },
  );
  const payload = (await stripeResponse.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!stripeResponse.ok || !payload.url) {
    return json(
      {
        message:
          payload.error?.message ||
          'Stripe did not return a checkout session URL.',
      },
      502,
    );
  }

  await savePendingEnrollment({
    courseId: course.id,
    userId: user.id,
    learnerEmail: user.email,
    learnerName: getAcademyDisplayName(user),
    amountCents: Math.round(course.price * 100),
    checkoutSessionId: payload.id,
  });

  return json({ url: payload.url });
}

async function readCheckoutBody(request: Request): Promise<CheckoutBody> {
  try {
    return (await request.json()) as CheckoutBody;
  } catch {
    return {};
  }
}

function getStripePriceId(courseId: string, fallbackEnvName: string) {
  const explicit = cleanEnv(process.env[fallbackEnvName]);
  if (explicit) {
    return explicit;
  }

  const map = cleanEnv(process.env.STRIPE_PRICE_IDS);
  if (!map) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(map) as Record<string, string | undefined>;
    return cleanEnv(parsed[courseId]);
  } catch {
    return undefined;
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
    await academyRestFetch('enrollments?on_conflict=user_id,course_id', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        learner_email: learnerEmail,
        learner_name: learnerName,
        course_id: courseId,
        amount_cents: amountCents,
        currency: 'usd',
        stripe_checkout_session_id: checkoutSessionId,
        status: 'pending_payment',
        updated_at: new Date().toISOString(),
      }),
      prefer: 'resolution=merge-duplicates,return=minimal',
      useServiceRole: true,
    });
  } catch {
    // Checkout should still open if reporting is temporarily unavailable.
  }
}
