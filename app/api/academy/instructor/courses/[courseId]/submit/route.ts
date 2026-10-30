import { academyRestFetch, json } from '@/lib/academy-auth';
import { getOwnedCourse, requireInstructor } from '@/lib/academy-instructor';

// Sends a finished draft to the team for review.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, auth.user.id);
  if (!course) return json({ message: 'Course not found.' }, 404);

  if (!['draft', 'changes_requested'].includes(String(course.review_status)) || course.is_published) {
    return json({ message: 'This course was already sent for review.' }, 409);
  }

  const problems: string[] = [];
  if (String(course.title || '').trim().length < 3) problems.push('Add a title.');
  if (String(course.description || '').trim().length < 80) problems.push('Write a description of at least a few sentences.');

  const lessonsResponse = await academyRestFetch(
    `lessons?select=title,lesson_type,video_url,description&course_id=eq.${encodeURIComponent(courseId)}&lesson_type=neq.quiz`,
    { useServiceRole: true },
  );
  const lessons = lessonsResponse.ok
    ? ((await lessonsResponse.json()) as {
        title: string;
        lesson_type: string;
        video_url: string | null;
        description: string | null;
      }[])
    : [];

  if (lessons.length === 0) problems.push('Add at least one lesson.');

  const examResponse = await academyRestFetch(
    `lessons?select=resources&course_id=eq.${encodeURIComponent(courseId)}&lesson_type=eq.quiz&limit=1`,
    { useServiceRole: true },
  );
  const exam = examResponse.ok ? ((await examResponse.json()) as { resources: unknown[] | null }[])[0] : null;
  if ((exam?.resources?.length || 0) < 3) problems.push('Write a final exam of at least 3 questions.');
  lessons.forEach((lesson) => {
    if (lesson.lesson_type === 'article' ? !lesson.description : !lesson.video_url) {
      problems.push(`The lesson "${lesson.title}" has no ${lesson.lesson_type === 'article' ? 'text' : 'video'}.`);
    }
  });

  if (problems.length > 0) {
    return json({ message: problems.slice(0, 4).join(' ') }, 400);
  }

  const now = new Date().toISOString();
  const updated = await academyRestFetch(`courses?id=eq.${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ review_status: 'in_review', submitted_at: now, updated_at: now }),
    prefer: 'return=minimal',
    useServiceRole: true,
  });
  if (!updated.ok) return json({ message: 'The course could not be sent.' }, 502);

  return json({ submitted: true });
}
