'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Receipt,
  Star,
  Tag,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';

import { AcademyAvatar } from '@/components/academy-avatar';
import { DashboardContentSkeleton } from '@/components/instructor-skeletons';
import {
  clearAcademySession,
  getAcademyAuthHeader,
  getAcademyAvatarUrl,
  getAcademyDisplayName,
  getStoredAcademySession,
  type AcademySession,
} from '@/lib/academy-session';

export type DashboardPage =
  | 'overview'
  | 'courses'
  | 'enrollments'
  | 'learners'
  | 'certificates'
  | 'questions'
  | 'coupons'
  | 'reviews'
  | 'earnings'
  | 'payment'
  | 'profile';

const NAV: { key: DashboardPage; label: string; href: string; icon: typeof BookOpen }[] = [
  { key: 'overview', label: 'Dashboard', href: '/academy/instructor', icon: LayoutDashboard },
  { key: 'courses', label: 'My courses', href: '/academy/instructor/courses', icon: BookOpen },
  { key: 'enrollments', label: 'Enrollments', href: '/academy/instructor/enrollments', icon: Receipt },
  { key: 'learners', label: 'Learners', href: '/academy/instructor/learners', icon: Users },
  { key: 'certificates', label: 'Certificates', href: '/academy/instructor/certificates', icon: Trophy },
  { key: 'questions', label: 'Lesson questions', href: '/academy/instructor/questions', icon: MessageSquare },
  { key: 'coupons', label: 'Coupons', href: '/academy/instructor/coupons', icon: Tag },
  { key: 'reviews', label: 'Reviews', href: '/academy/instructor/reviews', icon: Star },
  { key: 'earnings', label: 'Earnings', href: '/academy/instructor/earnings', icon: Wallet },
  { key: 'payment', label: 'Payment details', href: '/academy/instructor/payment', icon: CreditCard },
];

/**
 * The instructor dashboard frame: only the Academy logo on top and the dashboard menu
 * on the left. It also keeps out anyone who is not an approved instructor.
 */
export function InstructorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = pathname.replace(/^\/academy\/instructor\/?/, '').split('/')[0];
  const active: DashboardPage = NAV.some((item) => item.key === segment) ? (segment as DashboardPage) : 'overview';
  const [session, setSession] = useState<AcademySession | null>(null);
  const [ready, setReady] = useState(false);
  const [unanswered, setUnanswered] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = getStoredAcademySession();
    if (!stored) {
      window.location.assign(`/academy/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setSession(stored);
    let active = true;
    fetch('/api/academy/instructor', { headers: getAcademyAuthHeader(stored) })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { status?: string };
        if (!active) return;
        if (!response.ok || payload.status !== 'approved') {
          window.location.assign('/academy/instructor/apply');
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (active) window.location.assign('/academy/instructor/apply');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refresh = () => setSession(getStoredAcademySession());
    window.addEventListener('academy-auth-change', refresh);
    return () => window.removeEventListener('academy-auth-change', refresh);
  }, []);

  // The red number on "Lesson questions".
  useEffect(() => {
    if (!ready) return;
    const load = () => {
      const stored = getStoredAcademySession();
      if (!stored) return;
      fetch('/api/academy/instructor/overview', { headers: getAcademyAuthHeader(stored), cache: 'no-store' })
        .then(async (response) => (response.ok ? ((await response.json()) as { unanswered?: number }) : null))
        .then((payload) => setUnanswered(payload?.unanswered || 0))
        .catch(() => undefined);
    };
    load();
    window.addEventListener('instructor-questions-changed', load);
    return () => window.removeEventListener('instructor-questions-changed', load);
  }, [ready]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const name = getAcademyDisplayName(session);
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#ded6f3]/70 bg-white px-4 sm:px-6">
        <Link href="/academy/instructor" className="flex items-center gap-3" aria-label="Easy Medical Device Academy">
          <span className="flex flex-col justify-center">
            <span className="text-[11px] font-semibold leading-none text-[#6e687e] sm:text-xs">Easy Medical Device</span>
            <span className="mt-1 text-xl font-black leading-none tracking-tight text-[#7c3aed] sm:text-2xl">Academy</span>
          </span>
          <span className="rounded-full bg-[#f4f0ff] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7c3aed] ring-1 ring-[#7c3aed]/20">
            Instructor space
          </span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-[#7c3aed]/40 focus:outline-none"
            aria-label="Account menu"
          >
            <AcademyAvatar
              src={getAcademyAvatarUrl(session)}
              alt={name}
              initials={initials}
              imageClassName="size-9 rounded-full object-cover"
              fallbackClassName="flex size-9 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-bold text-white"
            />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-2xl border border-[#ded6f3] bg-white p-2 shadow-[0_20px_60px_rgba(25,22,37,0.16)]">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-bold">{name}</p>
                <p className="truncate text-xs text-[#6e687d]">{session?.user.email}</p>
              </div>
              <Link href="/academy/instructor/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#302945] hover:bg-[#f8f6ff]">
                <UserRound className="size-4 text-[#7c3aed]" /> My profile
              </Link>
              <Link href="/academy" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#302945] hover:bg-[#f8f6ff]">
                <ExternalLink className="size-4 text-[#7c3aed]" /> Go to the Academy
              </Link>
              <button
                type="button"
                onClick={() => {
                  clearAcademySession();
                  window.location.assign('/academy');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#b42318] hover:bg-[#fff5f5]"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {(
        <div className="flex flex-col lg:flex-row">
          <nav
            aria-label="Instructor menu"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#ede8fb] bg-white p-2 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-60 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"
          >
            {NAV.map(({ key, label, href, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition ${
                  active === key ? 'bg-[#f4f0ff] font-black text-[#7c3aed]' : 'font-semibold text-[#302945] hover:bg-[#f8f6ff]'
                }`}
              >
                <Icon className="size-[18px] text-[#7c3aed]" aria-hidden="true" />
                {label}
                {key === 'questions' && unanswered > 0 ? (
                  <span className="ml-auto rounded-full bg-[#e11d48] px-2 py-0.5 text-[10px] font-black text-white">{unanswered}</span>
                ) : null}
              </Link>
            ))}
          </nav>

          <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-5">
            {ready ? children : <DashboardContentSkeleton variant="overview" />}
          </main>
        </div>
      )}
    </div>
  );
}
