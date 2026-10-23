import { academyRestFetch, cleanEnv, json } from '@/lib/academy-auth';
import { notifySurveyRequest } from '@/lib/academy-notify';

export const dynamic = 'force-dynamic';

type CertificateRow = { user_id: string | null; course_id: string; issued_at: string };

// Runs once a day (see vercel.json). Asks every learner who earned a certificate
// more than a day ago, and has not sent a review yet, to rate the course.
export async function GET(request: Request) {
  const secret = cleanEnv(process.env.CRON_SECRET);
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ message: 'Not allowed.' }, 401);
  }

  const now = Date.now();
  const from = new Date(now - 7 * 24 * 60 * 60_000).toISOString();
  const to = new Date(now - 24 * 60 * 60_000).toISOString();

  const response = await academyRestFetch(
    `certificates?select=user_id,course_id,issued_at&issued_at=gte.${encodeURIComponent(from)}&issued_at=lte.${encodeURIComponent(to)}&order=issued_at.asc&limit=200`,
    { useServiceRole: true },
  );
  if (!response.ok) {
    return json({ message: 'Could not read certificates.' }, 502);
  }

  const certificates = (await response.json()) as CertificateRow[];
  let sent = 0;
  let skipped = 0;

  for (const certificate of certificates) {
    if (!certificate.user_id) continue;

    // Already reviewed: no need to ask.
    const review = await academyRestFetch(
      `course_reviews?select=id&user_id=eq.${encodeURIComponent(certificate.user_id)}&course_id=eq.${encodeURIComponent(certificate.course_id)}&limit=1`,
      { useServiceRole: true },
    );
    if (review.ok && ((await review.json()) as unknown[]).length > 0) {
      skipped += 1;
      continue;
    }

    const [enrollment, course] = await Promise.all([
      academyRestFetch(
        `enrollments?select=learner_email,learner_name&user_id=eq.${encodeURIComponent(certificate.user_id)}&course_id=eq.${encodeURIComponent(certificate.course_id)}&limit=1`,
        { useServiceRole: true },
      ),
      academyRestFetch(
        `courses?select=title&id=eq.${encodeURIComponent(certificate.course_id)}&limit=1`,
        { useServiceRole: true },
      ),
    ]);

    const learner = enrollment.ok
      ? ((await enrollment.json()) as { learner_email?: string; learner_name?: string | null }[])[0]
      : undefined;
    const title = course.ok ? ((await course.json()) as { title?: string }[])[0]?.title : undefined;

    if (!learner?.learner_email) {
      skipped += 1;
      continue;
    }

    const result = await notifySurveyRequest({
      userId: certificate.user_id,
      email: learner.learner_email,
      name: learner.learner_name,
      courseId: certificate.course_id,
      courseTitle: title || 'your course',
    });

    if (result.sent) sent += 1;
    else skipped += 1;
  }

  return json({ checked: certificates.length, sent, skipped });
}
