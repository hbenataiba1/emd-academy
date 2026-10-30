import { cleanEnv, json, readJson } from '@/lib/academy-auth';
import { notifyInstructorDecision } from '@/lib/academy-notify';

export const dynamic = 'force-dynamic';

// Called by the CRM after the team approves or declines an application: the applicant
// gets the decision by email. Protected by the same shared secret as the reply emails.
export async function POST(request: Request) {
  const secret = cleanEnv(process.env.ACADEMY_NOTIFY_SECRET);
  if (!secret || request.headers.get('x-academy-secret') !== secret) {
    return json({ message: 'Not allowed.' }, 401);
  }

  const body = await readJson<{ userId?: string }>(request, {});
  if (!body.userId) {
    return json({ message: 'Missing applicant.' }, 400);
  }

  const result = await notifyInstructorDecision(body.userId);
  return json({ sent: Boolean(result?.sent), reason: result?.reason });
}
