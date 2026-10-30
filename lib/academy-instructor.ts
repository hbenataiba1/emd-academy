import {
  type AcademyAuthUser,
  academyRestFetch,
  getAcademyUserFromRequest,
  json,
} from '@/lib/academy-auth';

export type ApprovedInstructor = {
  user: AcademyAuthUser & { email: string };
  instructor: {
    user_id: string;
    full_name: string;
    headline: string | null;
    job_title: string | null;
    commission_percent: number;
  };
};

/**
 * The signed-in learner, if they are an approved instructor. Otherwise the response
 * to send back (401 not signed in, 403 not an instructor).
 */
export async function requireInstructor(
  request: Request,
): Promise<ApprovedInstructor | Response> {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to continue.' }, 401);
  }

  const response = await academyRestFetch(
    `instructors?select=user_id,full_name,headline,job_title,commission_percent&user_id=eq.${encodeURIComponent(user.id)}&status=eq.approved&limit=1`,
    { useServiceRole: true },
  );

  const instructor = response.ok
    ? ((await response.json()) as ApprovedInstructor['instructor'][])[0]
    : null;

  if (!instructor) {
    return json({ message: 'Instructor access is required.' }, 403);
  }

  return { user: { ...user, email: user.email }, instructor };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text written by an instructor, as the paragraphs the lesson page displays. */
export function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** The reverse of `textToHtml`, to show a saved article back in the editor. */
export function htmlToText(html: string) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?(p|div)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

export function formatCourseMinutes(total: number) {
  const minutes = Math.round(total);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export type OwnedCourse = {
  id: string;
  title: string;
  review_status: 'draft' | 'in_review' | 'changes_requested' | 'approved';
  is_published: boolean;
  instructor_id: string | null;
};

/** The course, only if this instructor owns it. */
export async function getOwnedCourse(courseId: string, userId: string) {
  const response = await academyRestFetch(
    `courses?select=*&id=eq.${encodeURIComponent(courseId)}&instructor_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { useServiceRole: true },
  );
  if (!response.ok) return null;
  return ((await response.json()) as Record<string, unknown>[])[0] || null;
}

/** The ids and titles of every course this instructor created. */
export async function getOwnCourses(userId: string) {
  const response = await academyRestFetch(
    `courses?select=id,title,is_published,review_status&instructor_id=eq.${encodeURIComponent(userId)}`,
    { useServiceRole: true },
  );
  return response.ok
    ? ((await response.json()) as {
        id: string;
        title: string;
        is_published: boolean;
        review_status: string;
      }[])
    : [];
}

/** `in.(a,b,c)` filter for a list of ids (or null when the list is empty). */
export function inFilter(ids: string[]) {
  return ids.length ? `in.(${ids.map(encodeURIComponent).join(',')})` : null;
}
