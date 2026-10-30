import { randomUUID } from 'node:crypto';

import { academyRestFetch, json, readJson } from '@/lib/academy-auth';
import {
  formatCourseMinutes,
  getOwnedCourse,
  htmlToText,
  requireInstructor,
  textToHtml,
} from '@/lib/academy-instructor';
import { MIN_CHARGE_CENTS } from '@/lib/academy-coupons';

type LessonRow = {
  id: string;
  section_title: string | null;
  title: string;
  lesson_type: string;
  duration_minutes: number | null;
  video_url: string | null;
  description: string | null;
  resources: { name: string; url: string; type?: string }[] | null;
  sort_order: number;
  preview_enabled: boolean;
};

type Resource = { name: string; url: string; type: string };

type IncomingLesson = {
  id?: string;
  title?: string;
  type?: string;
  videoUrl?: string;
  minutes?: number;
  text?: string;
  preview?: boolean;
  resources?: { name?: string; url?: string }[];
};

type ExamQuestionInput = {
  key?: string;
  question?: string;
  options?: { id?: string; text?: string }[];
  correctOptionIds?: string[];
  explanation?: string;
};

type ExamInput = {
  passingScore?: number;
  timeLimitMinutes?: number;
  questions?: ExamQuestionInput[];
};

type SaveBody = {
  exam?: ExamInput;
  /** Slides of the whole course, shown in every lesson. */
  presentationUrl?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  category?: string;
  level?: string;
  price?: number;
  outcomes?: string[];
  sections?: { title?: string; lessons?: IncomingLesson[] }[];
};

const EDITABLE = ['draft', 'changes_requested'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

function isEditable(course: Record<string, unknown>) {
  return EDITABLE.includes(String(course.review_status)) && !course.is_published;
}

// The course and its lessons, ready for the editor.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, auth.user.id);
  if (!course) return json({ message: 'Course not found.' }, 404);

  const lessonsResponse = await academyRestFetch(
    `lessons?select=id,section_title,title,lesson_type,duration_minutes,video_url,description,resources,sort_order,preview_enabled&course_id=eq.${encodeURIComponent(courseId)}&order=sort_order.asc`,
    { useServiceRole: true },
  );
  const rows = lessonsResponse.ok ? ((await lessonsResponse.json()) as LessonRow[]) : [];

  // The final exam is prepared by the team: it is not edited here.
  const sections: { title: string; lessons: unknown[] }[] = [];
  rows
    .filter((row) => row.lesson_type !== 'quiz')
    .forEach((row) => {
      const title = row.section_title || 'Lessons';
      let section = sections.find((item) => item.title === title);
      if (!section) {
        section = { title, lessons: [] };
        sections.push(section);
      }
      section.lessons.push({
        id: row.id,
        title: row.title,
        type: row.lesson_type === 'article' ? 'article' : 'video',
        videoUrl: row.video_url || '',
        minutes: row.duration_minutes || 0,
        text: row.lesson_type === 'article' ? htmlToText(row.description || '') : '',
        preview: Boolean(row.preview_enabled),
        resources: (row.resources || [])
          .filter((item) => item.type !== 'presentation')
          .map((item) => ({ name: item.name, url: item.url })),
      });
    });

  const quiz = rows.find((row) => row.lesson_type === 'quiz');
  let exam: { passingScore: number; timeLimitMinutes: number; questions: unknown[] } | null = null;
  if (quiz) {
    let meta: { passingScore?: number } = {};
    try {
      meta = JSON.parse(quiz.description || '{}');
    } catch {
      meta = {};
    }
    const questions = (quiz.resources || [])
      .map((item) => {
        try {
          return JSON.parse(item.url) as {
            _key?: string;
            question: string;
            options: { id: string; text: string }[];
            correctOptionId?: string;
            correctOptionIds?: string[];
            explanation?: string;
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item, index) => ({
        key: item._key || `q${index}`,
        question: item.question,
        options: item.options,
        correctOptionIds: item.correctOptionIds?.length ? item.correctOptionIds : item.correctOptionId ? [item.correctOptionId] : [],
        explanation: item.explanation || '',
      }));
    exam = {
      passingScore: meta.passingScore ?? 80,
      timeLimitMinutes: quiz.duration_minutes ?? 20,
      questions,
    };
  }

  return json({
    exam,
    editable: isEditable(course),
    course: {
      id: course.id,
      title: course.title,
      subtitle: course.subtitle || '',
      description: course.description || '',
      category: course.category || 'EU MDR',
      level: course.level || 'Intermediate',
      price: Number(course.price_cents || 0) / 100,
      presentationUrl: typeof course.presentation_url === 'string' ? course.presentation_url : '',
      outcomes: Array.isArray(course.outcomes) ? course.outcomes : [],
      reviewStatus: course.review_status,
      reviewNote: course.review_note || '',
      isPublished: Boolean(course.is_published),
    },
    sections,
  });
}

// Saves the whole course (details and lessons) while it is a draft.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, auth.user.id);
  if (!course) return json({ message: 'Course not found.' }, 404);
  if (!isEditable(course)) {
    return json({ message: 'This course is in review or published, so it cannot be edited now.' }, 409);
  }

  const body = await readJson<SaveBody>(request, {});
  const title = String(body.title || '').trim().slice(0, 140);
  if (title.length < 3) return json({ message: 'Give your course a title.' }, 400);

  const price = Number(body.price || 0);
  const priceCents = Math.round(price * 100);
  if (!Number.isFinite(price) || priceCents < 0 || priceCents > 200000) {
    return json({ message: 'The price must be between 0 and 2000 USD.' }, 400);
  }
  if (priceCents > 0 && priceCents < MIN_CHARGE_CENTS) {
    return json({ message: `A paid course costs at least ${(MIN_CHARGE_CENTS / 100).toFixed(2)} USD.` }, 400);
  }

  // The final exam: every question needs text, two or more answers and a right answer.
  const examQuestions: {
    _key: string;
    question: string;
    options: { id: string; text: string }[];
    correctOptionId: string;
    correctOptionIds: string[];
    explanation: string;
  }[] = [];
  for (const [index, input] of (body.exam?.questions || []).slice(0, 60).entries()) {
    const question = String(input.question || '').trim().slice(0, 600);
    const options = (input.options || [])
      .map((option, optionIndex) => ({
        id: String(option.id || `opt-${optionIndex + 1}`),
        text: String(option.text || '').trim().slice(0, 400),
      }))
      .filter((option) => option.text)
      .slice(0, 6);
    const correct = (input.correctOptionIds || []).filter((id) => options.some((option) => option.id === id));

    if (!question && options.length === 0) continue;
    if (!question) return json({ message: `Exam question ${index + 1} has no text.` }, 400);
    if (options.length < 2) return json({ message: `Exam question ${index + 1} needs at least two answers.` }, 400);
    if (correct.length === 0) return json({ message: `Choose the right answer of exam question ${index + 1}.` }, 400);

    examQuestions.push({
      _key: String(input.key || `q${index}`),
      question,
      options,
      correctOptionId: correct[0],
      correctOptionIds: correct,
      explanation: String(input.explanation || '').trim().slice(0, 800),
    });
  }

  // Existing lessons: only those of this course may be updated.
  const existingResponse = await academyRestFetch(
    `lessons?select=id,lesson_type,description&course_id=eq.${encodeURIComponent(courseId)}`,
    { useServiceRole: true },
  );
  const existing = existingResponse.ok
    ? ((await existingResponse.json()) as { id: string; lesson_type: string; description: string | null }[])
    : [];
  const ownIds = new Set(existing.map((row) => row.id));

  const rows: Record<string, unknown>[] = [];
  let order = 0;
  for (const section of (body.sections || []).slice(0, 40)) {
    const sectionTitle = String(section.title || '').trim().slice(0, 120) || 'Lessons';
    for (const lesson of (section.lessons || []).slice(0, 80)) {
      const lessonTitle = String(lesson.title || '').trim().slice(0, 160);
      if (!lessonTitle) continue;

      const isArticle = lesson.type === 'article';
      const id = lesson.id && ownIds.has(lesson.id) ? lesson.id : randomUUID();
      const resources: Resource[] = (lesson.resources || [])
        .map((item) => ({
          name: String(item.name || '').trim().slice(0, 120),
          url: String(item.url || '').trim().slice(0, 600),
          type: 'link',
        }))
        .filter((item) => item.name && /^https?:\/\//i.test(item.url))
        .slice(0, 12);

      rows.push({
        id,
        course_id: courseId,
        section_title: sectionTitle,
        title: lessonTitle,
        lesson_type: isArticle ? 'article' : 'video',
        duration_minutes: Math.max(0, Math.min(600, Math.round(Number(lesson.minutes) || 0))),
        video_url: isArticle ? null : String(lesson.videoUrl || '').trim().slice(0, 600) || null,
        description: isArticle ? textToHtml(String(lesson.text || '').slice(0, 60000)) : null,
        resources,
        sort_order: order++,
        preview_enabled: Boolean(lesson.preview),
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Lessons removed in the editor (never the exam).
  const keep = new Set(rows.map((row) => String(row.id)));
  const stale = existing
    .filter((row) => row.lesson_type !== 'quiz' && !keep.has(row.id))
    .map((row) => row.id);
  if (stale.length > 0) {
    const removed = await academyRestFetch(
      `lessons?course_id=eq.${encodeURIComponent(courseId)}&id=in.(${stale.map(encodeURIComponent).join(',')})`,
      { method: 'DELETE', useServiceRole: true },
    );
    if (!removed.ok) return json({ message: 'Some lessons could not be removed.' }, 502);
  }

  if (rows.length > 0) {
    const saved = await academyRestFetch('lessons?on_conflict=id', {
      method: 'POST',
      body: JSON.stringify(rows),
      prefer: 'resolution=merge-duplicates,return=minimal',
      useServiceRole: true,
    });
    if (!saved.ok) return json({ message: 'The lessons could not be saved.' }, 502);
  }

  if (body.exam) {
    const existingQuiz = existing.find((row) => row.lesson_type === 'quiz');

    if (examQuestions.length > 0) {
      // Certificate settings already chosen by the team are kept.
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(existingQuiz?.description || '{}');
      } catch {
        meta = {};
      }
      const passing = Math.max(30, Math.min(100, Math.round(Number(body.exam.passingScore) || 80)));
      const limit = Math.max(5, Math.min(240, Math.round(Number(body.exam.timeLimitMinutes) || 20)));

      const savedExam = await academyRestFetch('lessons?on_conflict=id', {
        method: 'POST',
        body: JSON.stringify({
          id: existingQuiz?.id || randomUUID(),
          course_id: courseId,
          section_title: 'Final Examination & Certification',
          title: 'Official Course Certification Exam',
          lesson_type: 'quiz',
          duration_minutes: limit,
          video_url: null,
          description: JSON.stringify({
            certificateTitle: `Certificate of Excellence in ${title}`,
            certificateEnabled: true,
            linkedinShareEnabled: true,
            ...meta,
            passingScore: passing,
          }),
          resources: examQuestions.map((question, index) => ({
            name: `Q${index + 1}: ${question.question.slice(0, 60)}`,
            url: JSON.stringify(question),
            type: 'quiz_question',
          })),
          sort_order: rows.length,
          preview_enabled: false,
          updated_at: new Date().toISOString(),
        }),
        prefer: 'resolution=merge-duplicates,return=minimal',
        useServiceRole: true,
      });
      if (!savedExam.ok) return json({ message: 'The final exam could not be saved.' }, 502);
    } else if (existingQuiz) {
      await academyRestFetch(`lessons?id=eq.${encodeURIComponent(existingQuiz.id)}`, {
        method: 'DELETE',
        useServiceRole: true,
      });
    }
  }

  const totalMinutes = rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
  const level = LEVELS.includes(String(body.level)) ? String(body.level) : 'Intermediate';
  const updated = await academyRestFetch(`courses?id=eq.${encodeURIComponent(courseId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title,
      subtitle: String(body.subtitle || '').trim().slice(0, 240) || null,
      description: String(body.description || '').trim().slice(0, 8000) || null,
      category: String(body.category || '').trim().slice(0, 60) || 'EU MDR',
      level,
      price_cents: priceCents,
      price_label: priceCents === 0 ? 'Free' : `$${Math.round(priceCents / 100)}`,
      outcomes: (body.outcomes || [])
        .map((item) => String(item || '').trim().slice(0, 200))
        .filter(Boolean)
        .slice(0, 12),
      lesson_count: rows.length,
      duration: formatCourseMinutes(totalMinutes),
      updated_at: new Date().toISOString(),
    }),
    prefer: 'return=minimal',
    useServiceRole: true,
  });

  if (!updated.ok) return json({ message: 'The course could not be saved.' }, 502);

  // The presentation is saved on its own, so a missing column never blocks the rest.
  if (body.presentationUrl !== undefined) {
    const slides = String(body.presentationUrl || '').trim().slice(0, 600);
    const valid = /^https?:\/\//i.test(slides) ? slides : null;
    const saved = await academyRestFetch(`courses?id=eq.${encodeURIComponent(courseId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ presentation_url: valid }),
      prefer: 'return=minimal',
      useServiceRole: true,
    });
    if (!saved.ok && valid) {
      return json({ message: 'The presentation could not be saved yet. Please contact us.' }, 502);
    }
  }

  return json({ saved: true });
}

// A draft with no learners can be deleted.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, auth.user.id);
  if (!course) return json({ message: 'Course not found.' }, 404);
  if (course.review_status !== 'draft' || course.is_published) {
    return json({ message: 'Only a draft can be deleted. Contact us to remove another course.' }, 409);
  }

  const removed = await academyRestFetch(`courses?id=eq.${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
    useServiceRole: true,
  });
  if (!removed.ok) return json({ message: 'The course could not be deleted.' }, 502);

  return json({ deleted: true });
}
