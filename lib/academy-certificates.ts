import { createHash } from 'node:crypto';

import { academyRestFetch } from '@/lib/academy-auth';

export type CertificateRecord = {
  certificate_number: string;
  issued_at: string;
  course_id: string;
  /** The name the learner confirmed (certificates issued before that have none). */
  learner_name?: string | null;
};

export type CertificateSigner = {
  instructor_name?: string;
  instructor_title?: string;
};

/**
 * Who signs the certificate of a course. A course taught by an outside instructor is signed
 * by them (name, job title and company); the team's own courses keep the default signature.
 */
export async function getCertificateSigner(courseId: string): Promise<CertificateSigner> {
  try {
    const courseResponse = await academyRestFetch(
      `courses?select=instructor,instructor_role,instructor_id&id=eq.${encodeURIComponent(courseId)}&limit=1`,
      { useServiceRole: true },
    );
    if (!courseResponse.ok) return {};

    const course = ((await courseResponse.json()) as {
      instructor?: string | null;
      instructor_role?: string | null;
      instructor_id?: string | null;
    }[])[0];
    if (!course?.instructor_id || !course.instructor?.trim()) return {};

    let company = '';
    const instructorResponse = await academyRestFetch(
      `instructors?select=company,job_title&user_id=eq.${encodeURIComponent(course.instructor_id)}&limit=1`,
      { useServiceRole: true },
    );
    if (instructorResponse.ok) {
      const row = ((await instructorResponse.json()) as { company?: string | null }[])[0];
      company = row?.company?.trim() || '';
    }

    const role = course.instructor_role?.trim();
    const title = [role && role !== 'Instructor' ? role : '', company].filter(Boolean).join(', ');
    return { instructor_name: course.instructor.trim(), instructor_title: title || 'Instructor' };
  } catch {
    return {};
  }
}

/**
 * One stable, collision-free number per learner and course
 * (for example EMDA-2026-3FA9C1D2). It is derived from the ids, so asking again
 * always gives the same certificate instead of a second one.
 */
export function buildCertificateNumber(
  userId: string,
  courseId: string,
  year = new Date().getFullYear(),
) {
  const hash = createHash('sha256')
    .update(`${userId}:${courseId}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  return `EMDA-${year}-${hash}`;
}

export async function findCertificate(userId: string, courseId: string) {
  const filter = `user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`;
  let response = await academyRestFetch(
    `certificates?select=certificate_number,issued_at,course_id,learner_name&${filter}`,
    { useServiceRole: true },
  );
  if (!response.ok) {
    // The learner_name column does not exist yet (supabase/certificate_names.sql): read without it.
    response = await academyRestFetch(
      `certificates?select=certificate_number,issued_at,course_id&${filter}`,
      { useServiceRole: true },
    );
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return ((await response.json()) as CertificateRecord[])[0] || null;
}

/**
 * The learner earned the certificate when they passed the exam. A course without
 * an exam needs every lesson completed instead.
 */
export async function isEligibleForCertificate(userId: string, courseId: string) {
  const [lessonsResponse, progressResponse] = await Promise.all([
    academyRestFetch(
      `lessons?select=id,lesson_type&course_id=eq.${encodeURIComponent(courseId)}`,
      { useServiceRole: true },
    ),
    academyRestFetch(
      `lesson_progress?select=lesson_id&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&completed=eq.true`,
      { useServiceRole: true },
    ),
  ]);

  if (!lessonsResponse.ok || !progressResponse.ok) {
    return false;
  }

  const lessons = (await lessonsResponse.json()) as { id: string; lesson_type?: string }[];
  const done = new Set(
    ((await progressResponse.json()) as { lesson_id: string }[]).map((row) =>
      String(row.lesson_id),
    ),
  );

  if (lessons.length === 0) return false;

  const exam = lessons.find((lesson) => lesson.lesson_type === 'quiz');
  if (exam) return done.has(String(exam.id));

  return lessons.every((lesson) => done.has(String(lesson.id)));
}

/**
 * Creates the certificate record if it does not exist yet, and returns it. The name the learner
 * confirmed is saved with it; an existing certificate keeps the name it was created with.
 */
export async function ensureCertificate(userId: string, courseId: string, learnerName?: string) {
  const existing = await findCertificate(userId, courseId);
  if (existing) return existing;

  const base = {
    user_id: userId,
    course_id: courseId,
    certificate_number: buildCertificateNumber(userId, courseId),
  };
  const post = (body: Record<string, unknown>) =>
    academyRestFetch('certificates', {
      method: 'POST',
      body: JSON.stringify(body),
      prefer: 'return=representation',
      useServiceRole: true,
    });

  let insert = await post(learnerName ? { ...base, learner_name: learnerName } : base);

  if (!insert.ok && learnerName) {
    // Another request may have created it a moment ago.
    const raced = await findCertificate(userId, courseId).catch(() => null);
    if (raced) return raced;

    // The learner_name column does not exist yet: the certificate still works, with the account name.
    insert = await post(base);
  }

  if (!insert.ok) {
    // Another request may have created it a moment ago.
    const raced = await findCertificate(userId, courseId).catch(() => null);
    if (raced) return raced;

    throw new Error(await insert.text());
  }

  const created = ((await insert.json().catch(() => [])) as CertificateRecord[])[0];

  await academyRestFetch(
    `enrollments?user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      prefer: 'return=minimal',
      useServiceRole: true,
    },
  );

  return created || (await findCertificate(userId, courseId))!;
}
