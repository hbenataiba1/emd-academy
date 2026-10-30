import { academyRestFetch, json } from '@/lib/academy-auth';
import { EARNINGS_HOLD_DAYS } from '@/lib/academy-earnings';
import { getOwnCourses, requireInstructor } from '@/lib/academy-instructor';

type EarningRow = {
  id: string;
  course_id: string;
  kind: 'sale' | 'refund';
  learner_email: string | null;
  learner_name: string | null;
  gross_cents: number;
  commission_percent: number;
  platform_cents: number;
  net_cents: number;
  currency: string;
  status: 'pending' | 'paid';
  available_at: string;
  created_at: string;
};

type PayoutRow = {
  id: string;
  amount_cents: number;
  currency: string;
  method: string;
  reference: string | null;
  paid_at: string;
};

// What the instructor earned, what can be paid out now, and the payouts already sent.
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const id = encodeURIComponent(auth.user.id);
  const [earningsResponse, payoutsResponse, courses, detailsResponse] = await Promise.all([
    academyRestFetch(
      `instructor_earnings?select=id,course_id,kind,learner_email,learner_name,gross_cents,commission_percent,platform_cents,net_cents,currency,status,available_at,created_at&instructor_id=eq.${id}&order=created_at.desc&limit=2000`,
      { useServiceRole: true },
    ),
    academyRestFetch(
      `instructor_payouts?select=id,amount_cents,currency,method,reference,paid_at&instructor_id=eq.${id}&order=paid_at.desc&limit=200`,
      { useServiceRole: true },
    ),
    getOwnCourses(auth.user.id),
    academyRestFetch(`instructor_payment_details?select=method&instructor_id=eq.${id}&limit=1`, { useServiceRole: true }),
  ]);

  // The earnings tables are not created yet.
  if (!earningsResponse.ok) {
    return json({ available: false, rows: [], payouts: [] });
  }

  const earnings = (await earningsResponse.json()) as EarningRow[];
  const payouts = payoutsResponse.ok ? ((await payoutsResponse.json()) as PayoutRow[]) : [];
  const titles = new Map(courses.map((course) => [course.id, course.title]));
  const now = Date.now();

  const unpaid = earnings.filter((row) => row.status === 'pending');
  const availableCents = unpaid
    .filter((row) => new Date(row.available_at).getTime() <= now)
    .reduce((sum, row) => sum + row.net_cents, 0);
  const pendingCents = unpaid
    .filter((row) => new Date(row.available_at).getTime() > now)
    .reduce((sum, row) => sum + row.net_cents, 0);
  const paidCents = payouts.reduce((sum, payout) => sum + payout.amount_cents, 0);

  return json({
    available: true,
    commissionPercent: Number(auth.instructor.commission_percent),
    holdDays: EARNINGS_HOLD_DAYS,
    hasPaymentDetails: detailsResponse.ok ? ((await detailsResponse.json()) as unknown[]).length > 0 : true,
    availableCents,
    pendingCents,
    paidCents,
    salesCents: earnings.filter((row) => row.kind === 'sale').reduce((sum, row) => sum + row.gross_cents, 0),
    rows: earnings.map((row) => ({
      id: row.id,
      kind: row.kind,
      date: row.created_at,
      courseTitle: titles.get(row.course_id) || row.course_id,
      learner: row.learner_name || row.learner_email?.split('@')[0] || 'Learner',
      grossCents: row.gross_cents,
      commissionPercent: Number(row.commission_percent),
      platformCents: row.platform_cents,
      netCents: row.net_cents,
      status:
        row.status === 'paid'
          ? 'paid'
          : new Date(row.available_at).getTime() <= now
            ? 'available'
            : 'pending',
      availableAt: row.available_at,
    })),
    payouts: payouts.map((payout) => ({
      id: payout.id,
      amountCents: payout.amount_cents,
      method: payout.method,
      reference: payout.reference,
      paidAt: payout.paid_at,
    })),
  });
}
