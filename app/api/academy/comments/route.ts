import { getCurrentAvatars } from '@/lib/academy-avatars';
import {
  academyRestFetch,
  getAcademyCourseForAccess,
  getAcademyDisplayName,
  getAcademyEnrollmentForUser,
  getAcademyUserFromRequest,
  isFreeCourse,
  json,
  readJson,
} from '@/lib/academy-auth';

type CommentRow = {
  id: string;
  author_avatar?: string | null;
  user_id: string | null;
  author_name: string;
  is_staff: boolean;
  parent_id: string | null;
  body: string;
  created_at: string;
};

const MISSING_TABLE = /lesson_comments|schema cache|does not exist/i;

// The picture the learner set on their profile (only a normal web address is kept).
function profilePicture(user: { user_metadata?: Record<string, unknown> }) {
  const value = user.user_metadata?.avatar_url;
  if (typeof value !== 'string') return null;
  const url = value.trim();
  return /^https?:\/\//i.test(url) && url.length <= 600 ? url : null;
}

// Learners of a course (or anyone on a free course) can read and write its comments.
async function canUseCourse(user: { id: string; email: string }, courseId: string) {
  const enrollment = await getAcademyEnrollmentForUser({
    userId: user.id,
    learnerEmail: user.email,
    courseId,
  });

  if (['active', 'completed'].includes(enrollment?.status || '')) return true;

  const course = await getAcademyCourseForAccess(courseId);
  return Boolean(course && isFreeCourse(course));
}

// Every comment of one lesson, oldest first (replies are grouped by the page).
export async function GET(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id || !user.email) {
      return json({ message: 'Please log in to read the questions.' }, 401);
    }

    const params = new URL(request.url).searchParams;
    const courseId = params.get('courseId');
    const lessonId = params.get('lessonId');
    if (!courseId || !lessonId) {
      return json({ message: 'Missing lesson.' }, 400);
    }

    if (!(await canUseCourse({ id: user.id, email: user.email }, courseId))) {
      return json({ message: 'Enroll in this course to see the questions.' }, 403);
    }

    const response = await academyRestFetch(
      `lesson_comments?select=id,user_id,author_name,author_avatar,is_staff,parent_id,body,created_at&course_id=eq.${encodeURIComponent(courseId)}&lesson_id=eq.${encodeURIComponent(lessonId)}&order=created_at.asc&limit=500`,
      { useServiceRole: true },
    );

    if (!response.ok) {
      const text = await response.text();
      if (MISSING_TABLE.test(text)) return json({ available: false, comments: [] });
      return json({ message: 'The questions could not be loaded.' }, 502);
    }

    const rows = (await response.json()) as CommentRow[];
    const avatars = await getCurrentAvatars(rows.map((row) => row.user_id));
    return json({
      available: true,
      comments: rows.map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        author: row.author_name,
        avatar: row.user_id && avatars.has(row.user_id) ? avatars.get(row.user_id) || null : row.author_avatar || null,
        isStaff: row.is_staff,
        // A team reply written by an instructor (it belongs to their account).
        isInstructor: row.is_staff && Boolean(row.user_id),
        body: row.body,
        createdAt: row.created_at,
        mine: row.user_id === user.id,
      })),
    });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'The questions could not be loaded.' },
      500,
    );
  }
}

// A learner asks a question, or answers another one (parentId).
export async function POST(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id || !user.email) {
      return json({ message: 'Please log in to ask a question.' }, 401);
    }

    const body = await readJson<{
      courseId?: string;
      lessonId?: string;
      body?: string;
      parentId?: string | null;
    }>(request, {});
    const text = String(body.body || '').trim().slice(0, 2000);

    if (!body.courseId || !body.lessonId || !text) {
      return json({ message: 'Write your question first.' }, 400);
    }

    if (!(await canUseCourse({ id: user.id, email: user.email }, body.courseId))) {
      return json({ message: 'Enroll in this course to ask a question.' }, 403);
    }

    // Replies always hang from the first comment of the thread.
    let parentId: string | null = null;
    if (body.parentId) {
      const parentResponse = await academyRestFetch(
        `lesson_comments?select=id,parent_id,course_id,lesson_id&id=eq.${encodeURIComponent(body.parentId)}&limit=1`,
        { useServiceRole: true },
      );
      const parent = parentResponse.ok
        ? ((await parentResponse.json()) as {
            id: string;
            parent_id: string | null;
            course_id: string;
            lesson_id: string;
          }[])[0]
        : null;

      if (!parent || parent.course_id !== body.courseId || parent.lesson_id !== body.lessonId) {
        return json({ message: 'That question no longer exists.' }, 404);
      }
      parentId = parent.parent_id || parent.id;
    }

    const avatar = profilePicture(user);
    const response = await academyRestFetch('lesson_comments', {
      method: 'POST',
      body: JSON.stringify({
        course_id: body.courseId,
        lesson_id: body.lessonId,
        user_id: user.id,
        author_name: getAcademyDisplayName(user),
        author_email: user.email,
        author_avatar: avatar,
        is_staff: false,
        parent_id: parentId,
        body: text,
      }),
      prefer: 'return=representation',
      useServiceRole: true,
    });

    if (!response.ok) {
      const failure = await response.text();
      return json(
        {
          message: MISSING_TABLE.test(failure)
            ? 'Questions are not available yet.'
            : 'Your question could not be saved.',
        },
        502,
      );
    }

    const saved = ((await response.json()) as CommentRow[])[0];
    return json({
      comment: {
        id: saved.id,
        parentId: saved.parent_id,
        author: saved.author_name,
        avatar: saved.author_avatar || null,
        isStaff: false,
        body: saved.body,
        createdAt: saved.created_at,
        mine: true,
      },
    });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'Your question could not be saved.' },
      500,
    );
  }
}

// A learner deletes their own comment (its replies go with it).
export async function DELETE(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id) {
      return json({ message: 'Please log in to continue.' }, 401);
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return json({ message: 'Missing comment.' }, 400);
    }

    const response = await academyRestFetch(
      `lesson_comments?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`,
      { method: 'DELETE', useServiceRole: true },
    );

    if (!response.ok) {
      return json({ message: 'The question could not be deleted.' }, 502);
    }

    return json({ deleted: true });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'The question could not be deleted.' },
      500,
    );
  }
}
