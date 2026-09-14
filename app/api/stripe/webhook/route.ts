import { academyRestFetch, cleanEnv, json } from '@/lib/academy-auth';

type StripeCheckoutSession = {
  id: string;
  customer?: string;
  customer_email?: string;
  payment_intent?: string;
  amount_total?: number;
  currency?: string;
  metadata?: {
    user_id?: string;
    learner_email?: string;
    course_id?: string;
    course_title?: string;
  };
};

type StripeEvent = {
  type: string;
  data?: {
    object?: StripeCheckoutSession;
  };
};

export async function POST(request: Request) {
  const webhookSecret = cleanEnv(process.env.STRIPE_WEBHOOK_SECRET);
  if (!webhookSecret) {
    return json({ message: 'Missing STRIPE_WEBHOOK_SECRET.' }, 503);
  }

  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  if (!(await verifyStripeSignature(rawBody, signature, webhookSecret))) {
    return json({ message: 'Invalid Stripe signature.' }, 400);
  }

  const event = JSON.parse(rawBody) as StripeEvent;

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object;
    if (session?.metadata?.user_id && session.metadata.course_id) {
      await markCheckoutComplete(session);
    }
  }

  return json({ received: true });
}

async function markCheckoutComplete(session: StripeCheckoutSession) {
  const userId = session.metadata?.user_id;
  const courseId = session.metadata?.course_id;
  const learnerEmail = session.metadata?.learner_email || session.customer_email;

  if (!userId || !courseId || !learnerEmail) {
    return;
  }

  const now = new Date().toISOString();
  const amountCents = session.amount_total || 0;
  const currency = session.currency || 'usd';

  await academyRestFetch('enrollments?on_conflict=user_id,course_id', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      learner_email: learnerEmail,
      course_id: courseId,
      amount_cents: amountCents,
      currency,
      stripe_checkout_session_id: session.id,
      stripe_customer_id:
        typeof session.customer === 'string' ? session.customer : null,
      status: 'active',
      updated_at: now,
    }),
    prefer: 'resolution=merge-duplicates,return=minimal',
    useServiceRole: true,
  });

  await academyRestFetch('purchases?on_conflict=stripe_checkout_session_id', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      learner_email: learnerEmail,
      course_id: courseId,
      amount_cents: amountCents,
      currency,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent:
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

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
) {
  if (!signatureHeader) {
    return false;
  }

  const timestamp = signatureHeader
    .split(',')
    .find((part) => part.startsWith('t='))
    ?.slice(2);
  const signatures = signatureHeader
    .split(',')
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  const expected = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}
