import { cleanEnv, json, readJson } from '@/lib/academy-auth';
import { notifyCourseDecision } from '@/lib/academy-notify';

export const dynamic = 'force-dynamic';

// Called by the CRM when the team asks an instructor for changes or publishes their course.
export async function POST(request: Request) {
  const secret = cleanEnv(process.env.ACADEMY_NOTIFY_SECRET);
  if (!secret || request.headers.get('x-academy-secret') !== secret) {
    return json({ message: 'Not allowed.' }, 401);
  }

  const body = await readJson<{ courseId?: string; event?: string }>(request, {});
  if (!body.courseId || !['changes_requested', 'published'].includes(String(body.event))) {
    return json({ message: 'Missing course.' }, 400);
  }

  const result = await notifyCourseDecision(body.courseId, body.event as 'changes_requested' | 'published');
  return json({ sent: Boolean(result?.sent), reason: result?.reason });
}
