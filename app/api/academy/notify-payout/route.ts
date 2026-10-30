import { cleanEnv, json, readJson } from '@/lib/academy-auth';
import { notifyInstructorPayout } from '@/lib/academy-notify';

export const dynamic = 'force-dynamic';

// Called by the CRM when the team records a payment to an instructor.
export async function POST(request: Request) {
  const secret = cleanEnv(process.env.ACADEMY_NOTIFY_SECRET);
  if (!secret || request.headers.get('x-academy-secret') !== secret) {
    return json({ message: 'Not allowed.' }, 401);
  }

  const body = await readJson<{ payoutId?: string }>(request, {});
  if (!body.payoutId) {
    return json({ message: 'Missing payout.' }, 400);
  }

  const result = await notifyInstructorPayout(body.payoutId);
  return json({ sent: Boolean(result?.sent), reason: result?.reason });
}
