import { getCourseById } from '@/lib/academy-data';

type CheckoutBody = {
  courseId?: string;
};

export async function POST(request: Request) {
  const body = await readCheckoutBody(request);
  const course = body.courseId ? getCourseById(body.courseId) : undefined;

  if (!body.courseId || !course) {
    return json(
      { message: 'Choose a valid course before starting checkout.' },
      400,
    );
  }

  const stripeSecret = cleanEnv(process.env.STRIPE_SECRET_KEY);
  const priceId = getStripePriceId(course.id, course.stripePriceEnv);

  if (!stripeSecret || !priceId) {
    return json(
      {
        message:
          'Stripe is ready, but this course needs STRIPE_SECRET_KEY and a Stripe price ID before live checkout.',
      },
      503,
    );
  }

  const siteUrl = cleanEnv(process.env.NEXT_PUBLIC_SITE_URL);
  const origin = siteUrl || new URL(request.url).origin;
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('allow_promotion_codes', 'true');
  params.set('client_reference_id', course.id);
  params.set(
    'success_url',
    `${origin}/academy?checkout=success&course=${course.id}`,
  );
  params.set('cancel_url', `${origin}/academy?checkout=cancelled`);
  params.set('metadata[course_id]', course.id);
  params.set('metadata[course_title]', course.title);

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

function cleanEnv(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.replace(/\/$/, '') : undefined;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
