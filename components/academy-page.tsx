'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Filter,
  Globe,
  GraduationCap,
  Laptop,
  MessageSquare,
  Mic,
  Microscope,
  Network,
  Newspaper,
  PlayCircle,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  ThumbsUp,
  Users,
} from 'lucide-react';

import {
  type AcademyCourse,
  courseCategories,
  featuredCourses,
} from '@/lib/academy-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { AcademyHeader, AcademyFooter } from '@/components/academy-shell';
import {
  type CommunityPost,
  isSafeLinkedInEmbedUrl,
} from '@/lib/community-posts';
import {
  buildCertificateSvg,
  formatCertificateDate,
} from '@/lib/academy-certificate';
import {
  getAcademyAuthHeader,
  getStoredAcademySession,
} from '@/lib/academy-session';
import {
  getStoredLearningCourses,
  markCourseStarted,
} from '@/lib/academy-learning-state';

type AcademyPageProps = {
  initialCourses?: AcademyCourse[];
  communityPosts?: CommunityPost[];
};

type CheckoutNotice = {
  courseId: string;
  kind: 'info' | 'error';
  message: string;
};

type MePayload = {
  courses?: {
    id: string;
    progress: number;
    status?: string;
    certificate?: { certificate_number: string };
  }[];
};

type CourseLearnerState = {
  enrolled: boolean;
  progress: number;
  certificateNumber?: string;
};

// Sample of the exact certificate learners receive (same template as the real one).
const sampleCertificatePreview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  buildCertificateSvg({
    learnerName: 'Your Name',
    courseTitle: 'EU MDR Technical File Masterclass',
    certificateTitle: 'Certificate of Completion',
    certificateNumber: 'EMDA-2026-XXXX-00000000',
    issuedDate: formatCertificateDate(),
  }),
)}`;

const numberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function parseResponsePayload(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function getReadableResponseError(text: string) {
  const cleaned = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.startsWith('<!DOCTYPE')) return '';

  return cleaned.length > 220 ? `${cleaned.slice(0, 220)}...` : cleaned;
}

export function AcademyPage({
  initialCourses = featuredCourses,
  communityPosts = [],
}: AcademyPageProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof courseCategories)[number]>('All');
  const [search, setSearch] = useState('');
  const [pendingCourse, setPendingCourse] = useState<string | null>(null);
  const postsScrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollPosts = (direction: 1 | -1) => {
    const scroller = postsScrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth, behavior: 'smooth' });
  };
  const [checkoutNotice, setCheckoutNotice] = useState<CheckoutNotice | null>(
    null,
  );

  const [learnerStates, setLearnerStates] = useState<
    Record<string, CourseLearnerState>
  >({});

  // When logged in, show each course's progress / completion in the catalog.
  useEffect(() => {
    const session = getStoredAcademySession();
    if (!session) return;
    let cancelled = false;

    const merge = (
      states: Record<string, CourseLearnerState>,
      id: string,
      next: CourseLearnerState,
    ) => {
      const existing = states[id];
      states[id] = existing
        ? {
            enrolled: existing.enrolled || next.enrolled,
            progress: Math.max(existing.progress, next.progress),
            certificateNumber: existing.certificateNumber || next.certificateNumber,
          }
        : next;
    };

    const buildLocalStates = () => {
      const states: Record<string, CourseLearnerState> = {};
      getStoredLearningCourses().forEach((course) => {
        const completed = course.completedLessonIds.length;
        const total = Math.max(course.lessons || 1, completed || 1);
        const progress = Math.min(100, Math.round((completed / total) * 100));
        merge(states, course.id, { enrolled: progress > 0, progress });
      });
      return states;
    };

    setLearnerStates(buildLocalStates());

    fetch('/api/academy/me', { headers: getAcademyAuthHeader(session) })
      .then(
        (response) => (response.ok ? response.json() : null) as Promise<MePayload | null>,
      )
      .then(
        (payload: {
          courses?: {
            id: string;
            progress: number;
            status?: string;
            certificate?: { certificate_number: string };
          }[];
        } | null) => {
          if (cancelled || !payload?.courses) return;
          const states = buildLocalStates();
          payload.courses.forEach((course) => {
            merge(states, course.id, {
              enrolled: ['active', 'completed'].includes(course.status || ''),
              progress: course.progress,
              certificateNumber: course.certificate?.certificate_number,
            });
          });
          setLearnerStates(states);
        },
      )
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return initialCourses.filter((course) => {
      const matchesCategory =
        selectedCategory === 'All' || course.category === selectedCategory;
      const matchesQuery =
        !query ||
        [course.title, course.subtitle, course.category, course.instructor]
          .join(' ')
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [initialCourses, search, selectedCategory]);

  async function startCheckout(courseId: string) {
    const course = initialCourses.find((item) => item.id === courseId);
    const session = getStoredAcademySession();

    if (!session) {
      window.location.assign(
        `/academy/login?next=${encodeURIComponent(`/academy/course/${courseId}`)}`,
      );
      return;
    }

    const isFree = course
      ? course.price <= 0 ||
        course.priceLabel?.trim().toLowerCase() === 'free' ||
        course.priceLabel?.trim().toLowerCase() === '$0'
      : false;

    if (isFree) {
      if (course) {
        markCourseStarted(course);
      }
      window.location.assign(`/academy/learn/${courseId}`);
      return;
    }

    setPendingCourse(courseId);
    setCheckoutNotice({
      courseId,
      kind: 'info',
      message: isFree
        ? 'Opening your free course...'
        : 'Preparing secure checkout...',
    });

    try {
      const endpoint = isFree ? '/api/academy/enroll' : '/api/checkout';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getAcademyAuthHeader(session),
        },
        body: JSON.stringify({ courseId }),
      });
      const responseText = await response.text();
      const payload = parseResponsePayload(responseText) as {
        url?: string;
        message?: string;
        enrolled?: boolean;
      };

      if (response.status === 401) {
        window.location.assign(
          `/academy/login?next=${encodeURIComponent(`/academy/course/${courseId}`)}`,
        );
        return;
      }

      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }

      if (payload.enrolled) {
        window.location.assign(`/academy/learn/${courseId}`);
        return;
      }

      setCheckoutNotice({
        courseId,
        kind: 'error',
        message:
          payload.message ||
          getReadableResponseError(responseText) ||
          'This course needs setup before enrollment is available.',
      });
    } catch (err: any) {
      setCheckoutNotice({
        courseId,
        kind: 'error',
        message:
          err?.message || 'Connection could not be completed. Please try again.',
      });
    } finally {
      setPendingCourse(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="home" />

      <section className="bg-[#f8f6ff]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(360px,0.84fr)] lg:px-8 lg:py-16">
          <div>
            <h1 className="max-w-4xl text-4xl font-bold leading-[1.06] text-[#171321] sm:text-5xl lg:text-6xl">
              Learn medical device compliance from real-world experts
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f5872] sm:text-lg">
              Add a modern course academy to easymedicaldevice.com with
              practical training for MDR, IVDR, ISO 13485, SaMD, risk
              management, and market access.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#courses"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white hover:bg-[#6d31dc]"
              >
                Browse courses
                <GraduationCap className="size-4" aria-hidden="true" />
              </a>
              <Link
                href="/academy/signup?next=/academy/my-learning"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cfc4ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:bg-[#f4f1ff]"
              >
                <PlayCircle className="size-4 text-[#7c3aed]" aria-hidden="true" />
                Start learning
              </Link>
            </div>

          </div>

          {/* Hero Right: Photo + floating badges */}
          <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">

            {/* Main photo */}
            <div className="relative overflow-hidden rounded-2xl shadow-[0_32px_80px_rgb(35_28_61/18%)]">
              <img
                src="/academy/learn.jpg"
                alt="Medical device compliance learning"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Badge — top left */}
            <div className="absolute -left-6 top-8 flex max-w-[170px] flex-col gap-1 rounded-2xl border border-[#ede8fb] bg-white px-4 py-3 shadow-[0_8px_30px_rgb(35_28_61/12%)]">
              <ShieldCheck className="size-5 text-[#7c3aed]" />
              <p className="mt-0.5 text-sm font-bold text-[#191625] leading-tight">MDR Certified</p>
              <p className="text-xs text-[#706982] leading-snug">EU-approved compliance pathway</p>
            </div>

            {/* Badge — top right */}
            <div className="absolute -right-6 top-6 flex max-w-[165px] flex-col gap-1 rounded-2xl border border-[#ede8fb] bg-white px-4 py-3 shadow-[0_8px_30px_rgb(35_28_61/12%)]">
              <Award className="size-5 text-[#f6b44b]" />
              <p className="mt-0.5 text-sm font-bold text-[#191625] leading-tight">Verified Certificate</p>
              <p className="text-xs text-[#706982] leading-snug">Shareable on LinkedIn</p>
            </div>

            {/* Badge — bottom left */}
            <div className="absolute -bottom-4 -left-6 flex max-w-[175px] flex-col gap-1 rounded-2xl border border-[#ede8fb] bg-white px-4 py-3 shadow-[0_8px_30px_rgb(35_28_61/12%)]">
              <GraduationCap className="size-5 text-[#08a99f]" />
              <p className="mt-0.5 text-sm font-bold text-[#191625] leading-tight">Expert Instructor</p>
              <p className="text-xs text-[#706982] leading-snug">15+ years in MedTech regulatory</p>
            </div>

          </div>
        </div>

      </section>

      <section
        id="courses"
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <Badge className="mb-3 bg-[#e9fbf8] text-[#067b75]">
              Course catalog
            </Badge>
            <h2 className="text-3xl font-bold text-[#191625] sm:text-4xl">
              Trending compliance courses
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#625b75] sm:text-base">
              Udemy-style browsing, focused entirely on regulated product teams
              that need practical approval evidence.
            </p>
          </div>

          <label className="relative block w-full md:max-w-sm">
            <span className="sr-only">Search courses</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b849a]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search MDR, IVDR, SaMD..."
              className="h-11 w-full rounded-lg border border-[#dcd5ee] bg-white pl-10 pr-3 text-sm font-medium text-[#201b31] outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="size-4 shrink-0 text-[#7c3aed]" />
          {courseCategories.map((category) => (
            <Button
              key={category}
              type="button"
              size="sm"
              variant={selectedCategory === category ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category)}
              aria-pressed={selectedCategory === category}
              className={
                selectedCategory === category
                  ? 'bg-[#7c3aed] text-white hover:bg-[#6d31dc]'
                  : 'border-[#dcd5ee] bg-white text-[#514b63] hover:bg-[#f4f1ff]'
              }
            >
              {category}
            </Button>
          ))}
        </div>

        {checkoutNotice ? (
          <output
            className={`mt-5 rounded-lg border px-4 py-3 text-sm font-medium ${
              checkoutNotice.kind === 'error'
                ? 'border-[#f0c7c7] bg-[#fff7f7] text-[#9b2c2c]'
                : 'border-[#d8cef6] bg-[#f7f3ff] text-[#5f36c7]'
            }`}
          >
            {checkoutNotice.message}
          </output>
        ) : null}

        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              pending={pendingCourse === course.id}
              learnerState={learnerStates[course.id]}
              notice={
                checkoutNotice?.courseId === course.id ? checkoutNotice : null
              }
              onCheckout={startCheckout}
            />
          ))}
        </div>

        {!filteredCourses.length ? (
          <div className="mt-7 rounded-lg border border-[#e4ddf4] bg-white p-8 text-center">
            <h3 className="text-lg font-bold text-[#191625]">
              {initialCourses.length
                ? 'No courses match that search'
                : 'New courses are coming soon'}
            </h3>
            <p className="mt-2 text-sm text-[#625b75]">
              {initialCourses.length
                ? 'Try a different regulatory topic or view all courses.'
                : 'We are preparing our first medical device compliance courses. Check back shortly.'}
            </p>
          </div>
        ) : null}
      </section>

      {/* Certificate Banner Section */}
      <section
        id="certificate"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="relative rounded-3xl bg-[#171321] p-8 shadow-2xl sm:p-10 md:p-12">

          {/* Decorations are clipped to the box; the certificate is not */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          {/* Background pattern */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '28px 28px',
            }}
          />
          {/* Glow blobs */}
          <div className="pointer-events-none absolute -top-20 left-1/4 size-72 rounded-full bg-[#7c3aed] opacity-20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-1/4 size-60 rounded-full bg-[#08a99f] opacity-15 blur-3xl" />
          </div>

          <div className="relative flex flex-col items-center gap-10 md:flex-row md:items-center">

            {/* ── CERTIFICATE MOCKUP ── */}
            <div className="relative w-full max-w-sm shrink-0 md:w-[380px] lg:w-[440px]">
              <div className="relative -rotate-3 rounded-2xl bg-gradient-to-br from-[#a78bfa] via-[#9b5de5] to-[#34d4c6] p-[3px] transition duration-500 hover:-rotate-1 hover:scale-[1.02]">
                <div className="overflow-hidden rounded-[13px] bg-white">
                  <img
                    src={sampleCertificatePreview}
                    alt="Sample Easy Medical Device Academy certificate"
                    className="block w-full"
                    loading="lazy"
                  />
                </div>
              </div>
              <p className="relative mt-5 text-center text-[11px] text-[#8e879f]">
                Sample preview of the certificate you receive
              </p>
            </div>

            {/* ── TEXT CONTENT ── */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-3 py-1 text-xs font-semibold text-[#b58dfb]">
                <Award className="size-3.5" />
                Official Recognition
              </div>

              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Earn Your Certificate from<br className="hidden sm:block" />
                <span className="text-[#b58dfb]"> Easy Medical Device Academy</span>
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#9f98b2] sm:text-base">
                Recognized by the global MedTech &amp; regulatory community, our certificates
                validate your expertise in EU MDR, IVDR, ISO 13485 and SaMD compliance —
                trusted by manufacturers and quality leaders worldwide.
              </p>

              {/* Three feature pills */}
              <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                {[
                  { icon: <ShieldCheck className="size-4 text-[#34d4c6]" />, label: 'EU MDR Aligned' },
                  { icon: <Award className="size-4 text-[#b58dfb]" />, label: 'Shareable on LinkedIn' },
                  { icon: <GraduationCap className="size-4 text-[#f6b44b]" />, label: 'Industry Recognised' },
                ].map(({ icon, label }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {icon}
                    {label}
                  </span>
                ))}
              </div>

              <a
                href="#courses"
                className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#08a99f] px-6 text-sm font-bold text-white transition hover:opacity-90"
              >
                Start earning your certificate
                <ArrowRight className="size-4" />
              </a>
            </div>

          </div>
        </div>
      </section>


      {/* Lead Instructor Section */}
      <section
        id="instructor"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"
      >
        {/* Section heading */}
        <div className="mb-8 text-center">
          <Badge className="mb-3 border-[#d9ceff] bg-[#f4f0ff] text-[#6d31dc]">
            Your Instructor
          </Badge>
          <h2 className="text-3xl font-extrabold text-[#171321] sm:text-4xl">
            Learn directly from a MedTech expert
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-[#625b75]">
            Every lesson is taught by Monir El Azzouzi — one of Europe's leading
            regulatory affairs consultants with real-world approval experience.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[#ede8fb] bg-white shadow-[0_8px_40px_rgb(38_29_68/8%)]">
          <div className="grid grid-cols-1 lg:grid-cols-12">

            {/* Left: Photo */}
            <div className="flex items-center justify-center bg-[#f4f0ff] p-8 lg:col-span-4">
              <div className="overflow-hidden rounded-2xl shadow-lg max-w-[260px] w-full">
                <img
                  src="/academy/monir-el-azzouzi-founder-ceo.jpg"
                  alt="Monir El Azzouzi - Founder & CEO Easy Medical Device"
                  className="w-full object-cover object-top transition duration-500 hover:scale-105"
                />
              </div>
            </div>

            {/* Right: Bio */}
            <div className="flex flex-col justify-between p-6 sm:p-8 md:p-10 lg:col-span-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d9ceff] bg-[#f4f0ff] px-3 py-1 text-xs font-semibold text-[#6d31dc]">
                  <Award className="size-3.5 text-[#7c3aed]" />
                  <span>Founder &amp; CEO • Easy Medical Device</span>
                </div>

                <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-[#171321] sm:text-4xl">
                  Monir El Azzouzi
                </h3>

                <p className="mt-2 text-base font-semibold text-[#7c3aed]">
                  Lead Regulatory Affairs &amp; Quality Management Consultant
                </p>

                <p className="mt-4 text-sm leading-relaxed text-[#625b75] sm:text-base">
                  You will learn from a Medical Device Expert with over <strong className="text-[#171321]">15 years</strong> of
                  hands-on international experience. Monir has personally guided
                  MedTech companies through CE mark approvals (EU MDR &amp; IVDR),
                  FDA clearances, and ISO 13485 certifications — and he teaches
                  every concept the way auditors actually think.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#ede8fb] pt-6">
                  <div className="rounded-xl border border-[#ede8fb] bg-[#f8f6ff] p-4">
                    <p className="text-2xl font-extrabold text-[#171321]">15+ Years</p>
                    <p className="mt-1 text-xs text-[#8b849a]">Leading MedTech RA/QA programs worldwide</p>
                  </div>
                  <div className="rounded-xl border border-[#ede8fb] bg-[#f8f6ff] p-4">
                    <p className="text-2xl font-extrabold text-[#171321]">10,000+</p>
                    <p className="mt-1 text-xs text-[#8b849a]">Professionals trained across the globe</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#ede8fb] pt-6">
                <a
                  href="#courses"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-6 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
                >
                  Start learning with Monir
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
                <span className="text-xs font-medium text-[#8b849a]">
                  🎙️ Host of the Easy Medical Device Podcast
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>



      {/* LinkedIn Community / Certificates Showcase */}
      <section id="community" className="bg-[#f8f6ff] py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-3 border-[#d9ceff] bg-white text-[#6d31dc]">
              Community & Recognition
            </Badge>
            <h2 className="text-3xl font-extrabold text-[#171321] sm:text-4xl">
              Shared by MedTech Leaders on LinkedIn
            </h2>
            <p className="mt-3 text-base text-[#5f5872] sm:text-lg">
              Alumni and regulated teams celebrate their verified completion
              certificates and real-world audit readiness.
            </p>
          </div>

          {communityPosts.length > 0 ? (
            <div className="relative mt-10 px-11 sm:px-14">
              {communityPosts.length > 3 ? (
                <>
                  <button
                    type="button"
                    onClick={() => scrollPosts(-1)}
                    aria-label="Previous posts"
                    className="absolute left-0 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#ded6f3] bg-white text-[#6d31dc] shadow-md transition hover:bg-[#f4f1ff]"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollPosts(1)}
                    aria-label="Next posts"
                    className="absolute right-0 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#ded6f3] bg-white text-[#6d31dc] shadow-md transition hover:bg-[#f4f1ff]"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              ) : null}
            <div
              ref={postsScrollerRef}
              className="flex snap-x snap-mandatory items-start gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {communityPosts.map((post) =>
                isSafeLinkedInEmbedUrl(post.embed_url) ? (
                  <div
                    key={post.id}
                    className="w-full shrink-0 snap-start overflow-hidden rounded-xl border border-[#ded6f3] bg-white shadow-sm sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                  >
                    <div className="relative h-[560px] overflow-hidden">
                      <iframe
                        src={post.embed_url}
                        title={`LinkedIn post by ${post.author_name || 'Easy Medical Device Academy community'}`}
                        className="block h-full w-[calc(100%+18px)] border-0"
                        loading="lazy"
                        allowFullScreen
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                    </div>
                    <a
                      href={post.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 border-t border-[#f0edf8] py-2.5 text-xs font-semibold text-[#0a66c2] hover:bg-[#f6faff]"
                    >
                      View on LinkedIn
                      <ArrowRight className="size-3.5" />
                    </a>
                  </div>
                ) : (
                  <div
                    key={post.id}
                    className="flex w-full shrink-0 snap-start flex-col justify-between rounded-xl border border-[#ded6f3] bg-white p-5 shadow-sm sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full bg-[#eee8fb] font-bold text-[#6b34e9]">
                          {(post.author_name || 'LI').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#171321]">
                            {post.author_name || 'LinkedIn member'}
                          </h4>
                          {post.author_role ? (
                            <p className="text-xs text-[#6e687d]">{post.author_role}</p>
                          ) : null}
                        </div>
                      </div>
                      {post.post_text ? (
                        <p className="mt-4 text-xs leading-relaxed text-[#302a42] sm:text-sm">
                          {post.post_text}
                        </p>
                      ) : null}
                      {post.course ? (
                        <p className="mt-3 text-[11px] text-[#6e687d]">
                          {post.course} • Easy Medical Device Academy
                        </p>
                      ) : null}
                    </div>
                    <a
                      href={post.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0a66c2] hover:underline"
                    >
                      View on LinkedIn
                      <ArrowRight className="size-3.5" />
                    </a>
                  </div>
                ),
              )}
            </div>
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  name: 'Sarah Van Der Berg',
                  role: 'Senior Regulatory Affairs Specialist at MedTech Europe',
                  time: 'Shared 2 days ago',
                  course: 'EU MDR Technical Documentation Intensive',
                  post: 'Thrilled to complete the EU MDR Technical Documentation Masterclass with Monir El Azzouzi! The GSPR mapping and notified body review logic are practical and immediate. Highly recommended for any RA team! 🚀📜 #MDR #EasyMedicalDevice',
                  likes: 84,
                  comments: 12,
                },
                {
                  name: 'Marcus Lindqvist',
                  role: 'Head of Quality & Compliance at Nordic Health Devices',
                  time: 'Shared 1 week ago',
                  course: 'ISO 13485 QMS Implementation Sprint',
                  post: 'Proud to receive my official certificate from Easy Medical Device Academy. Practical templates, zero fluff, and clear auditor expectations. Essential training for quality managers! ⭐',
                  likes: 112,
                  comments: 19,
                },
                {
                  name: 'Dr. Elena Rossi',
                  role: 'Digital Health & SaMD Consultant',
                  time: 'Shared 2 weeks ago',
                  course: 'Software as a Medical Device (SaMD) Compliance',
                  post: 'Just received my SaMD Compliance certification! Connecting IEC 62304 with cybersecurity and AI claims was presented with crystal clarity by Monir. Great academy! 💡',
                  likes: 96,
                  comments: 15,
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex flex-col justify-between rounded-xl border border-[#ded6f3] bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full bg-[#eee8fb] font-bold text-[#6b34e9]">
                          {item.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#171321]">
                            {item.name}
                          </h4>
                          <p className="text-xs text-[#6e687d]">{item.role}</p>
                          <p className="text-[11px] text-[#8e889d]">{item.time}</p>
                        </div>
                      </div>
                      {/* LinkedIn icon */}
                      <div className="flex size-7 items-center justify-center rounded bg-[#0a66c2] text-white shadow-sm">
                        <svg
                          className="size-4 fill-current"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.64c-.92 0-1.66.74-1.66 1.66 0 .92.74 1.66 1.66 1.66.92 0 1.66-.74 1.66-1.66 0-.92-.74-1.66-1.66-1.66Z" />
                        </svg>
                      </div>
                    </div>
  
                    <p className="mt-4 text-xs leading-relaxed text-[#302a42] sm:text-sm">
                      {item.post}
                    </p>
  
                    <div className="mt-4 rounded-lg border border-[#e5def2] bg-[#fbfbfe] p-3">
                      <div className="flex items-center gap-2">
                        <Award className="size-4 text-[#7c3aed]" />
                        <span className="text-xs font-semibold text-[#171321]">
                          Verified Certificate of Completion
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#6e687d]">
                        {item.course} • Easy Medical Device Academy
                      </p>
                    </div>
                  </div>
  
                  <div className="mt-4 flex items-center justify-between border-t border-[#f0edf8] pt-3 text-xs text-[#6e687d]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <ThumbsUp className="size-3.5 text-[#0a66c2]" />
                      <span>{item.likes} reactions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="size-3.5" />
                      <span>{item.comments} comments</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8 rounded-xl border border-dashed border-[#cfc4ee] bg-white/70 p-4 text-center">
            <p className="text-xs font-medium text-[#5f5872] sm:text-sm">
              ✨ Have you completed a course? Post your certificate on LinkedIn
              with{' '}
              <span className="font-semibold text-[#6b34e9]">
                #EasyMedicalDeviceAcademy
              </span>{' '}
              to be featured here!
            </p>
          </div>
        </div>
      </section>

      {/* Final Beautiful CTA Section */}
      <section className="relative overflow-hidden bg-[#171321] py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(124,58,237,0.3),rgba(255,255,255,0))]" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <Badge className="mb-4 bg-white/10 text-[#d9ceff] backdrop-blur-sm">
            Start Your Transformation
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-5xl">
            Master Medical Device Compliance with Confidence
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#cfc8de] sm:text-lg">
            Join regulatory affairs leaders, quality managers, and innovators
            worldwide. Access proven frameworks, downloadable templates, and
            certified courses today.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#courses"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-7 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
            >
              Explore Course Catalog
              <GraduationCap className="size-4" aria-hidden="true" />
            </a>
            <a
              href="https://easymedicaldevice.com/contact/"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/5 px-7 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15"
            >
              Contact for Team Training
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-white/10 pt-8 sm:grid-cols-4">
            {[
              'Practical real-world case studies',
              'Downloadable audit-ready templates',
              'Official shareable certificate',
              'Direct expert Q&A support',
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center justify-center gap-2 text-xs font-medium text-[#dcd6e8]"
              >
                <CheckCircle2 className="size-4 shrink-0 text-[#34d4c6]" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AcademyFooter />
    </main>
  );
}

function CourseCard({
  course,
  pending,
  notice,
  learnerState,
  onCheckout,
}: {
  course: AcademyCourse;
  pending: boolean;
  notice: CheckoutNotice | null;
  learnerState?: CourseLearnerState;
  onCheckout: (courseId: string) => void;
}) {
  const completed = (learnerState?.progress ?? 0) >= 100;
  const inProgress =
    !completed && (learnerState?.progress ?? 0) > 0 ? learnerState!.progress : 0;
  const enrolled = Boolean(learnerState?.enrolled);
  return (
    <Card
      className="rounded-lg border-[#e4ddf4] bg-white py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgb(38_29_68/10%)]"
      style={{ '--course-accent': course.accent } as CSSProperties}
    >
      <Link
        href={`/academy/course/${course.slug || course.id}`}
        className="group/thumb relative block aspect-[16/9] overflow-hidden rounded-t-lg bg-[#eee8ff]"
      >
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition duration-500 group-hover/thumb:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#171321]/70 via-transparent to-transparent opacity-80 group-hover/thumb:opacity-90 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-lg">
            <PlayCircle className="size-7 fill-white/20" />
          </div>
        </div>
        {completed ? (
          <Badge className="absolute left-3 top-3 gap-1 bg-[#08a99f] text-white">
            <CheckCircle2 className="size-3.5" />
            Completed
          </Badge>
        ) : (
          <Badge className="absolute left-3 top-3 bg-white text-[#201b31]">
            {course.badge}
          </Badge>
        )}
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/94 px-3 py-2 text-xs font-bold text-[#201b31]">
          {course.category}
        </div>
      </Link>

      <CardHeader className="p-5 pb-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#6d31dc]">
          {course.rating > 0 ? (
            <>
              <Star className="size-4 fill-[#f6b44b] text-[#f6b44b]" />
              <span>{course.rating.toFixed(1)}</span>
            </>
          ) : null}
          {course.students > 0 ? (
            <span className="text-[#8b849a]">
              ({numberFormatter.format(course.students)} learners)
            </span>
          ) : null}
        </div>
        <Link href={`/academy/course/${course.slug || course.id}`}>
          <CardTitle className="text-xl font-bold leading-snug text-[#191625] transition hover:text-[#7c3aed]">
            {course.title}
          </CardTitle>
        </Link>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <p className="min-h-[72px] text-sm leading-6 text-[#625b75]">
          {course.subtitle}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-[#625b75]">
          <span className="flex items-center gap-1 rounded-lg bg-[#f6f4fb] px-2 py-2">
            <Clock className="size-3.5 text-[#7c3aed]" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-[#f6f4fb] px-2 py-2">
            <BookOpen className="size-3.5 text-[#08a99f]" />
            {course.lessons} lessons
          </span>
        </div>
        {completed || inProgress > 0 ? (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] font-bold">
              <span className={completed ? 'text-[#067b75]' : 'text-[#6d31dc]'}>
                {completed ? 'Course completed' : 'In progress'}
              </span>
              <span className="text-[#625b75]">
                {completed ? 100 : inProgress}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#ede9fe]">
              <div
                className={`h-full rounded-full ${completed ? 'bg-[#08a99f]' : 'bg-[#7c3aed]'}`}
                style={{ width: `${completed ? 100 : inProgress}%` }}
              />
            </div>
          </div>
        ) : null}
        <ul className="mt-4 space-y-2">
          {course.outcomes.slice(0, 2).map((outcome, index) => (
            <li
              key={`${course.id}-outcome-${index}`}
              className="flex gap-2 text-sm leading-5 text-[#514b63]"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#08a99f]" />
              <span>{outcome}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3 rounded-b-lg border-[#e9e3f4] bg-[#fcfbff] p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold text-[#8b849a]">{course.level}</p>
          <p className="text-2xl font-bold text-[#191625]">
            {course.priceLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/academy/course/${course.slug || course.id}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[#cfc4ee] bg-white px-3.5 text-xs font-bold text-[#302945] transition hover:bg-[#f4f1ff]"
          >
            <PlayCircle className="size-4 text-[#7c3aed]" />
            <span>Details</span>
          </Link>
          {enrolled ? (
            <Link
              href={`/academy/learn/${course.id}`}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white transition ${
                completed ? 'bg-[#08a99f] hover:bg-[#067b75]' : 'bg-[#7c3aed] hover:bg-[#6d31dc]'
              }`}
            >
              {completed ? (
                <Award className="size-4" aria-hidden="true" />
              ) : (
                <PlayCircle className="size-4" aria-hidden="true" />
              )}
              {completed ? 'View certificate' : inProgress > 0 ? 'Continue' : 'Start learning'}
            </Link>
          ) : (
            <Button
              type="button"
              onClick={() => onCheckout(course.id)}
              disabled={pending}
              className="h-10 bg-[#7c3aed] px-4 text-white hover:bg-[#6d31dc]"
            >
              {pending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              ) : (
                <CreditCard className="size-4" aria-hidden="true" />
              )}
              {pending
                ? 'Opening...'
                : course.price <= 0 ||
                    course.priceLabel?.trim().toLowerCase() === 'free' ||
                    course.priceLabel?.trim().toLowerCase() === '$0'
                  ? 'Start free'
                  : 'Enroll'}
            </Button>
          )}
        </div>
      </CardFooter>

      {notice ? (
        <div
          className={`border-t px-5 py-3 text-sm font-medium ${
            notice.kind === 'error'
              ? 'border-[#f0c7c7] bg-[#fff7f7] text-[#9b2c2c]'
              : 'border-[#d8cef6] bg-[#f7f3ff] text-[#5f36c7]'
          }`}
        >
          {notice.message}
        </div>
      ) : null}
    </Card>
  );
}
