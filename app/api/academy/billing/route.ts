import {
  academyRestFetch,
  cleanEnv,
  getAcademyEnrollmentsForUser,
  getAcademyUserFromRequest,
  json,
} from '@/lib/academy-auth';

export type BillingItem = {
  id: string;
  courseId: string;
  courseTitle: string;
  date: string;
  amountCents: number;
  currency: string;
  status: 'paid' | 'refunded' | 'partially_refunded' | 'pending';
  receiptUrl?: string;
  invoiceUrl?: string;
  invoicePdfUrl?: string;
  invoiceNumber?: string;
};

type StripeSession = {
  created?: number;
  amount_total?: number;
  currency?: string;
  payment_status?: string;
  invoice?: {
    number?: string;
    hosted_invoice_url?: string;
    invoice_pdf?: string;
  } | null;
  payment_intent?: {
    latest_charge?: {
      receipt_url?: string;
      refunded?: boolean;
      amount_refunded?: number;
    } | null;
  } | null;
};

export async function GET(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to see your billing.' }, 401);
  }

  try {
    const enrollments = await getAcademyEnrollmentsForUser({
      userId: user.id,
      learnerEmail: user.email,
    });
    // Only real purchases: free courses never show up in billing.
    const purchases = enrollments.filter(
      (row) => (row.amount_cents || 0) > 0 || row.stripe_checkout_session_id,
    );

    const courseIds = [...new Set(purchases.map((row) => row.course_id))];
    const titles = new Map<string, string>();

    if (courseIds.length) {
      const response = await academyRestFetch(
        `courses?select=id,title&id=in.(${courseIds.map(encodeURIComponent).join(',')})`,
        { useServiceRole: true },
      );
      if (response.ok) {
        ((await response.json()) as { id: string; title?: string }[]).forEach(
          (course) => titles.set(course.id, course.title || course.id),
        );
      }
    }

    const stripeSecret = cleanEnv(process.env.STRIPE_SECRET_KEY);

    const items = await Promise.all(
      purchases.map(async (row): Promise<BillingItem> => {
        const session = stripeSecret && row.stripe_checkout_session_id
          ? await fetchStripeSession(row.stripe_checkout_session_id, stripeSecret)
          : null;
        const charge = session?.payment_intent?.latest_charge;

        let status: BillingItem['status'] = 'paid';
        if (charge?.refunded) status = 'refunded';
        else if ((charge?.amount_refunded || 0) > 0) status = 'partially_refunded';
        else if (session ? session.payment_status !== 'paid' : row.status === 'pending_payment') {
          status = 'pending';
        }

        return {
          id: row.stripe_checkout_session_id || row.id || `${row.course_id}`,
          courseId: row.course_id,
          courseTitle: titles.get(row.course_id) || row.course_id,
          date: session?.created
            ? new Date(session.created * 1000).toISOString()
            : row.created_at || row.updated_at || new Date().toISOString(),
          amountCents: session?.amount_total ?? row.amount_cents ?? 0,
          currency: session?.currency || row.currency || 'usd',
          status,
          receiptUrl: charge?.receipt_url || undefined,
          invoiceUrl: session?.invoice?.hosted_invoice_url || undefined,
          invoicePdfUrl: session?.invoice?.invoice_pdf || undefined,
          invoiceNumber: session?.invoice?.number || undefined,
        };
      }),
    );

    items.sort((a, b) => b.date.localeCompare(a.date));

    return json({ items });
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error ? error.message : 'Billing could not be loaded.',
      },
      502,
    );
  }
}

async function fetchStripeSession(sessionId: string, secret: string) {
  try {
    const params = new URLSearchParams();
    params.append('expand[]', 'invoice');
    params.append('expand[]', 'payment_intent.latest_charge');

    const response = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${params}`,
      { headers: { authorization: `Bearer ${secret}` }, cache: 'no-store' },
    );

    return response.ok ? ((await response.json()) as StripeSession) : null;
  } catch {
    return null;
  }
}
