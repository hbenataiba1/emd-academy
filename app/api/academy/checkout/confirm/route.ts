import {
  cleanEnv,
  getAcademyEnrollmentForUser,
  getAcademyUserFromRequest,
  json,
  readJson,
} from '@/lib/academy-auth';
import {
  completeCheckoutSession,
  type StripeCheckoutSession,
} from '@/lib/academy-checkout-complete';

// Called by the checkout page right after a payment. It asks Stripe directly
// whether the learner's checkout was paid and unlocks the course at once, instead
// of waiting for Stripe's webhook message to arrive.
export async function POST(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id || !user.email) {
      return json({ message: 'Please log in to continue.' }, 401);
    }

    const body = await readJson<{ courseId?: string }>(request, {});
    if (!body.courseId) {
      return json({ message: 'Missing course.' }, 400);
    }

    const enrollment = await getAcademyEnrollmentForUser({
      userId: user.id,
      learnerEmail: user.email,
      courseId: body.courseId,
    });

    if (['active', 'completed'].includes(enrollment?.status || '')) {
      return json({ enrolled: true });
    }

    const sessionId = enrollment?.stripe_checkout_session_id;
    const stripeSecret = cleanEnv(process.env.STRIPE_SECRET_KEY);
    if (!sessionId || !stripeSecret) {
      return json({ enrolled: false });
    }

    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          authorization: `Bearer ${stripeSecret}`,
          'stripe-version': '2024-06-20',
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return json({ enrolled: false });
    }

    const session = (await response.json()) as StripeCheckoutSession;

    // Only the learner who started this checkout, for this course, and only once paid.
    if (
      session.payment_status !== 'paid' ||
      session.metadata?.user_id !== user.id ||
      session.metadata?.course_id !== body.courseId
    ) {
      return json({ enrolled: false });
    }

    await completeCheckoutSession(session);

    return json({ enrolled: true });
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error ? error.message : 'The payment could not be confirmed.',
      },
      500,
    );
  }
}
