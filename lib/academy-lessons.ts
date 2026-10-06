import { academyRestFetch } from '@/lib/academy-auth';
import { getCurriculumForCourse } from '@/lib/curriculum-data';

export type CourseLessonRef = {
  id: string;
  title: string;
};

// The course player shows the lessons stored in the database (falling back to the
// built-in curriculum), so progress must be counted against those same lesson ids.
export async function getLessonsForCourse(
  courseId: string,
): Promise<CourseLessonRef[]> {
  try {
    const response = await academyRestFetch(
      `lessons?select=id,title&course_id=eq.${encodeURIComponent(courseId)}&order=sort_order.asc`,
      { useServiceRole: true },
    );

    if (response.ok) {
      const rows = (await response.json()) as { id: unknown; title?: string }[];
      if (rows.length > 0) {
        return rows.map((row) => ({
          id: String(row.id),
          title: row.title || 'Untitled Lesson',
        }));
      }
    }
  } catch {
    // Fall back to the built-in curriculum below.
  }

  return getCurriculumForCourse(courseId).sections.flatMap(
    (section) => section.lessons,
  );
}
