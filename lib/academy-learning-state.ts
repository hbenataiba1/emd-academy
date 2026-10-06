const LEARNING_STATE_KEY = 'easy_medical_device_academy_learning_state';

export type StoredLearningCourse = {
  id: string;
  title: string;
  instructor: string;
  category: string;
  lessons: number;
  image: string;
  accent: string;
  startedAt: string;
  updatedAt: string;
  lastLessonId?: string;
  lastLessonTitle?: string;
  completedLessonIds: string[];
};

type LearningState = {
  courses: Record<string, StoredLearningCourse>;
};

const fallbackCourseMeta = {
  title: 'Academy course',
  instructor: 'Easy Medical Device Academy',
  category: 'Academy',
  lessons: 1,
  image:
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
  accent: '#7c3aed',
};

export function getLearningState(): LearningState {
  if (typeof window === 'undefined') {
    return { courses: {} };
  }

  try {
    const raw = window.localStorage.getItem(LEARNING_STATE_KEY);
    if (!raw) return { courses: {} };
    const parsed = JSON.parse(raw) as Partial<LearningState>;
    return { courses: parsed.courses || {} };
  } catch {
    return { courses: {} };
  }
}

export function getStoredLearningCourses() {
  return Object.values(getLearningState().courses).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getStoredCourseProgress(courseId: string) {
  return getLearningState().courses[courseId] || null;
}

type LearningCourseMeta = {
  id: string;
  title?: string;
  instructor?: string;
  category?: string;
  lessons?: number;
  image?: string;
  accent?: string;
};

export function markCourseStarted(course: LearningCourseMeta) {
  const now = new Date().toISOString();
  const state = getLearningState();
  const existing = state.courses[course.id];

  state.courses[course.id] = {
    id: course.id,
    title: course.title || existing?.title || fallbackCourseMeta.title,
    instructor:
      course.instructor || existing?.instructor || fallbackCourseMeta.instructor,
    category: course.category || existing?.category || fallbackCourseMeta.category,
    lessons: course.lessons || existing?.lessons || fallbackCourseMeta.lessons,
    image: course.image || existing?.image || fallbackCourseMeta.image,
    accent: course.accent || existing?.accent || fallbackCourseMeta.accent,
    startedAt: existing?.startedAt || now,
    updatedAt: now,
    lastLessonId: existing?.lastLessonId,
    lastLessonTitle: existing?.lastLessonTitle,
    completedLessonIds: existing?.completedLessonIds || [],
  };

  saveLearningState(state);
  return state.courses[course.id];
}

export function saveStoredLessonProgress({
  course,
  courseId,
  lessonId,
  lessonTitle,
  completed,
  totalLessons,
}: {
  course?: Partial<LearningCourseMeta>;
  courseId: string;
  lessonId: string;
  lessonTitle?: string;
  completed: boolean;
  totalLessons?: number;
}) {
  const now = new Date().toISOString();
  const state = getLearningState();
  const existing = state.courses[courseId];
  const completedIds = new Set(existing?.completedLessonIds || []);

  if (completed) {
    completedIds.add(lessonId);
  } else {
    completedIds.delete(lessonId);
  }

  state.courses[courseId] = {
    id: courseId,
    title: course?.title || existing?.title || fallbackCourseMeta.title,
    instructor:
      course?.instructor || existing?.instructor || fallbackCourseMeta.instructor,
    category:
      String(course?.category || existing?.category || fallbackCourseMeta.category),
    lessons: totalLessons || course?.lessons || existing?.lessons || 1,
    image: course?.image || existing?.image || fallbackCourseMeta.image,
    accent: course?.accent || existing?.accent || fallbackCourseMeta.accent,
    startedAt: existing?.startedAt || now,
    updatedAt: now,
    lastLessonId: lessonId,
    lastLessonTitle: lessonTitle || existing?.lastLessonTitle,
    completedLessonIds: [...completedIds],
  };

  saveLearningState(state);
  return state.courses[courseId];
}

function saveLearningState(state: LearningState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEARNING_STATE_KEY, JSON.stringify(state));
}
