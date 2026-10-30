import { after } from 'next/server';

import { academyRestFetch, json, readJson } from '@/lib/academy-auth';
import { getCurrentAvatars } from '@/lib/academy-avatars';
import { getOwnCourses, inFilter, requireInstructor } from '@/lib/academy-instructor';
import { notifyQuestionAnswered } from '@/lib/academy-notify';

type Row = {
  id: string;
  course_id: string;
  lesson_id: string;
  user_id: string | null;
  author_name: string;
  author_email: string | null;
  author_avatar: string | null;
  is_staff: boolean;
  parent_id: string | null;
  body: string;
  created_at: string;
};

// Questions learners asked under the instructor's lessons, with the answers.
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const courses = await getOwnCourses(auth.user.id);
  const filter = inFilter(courses.map((course) => course.id));
  if (!filter) return json({ threads: [] });

  const [commentsResponse, lessonsResponse] = await Promise.all([
    academyRestFetch(
      `lesson_comments?select=id,course_id,lesson_id,user_id,author_name,author_email,author_avatar,is_staff,parent_id,body,created_at&course_id=${filter}&order=created_at.asc&limit=5000`,
      { useServiceRole: true },
    ),
    academyRestFetch(`lessons?select=id,title&course_id=${filter}`, { useServiceRole: true }),
  ]);

  // The questions table is not created yet.
  if (!commentsResponse.ok) return json({ threads: [], available: false });

  const comments = (await commentsResponse.json()) as Row[];
  const lessons = lessonsResponse.ok ? ((await lessonsResponse.json()) as { id: string; title: string }[]) : [];
  const lessonTitles = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const courseTitles = new Map(courses.map((course) => [course.id, course.title]));

  const avatars = await getCurrentAvatars(comments.map((row) => row.user_id));

  const present = (row: Row) => ({
    id: row.id,
    author: row.author_name,
    avatar: row.user_id && avatars.has(row.user_id) ? avatars.get(row.user_id) || null : row.author_avatar,
    email: row.is_staff ? null : row.author_email,
    isStaff: row.is_staff,
    isInstructor: row.is_staff && Boolean(row.user_id),
    mine: row.user_id === auth.user.id,
    body: row.body,
    createdAt: row.created_at,
  });

  const threads = comments
    .filter((row) => !row.parent_id)
    .map((root) => {
      const replies = comments.filter((row) => row.parent_id === root.id);
      return {
        root: present(root),
        replies: replies.map(present),
        courseTitle: courseTitles.get(root.course_id) || root.course_id,
        lessonTitle: lessonTitles.get(root.lesson_id) || root.lesson_id,
        answered: replies.some((reply) => reply.is_staff),
        lastAt: (replies[replies.length - 1] || root).created_at,
      };
    })
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

  return json({ available: true, threads });
}

// The instructor answers a learner's question.
export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ parentId?: string; body?: string }>(request, {});
  const text = String(body.body || '').trim().slice(0, 2000);
  if (!body.parentId || !text) return json({ message: 'Write your answer first.' }, 400);

  const parentResponse = await academyRestFetch(
    `lesson_comments?select=id,parent_id,course_id,lesson_id&id=eq.${encodeURIComponent(body.parentId)}&limit=1`,
    { useServiceRole: true },
  );
  const parent = parentResponse.ok
    ? ((await parentResponse.json()) as { id: string; parent_id: string | null; course_id: string; lesson_id: string }[])[0]
    : null;
  if (!parent) return json({ message: 'That question no longer exists.' }, 404);

  // Only the questions of the instructor's own courses.
  const owned = (await getOwnCourses(auth.user.id)).some((course) => course.id === parent.course_id);
  if (!owned) return json({ message: 'This is not one of your courses.' }, 403);

  const avatar = auth.user.user_metadata?.avatar_url;
  const response = await academyRestFetch('lesson_comments', {
    method: 'POST',
    body: JSON.stringify({
      course_id: parent.course_id,
      lesson_id: parent.lesson_id,
      user_id: auth.user.id,
      author_name: auth.instructor.full_name,
      author_email: auth.user.email,
      author_avatar: typeof avatar === 'string' && /^https?:\/\//i.test(avatar) ? avatar.slice(0, 600) : null,
      is_staff: true,
      parent_id: parent.parent_id || parent.id,
      body: text,
    }),
    prefer: 'return=representation',
    useServiceRole: true,
  });
  if (!response.ok) return json({ message: 'Your answer could not be saved.' }, 502);

  const saved = ((await response.json()) as { id: string }[])[0];
  // The learner who asked is told by email.
  after(() => notifyQuestionAnswered(saved.id));

  return json({ saved: true });
}

// The instructor removes one of their own answers.
export async function DELETE(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ message: 'Missing answer.' }, 400);

  const response = await academyRestFetch(
    `lesson_comments?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(auth.user.id)}&is_staff=eq.true`,
    { method: 'DELETE', useServiceRole: true },
  );
  return response.ok ? json({ deleted: true }) : json({ message: 'The answer could not be deleted.' }, 502);
}
