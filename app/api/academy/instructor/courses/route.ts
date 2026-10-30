import { randomUUID } from 'node:crypto';

import { academyRestFetch, json, readJson } from '@/lib/academy-auth';
import { requireInstructor, slugify } from '@/lib/academy-instructor';

// The instructor's own courses.
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const response = await academyRestFetch(
    `courses?select=id,title,subtitle,review_status,review_note,is_published,price_cents,lesson_count,duration,submitted_at,updated_at,created_at&instructor_id=eq.${encodeURIComponent(auth.user.id)}&order=updated_at.desc`,
    { useServiceRole: true },
  );

  if (!response.ok) {
    const text = await response.text();
    return json(
      {
        message: /instructor_id|review_status|schema cache/i.test(text)
          ? 'Courses are not available yet.'
          : 'Your courses could not be loaded.',
      },
      502,
    );
  }

  return json({ courses: await response.json() });
}

// Starts a new course as a draft. It is only published later, by the team.
export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ title?: string }>(request, {});
  // The title is written in the first step of the editor.
  const title = String(body.title || '').trim().slice(0, 140) || 'Untitled course';

  const slug = `${slugify(title) || 'course'}-${randomUUID().slice(0, 4)}`;
  const response = await academyRestFetch('courses', {
    method: 'POST',
    body: JSON.stringify({
      id: slug,
      slug,
      title,
      instructor: auth.instructor.full_name,
      instructor_role: auth.instructor.job_title || auth.instructor.headline || 'Instructor',
      instructor_id: auth.user.id,
      review_status: 'draft',
      is_published: false,
      price_cents: 0,
      price_label: 'Free',
      outcomes: [],
      sort_order: 100,
    }),
    prefer: 'return=minimal',
    useServiceRole: true,
  });

  if (!response.ok) {
    return json({ message: 'The course could not be created.' }, 502);
  }

  return json({ id: slug });
}
