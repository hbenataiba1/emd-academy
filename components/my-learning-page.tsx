'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PlayCircle,
  Share2,
  Trophy,
} from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import { Badge } from '@/components/ui/badge';
import {
  clearAcademySession,
  getAcademyAuthHeader,
  getAcademyDisplayName,
  getStoredAcademySession,
  type AcademySession,
} from '@/lib/academy-session';
import { getStoredLearningCourses } from '@/lib/academy-learning-state';
import {
  downloadCertificatePdf,
  formatCertificateDate,
  openLinkedInCertificate,
} from '@/lib/academy-certificate';

type LearningCourse = {
  id: string;
  title: string;
  instructor: string;
  category: string;
  lessons: number;
  completedLessons: number;
  progress: number;
  lastLesson?: string;
  image: string;
  accent: string;
  status: string;
  certificate?: {
    certificate_number: string;
    issued_at: string;
  };
};

type LearningPayload = {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  courses?: LearningCourse[];
  message?: string;
};

function getLocalLearningCourses(): LearningCourse[] {
  return getStoredLearningCourses().map((course) => {
    const completedLessons = course.completedLessonIds.length;
    const totalLessons = Math.max(course.lessons || 1, completedLessons || 1);
    const progress =
      totalLessons > 0
        ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
        : 0;

    return {
      id: course.id,
      title: course.title,
      instructor: course.instructor,
      category: course.category,
      lessons: totalLessons,
      completedLessons,
      progress,
      lastLesson: progress === 100 ? 'Completed' : course.lastLessonTitle,
      image: course.image,
      accent: course.accent,
      status: progress === 100 ? 'completed' : 'active',
    };
  });
}

function mergeLearningCourses(
  remoteCourses: LearningCourse[] = [],
  localCourses: LearningCourse[] = [],
) {
  const map = new Map<string, LearningCourse>();
  remoteCourses.forEach((course) => map.set(course.id, course));

  localCourses.forEach((course) => {
    const existing = map.get(course.id);
    if (!existing) {
      map.set(course.id, course);
      return;
    }

    map.set(course.id, {
      ...existing,
      completedLessons: Math.max(existing.completedLessons, course.completedLessons),
      progress: Math.max(existing.progress, course.progress),
      lastLesson: existing.lastLesson || course.lastLesson,
      status: existing.status || course.status,
    });
  });

  return [...map.values()];
}

function ProgressRing({
  pct,
  accent,
  size = 44,
}: {
  pct: number;
  accent: string;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#ede9fe"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={accent}
      >
        {pct}%
      </text>
    </svg>
  );
}

function CourseCard({
  course,
  learnerName,
  userId,
}: {
  course: LearningCourse;
  learnerName: string;
  userId?: string;
}) {
  const done = course.progress === 100;
  const certificateTitle = 'Certificate of Completion';
  const certificateNumber =
    course.certificate?.certificate_number ||
    `EMDA-${new Date().getFullYear()}-${course.id.slice(0, 4).toUpperCase()}-${(userId || 'ACADEMY').slice(0, 8).toUpperCase()}`;
  const issuedAt = course.certificate?.issued_at;

  const downloadCertificate = () =>
    downloadCertificatePdf({
      learnerName,
      courseTitle: course.title,
      certificateTitle,
      certificateNumber,
      issuedDate: formatCertificateDate(issuedAt),
    });
  const shareCertificate = () =>
    openLinkedInCertificate({ certificateTitle, certificateNumber, issuedAt });
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-[#ede9fe] bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-40 overflow-hidden bg-[#f4f0ff]">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
          style={{ backgroundColor: course.accent }}
        >
          {course.category}
        </span>
        <div className="absolute right-3 top-3 rounded-full bg-white/90 p-0.5 backdrop-blur-sm">
          <ProgressRing pct={course.progress} accent={course.accent} />
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-sm font-semibold text-white">
          {done ? (
            <>
              <CheckCircle2 className="size-4" />
              Completed
            </>
          ) : (
            <>
              <PlayCircle className="size-4" />
              Continue
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[#171321]">
          {course.title}
        </h3>
        <p className="flex items-center gap-1.5 text-xs text-[#7b748c]">
          <GraduationCap className="size-3.5 shrink-0" />
          {course.instructor}
        </p>
        <div>
          <div className="mb-1 flex justify-between text-[11px] font-medium text-[#7b748c]">
            <span>
              {course.completedLessons}/{course.lessons} lessons
            </span>
            <span style={{ color: course.accent }}>{course.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#ede9fe]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${course.progress}%`,
                backgroundColor: course.accent,
              }}
            />
          </div>
        </div>
        {!done && course.lastLesson ? (
          <p className="text-[11px] italic text-[#9e99ab]">
            Next: {course.lastLesson}
          </p>
        ) : null}
        {done ? (
          <div className="rounded-lg border border-[#bdeee9] bg-[#effbf9] p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#067b75]">
              <Award className="size-4" />
              Certificate ready
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[#3f8f8a]">
              {certificateNumber}
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadCertificate}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#067b75] px-2 py-2 text-xs font-bold text-white transition hover:bg-[#056560]"
              >
                <Download className="size-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={shareCertificate}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#0a66c2] px-2 py-2 text-xs font-bold text-white transition hover:bg-[#004182]"
              >
                <Share2 className="size-3.5" />
                LinkedIn
              </button>
            </div>
          </div>
        ) : null}
        <Link
          href={`/academy/learn/${course.id}`}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: course.accent }}
        >
          {done ? 'Review course' : 'Continue learning'}
          {done ? (
            <ChevronRight className="size-4" />
          ) : (
            <PlayCircle className="size-4" />
          )}
        </Link>
      </div>
    </div>
  );
}

export default function MyLearningPage() {
  const [session, setSession] = useState<AcademySession | null | undefined>(
    undefined,
  );
  const [payload, setPayload] = useState<LearningPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedSession = getStoredAcademySession();
    setSession(storedSession);

    if (!storedSession) {
      return;
    }

    const activeSession = storedSession;
    let cancelled = false;

    async function loadLearning() {
      const localCourses = getLocalLearningCourses();
      try {
        const response = await fetch('/api/academy/me', {
          headers: getAcademyAuthHeader(activeSession),
        });
        const nextPayload = (await response.json()) as LearningPayload;

        if (cancelled) return;

        if (response.status === 401) {
          clearAcademySession();
          setSession(null);
          return;
        }

        if (!response.ok) {
          setMessage(
            localCourses.length
              ? null
              : nextPayload.message || 'Could not load your learning.',
          );
          setPayload({
            user: {
              id: activeSession.user.id,
              email: activeSession.user.email || '',
              name: getAcademyDisplayName(activeSession),
            },
            courses: localCourses,
          });
          return;
        }

        setPayload({
          ...nextPayload,
          courses: mergeLearningCourses(nextPayload.courses, localCourses),
        });
      } catch {
        if (!cancelled) {
          setMessage(
            localCourses.length
              ? null
              : 'Could not load your learning right now.',
          );
          setPayload({
            user: {
              id: activeSession.user.id,
              email: activeSession.user.email || '',
              name: getAcademyDisplayName(activeSession),
            },
            courses: localCourses,
          });
        }
      }
    }

    loadLearning();

    return () => {
      cancelled = true;
    };
  }, []);

  const courses = payload?.courses || [];
  const inProgress = courses.filter(
    (course) => course.progress > 0 && course.progress < 100,
  );
  const completed = courses.filter((course) => course.progress === 100);
  const notStarted = courses.filter((course) => course.progress === 0);
  const hoursLearned = useMemo(() => {
    const lessonCount = courses.reduce(
      (total, course) => total + course.completedLessons,
      0,
    );
    return `${Math.round(lessonCount * 0.18 * 10) / 10}h`;
  }, [courses]);
  const displayName =
    payload?.user?.name || getAcademyDisplayName(session || null);

  const statsData = [
    { label: 'Enrolled courses', value: courses.length, icon: BookOpen },
    { label: 'Completed', value: completed.length, icon: CheckCircle2 },
    { label: 'Hours learned', value: hoursLearned, icon: Clock },
    {
      label: 'Certificates earned',
      value: courses.filter((course) => course.certificate).length,
      icon: Trophy,
    },
  ];

  function signOut() {
    clearAcademySession();
    window.location.assign('/academy');
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#f8f6ff]">
        <AcademyHeader activePage="my-learning" />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="text-2xl font-black text-[#171321]">
            Loading your learning
          </h1>
        </div>
        <AcademyFooter />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f8f6ff]">
        <AcademyHeader activePage="my-learning" />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <div className="rounded-xl border border-[#e4ddf4] bg-white p-8 shadow-sm">
            <GraduationCap className="mx-auto size-12 text-[#7c3aed]" />
            <h1 className="mt-4 text-3xl font-black text-[#171321]">
              Sign in to see your courses
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#625b75]">
              Your enrolled courses, lesson progress, purchases, and
              certificates are connected to your Academy account.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/academy/login?next=/academy/my-learning"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white hover:bg-[#6d31dc]"
              >
                Log in
              </Link>
              <Link
                href="/academy/signup?next=/academy/my-learning"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#cfc4ee] bg-white px-5 text-sm font-bold text-[#302945] hover:bg-[#f4f1ff]"
              >
                Create account
              </Link>
            </div>
          </div>
        </main>
        <AcademyFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6ff]">
      <AcademyHeader activePage="my-learning" />

      <section className="border-b border-[#ede9fe] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-2xl font-black text-[#7c3aed]">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="size-4 text-[#7c3aed]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#7b748c]">
                    My Learning
                  </span>
                </div>
                <h1 className="text-2xl font-black text-[#171321] sm:text-3xl">
                  Welcome back, {displayName}
                </h1>
                <p className="mt-0.5 text-sm text-[#7b748c]">
                  {payload?.user?.email || session.user.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/academy#courses"
                className="inline-flex items-center gap-2 rounded-lg bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6d31dc]"
              >
                Explore more courses
                <ArrowRight className="size-4" />
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-lg border border-[#d9ceff] bg-white px-4 py-2.5 text-sm font-semibold text-[#514b63] transition hover:bg-[#f4f1ff]"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statsData.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex flex-col gap-2 rounded-lg border border-[#ede9fe] bg-[#f8f6ff] p-4"
                >
                  <Icon className="size-5 text-[#7c3aed]" />
                  <span className="text-2xl font-black text-[#171321]">
                    {stat.value}
                  </span>
                  <span className="text-xs text-[#7b748c]">{stat.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        {message ? (
          <div className="rounded-lg border border-[#efd2d2] bg-white px-4 py-3 text-sm font-semibold text-[#8f2d2d]">
            {message}
          </div>
        ) : null}

        {inProgress.length > 0 ? (
          <LearningSection
            title="In progress"
            icon={PlayCircle}
            badge={inProgress.length}
            courses={inProgress}
            learnerName={displayName}
            userId={payload?.user?.id || session?.user.id}
          />
        ) : null}

        {completed.length > 0 ? (
          <LearningSection
            title="Completed"
            icon={CheckCircle2}
            badge={completed.length}
            courses={completed}
            learnerName={displayName}
            userId={payload?.user?.id || session?.user.id}
          />
        ) : null}

        {notStarted.length > 0 ? (
          <LearningSection
            title="Not started"
            icon={BookOpen}
            badge={notStarted.length}
            courses={notStarted}
            learnerName={displayName}
            userId={payload?.user?.id || session?.user.id}
          />
        ) : null}

        {!courses.length && !message ? (
          <div className="flex flex-col items-center gap-5 rounded-lg border border-dashed border-[#d9ceff] bg-white py-20 text-center">
            <GraduationCap className="size-12 text-[#c4baee]" />
            <h3 className="text-lg font-bold text-[#171321]">
              No courses enrolled yet
            </h3>
            <p className="max-w-sm text-sm text-[#7b748c]">
              Browse the Academy catalog and start your first MedTech
              compliance course.
            </p>
            <Link
              href="/academy#courses"
              className="inline-flex items-center gap-2 rounded-lg bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6d31dc]"
            >
              Browse courses
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : null}
      </main>

      <AcademyFooter />
    </div>
  );
}

function LearningSection({
  title,
  icon: Icon,
  badge,
  courses,
  learnerName,
  userId,
}: {
  title: string;
  icon: typeof PlayCircle;
  badge: number;
  courses: LearningCourse[];
  learnerName: string;
  userId?: string;
}) {
  return (
    <section>
      <div className="mb-5 flex items-center gap-3">
        <Icon className="size-5 text-[#7c3aed]" />
        <h2 className="text-lg font-bold text-[#171321]">{title}</h2>
        <Badge className="border-[#d9ceff] bg-white text-[#7c3aed]">
          {badge}
        </Badge>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            learnerName={learnerName}
            userId={userId}
          />
        ))}
      </div>
    </section>
  );
}
