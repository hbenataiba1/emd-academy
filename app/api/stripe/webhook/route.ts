import { cleanEnv, json } from '@/lib/academy-auth';
import {
  completeCheckoutSession,
  type StripeCheckoutSession,
} from '@/lib/academy-checkout-complete';

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
      await completeCheckoutSession(session);
    }
  }

  return json({ received: true });
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
