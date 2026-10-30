import { cleanEnv, json, readJson } from '@/lib/academy-auth';
import { notifyQuestionAnswered } from '@/lib/academy-notify';

export const dynamic = 'force-dynamic';

// Called by the CRM right after the team answers a learner's question: the learner who
// asked gets an email. Protected by a shared secret (ACADEMY_NOTIFY_SECRET).
export async function POST(request: Request) {
  const secret = cleanEnv(process.env.ACADEMY_NOTIFY_SECRET);
  if (!secret || request.headers.get('x-academy-secret') !== secret) {
    return json({ message: 'Not allowed.' }, 401);
  }

  const body = await readJson<{ replyId?: string }>(request, {});
  if (!body.replyId) {
    return json({ message: 'Missing reply.' }, 400);
  }

  const result = await notifyQuestionAnswered(body.replyId);
  return json({ sent: Boolean(result?.sent), reason: result?.reason });
}
