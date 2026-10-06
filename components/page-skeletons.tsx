import { PlayCircle } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* Skeleton building blocks used by the route-level loading.tsx files.
   They mirror the real page layout so nothing jumps when content arrives. */

const tone = 'bg-[#e9e3f8]';

function Bar({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <Skeleton className={cn(tone, className)} style={style} />;
}

export function HeaderSkeleton() {
  return (
    <>
      <div className="border-b border-[#ded6f3]/60 bg-[#f8f6ff]">
        <div className="mx-auto flex min-h-[92px] max-w-[1380px] items-center gap-6 px-4 sm:px-6 lg:min-h-[112px] lg:px-8">
          <Bar className="size-[76px] rounded-full lg:size-[92px]" />
          <div className="hidden flex-1 items-center gap-8 lg:flex">
            {[72, 80, 64, 60].map((width) => (
              <Bar key={width} className="h-4" style={{ width }} />
            ))}
          </div>
          <Bar className="ml-auto h-[52px] w-36 rounded-lg sm:w-48 lg:w-[260px]" />
        </div>
      </div>
      <div className="border-b border-[#ded6f3]/60 bg-[#f8f6ff]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="space-y-1.5">
            <Bar className="h-3 w-28" />
            <Bar className="h-5 w-24" />
          </div>
          <div className="hidden items-center gap-6 md:flex">
            {[56, 72, 64, 72].map((width, index) => (
              <Bar key={index} className="h-4" style={{ width }} />
            ))}
          </div>
          <Bar className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </>
  );
}

export function FooterSkeleton() {
  return (
    <div className="border-t border-[#e5def2] bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_2fr] lg:px-8">
        <div className="space-y-3">
          <Bar className="size-20 rounded-full" />
          <Bar className="h-5 w-24" />
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[0, 1, 2].map((column) => (
            <div key={column} className="space-y-3">
              <Bar className="h-5 w-24" />
              {[0, 1, 2, 3].map((row) => (
                <Bar key={row} className="h-4 w-full max-w-[180px]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e4ddf4] bg-white">
      <Bar className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Bar className="h-4 w-1/3" />
        <Bar className="h-6 w-4/5" />
        <Bar className="h-4 w-full" />
        <Bar className="h-4 w-5/6" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Bar className="h-8" />
          <Bar className="h-8" />
        </div>
        <div className="flex items-center justify-between pt-3">
          <Bar className="h-8 w-16" />
          <Bar className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-white"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <HeaderSkeleton />
      {children}
      <FooterSkeleton />
    </div>
  );
}

/* /academy and / */
export function AcademyHomeSkeleton() {
  return (
    <PageShell>
      <section className="bg-[#f8f6ff]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-16">
          <div className="space-y-5">
            <Bar className="h-12 w-4/5 sm:h-14" />
            <Bar className="h-12 w-3/5 sm:h-14" />
            <Bar className="h-4 w-full max-w-lg" />
            <Bar className="h-4 w-5/6 max-w-lg" />
            <div className="flex gap-3 pt-2">
              <Bar className="h-11 w-36 rounded-lg" />
              <Bar className="h-11 w-44 rounded-lg" />
            </div>
          </div>
          <Bar className="aspect-[4/3] w-full rounded-2xl" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <Bar className="h-6 w-28 rounded-full" />
          <Bar className="h-9 w-72" />
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <CourseCardSkeleton key={index} />
          ))}
        </div>
      </section>
    </PageShell>
  );
}

/* /academy/course/[courseId] */
export function CourseDetailSkeleton() {
  return (
    <PageShell>
      <section className="bg-[#f8f6ff]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
          <div className="space-y-4">
            <Bar className="h-4 w-32" />
            <Bar className="h-10 w-4/5" />
            <Bar className="h-10 w-2/3" />
            <Bar className="h-4 w-full max-w-xl" />
            <Bar className="h-4 w-5/6 max-w-xl" />
            <div className="flex gap-3 pt-2">
              <Bar className="h-8 w-24 rounded-full" />
              <Bar className="h-8 w-28 rounded-full" />
              <Bar className="h-8 w-24 rounded-full" />
            </div>
          </div>
          <Bar className="aspect-video w-full rounded-2xl" />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-8">
          <div className="space-y-4 rounded-2xl border border-[#e4ddf4] p-6">
            <Bar className="h-7 w-56" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Bar key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-[#e4ddf4] p-6">
            <Bar className="h-7 w-48" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Bar key={index} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
        <Bar className="h-80 rounded-2xl" />
      </section>
    </PageShell>
  );
}

/* /academy/my-learning */
export function MyLearningSkeleton() {
  return (
    <PageShell>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Bar className="size-14 rounded-full" />
          <div className="space-y-2">
            <Bar className="h-7 w-56" />
            <Bar className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Bar key={index} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-lg border border-[#ede9fe] bg-white">
              <Bar className="h-40 w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Bar className="h-4 w-4/5" />
                <Bar className="h-3 w-1/3" />
                <Bar className="h-1.5 w-full" />
                <Bar className="h-9 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </PageShell>
  );
}

/* /academy/login, /academy/signup */
export function AuthSkeleton() {
  return (
    <PageShell>
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-16">
        <Bar className="mx-auto h-8 w-48" />
        <Bar className="mx-auto h-4 w-64" />
        <div className="space-y-4 rounded-2xl border border-[#e4ddf4] p-6">
          <Bar className="h-11 w-full rounded-lg" />
          <Bar className="h-11 w-full rounded-lg" />
          <Bar className="h-11 w-full rounded-lg" />
          <Bar className="h-11 w-full rounded-lg" />
        </div>
      </main>
    </PageShell>
  );
}

/* /academy/profile */
export function ProfileSkeleton() {
  return (
    <PageShell>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <div className="flex items-center gap-5">
          <Bar className="size-20 rounded-full" />
          <div className="space-y-2">
            <Bar className="h-7 w-48" />
            <Bar className="h-4 w-60" />
          </div>
        </div>
        <div className="space-y-4 rounded-2xl border border-[#e4ddf4] p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Bar className="h-3 w-24" />
              <Bar className="h-11 w-full rounded-lg" />
            </div>
          ))}
          <Bar className="h-11 w-36 rounded-lg" />
        </div>
      </main>
    </PageShell>
  );
}

/* /academy/learn/** , also shown by the player itself while access is checked */
export function PlayerSkeleton() {
  const dark = 'bg-white/10';
  return (
    <div
      className="flex min-h-screen flex-col bg-[#0e0c14] text-white"
      role="status"
      aria-busy="true"
      aria-label="Loading your course"
    >
      <div className="flex h-14 items-center gap-3 border-b border-white/10 bg-[#14101e] px-4">
        <Skeleton className={cn(dark, 'size-6')} />
        <Skeleton className={cn(dark, 'h-4 w-48')} />
        <Skeleton className={cn(dark, 'ml-auto h-8 w-28 rounded-lg')} />
      </div>
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex-1">
          <div className="relative flex aspect-video max-h-[68vh] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#1b152b] via-[#100d1a] to-black">
            <div className="relative flex flex-col items-center gap-4">
              <div className="relative flex size-16 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-[#7c3aed]/25" />
                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-white/10 border-t-[#a78bfa]" />
                <PlayCircle className="size-6 text-[#b58dfb]" />
              </div>
              <p className="text-sm font-semibold text-[#d8d0ea]">Loading your course…</p>
            </div>
          </div>
          <div className="space-y-3 p-6">
            <Skeleton className={cn(dark, 'h-7 w-2/3')} />
            <Skeleton className={cn(dark, 'h-4 w-1/3')} />
            <Skeleton className={cn(dark, 'h-4 w-full max-w-2xl')} />
            <Skeleton className={cn(dark, 'h-4 w-5/6 max-w-2xl')} />
          </div>
        </div>
        <aside className="hidden w-80 shrink-0 space-y-3 border-l border-white/10 bg-[#14101e] p-4 lg:block">
          <Skeleton className={cn(dark, 'h-5 w-32')} />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className={cn(dark, 'size-5')} />
              <Skeleton className={cn(dark, 'h-4 flex-1')} />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
