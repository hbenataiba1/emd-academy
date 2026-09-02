'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CreditCard,
  Database,
  FileCheck2,
  Filter,
  GraduationCap,
  PlayCircle,
  Search,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';

import {
  type AcademyCourse,
  companyLogos,
  courseCategories,
  featuredCourses,
  learningPaths,
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
import { Progress } from '@/components/ui/progress';

type AcademyPageProps = {
  initialCourses?: AcademyCourse[];
};

type CheckoutNotice = {
  courseId: string;
  kind: 'info' | 'error';
  message: string;
};

const pathwayIcons = [ShieldCheck, ClipboardCheck, BookOpen];

const stats = [
  { label: 'Compliance courses', value: '24+' },
  { label: 'Templates and examples', value: '120+' },
  { label: 'Expert-led lessons', value: '80h' },
];

const mainSiteMenu = [
  { label: 'Services', href: 'https://easymedicaldevice.com/services/' },
  { label: 'Expertise', href: 'https://easymedicaldevice.com/expertise/' },
  { label: 'Learn', href: 'https://easymedicaldevice.com/blog/' },
  { label: 'About', href: 'https://easymedicaldevice.com/about/' },
];

const numberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function AcademyPage({
  initialCourses = featuredCourses,
}: AcademyPageProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<(typeof courseCategories)[number]>('All');
  const [search, setSearch] = useState('');
  const [pendingCourse, setPendingCourse] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<CheckoutNotice | null>(
    null,
  );

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
    setPendingCourse(courseId);
    setCheckoutNotice({
      courseId,
      kind: 'info',
      message: 'Preparing secure checkout...',
    });

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      const payload = (await response.json()) as {
        url?: string;
        message?: string;
      };

      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }

      setCheckoutNotice({
        courseId,
        kind: 'error',
        message:
          payload.message ||
          'Checkout is ready for Stripe keys before live purchases.',
      });
    } catch {
      setCheckoutNotice({
        courseId,
        kind: 'error',
        message: 'Checkout could not be reached. Please try again.',
      });
    } finally {
      setPendingCourse(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <header className="border-b border-[#f0edf8] bg-[#fbfbfe]">
        <div className="mx-auto grid min-h-[92px] max-w-[1380px] grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:min-h-[112px] lg:grid-cols-[150px_1fr_260px] lg:px-8">
          <a
            href="https://easymedicaldevice.com/"
            aria-label="Easy Medical Device home"
            className="flex w-fit items-center"
          >
            <img
              src="/easy-medical-device-logo.png"
              alt="Easy Medical Device"
              className="size-[76px] object-contain lg:size-[92px]"
            />
          </a>

          <nav
            aria-label="Easy Medical Device main menu"
            className="hidden items-center gap-9 justify-self-start text-[17px] font-medium text-black lg:flex"
          >
            {mainSiteMenu.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="inline-flex h-11 items-center gap-2 rounded-lg px-1 transition hover:text-[#6b34e9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b34e9]/20"
              >
                {item.label}
                <ChevronDown
                  className="size-4 stroke-[2.2]"
                  aria-hidden="true"
                />
              </a>
            ))}
          </nav>

          <a
            href="https://easymedicaldevice.com/contact/"
            className="inline-flex h-[52px] min-w-[148px] items-center justify-center rounded-lg bg-[#eee8fb] px-6 text-base font-medium text-[#6b34e9] transition hover:bg-[#e6dcfb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b34e9]/20 sm:min-w-[190px] lg:h-[54px] lg:min-w-[260px]"
          >
            Let&apos;s Talk
          </a>

          <nav
            aria-label="Easy Medical Device mobile main menu"
            className="col-span-2 flex items-center gap-4 overflow-x-auto pb-3 text-sm font-medium text-black lg:hidden"
          >
            {mainSiteMenu.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-1 py-2"
              >
                {item.label}
                <ChevronDown className="size-3.5" aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className="border-b border-[#e8e3f7] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/academy" className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full border border-[#8f68ff]/25 bg-white shadow-sm">
              <span className="text-[11px] font-bold text-[#7c3aed]">EASY</span>
            </span>
            <span className="hidden text-sm font-semibold text-[#201b31] sm:inline">
              Easy Medical Device Academy
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#514b63] md:flex">
            <a href="#courses" className="hover:text-[#7c3aed]">
              Courses
            </a>
            <a href="#paths" className="hover:text-[#7c3aed]">
              Learning paths
            </a>
            <a href="#teams" className="hover:text-[#7c3aed]">
              For teams
            </a>
            <a href="#included" className="hover:text-[#7c3aed]">
              Included
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#courses"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[#5e5870] hover:bg-[#f4f1ff] sm:inline-flex"
            >
              Log in
            </a>
            <a
              href="#courses"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#6d31dc]"
            >
              Start learning
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#f8f6ff]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(360px,0.84fr)] lg:px-8 lg:py-16">
          <div>
            <Badge className="mb-5 border-[#d9ceff] bg-white text-[#6d31dc]">
              Regulatory training for real approvals
            </Badge>
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgb(124_58_237/24%)] hover:bg-[#6d31dc]"
              >
                Browse courses
                <GraduationCap className="size-4" aria-hidden="true" />
              </a>
              <a
                href="#teams"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cfc4ee] bg-white px-5 text-sm font-bold text-[#302945] hover:bg-[#f4f1ff]"
              >
                Build a team plan
                <Users className="size-4" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-9 grid max-w-2xl grid-cols-3 gap-3">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-[#e7e1f6] bg-white p-4"
                >
                  <div className="text-2xl font-bold text-[#191625]">
                    {item.value}
                  </div>
                  <div className="mt-1 text-xs font-medium text-[#6e687d]">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-lg border border-[#ded6f3] bg-white shadow-[0_24px_70px_rgb(35_28_61/15%)]">
              <div className="relative aspect-[5/4] min-h-[360px]">
                <img
                  src={initialCourses[0]?.image || featuredCourses[0].image}
                  alt="Medical device training session"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#151020]/75 via-[#151020]/10 to-transparent" />
                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-white/92 px-3 py-2 text-sm font-bold text-[#251d36] shadow-sm">
                  <ShieldCheck className="size-4 text-[#08a99f]" />
                  MDR-ready curriculum
                </div>
                <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/94 p-4 shadow-sm backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[#7c3aed]">
                        Featured path
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-[#191625]">
                        EU regulatory submission readiness
                      </h2>
                    </div>
                    <PlayCircle className="size-9 text-[#7c3aed]" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold text-[#625b75]">
                    <span className="rounded-lg bg-[#f2efff] px-2 py-2">
                      42 lessons
                    </span>
                    <span className="rounded-lg bg-[#e9fbf8] px-2 py-2">
                      Templates
                    </span>
                    <span className="rounded-lg bg-[#fff6e8] px-2 py-2">
                      Expert Q&A
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold text-[#706982]">
            Trusted by medical device teams building compliant products
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {companyLogos.map((name) => (
              <div
                key={name}
                className="rounded-lg border border-[#e6e0f4] bg-white px-4 py-3 text-center text-sm font-bold text-[#8b849a]"
              >
                {name}
              </div>
            ))}
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
              No courses match that search
            </h3>
            <p className="mt-2 text-sm text-[#625b75]">
              Try a different regulatory topic or view all courses.
            </p>
          </div>
        ) : null}
      </section>

      <section id="paths" className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <Badge className="mb-3 bg-[#f2efff] text-[#6d31dc]">
                Guided learning
              </Badge>
              <h2 className="text-3xl font-bold text-[#191625] sm:text-4xl">
                Skills to transform your compliance workflow
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[#625b75] sm:text-base">
              Bundle courses into role-based paths so founders, RA teams,
              quality managers, and digital health teams know exactly what to
              take next.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {learningPaths.map((path, index) => {
              const Icon = pathwayIcons[index % pathwayIcons.length];

              return (
                <Card
                  key={path.title}
                  className="rounded-lg border-[#e5def2] bg-[#fbfbfe] py-0"
                >
                  <CardHeader className="p-5">
                    <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-white text-[#7c3aed] shadow-sm">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl font-bold text-[#191625]">
                      {path.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="min-h-[96px] text-sm leading-6 text-[#625b75]">
                      {path.copy}
                    </p>
                    <div className="mt-5 flex items-center justify-between text-sm font-semibold text-[#514b63]">
                      <span>{path.courses} courses</span>
                      <span>{path.hours} hours</span>
                    </div>
                    <Progress
                      value={path.progress}
                      className="mt-4 [&_[data-slot=progress-indicator]]:bg-[#08a99f]"
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="teams" className="bg-[#171321] py-14 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <Badge className="mb-4 bg-white text-[#171321]">
              For regulated teams
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Reimagine onboarding for medical device compliance
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#d8d3e5] sm:text-base">
              Give every team member a clear path through approval strategy,
              technical documentation, QMS evidence, and post-market readiness.
            </p>
            <a
              href="#courses"
              className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-[#171321] hover:bg-[#f4f1ff]"
            >
              Explore team training
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [
                'Role-based learning',
                'Assign RA, QA, clinical, and software paths.',
              ],
              [
                'Evidence templates',
                'Download examples that match real review needs.',
              ],
              [
                'Progress visibility',
                'See completion signals for each training path.',
              ],
              [
                'Secure checkout',
                'Sell individual courses or curated bundles.',
              ],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="rounded-lg border border-white/12 bg-white/8 p-5"
              >
                <CheckCircle2 className="mb-4 size-5 text-[#34d4c6]" />
                <h3 className="font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#d8d3e5]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="included"
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="mb-3 bg-[#e9fbf8] text-[#067b75]">
            Built for approvals
          </Badge>
          <h2 className="text-3xl font-bold text-[#191625] sm:text-4xl">
            Everything learners expect, adapted for MedTech
          </h2>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-4">
          {[
            {
              icon: FileCheck2,
              title: 'Submission examples',
              copy: 'Realistic technical file sections, GSPR maps, and audit evidence.',
            },
            {
              icon: Database,
              title: 'Course library',
              copy: 'Structured catalog content that can come from Supabase.',
            },
            {
              icon: CreditCard,
              title: 'Paid enrollment',
              copy: 'Stripe Checkout flow for course and bundle purchases.',
            },
            {
              icon: Clock,
              title: 'Practical pace',
              copy: 'Short lessons, downloadable templates, and completion progress.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-[#e5def2] bg-white p-5"
            >
              <item.icon className="size-6 text-[#7c3aed]" aria-hidden="true" />
              <h3 className="mt-4 font-bold text-[#191625]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#625b75]">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#e5def2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-[#625b75] sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p className="font-semibold text-[#201b31]">
            Easy Medical Device Academy
          </p>
          <div className="flex flex-wrap gap-4">
            <a href="#courses" className="hover:text-[#7c3aed]">
              Courses
            </a>
            <a href="#paths" className="hover:text-[#7c3aed]">
              Paths
            </a>
            <a href="#teams" className="hover:text-[#7c3aed]">
              Teams
            </a>
            <a
              href="https://easymedicaldevice.com"
              className="hover:text-[#7c3aed]"
            >
              Main website
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function CourseCard({
  course,
  pending,
  notice,
  onCheckout,
}: {
  course: AcademyCourse;
  pending: boolean;
  notice: CheckoutNotice | null;
  onCheckout: (courseId: string) => void;
}) {
  return (
    <Card
      className="rounded-lg border-[#e4ddf4] bg-white py-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgb(38_29_68/10%)]"
      style={{ '--course-accent': course.accent } as CSSProperties}
    >
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-lg bg-[#eee8ff]">
        <img
          src={course.image}
          alt={course.title}
          className="h-full w-full object-cover transition duration-500 group-hover/card:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#171321]/70 via-transparent to-transparent" />
        <Badge className="absolute left-3 top-3 bg-white text-[#201b31]">
          {course.badge}
        </Badge>
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/94 px-3 py-2 text-xs font-bold text-[#201b31]">
          {course.category}
        </div>
      </div>

      <CardHeader className="p-5 pb-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#6d31dc]">
          <Star className="size-4 fill-[#f6b44b] text-[#f6b44b]" />
          <span>{course.rating.toFixed(1)}</span>
          <span className="text-[#8b849a]">
            ({numberFormatter.format(course.students)} learners)
          </span>
        </div>
        <CardTitle className="text-xl font-bold leading-snug text-[#191625]">
          {course.title}
        </CardTitle>
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
        <ul className="mt-4 space-y-2">
          {course.outcomes.slice(0, 2).map((outcome) => (
            <li
              key={outcome}
              className="flex gap-2 text-sm leading-5 text-[#514b63]"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#08a99f]" />
              <span>{outcome}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex items-center justify-between rounded-b-lg border-[#e9e3f4] bg-[#fcfbff] p-5">
        <div>
          <p className="text-xs font-semibold text-[#8b849a]">{course.level}</p>
          <p className="text-2xl font-bold text-[#191625]">
            {course.priceLabel}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => onCheckout(course.id)}
          disabled={pending}
          className="h-10 bg-[#7c3aed] px-4 text-white hover:bg-[#6d31dc]"
        >
          <CreditCard className="size-4" aria-hidden="true" />
          {pending ? 'Opening...' : 'Enroll'}
        </Button>
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
