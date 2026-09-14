import { featuredCourses, mapSupabaseCourse } from '@/lib/academy-data';
import {
  academyRestFetch,
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  json,
} from '@/lib/academy-auth';
import { getCurriculumForCourse } from '@/lib/curriculum-data';

type EnrollmentRow = {
  id: string;
  course_id: string;
  status: string;
  amount_cents?: number;
  currency?: string;
  created_at?: string;
  updated_at?: string;
};

type ProgressRow = {
  course_id: string;
  lesson_id: string;
  completed: boolean;
  progress_percent?: number;
};

type CertificateRow = {
  id: string;
  course_id: string;
  certificate_number: string;
  issued_at: string;
};

export async function GET(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to continue.' }, 401);
  }

  try {
    const [enrollments, progress, certificates] = await Promise.all([
      fetchRows<EnrollmentRow>(
        `enrollments?select=*&user_id=eq.${encodeURIComponent(user.id)}&order=updated_at.desc`,
      ),
      fetchRows<ProgressRow>(
        `lesson_progress?select=*&user_id=eq.${encodeURIComponent(user.id)}`,
      ),
      fetchRows<CertificateRow>(
        `certificates?select=*&user_id=eq.${encodeURIComponent(user.id)}&order=issued_at.desc`,
      ),
    ]);
    const activeEnrollments = enrollments.filter((row) =>
      ['active', 'completed', 'pending_payment'].includes(row.status),
    );
    const courseIds = [...new Set(activeEnrollments.map((row) => row.course_id))];
    const supabaseCourses = courseIds.length
      ? await fetchRows<Record<string, unknown>>(
          `courses?select=*&id=in.(${courseIds.map(encodeURIComponent).join(',')})`,
        )
      : [];
    const coursesById = new Map(
      supabaseCourses
        .map((row, index) => mapSupabaseCourse(row, index))
        .filter(Boolean)
        .map((course) => [course!.id, course!]),
    );
    featuredCourses.forEach((course) => {
      if (courseIds.includes(course.id) && !coursesById.has(course.id)) {
        coursesById.set(course.id, course);
      }
    });

    const completedLessonsByCourse = progress.reduce<Record<string, string[]>>(
      (acc, row) => {
        if (row.completed) {
          acc[row.course_id] = [...(acc[row.course_id] || []), row.lesson_id];
        }
        return acc;
      },
      {},
    );

    const learningCourses = activeEnrollments.map((enrollment) => {
      const course =
        coursesById.get(enrollment.course_id) ||
        featuredCourses.find((item) => item.id === enrollment.course_id) ||
        featuredCourses[0];
      const curriculum = getCurriculumForCourse(enrollment.course_id);
      const allLessons = curriculum.sections.flatMap((section) => section.lessons);
      const completedIds = new Set(
        completedLessonsByCourse[enrollment.course_id] || [],
      );
      const completedLessons = allLessons.filter((lesson) =>
        completedIds.has(lesson.id),
      ).length;
      const totalLessons = Math.max(allLessons.length, course.lessons || 1);
      const progressPercent =
        totalLessons > 0
          ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
          : 0;
      const nextLesson =
        allLessons.find((lesson) => !completedIds.has(lesson.id)) ||
        allLessons[allLessons.length - 1];
      const certificate = certificates.find(
        (item) => item.course_id === enrollment.course_id,
      );

      return {
        id: course.id,
        title: course.title,
        instructor: course.instructor,
        category: course.category,
        lessons: totalLessons,
        completedLessons,
        progress: progressPercent,
        lastLesson: progressPercent === 100 ? 'Completed' : nextLesson?.title,
        image: course.image,
        accent: course.accent,
        status: enrollment.status,
        certificate,
      };
    });

    return json({
      user: {
        id: user.id,
        email: user.email,
        name: getAcademyDisplayName(user),
      },
      courses: learningCourses,
      progress: completedLessonsByCourse,
      certificates,
    });
  } catch (error) {
    return json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Could not load your academy profile.',
      },
      503,
    );
  }
}

async function fetchRows<T>(path: string) {
  const response = await academyRestFetch(path, { useServiceRole: true });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T[];
}
