import { NextResponse } from 'next/server';
import { academyRestFetch } from '@/lib/academy-auth';
import { getCurriculumForCourse, type CourseCurriculum, type CourseSection, type CourseLesson } from '@/lib/curriculum-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId') || 'eu-mdr-technical-file';

  try {
    const courseRes = await academyRestFetch(
      `courses?select=*&or=(id.eq.${encodeURIComponent(courseId)},slug.eq.${encodeURIComponent(courseId)})&limit=1`,
      { useServiceRole: true }
    );

    let courseData: any = null;
    if (courseRes.ok) {
      const rows: any = await courseRes.json();
      if (rows && rows[0]) courseData = rows[0];
    }

    const resolvedId = courseData?.id || courseId;

    const lessonsRes = await academyRestFetch(
      `lessons?select=*&course_id=eq.${encodeURIComponent(resolvedId)}&order=sort_order.asc`,
      { useServiceRole: true }
    );

    if (lessonsRes.ok) {
      const dbLessons: any[] = await lessonsRes.json();

      if (dbLessons && dbLessons.length > 0) {
        const sectionMap = new Map<string, CourseLesson[]>();

        dbLessons.forEach((l) => {
          const secTitle = l.section_title || 'Course Content';
          if (!sectionMap.has(secTitle)) {
            sectionMap.set(secTitle, []);
          }

          const durMin = l.duration_minutes || 10;
          sectionMap.get(secTitle)!.push({
            id: String(l.id),
            title: l.title || 'Untitled Lesson',
            duration: `${durMin} min`,
            durationSeconds: durMin * 60,
            type: l.lesson_type || 'video',
            videoUrl: l.video_url || undefined,
            description: l.description || '',
            resources: Array.isArray(l.resources)
              ? l.resources.map((r: any) => ({
                  name: r.name || 'Resource file',
                  url: r.url || '#',
                  size: r.size || 'File',
                  type: r.type || 'Document',
                }))
              : [],
          });
        });

        const sections: CourseSection[] = Array.from(sectionMap.entries()).map(([title, lessons], idx) => ({
          id: `sec-${idx + 1}`,
          title,
          lessons,
        }));

        const totalMinutes = dbLessons.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
        const hours = (totalMinutes / 60).toFixed(1);

        const curriculum: CourseCurriculum = {
          courseId: resolvedId,
          title: courseData?.title || 'Academy Masterclass',
          instructor: courseData?.instructor || 'Monir El Azzouzi',
          instructorRole: courseData?.instructor_role || 'Founder & CEO Easy Medical Device',
          rating: courseData?.rating || 4.9,
          ratingCount: 1250,
          studentCount: courseData?.learner_count || 3200,
          lastUpdated: '2026',
          totalDuration: `${hours} hours`,
          sections,
        };

        return NextResponse.json({ curriculum, source: 'database' });
      }
    }

    const fallback = getCurriculumForCourse(courseId);
    return NextResponse.json({ curriculum: fallback, source: 'default' });
  } catch (err: any) {
    const fallback = getCurriculumForCourse(courseId);
    return NextResponse.json({ curriculum: fallback, source: 'fallback_error', error: err?.message });
  }
}
