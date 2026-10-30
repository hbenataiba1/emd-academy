import { academyRestFetch, json, readJson } from '@/lib/academy-auth';
import { requireInstructor } from '@/lib/academy-instructor';

type Method = 'bank' | 'paypal' | 'wise' | 'other';

// The fields kept for each way of being paid.
const FIELDS: Record<Method, string[]> = {
  bank: ['account_holder', 'iban', 'bic', 'bank_name', 'bank_country'],
  paypal: ['paypal_email'],
  wise: ['account_holder', 'wise_email'],
  other: ['instructions'],
};

const MISSING = /instructor_payment_details|schema cache|does not exist/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

// The instructor's saved payment details (only they and the Academy team can see them).
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const response = await academyRestFetch(
    `instructor_payment_details?select=method,details,updated_at&instructor_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    { useServiceRole: true },
  );

  if (!response.ok) {
    const text = await response.text();
    if (MISSING.test(text)) return json({ available: false, method: null, details: {} });
    return json({ message: 'Your payment details could not be loaded.' }, 502);
  }

  const row = ((await response.json()) as { method: Method; details: Record<string, string>; updated_at: string }[])[0];
  return json({
    available: true,
    method: row?.method || null,
    details: row?.details || {},
    updatedAt: row?.updated_at || null,
  });
}

// Saves the way the instructor wants to be paid.
export async function PUT(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ method?: string; details?: Record<string, unknown> }>(request, {});
  const method = body.method as Method;
  if (!FIELDS[method]) return json({ message: 'Choose how you want to be paid.' }, 400);

  const details: Record<string, string> = {};
  for (const key of FIELDS[method]) {
    const value = clean(body.details?.[key], key === 'instructions' ? 800 : 160);
    if (value) details[key] = value;
  }

  if (method === 'bank') {
    if (!details.account_holder) return json({ message: 'Enter the name of the account holder.' }, 400);
    const account = (details.iban || '').replace(/\s+/g, '').toUpperCase();
    if (account.length < 6) return json({ message: 'Enter your IBAN or account number.' }, 400);
    details.iban = account;
  }
  if (method === 'paypal' && !EMAIL.test(details.paypal_email || '')) {
    return json({ message: 'Enter the email address of your PayPal account.' }, 400);
  }
  if (method === 'wise') {
    if (!details.account_holder) return json({ message: 'Enter your full name as it appears on Wise.' }, 400);
    if (!EMAIL.test(details.wise_email || '')) return json({ message: 'Enter the email address of your Wise account.' }, 400);
  }
  if (method === 'other' && (details.instructions || '').length < 10) {
    return json({ message: 'Explain how we should pay you.' }, 400);
  }

  const response = await academyRestFetch('instructor_payment_details?on_conflict=instructor_id', {
    method: 'POST',
    body: JSON.stringify({
      instructor_id: auth.user.id,
      method,
      details,
      updated_at: new Date().toISOString(),
    }),
    prefer: 'resolution=merge-duplicates,return=minimal',
    useServiceRole: true,
  });

  if (!response.ok) {
    const text = await response.text();
    return json({ message: MISSING.test(text) ? 'Payment details are not available yet.' : 'Your payment details could not be saved.' }, 502);
  }

  return json({ saved: true });
}
