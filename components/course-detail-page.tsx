'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  Star,
  UserRound,
  X,
} from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AcademyCourse } from '@/lib/academy-data';
import type { CourseCurriculum, CourseLesson } from '@/lib/curriculum-data';
import {
  getStoredAcademySession,
  type AcademySession,
} from '@/lib/academy-session';
import {
  buildCertificateSvg,
  formatCertificateDate,
} from '@/lib/academy-certificate';
import {
  getStoredCourseProgress,
  markCourseStarted,
} from '@/lib/academy-learning-state';

type CourseDetailPageProps = {
  course: AcademyCourse;
  initialCurriculum: CourseCurriculum;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function isFreeCourse(course: AcademyCourse) {
  return (
    course.price <= 0 ||
    course.priceLabel?.trim().toLowerCase() === 'free' ||
    course.priceLabel?.trim().toLowerCase() === '$0'
  );
}

function getLessonIcon(lesson: CourseLesson) {
  if (lesson.type === 'article') return FileText;
  if (lesson.type === 'quiz') return Award;
  return PlayCircle;
}

function cleanDisplayText(value?: string | null): string {
  if (!value) return '';

  let text = String(value).trim();

  try {
    const parsed = JSON.parse(text);
    if (
      parsed &&
      typeof parsed === 'object' &&
      ('passingScore' in parsed ||
        'certificateTitle' in parsed ||
        'certificateEnabled' in parsed ||
        'linkedinShareEnabled' in parsed)
    ) {
      return '';
    }
  } catch {
    // Not plain JSON; it may still contain a JSON config prefix plus rich text.
  }

  text = text.replace(
    /^\s*\{(?=[\s\S]*?(passingScore|certificateTitle|certificateEnabled|linkedinShareEnabled))[\s\S]*?\}\s*/i,
    '',
  );

  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, ' ')
    .replace(/<li[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getLessonTitle(lesson: CourseLesson): string {
  return (
    cleanDisplayText(lesson.title) ||
    (lesson.type === 'quiz' ? 'Final certification exam' : 'Untitled lesson')
  );
}

function getLessonSummary(lesson: CourseLesson): string {
  if (lesson.type === 'quiz') {
    return 'Final exam and certificate unlock after completing the course.';
  }

  return (
    cleanDisplayText(lesson.subtitleSummary) ||
    cleanDisplayText(lesson.description) ||
    'Lesson content unlocks after sign in.'
  );
}

function getPreviewEmbedUrl(url?: string): string {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    return url.replace('youtube.com/watch?v=', 'youtube.com/embed/');
  }
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
    const id = url.split('vimeo.com/')[1]?.split(/[?#]/)[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  if (url.includes('loom.com/share/')) {
    const id = url.split('loom.com/share/')[1]?.split(/[?#]/)[0];
    return `https://www.loom.com/embed/${id}`;
  }
  return url;
}

function isPreviewEmbedUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('vimeo.com') ||
    lower.includes('loom.com')
  );
}

function isDirectVideoUrl(url?: string): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
}

export function CourseDetailPage({
  course,
  initialCurriculum,
}: CourseDetailPageProps) {
  const [curriculum, setCurriculum] =
    useState<CourseCurriculum>(initialCurriculum);
  const [session, setSession] = useState<AcademySession | null>(null);
  const [previewLessonId, setPreviewLessonId] = useState<string | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [courseStarted, setCourseStarted] = useState(false);
  const certificateMockup = useMemo(
    () =>
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        buildCertificateSvg({
          learnerName: 'Your Name',
          courseTitle: course.title,
          certificateTitle: 'Certificate of Completion',
          certificateNumber: 'EMDA-2026-XXXX-00000000',
          issuedDate: formatCertificateDate(),
        }),
      )}`,
    [course.title],
  );

  const freeCourse = isFreeCourse(course);
  const totalLessons = useMemo(
    () => curriculum.sections.reduce((sum, section) => sum + section.lessons.length, 0),
    [curriculum.sections],
  );
  const previewLessons = useMemo(
    () =>
      curriculum.sections
        .flatMap((section) => section.lessons)
        .filter((lesson) => lesson.previewEnabled),
    [curriculum.sections],
  );
  const activePreviewLesson = useMemo(
    () => previewLessons.find((lesson) => lesson.id === previewLessonId) || null,
    [previewLessonId, previewLessons],
  );
  const courseSubtitle =
    cleanDisplayText(course.subtitle) ||
    'Practical medical device regulatory training from Easy Medical Device experts.';
  const cleanOutcomes = useMemo(
    () => course.outcomes.map((outcome) => cleanDisplayText(outcome)).filter(Boolean),
    [course.outcomes],
  );
  const progressPercent = totalLessons
    ? Math.min(100, Math.round((completedLessonIds.size / totalLessons) * 100))
    : 0;

  useEffect(() => {
    setSession(getStoredAcademySession());

    let active = true;
    fetch(`/api/academy/curriculum?courseId=${encodeURIComponent(course.id)}`)
      .then((response) => response.json())
      .then((data) => {
        const payload = data as { curriculum?: CourseCurriculum };
        if (active && payload.curriculum) {
          setCurriculum(payload.curriculum);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [course.id]);

  useEffect(() => {
    const storedProgress = getStoredCourseProgress(course.id);
    setCourseStarted(Boolean(storedProgress));
    setCompletedLessonIds(new Set(storedProgress?.completedLessonIds || []));
  }, [course.id]);

  useEffect(() => {
    if (!activePreviewLesson) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewLessonId(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePreviewLesson]);

  function loginForCourse() {
    window.location.assign(
      `/academy/login?next=${encodeURIComponent(`/academy/learn/${course.id}`)}`,
    );
  }

  async function openCourse() {
    if (!session) {
      loginForCourse();
      return;
    }

    if (freeCourse) {
      markCourseStarted(course);
      window.location.assign(`/academy/learn/${course.id}`);
      return;
    }

    markCourseStarted(course);
    window.location.assign(`/academy/learn/${course.id}`);
  }

  function openLesson(lesson: CourseLesson) {
    const lessonUrl = `/academy/learn/${course.id}?lesson=${encodeURIComponent(lesson.id)}`;

    if (lesson.previewEnabled && !session) {
      setPreviewLessonId(lesson.id);
      return;
    }

    if (lesson.previewEnabled) {
      window.location.assign(lessonUrl);
      return;
    }

    if (!session) {
      loginForCourse();
      return;
    }

    window.location.assign(lessonUrl);
  }

  const previewLoginHref = `/academy/login?next=${encodeURIComponent(
    activePreviewLesson
      ? `/academy/learn/${course.id}?lesson=${activePreviewLesson.id}`
      : `/academy/learn/${course.id}`,
  )}`;

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="home" />

      <section className="bg-[#f8f6ff]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8 lg:py-14">
          <div>
            <Link
              href="/academy#courses"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#6d31dc] hover:text-[#4f24a8]"
            >
              <ArrowLeft className="size-4" />
              Back to courses
            </Link>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Badge className="bg-white text-[#6d31dc]">{course.category}</Badge>
              <Badge className="border-[#d9ceff] bg-white text-[#302945]">
                {course.level}
              </Badge>
              {freeCourse ? (
                <Badge className="bg-[#e9fbf8] text-[#067b75]">Free course</Badge>
              ) : null}
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-[#171321] sm:text-5xl">
              {course.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#5f5872] sm:text-lg">
              {courseSubtitle}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-semibold text-[#514b63]">
              {course.rating > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-[#f6b44b] text-[#f6b44b]" />
                  {course.rating.toFixed(1)} rating
                </span>
              ) : null}
              {course.students > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="size-4 text-[#7c3aed]" />
                  {numberFormatter.format(course.students)} learners
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-[#7c3aed]" />
                {course.duration}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4 text-[#08a99f]" />
                {totalLessons || course.lessons} lessons
              </span>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={openCourse}
                className="h-12 rounded-lg bg-[#7c3aed] px-6 text-sm font-bold text-white hover:bg-[#6d31dc]"
              >
                {courseStarted
                  ? 'Continue course'
                  : freeCourse
                    ? 'Start free course'
                    : 'Go to course access'}
                <ArrowRight className="size-4" />
              </Button>
              {!session ? (
                <Link
                  href={`/academy/login?next=${encodeURIComponent(`/academy/learn/${course.id}`)}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#cfc4ee] bg-white px-6 text-sm font-bold text-[#302945] transition hover:bg-[#f4f1ff]"
                >
                  <LockKeyhole className="size-4 text-[#7c3aed]" />
                  Sign in to unlock lessons
                </Link>
              ) : null}
            </div>

          </div>

          <aside className="h-fit rounded-2xl border border-[#e4ddf4] bg-white p-5 shadow-[0_24px_70px_rgb(38_29_68/10%)]">
            <div className="overflow-hidden rounded-xl bg-[#eee8ff]">
              <img
                src={course.image}
                alt={course.title}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b849a]">
                  Price
                </p>
                <p className="mt-1 text-3xl font-black text-[#171321]">
                  {course.priceLabel}
                </p>
              </div>
              <div className="rounded-full bg-[#f4f1ff] p-3 text-[#7c3aed]">
                {freeCourse ? <PlayCircle className="size-6" /> : <CreditCard className="size-6" />}
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-[#ede8fb] pt-5">
              {[
                'Full curriculum list visible',
                'Progress saved after sign in',
                'Certificate after completion',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[#514b63]">
                  <CheckCircle2 className="size-4 text-[#08a99f]" />
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-8">
          <div className="rounded-2xl border border-[#e4ddf4] bg-white p-6">
            <h2 className="text-2xl font-black text-[#171321]">What you will learn</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(cleanOutcomes.length > 0
                ? cleanOutcomes
                : ['Practical skills you can apply to medical device regulatory work.']
              ).map((outcome) => (
                <div key={outcome} className="flex gap-3 rounded-xl bg-[#fbfbfe] p-4 text-sm font-semibold leading-6 text-[#514b63]">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-[#08a99f]" />
                  <span>{outcome}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e4ddf4] bg-white p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-black text-[#171321]">Course content</h2>
                <p className="mt-2 text-sm leading-6 text-[#625b75]">
                  You can review the full curriculum before signing in. Lessons marked Preview open immediately; the rest unlock after login.
                </p>
              </div>
              <p className="text-sm font-bold text-[#6d31dc]">
                {curriculum.sections.length} sections • {totalLessons || course.lessons} lessons
              </p>
            </div>

            <div className="mt-6 divide-y divide-[#ede8fb] overflow-hidden rounded-xl border border-[#ede8fb]">
              {curriculum.sections.map((section) => (
                <div key={section.id} className="bg-white">
                  <div className="bg-[#fbfaff] px-4 py-3">
                    <h3 className="text-sm font-black text-[#171321]">
                      {section.title}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#8b849a]">
                      {section.lessons.length} lessons
                    </p>
                  </div>
                  <div className="divide-y divide-[#f0edf8]">
                    {section.lessons.map((lesson) => {
                      const Icon = getLessonIcon(lesson);
                      const isPreview = Boolean(lesson.previewEnabled);
                      const lessonTitle = getLessonTitle(lesson);
                      const lessonSummary = getLessonSummary(lesson);
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => openLesson(lesson)}
                          className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-[#f8f6ff]"
                        >
                          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-[#191625]">
                                {lessonTitle}
                              </p>
                              {isPreview ? (
                                <span className="rounded-full bg-[#e9fbf8] px-2 py-0.5 text-[11px] font-black text-[#067b75]">
                                  Preview
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#625b75]">
                              {lessonSummary}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-[#8b849a]">
                            <span>{lesson.duration}</span>
                            {isPreview ? (
                              <PlayCircle className="size-3.5 text-[#08a99f]" />
                            ) : (
                              <LockKeyhole className="size-3.5 text-[#7c3aed]" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-[#ded6f3] bg-[#171321] p-6 text-white">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[#7c3aed]/20 text-[#b58dfb]">
            <ShieldCheck className="size-6" />
          </div>
          <h2 className="mt-4 text-xl font-black">Ready to start?</h2>
          <p className="mt-2 text-sm leading-6 text-[#cfc8de]">
            {freeCourse
              ? courseStarted
                ? `${progressPercent}% complete. Your lesson progress is saved on this device and synced when possible.`
                : 'Create or use your learner account and this free course opens without checkout.'
              : 'Sign in to continue to the course access screen and checkout if needed.'}
          </p>
          {courseStarted ? (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-bold text-[#cfc8de]">
                <span>Course started</span>
                <span>{completedLessonIds.size}/{totalLessons || course.lessons} lessons</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#34d4c6]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            onClick={openCourse}
            className="mt-5 h-11 w-full rounded-lg bg-[#7c3aed] text-sm font-bold text-white hover:bg-[#6d31dc]"
          >
            {courseStarted ? 'Continue course' : freeCourse ? 'Start free course' : 'Continue'}
            <ArrowRight className="size-4" />
          </Button>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Award className="size-4 text-[#34d4c6]" />
              Certificate included
            </div>
            <p className="mt-2 text-xs leading-5 text-[#a098b5]">
              Complete the required lessons and exam to unlock your Easy Medical Device Academy certificate.
            </p>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 rounded-2xl border border-[#e4ddf4] bg-white p-6 sm:p-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d9ceff] bg-[#f4f0ff] px-3 py-1 text-xs font-bold text-[#6d31dc]">
              <Award className="size-3.5" />
              Certificate included
            </div>
            <h2 className="mt-4 text-2xl font-black text-[#171321] sm:text-3xl">
              Earn your official certificate
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#625b75] sm:text-base">
              Complete all lessons and pass the exam for{' '}
              <span className="font-bold text-[#171321]">{course.title}</span> to receive a
              verified certificate from Easy Medical Device Academy.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                'Your name and the course title on the certificate',
                'Unique credential ID with a public verification link',
                'Download as PDF and add to LinkedIn in one click',
              ].map((item) => (
                <li key={item} className="flex gap-2.5 text-sm font-semibold text-[#514b63]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#08a99f]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="rounded-xl bg-gradient-to-br from-[#7c3aed] via-[#9b5de5] to-[#08a99f] p-[2px]">
              <div className="overflow-hidden rounded-[10px] bg-white">
                <img
                  src={certificateMockup}
                  alt={`Sample certificate for ${course.title}`}
                  className="block w-full"
                  loading="lazy"
                />
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-[#8b849a]">
              Sample preview of your certificate
            </p>
          </div>
        </div>
      </section>

      {previewLessons.length > 0 ? (
        <section className="bg-[#f8f6ff] py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black text-[#171321]">Free preview lectures</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {previewLessons.map((lesson) => {
                const Icon = getLessonIcon(lesson);
                const lessonTitle = getLessonTitle(lesson);
                const lessonSummary = getLessonSummary(lesson);
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => openLesson(lesson)}
                    className="rounded-2xl border border-[#e4ddf4] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgb(38_29_68/10%)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-[#f4f0ff] text-[#7c3aed]">
                        <Icon className="size-5" />
                      </div>
                      <span className="text-xs font-bold text-[#8b849a]">{lesson.duration}</span>
                    </div>
                    <h3 className="mt-4 text-base font-black leading-snug text-[#171321]">
                      {lessonTitle}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#625b75]">
                      {lessonSummary}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-[#6d31dc]">
                      Watch preview
                      <PlayCircle className="size-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {activePreviewLesson ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#12101c]/70 px-4 py-6 backdrop-blur-md sm:py-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          onClick={() => setPreviewLessonId(null)}
        >
          <div
            className="w-full max-w-[720px] overflow-hidden rounded-2xl bg-[#111019] text-white shadow-[0_28px_90px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
              <div>
                <p className="text-sm font-bold text-[#b9a7ff]">Course Preview</p>
                <h2
                  id="preview-modal-title"
                  className="mt-2 text-lg font-black leading-tight text-white sm:text-xl"
                >
                  {course.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLessonId(null)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close preview"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-5 pb-6 pt-5 sm:px-7">
              <div className="overflow-hidden rounded-none bg-black">
                {activePreviewLesson.videoUrl ? (
                  isPreviewEmbedUrl(activePreviewLesson.videoUrl) ? (
                    <iframe
                      src={getPreviewEmbedUrl(activePreviewLesson.videoUrl)}
                      title={getLessonTitle(activePreviewLesson)}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : isDirectVideoUrl(activePreviewLesson.videoUrl) ? (
                    <video
                      src={activePreviewLesson.videoUrl}
                      className="aspect-video w-full bg-black"
                      controls
                    />
                  ) : (
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={course.image}
                        alt=""
                        className="size-full object-cover opacity-45"
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 p-6 text-center">
                        <PlayCircle className="size-12 text-white" />
                        <p className="max-w-sm text-sm font-semibold text-white/85">
                          This preview uses an external video link.
                        </p>
                        <a
                          href={activePreviewLesson.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-white px-4 py-2 text-sm font-black text-[#171321] transition hover:bg-[#f4f1ff]"
                        >
                          Open preview video
                        </a>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={course.image}
                      alt=""
                      className="size-full object-cover opacity-40"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 p-6 text-center">
                      <PlayCircle className="size-14 text-white" />
                      <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-white/80">
                        {getLessonSummary(activePreviewLesson) ||
                          'Preview content will appear here when a video is added in CRM.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <h3 className="text-base font-black text-white">Free Sample Videos:</h3>
                <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
                  {previewLessons.map((lesson, index) => {
                    const isActive = lesson.id === activePreviewLesson.id;
                    const lessonTitle = getLessonTitle(lesson);
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => setPreviewLessonId(lesson.id)}
                        className={`flex w-full items-center gap-3 px-3 py-3 text-left transition ${
                          isActive
                            ? 'bg-[#2a2740] text-white'
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="relative h-11 w-16 shrink-0 overflow-hidden bg-[#211d30]">
                          <img
                            src={course.image}
                            alt=""
                            className="size-full object-cover opacity-70"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <PlayCircle className="size-4 fill-white text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-bold leading-snug">
                            {lessonTitle}
                          </p>
                          {index === 0 ? (
                            <p className="mt-1 text-xs font-semibold text-[#b9a7ff]">
                              Featured preview
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-xs font-black text-white">
                          {lesson.duration}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 rounded-xl bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold leading-6 text-white/75">
                  Sign in to continue the course, save progress, and unlock your certificate.
                </p>
                <Link
                  href={previewLoginHref}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed] px-4 text-sm font-black text-white transition hover:bg-[#6d31dc]"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AcademyFooter />
    </main>
  );
}
