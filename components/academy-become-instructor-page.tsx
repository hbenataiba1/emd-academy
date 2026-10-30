import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  Presentation,
  Send,
  ShieldCheck,
  Users,
  Wallet,
  Rocket,
} from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';

const APPLY = '/academy/instructor/apply';

const benefits = [
  {
    icon: Globe,
    title: 'Reach professionals worldwide',
    text: 'Regulatory, quality and engineering teams come to Easy Medical Device every day. Your course is in front of them.',
  },
  {
    icon: Building2,
    title: 'Visibility for you and your company',
    text: 'Your name and your company appear on your course page and in the Academy catalog, in front of regulatory, quality and engineering professionals who may become your clients, partners or future colleagues.',
  },
  {
    icon: LayoutDashboard,
    title: 'Your own dashboard',
    text: 'Create and manage your courses, follow your learners and enrollments, and see your reviews in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'We run the platform',
    text: 'Video hosting, secure payments, certificates and automatic emails are included. You focus on teaching.',
  },
  {
    icon: Wallet,
    title: 'Earn from every sale',
    text: 'You earn a share of every enrollment in your courses, and you can see your earnings in your dashboard.',
  },
];

const steps = [
  { icon: Send, title: 'Apply', text: 'Tell us about your background and send your LinkedIn profile.' },
  { icon: BadgeCheck, title: 'We verify you', text: 'Our team reviews your application and tells you the decision by email.' },
  { icon: ClipboardCheck, title: 'Create your course', text: 'Build your lessons in your dashboard and send the course for review.' },
  { icon: Rocket, title: 'We publish it', text: 'We review it, prepare the cover and put it online for learners.' },
  {
    icon: Wallet,
    title: 'You keep 70%',
    text: 'Of every sale of your course. A 30% platform fee covers hosting, secure payments, certificates and promotion. We send you your earnings.',
  },
];

const faqs = [
  {
    q: 'Do I need to be an expert?',
    a: 'Yes. We look for people with real, hands-on experience in medical devices: regulatory affairs, quality, clinical, software, testing or related fields. That is why we check your background and LinkedIn profile.',
  },
  {
    q: 'How long does the review take?',
    a: 'We review applications as quickly as we can and email you the decision. You can follow the status of your application at any time.',
  },
  {
    q: 'Who creates the course cover?',
    a: 'We do. You write the content and we design the cover before your course is published, so every course looks consistent.',
  },
  {
    q: 'Will my course be reviewed before it goes online?',
    a: 'Yes. Every course is reviewed by our team. We may edit it or ask you for changes before publishing it.',
  },
  {
    q: 'How and when do I get paid?',
    a: 'You keep 70% of every sale. Learners pay through the Academy, and a platform fee of 30% covers hosting, secure payments, certificates and promotion. You see your earnings in your dashboard, and our team sends your payout to you.',
  },
  {
    q: 'Can I answer my learners’ questions?',
    a: 'Yes. Learners can ask questions under each lesson, and you answer them from your dashboard.',
  },
];

export function AcademyBecomeInstructorPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader />

      <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#ece4ff] via-[#f6f2ff] to-[#dff8f4]">
        {/* Decoration: soft colour blobs and a dotted grid */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#7c3aed]/15 blur-3xl" />
          <div className="absolute -bottom-32 right-0 size-[460px] rounded-full bg-[#34d4c6]/25 blur-3xl" />
          <div className="absolute right-1/3 top-10 size-48 rounded-full bg-[#f6b44b]/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage: 'radial-gradient(rgba(124,58,237,0.18) 1.2px, transparent 1.2px)',
              backgroundSize: '26px 26px',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 85%)',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 85%)',
            }}
          />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.84fr)] lg:px-8 lg:py-16">
          {/* Left: text */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#e9fbf8] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#067b75]">
              <Presentation className="size-3.5" aria-hidden="true" />
              Become an instructor
            </span>
            <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.06] text-[#171321] sm:text-5xl lg:text-6xl">
              Teach medical device professionals around the world
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f5872] sm:text-lg">
              Share your experience, create your own course on Easy Medical Device Academy and earn from every
              enrollment. We take care of the platform.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={APPLY}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white hover:bg-[#6d31dc]"
              >
                Apply now <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cfc4ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:bg-[#f4f1ff]"
              >
                How it works
              </a>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#3b3650]">
              {['Free to apply', 'We handle payments', 'Your own dashboard'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-[#08a99f]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: photo + floating badges */}
          <div className="relative mx-auto mb-5 w-full max-w-[420px] sm:mb-0 lg:max-w-none">
            <div className="relative overflow-hidden rounded-2xl shadow-[0_32px_80px_rgb(35_28_61/18%)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/academy/instructor-hero.jpg"
                alt="An expert teaching an online course from his desk"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="absolute -left-2 top-6 hidden max-w-[150px] flex-col gap-1 rounded-2xl border border-[#ede8fb] bg-white px-4 py-3 shadow-[0_8px_30px_rgb(35_28_61/12%)] sm:-left-6 sm:top-8 sm:flex sm:max-w-[170px]">
              <Globe className="size-5 text-[#7c3aed]" aria-hidden="true" />
              <p className="mt-0.5 text-sm font-bold leading-tight text-[#191625]">Global audience</p>
              <p className="text-xs leading-snug text-[#706982]">Learners from every region</p>
            </div>

            <div className="absolute -bottom-4 -right-2 flex max-w-[145px] flex-col gap-1 rounded-2xl border border-[#ede8fb] bg-white px-4 py-3 shadow-[0_8px_30px_rgb(35_28_61/12%)] sm:-right-6 sm:bottom-auto sm:top-6 sm:max-w-[165px]">
              <Wallet className="size-5 text-[#f6b44b]" aria-hidden="true" />
              <p className="mt-0.5 text-sm font-bold leading-tight text-[#191625]">Earn from every sale</p>
              <p className="text-xs leading-snug text-[#706982]">Track your earnings live</p>
            </div>

            <div className="absolute -bottom-4 -left-2 flex max-w-[150px] flex-col gap-1 rounded-2xl border border-[#ede8fb] bg-white px-4 py-3 shadow-[0_8px_30px_rgb(35_28_61/12%)] sm:-left-6 sm:max-w-[175px]">
              <LayoutDashboard className="size-5 text-[#08a99f]" aria-hidden="true" />
              <p className="mt-0.5 text-sm font-bold leading-tight text-[#191625]">Your own dashboard</p>
              <p className="text-xs leading-snug text-[#706982]">Courses, learners and reviews</p>
            </div>

            <div className="absolute -right-2 top-1/2 hidden max-w-[150px] -translate-y-1/2 flex-col gap-1 rounded-2xl border border-[#ede8fb] bg-white px-4 py-3 shadow-[0_8px_30px_rgb(35_28_61/12%)] sm:-right-8 sm:flex sm:max-w-[165px] lg:-right-6">
              <ShieldCheck className="size-5 text-[#7c3aed]" aria-hidden="true" />
              <p className="mt-0.5 text-sm font-bold leading-tight text-[#191625]">We run the platform</p>
              <p className="text-xs leading-snug text-[#706982]">Video, payments, certificates</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-center text-2xl font-black sm:text-3xl">Why teach with us</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {benefits.map(({ icon: Icon, title, text }, index) => (
            <div
              key={title}
              className={`rounded-2xl border border-[#e4ddf4] bg-white p-6 shadow-sm ${index >= 3 ? 'lg:col-span-3' : 'lg:col-span-2'} ${index === benefits.length - 1 ? 'sm:col-span-2 lg:col-span-3' : ''}`}
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5f5872]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#f8f6ff] py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-black sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="relative rounded-2xl border border-[#e4ddf4] bg-white p-6">
                <span className="absolute -top-3 left-6 flex size-7 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-black text-white">
                  {index + 1}
                </span>
                <Icon className="size-6 text-[#7c3aed]" aria-hidden="true" />
                <h3 className="mt-3 text-base font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5f5872]">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="rounded-3xl border border-[#e4ddf4] bg-white p-7 shadow-sm sm:p-10">
          <div className="flex items-center gap-3">
            <Users className="size-6 text-[#7c3aed]" aria-hidden="true" />
            <h2 className="text-xl font-black sm:text-2xl">Who we are looking for</h2>
          </div>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-[#3b3650] sm:grid-cols-2">
            {[
              'Regulatory affairs and quality professionals',
              'Consultants, auditors and notified body experts',
              'Engineers in software, usability, testing or clinical evaluation',
              'People who like to explain complex topics in a clear, practical way',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#34d4c6]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-14 sm:px-6 sm:pb-20 lg:px-8">
        <h2 className="text-center text-2xl font-black sm:text-3xl">Questions</h2>
        <div className="mt-8 space-y-3">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border border-[#e4ddf4] bg-white p-5">
              <summary className="cursor-pointer list-none text-sm font-black marker:hidden sm:text-base">
                <span className="flex items-center justify-between gap-3">
                  {q}
                  <span className="text-xl leading-none text-[#7c3aed] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-[#5f5872]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-[#171321] py-14 text-center text-white sm:py-20">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-black sm:text-3xl">Ready to share what you know?</h2>
          <p className="mt-3 text-[#cfc6e6]">The application takes about five minutes.</p>
          <Link
            href={APPLY}
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#34d4c6] px-8 text-sm font-black text-[#171321] transition hover:bg-[#2bc2b5]"
          >
            Apply to become an instructor <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <AcademyFooter />
    </main>
  );
}
