import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* Loading placeholders of the instructor dashboard. They have the same shape as the real
   pages (frame, menu, cards, tables, forms) so nothing jumps when the content arrives. */

const tone = 'bg-[#e9e3f8]';

function Bar({ className }: { className?: string }) {
  return <Skeleton className={cn(tone, className)} />;
}

const card = 'rounded-2xl border border-[#e4ddf4] bg-white';

/** Title and one line of text, like the top of every dashboard page. */
export function PageTitleSkeleton() {
  return (
    <div className="mb-5 space-y-2">
      <Bar className="h-8 w-56" />
      <Bar className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function StatCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={cn(card, 'space-y-3 p-5')}>
          <Bar className="h-3 w-24" />
          <Bar className="h-8 w-20" />
          <Bar className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className={cn(card, 'overflow-hidden')}>
      <div className="flex gap-6 bg-[#faf8ff] px-4 py-3.5">
        {Array.from({ length: columns }).map((_, index) => (
          <Bar key={index} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-6 border-t border-[#f0ecf9] px-4 py-4">
          {Array.from({ length: columns }).map((__, column) => (
            <div key={column} className="flex-1 space-y-1.5">
              <Bar className={cn('h-4', column === 0 ? 'w-3/4' : 'w-2/3')} />
              {column === 0 ? <Bar className="h-3 w-1/2" /> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={cn(card, 'flex items-start justify-between gap-4 p-5')}>
          <div className="min-w-0 flex-1 space-y-2.5">
            <Bar className="h-5 w-2/3" />
            <Bar className="h-3 w-1/3" />
          </div>
          <Bar className="h-7 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className={cn(card, 'space-y-5 p-6 sm:p-8')}>
      <Bar className="h-6 w-40" />
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Bar className="h-3 w-24" />
          <Bar className={cn('w-full', index === 2 ? 'h-28' : 'h-11')} />
        </div>
      ))}
    </div>
  );
}

/** The menu on the left. */
export function MenuSkeleton() {
  return (
    <nav
      aria-hidden="true"
      className="flex shrink-0 gap-2 overflow-hidden border-b border-[#ede8fb] bg-white p-3 lg:h-[calc(100vh-4rem)] lg:w-60 lg:flex-col lg:border-b-0 lg:border-r"
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5">
          <Bar className="size-[18px] rounded" />
          <Bar className="h-4 w-24 lg:w-28" />
        </div>
      ))}
    </nav>
  );
}

/** What a dashboard page shows while its content loads: title, cards and a table. */
export function DashboardContentSkeleton({ variant = 'overview' }: { variant?: 'overview' | 'table' | 'list' | 'form' }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <PageTitleSkeleton />
      {variant === 'overview' ? (
        <>
          <StatCardsSkeleton />
          <div className="mt-6">
            <TableSkeleton rows={4} columns={4} />
          </div>
        </>
      ) : null}
      {variant === 'table' ? <TableSkeleton /> : null}
      {variant === 'list' ? <ListSkeleton /> : null}
      {variant === 'form' ? <FormSkeleton /> : null}
    </div>
  );
}

/** The whole dashboard frame (logo bar, menu and content), for the route loading screens. */
export function InstructorFrameSkeleton({ variant = 'overview' }: { variant?: 'overview' | 'table' | 'list' | 'form' }) {
  return (
    <div className="min-h-screen bg-[#fbfbfe]">
      <header className="flex h-16 items-center justify-between border-b border-[#ded6f3]/70 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="space-y-1.5">
            <Bar className="h-3 w-28" />
            <Bar className="h-6 w-24" />
          </div>
          <Bar className="hidden h-6 w-28 rounded-full sm:block" />
        </div>
        <Bar className="size-9 rounded-full" />
      </header>
      <div className="flex flex-col lg:flex-row">
        <MenuSkeleton />
        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-5">
          <DashboardContentSkeleton variant={variant} />
        </main>
      </div>
    </div>
  );
}
