'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Building2,
  Camera,
  KeyRound,
  Landmark,
  Mail,
  Send,
  User,
  LayoutDashboard,
  LoaderCircle,
  MessageSquare,
  Receipt,
  Star,
  Tag,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';

import { AcademyAvatar } from '@/components/academy-avatar';
import { useConfirm } from '@/components/confirm-dialog';
import { StatCardsSkeleton, TableSkeleton } from '@/components/instructor-skeletons';
import {
  getAcademyAuthHeader,
  getAcademyDisplayName,
  getStoredAcademySession,
  getAcademyAvatarUrl,
  updateAcademyProfile,
} from '@/lib/academy-session';
import { uploadAcademyAvatar } from '@/lib/academy-avatar-upload';

export type WorkspaceSection =
  | 'overview'
  | 'enrollments'
  | 'learners'
  | 'certificates'
  | 'questions'
  | 'coupons'
  | 'reviews'
  | 'earnings'
  | 'payment'
  | 'profile';

type Overview = {
  courses: number;
  published: number;
  enrollments: number;
  learners: number;
  certificates: number;
  reviews: number;
  rating: number;
  unanswered: number;
};

const inputClass =
  'w-full rounded-xl border border-[#d9d1ee] bg-white px-4 py-2.5 text-sm text-[#191625] outline-none transition placeholder:text-[#9a93ad] focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10';

const card = 'rounded-2xl border border-[#e4ddf4] bg-white shadow-sm';

function authHeaders(json = false) {
  const session = getStoredAcademySession();
  return { ...(json ? { 'content-type': 'application/json' } : {}), ...(session ? getAcademyAuthHeader(session) : {}) };
}

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';
}

/** Loads one of the instructor endpoints. */
function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const response = await fetch(path, { headers: authHeaders(), cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
      if (!response.ok) {
        setError(payload.message || 'This could not be loaded.');
        return;
      }
      setError('');
      setData(payload);
    } catch {
      setError('Network error. Please try again.');
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload };
}

const NAV: { key: WorkspaceSection; label: string; href: string; icon: typeof BookOpen }[] = [
  { key: 'overview', label: 'Overview', href: '/academy/instructor', icon: LayoutDashboard },
  { key: 'enrollments', label: 'Enrollments', href: '/academy/instructor/enrollments', icon: Receipt },
  { key: 'learners', label: 'Learners', href: '/academy/instructor/learners', icon: Users },
  { key: 'certificates', label: 'Certificates', href: '/academy/instructor/certificates', icon: Trophy },
  { key: 'questions', label: 'Lesson questions', href: '/academy/instructor/questions', icon: MessageSquare },
  { key: 'coupons', label: 'Coupons', href: '/academy/instructor/coupons', icon: Tag },
  { key: 'reviews', label: 'Reviews', href: '/academy/instructor/reviews', icon: Star },
  { key: 'earnings', label: 'Earnings', href: '/academy/instructor/earnings', icon: Wallet },
];

/** One page of the instructor dashboard, inside the dashboard frame. */
export function InstructorWorkspace({ section }: { section: WorkspaceSection }) {
  return (
    <>
      {section === 'overview' ? <OverviewSection /> : null}
      {section === 'enrollments' || section === 'learners' || section === 'certificates' ? <PeopleSection view={section} /> : null}
      {section === 'questions' ? <QuestionsSection onChanged={() => window.dispatchEvent(new Event('instructor-questions-changed'))} /> : null}
      {section === 'coupons' ? <CouponsSection /> : null}
      {section === 'reviews' ? <ReviewsSection /> : null}
      {section === 'earnings' ? <EarningsSection /> : null}
      {section === 'payment' ? <PaymentSection /> : null}
      {section === 'profile' ? <ProfileSection /> : null}
    </>
  );
}

function Title({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-[#5f5872]">{text}</p>
    </div>
  );
}

function Loading({ error }: { error: string }) {
  return error ? (
    <p className="text-sm font-semibold text-[#c0264b]">{error}</p>
  ) : (
    <TableSkeleton rows={5} columns={5} />
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[#d9d1ee] bg-white p-10 text-center text-sm text-[#6e687d]">{text}</p>;
}

/* ── Overview ── */
function OverviewSection() {
  const [name, setName] = useState('');
  const { data: overview } = useApi<Overview>('/api/academy/instructor/overview');

  useEffect(() => {
    const session = getStoredAcademySession();
    if (session) setName(getAcademyDisplayName(session));
  }, []);

  const stats = overview
    ? [
        { label: 'Courses', value: `${overview.published} / ${overview.courses}`, hint: 'published / total', href: '/academy/instructor/courses' },
        { label: 'Learners', value: overview.learners, hint: 'enrolled in your courses', href: '/academy/instructor/learners' },
        { label: 'Enrollments', value: overview.enrollments, hint: 'in total', href: '/academy/instructor/enrollments' },
        { label: 'Certificates', value: overview.certificates, hint: 'earned by learners', href: '/academy/instructor/certificates' },
        { label: 'Rating', value: overview.reviews ? overview.rating.toFixed(1) : '—', hint: `${overview.reviews} review${overview.reviews === 1 ? '' : 's'}`, href: '/academy/instructor/reviews' },
        { label: 'Questions to answer', value: overview.unanswered, hint: 'waiting for you', href: '/academy/instructor/questions' },
      ]
    : [];

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-[#3b0764] to-[#7c3aed] p-6 text-white shadow-lg sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#34d4c6]">Instructor dashboard</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Welcome, {name.split(' ')[0]}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#e2d8ff]">
          Create your courses, follow your learners and answer their questions.
        </p>
      </div>

      {overview ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} className={`${card} p-5 transition hover:border-[#7c3aed]/50`}>
              <p className="text-xs font-black uppercase tracking-wider text-[#6e687d]">{stat.label}</p>
              <p className="mt-2 text-3xl font-black">{stat.value}</p>
              <p className="mt-1 text-xs text-[#8e879f]">{stat.hint}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <StatCardsSkeleton />
        </div>
      )}

      <p className="mt-8 text-sm text-[#5f5872]">
        Questions? Write to us at{' '}
        <a href="mailto:contacts@easymedicaldevice.com" className="font-semibold text-[#7c3aed] underline">
          contacts@easymedicaldevice.com
        </a>
        .
      </p>
    </>
  );
}

/* ── Enrollments, learners and certificates ── */
type Person = {
  id: string;
  userId: string;
  name: string;
  email: string;
  courseId: string;
  courseTitle: string;
  amountCents: number;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  lastActivity: string | null;
  certificateNumber: string | null;
  certificateIssuedAt: string | null;
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[#ece8f7]">
        <div className={`h-full rounded-full ${value >= 100 ? 'bg-[#10b981]' : 'bg-[#7c3aed]'}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-black">{value}%</span>
    </div>
  );
}

function PeopleSection({ view }: { view: 'enrollments' | 'learners' | 'certificates' }) {
  const { data, error } = useApi<{ rows: Person[] }>('/api/academy/instructor/learners');
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('all');

  const rows = useMemo(() => data?.rows || [], [data]);
  const courses = useMemo(() => [...new Map(rows.map((row) => [row.courseId, row.courseTitle])).entries()], [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (course === 'all' || row.courseId === course) &&
        (!query || `${row.name} ${row.email} ${row.courseTitle}`.toLowerCase().includes(query)),
    );
  }, [rows, search, course]);

  const learners = useMemo(() => {
    const map = new Map<string, { name: string; email: string; courses: Person[] }>();
    filtered.forEach((row) => {
      const entry = map.get(row.userId) || { name: row.name, email: row.email, courses: [] };
      entry.courses.push(row);
      map.set(row.userId, entry);
    });
    return [...map.values()];
  }, [filtered]);

  const titles = {
    enrollments: ['Enrollments', 'Everyone who enrolled in one of your courses.'],
    learners: ['Learners', 'The people learning with you and how far they are.'],
    certificates: ['Certificates', 'Learners who passed the final exam of your courses.'],
  } as const;

  return (
    <>
      <Title title={titles[view][0]} text={titles[view][1]} />
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <input className={`${inputClass} max-w-xs`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, course..." />
            <select className={`${inputClass} max-w-xs`} value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="all">All courses</option>
              {courses.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </div>

          {view === 'enrollments' ? (
            filtered.length === 0 ? (
              <Empty text="No enrollment yet." />
            ) : (
              <Table head={['Learner', 'Course', 'Paid', 'Progress', 'Enrolled']}>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-[#f0ecf9]">
                    <Cell>
                      <b>{row.name}</b>
                      <div className="text-xs text-[#8e879f]">{row.email}</div>
                    </Cell>
                    <Cell>{row.courseTitle}</Cell>
                    <Cell>{row.amountCents ? `$${(row.amountCents / 100).toFixed(2)}` : 'Free'}</Cell>
                    <Cell>
                      <ProgressBar value={row.progress} />
                      <div className="text-[11px] text-[#8e879f]">{row.lessonsDone} of {row.lessonsTotal} lessons</div>
                    </Cell>
                    <Cell>{formatDate(row.enrolledAt)}</Cell>
                  </tr>
                ))}
              </Table>
            )
          ) : null}

          {view === 'learners' ? (
            learners.length === 0 ? (
              <Empty text="No learner yet." />
            ) : (
              <Table head={['Learner', 'Courses', 'Average progress', 'Certificates', 'Last activity']}>
                {learners.map((learner) => {
                  const average = Math.round(learner.courses.reduce((sum, row) => sum + row.progress, 0) / learner.courses.length);
                  const last = learner.courses.map((row) => row.lastActivity).filter(Boolean).sort().pop();
                  return (
                    <tr key={learner.email} className="border-t border-[#f0ecf9]">
                      <Cell>
                        <b>{learner.name}</b>
                        <div className="text-xs text-[#8e879f]">{learner.email}</div>
                      </Cell>
                      <Cell>{learner.courses.map((row) => row.courseTitle).join(', ')}</Cell>
                      <Cell><ProgressBar value={average} /></Cell>
                      <Cell>{learner.courses.filter((row) => row.certificateNumber).length}</Cell>
                      <Cell>{formatDate(last)}</Cell>
                    </tr>
                  );
                })}
              </Table>
            )
          ) : null}

          {view === 'certificates' ? (
            filtered.filter((row) => row.certificateNumber).length === 0 ? (
              <Empty text="No certificate yet." />
            ) : (
              <Table head={['Learner', 'Course', 'Certificate', 'Issued']}>
                {filtered
                  .filter((row) => row.certificateNumber)
                  .map((row) => (
                    <tr key={row.id} className="border-t border-[#f0ecf9]">
                      <Cell>
                        <b>{row.name}</b>
                        <div className="text-xs text-[#8e879f]">{row.email}</div>
                      </Cell>
                      <Cell>{row.courseTitle}</Cell>
                      <Cell>
                        <a href={`/academy/verify/${row.certificateNumber}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-bold text-[#7c3aed] underline">
                          {row.certificateNumber}
                        </a>
                      </Cell>
                      <Cell>{formatDate(row.certificateIssuedAt)}</Cell>
                    </tr>
                  ))}
              </Table>
            )
          ) : null}
        </>
      )}
    </>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-left text-sm">
        <thead className="bg-[#faf8ff] text-[11px] font-black uppercase tracking-wider text-[#6e687d]">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-4 py-3">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

/* ── Lesson questions ── */
type Post = {
  id: string;
  author: string;
  avatar: string | null;
  email: string | null;
  isStaff: boolean;
  isInstructor: boolean;
  mine: boolean;
  body: string;
  createdAt: string;
};
type Thread = { root: Post; replies: Post[]; courseTitle: string; lessonTitle: string; answered: boolean };

function QuestionsSection({ onChanged }: { onChanged: () => void }) {
  const { confirm, dialog } = useConfirm();
  const { data, error, reload } = useApi<{ threads: Thread[]; available?: boolean }>('/api/academy/instructor/questions');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  async function send(parentId: string) {
    if (!text.trim() || saving) return;
    setSaving(true);
    setProblem('');
    try {
      const response = await fetch('/api/academy/instructor/questions', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ parentId, body: text }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setProblem(payload.message || 'Your answer could not be sent.');
        return;
      }
      setText('');
      setReplyTo(null);
      await reload();
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({ title: 'Delete your answer?', message: 'The learner will no longer see it.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await fetch(`/api/academy/instructor/questions?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
    await reload();
    onChanged();
  }

  const threads = (data?.threads || []).filter((thread) => !onlyOpen || !thread.answered);

  return (
    <>
      {dialog}
      <Title title="Lesson questions" text="Questions learners ask under your lessons. Your answer is emailed to the learner." />
      {!data ? (
        <Loading error={error} />
      ) : data.available === false ? (
        <Empty text="Questions are not available yet." />
      ) : (
        <>
          <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#3b3650]">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="size-4 accent-[#7c3aed]" />
            Only questions waiting for an answer
          </label>
          {problem ? <p className="mb-3 text-sm font-semibold text-[#c0264b]">{problem}</p> : null}

          {threads.length === 0 ? (
            <Empty text={onlyOpen ? 'Nothing is waiting for you.' : 'No question yet.'} />
          ) : (
            <div className="space-y-4">
              {threads.map((thread) => (
                <div key={thread.root.id} className={`${card} p-5`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="rounded-full bg-[#f4f0ff] px-2.5 py-0.5 text-[#7c3aed]">{thread.courseTitle}</span>
                    <span className="text-[#8e879f]">Lesson: {thread.lessonTitle}</span>
                    {!thread.answered ? <span className="rounded-full bg-[#fff6e0] px-2.5 py-0.5 text-[#b7791f]">Waiting for an answer</span> : null}
                  </div>

                  <PostLine post={thread.root} />
                  {thread.replies.length > 0 ? (
                    <div className="mt-3 space-y-3 border-l-2 border-[#ede8fb] pl-4">
                      {thread.replies.map((reply) => (
                        <PostLine key={reply.id} post={reply} onDelete={reply.mine ? () => void remove(reply.id) : undefined} />
                      ))}
                    </div>
                  ) : null}

                  {replyTo === thread.root.id ? (
                    <div className="mt-4 flex items-start gap-2">
                      <textarea
                        className={`${inputClass} flex-1`}
                        rows={3}
                        autoFocus
                        maxLength={2000}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={`Answer ${thread.root.author}`}
                      />
                      <button
                        type="button"
                        onClick={() => void send(thread.root.id)}
                        disabled={saving || !text.trim()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7c3aed] px-4 text-sm font-black text-white hover:bg-[#6d31dc] disabled:opacity-50"
                      >
                        {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                        Send
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setReplyTo(thread.root.id); setText(''); }} className="mt-3 text-xs font-bold text-[#7c3aed] hover:underline">
                      Answer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function PostLine({ post, onDelete }: { post: Post; onDelete?: () => void }) {
  return (
    <div className="flex items-start gap-3">
      {post.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.avatar} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${post.isStaff ? 'bg-[#7c3aed]' : 'bg-[#a89fc0]'}`}>
          {(post.author.trim()[0] || '?').toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <b>{post.author}</b>
          {post.isStaff ? (
            <span className="rounded-full bg-[#7c3aed] px-2 py-0.5 text-[10px] font-bold uppercase text-white">{post.isInstructor ? 'Instructor' : 'Team'}</span>
          ) : post.email ? (
            <span className="text-xs text-[#8e879f]">{post.email}</span>
          ) : null}
          <span className="text-xs text-[#8e879f]">{formatDate(post.createdAt)}</span>
          {onDelete ? (
            <button type="button" onClick={onDelete} className="ml-auto text-xs font-bold text-[#c0264b] hover:underline">
              Delete
            </button>
          ) : null}
        </div>
        <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-[#3b3650]">{post.body}</p>
      </div>
    </div>
  );
}

/* ── Coupons ── */
type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: 'percent' | 'amount';
  percentOff: number | null;
  amountOffCents: number | null;
  maxRedemptions: number | null;
  maxPerUser: number;
  expiresAt: string | null;
  courseIds: string[];
  isActive: boolean;
  redeemed: number;
};

function CouponsSection() {
  const { confirm, dialog } = useConfirm();
  const { data, error, reload } = useApi<{ available?: boolean; coupons: Coupon[]; courses: { id: string; title: string }[] }>('/api/academy/instructor/coupons');
  const [form, setForm] = useState({ code: '', discountType: 'percent', value: '20', maxRedemptions: '', maxPerUser: '1', expiresAt: '', courseIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setProblem('');
    try {
      const response = await fetch('/api/academy/instructor/coupons', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          value: Number(form.value),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
          maxPerUser: Number(form.maxPerUser || 1),
          expiresAt: form.expiresAt || null,
          courseIds: form.courseIds,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setProblem(payload.message || 'The coupon could not be saved.');
        return;
      }
      setForm({ ...form, code: '', maxRedemptions: '' });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(coupon: Coupon) {
    await fetch('/api/academy/instructor/coupons', {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ id: coupon.id, isActive: !coupon.isActive }),
    });
    await reload();
  }

  async function remove(coupon: Coupon) {
    const ok = await confirm({
      title: `Delete the coupon ${coupon.code}?`,
      message: 'Learners will not be able to use it any more.',
      confirmLabel: 'Delete the coupon',
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/academy/instructor/coupons?id=${encodeURIComponent(coupon.id)}`, { method: 'DELETE', headers: authHeaders() });
    await reload();
  }

  return (
    <>
      {dialog}
      <Title title="Coupons" text="Discount codes that work on your courses only." />
      {!data ? (
        <Loading error={error} />
      ) : data.available === false ? (
        <Empty text="Coupons are not available yet." />
      ) : (
        <>
          <form onSubmit={create} className={`${card} mb-6 space-y-4 p-5 sm:p-6`}>
            <h2 className="text-base font-black">New coupon</h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="block text-sm font-bold sm:col-span-2">
                Code
                <input className={`${inputClass} mt-1.5 uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WELCOME20" maxLength={32} required />
              </label>
              <label className="block text-sm font-bold">
                Discount
                <select className={`${inputClass} mt-1.5`} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value, value: e.target.value === 'percent' ? '20' : '10' })}>
                  <option value="percent">Percent %</option>
                  <option value="amount">Fixed $</option>
                </select>
              </label>
              <label className="block text-sm font-bold">
                Value
                <input className={`${inputClass} mt-1.5`} type="number" min={1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
              </label>
              <label className="block text-sm font-bold">
                Total uses
                <input className={`${inputClass} mt-1.5`} type="number" min={1} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} placeholder="Unlimited" />
              </label>
              <label className="block text-sm font-bold">
                Uses per learner
                <input className={`${inputClass} mt-1.5`} type="number" min={1} value={form.maxPerUser} onChange={(e) => setForm({ ...form, maxPerUser: e.target.value })} />
              </label>
              <label className="block text-sm font-bold sm:col-span-2">
                Ends on (optional)
                <input className={`${inputClass} mt-1.5`} type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-bold">Works on</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.courses.length === 0 ? <span className="text-sm text-[#8e879f]">Create a course first.</span> : null}
                {data.courses.map((course) => {
                  const on = form.courseIds.includes(course.id);
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setForm({ ...form, courseIds: on ? form.courseIds.filter((id) => id !== course.id) : [...form.courseIds, course.id] })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${on ? 'border-[#7c3aed] bg-[#7c3aed] text-white' : 'border-[#d9d1ee] bg-white text-[#3b3650]'}`}
                    >
                      {course.title}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {problem ? <p className="text-sm font-semibold text-[#c0264b]">{problem}</p> : null}
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#7c3aed] px-5 text-sm font-black text-white hover:bg-[#6d31dc] disabled:opacity-60">
              {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              Create coupon
            </button>
          </form>

          {data.coupons.length === 0 ? (
            <Empty text="You have no coupon yet." />
          ) : (
            <Table head={['Code', 'Discount', 'Used', 'Ends', 'Courses', '']}>
              {data.coupons.map((coupon) => (
                <tr key={coupon.id} className="border-t border-[#f0ecf9]">
                  <Cell>
                    <b className="font-mono">{coupon.code}</b>
                    {!coupon.isActive ? <span className="ml-2 rounded-full bg-[#f1eef8] px-2 py-0.5 text-[10px] font-bold text-[#6e687d]">Off</span> : null}
                  </Cell>
                  <Cell>{coupon.discountType === 'percent' ? `${coupon.percentOff}%` : `$${((coupon.amountOffCents || 0) / 100).toFixed(2)}`}</Cell>
                  <Cell>{coupon.redeemed}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ''}</Cell>
                  <Cell>{formatDate(coupon.expiresAt)}</Cell>
                  <Cell>{coupon.courseIds.map((id) => data.courses.find((course) => course.id === id)?.title || id).join(', ')}</Cell>
                  <Cell>
                    <div className="flex gap-3 text-xs font-bold">
                      <button type="button" onClick={() => void toggle(coupon)} className="text-[#7c3aed] hover:underline">
                        {coupon.isActive ? 'Turn off' : 'Turn on'}
                      </button>
                      <button type="button" onClick={() => void remove(coupon)} className="text-[#c0264b] hover:underline">
                        Delete
                      </button>
                    </div>
                  </Cell>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </>
  );
}

/* ── Reviews ── */
type Review = { id: string; courseTitle: string; learnerName: string; rating: number; comment: string | null; date: string };

function ReviewsSection() {
  const { data, error } = useApi<{ reviews: Review[] }>('/api/academy/instructor/reviews');
  const reviews = data?.reviews || [];
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0;

  return (
    <>
      <Title title="Reviews" text="What learners say at the end of your courses." />
      {!data ? (
        <Loading error={error} />
      ) : reviews.length === 0 ? (
        <Empty text="No review yet." />
      ) : (
        <>
          <div className={`${card} mb-5 flex items-center gap-4 p-5`}>
            <p className="text-4xl font-black text-[#f59e0b]">{average.toFixed(1)}</p>
            <div>
              <Stars value={average} />
              <p className="mt-1 text-xs text-[#8e879f]">from {reviews.length} review{reviews.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className={`${card} p-5`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={review.rating} />
                  <span className="rounded-full bg-[#f4f0ff] px-2.5 py-0.5 text-[11px] font-bold text-[#7c3aed]">{review.courseTitle}</span>
                </div>
                <p className="mt-1 text-xs text-[#8e879f]"><b className="text-[#3b3650]">{review.learnerName}</b> · {formatDate(review.date)}</p>
                {review.comment ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3b3650]">{review.comment}</p> : null}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex text-lg leading-none" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= Math.round(value) ? 'text-[#f59e0b]' : 'text-[#d6d0e6]'}>★</span>
      ))}
    </span>
  );
}

/* ── Earnings ── */
type EarningsData = {
  available: boolean;
  commissionPercent: number;
  hasPaymentDetails?: boolean;
  holdDays: number;
  availableCents: number;
  pendingCents: number;
  paidCents: number;
  salesCents: number;
  rows: {
    id: string;
    kind: 'sale' | 'refund';
    date: string;
    courseTitle: string;
    learner: string;
    grossCents: number;
    commissionPercent: number;
    platformCents: number;
    netCents: number;
    status: 'pending' | 'available' | 'paid';
    availableAt: string;
  }[];
  payouts: { id: string; amountCents: number; method: string; reference: string | null; paidAt: string }[];
};

const money = (cents: number) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;

const STATUS_STYLE = {
  pending: 'bg-[#fff6e0] text-[#b7791f]',
  available: 'bg-[#e8f1ff] text-[#2563eb]',
  paid: 'bg-[#e6f8ef] text-[#0f8a5f]',
} as const;

const STATUS_LABEL = { pending: 'In waiting period', available: 'Ready to be paid', paid: 'Paid' } as const;

function EarningsSection() {
  const { data, error } = useApi<EarningsData>('/api/academy/instructor/earnings');

  return (
    <>
      <Title title="Earnings" text="Your sales, what you earn from them, and the payments we send you." />
      {!data ? (
        <Loading error={error} />
      ) : data.available === false ? (
        <Empty text="Earnings are not available yet." />
      ) : (
        <>
          {data.hasPaymentDetails === false ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f6d58f] bg-[#fff8e6] p-4">
              <p className="text-sm font-semibold text-[#7a5a0a]">
                Tell us where to send your money: add your payment details (bank, PayPal or Wise).
              </p>
              <Link href="/academy/instructor/payment" className="rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-black text-white hover:bg-[#6d31dc]">
                Add payment details
              </Link>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`${card} p-5`}>
              <p className="text-xs font-black uppercase tracking-wider text-[#6e687d]">Ready to be paid</p>
              <p className="mt-2 text-3xl font-black text-[#2563eb]">{money(data.availableCents)}</p>
              <p className="mt-1 text-xs text-[#8e879f]">our team sends it to you</p>
            </div>
            <div className={`${card} p-5`}>
              <p className="text-xs font-black uppercase tracking-wider text-[#6e687d]">In waiting period</p>
              <p className="mt-2 text-3xl font-black text-[#b7791f]">{money(data.pendingCents)}</p>
              <p className="mt-1 text-xs text-[#8e879f]">ready {data.holdDays} days after each sale</p>
            </div>
            <div className={`${card} p-5`}>
              <p className="text-xs font-black uppercase tracking-wider text-[#6e687d]">Paid to you</p>
              <p className="mt-2 text-3xl font-black text-[#0f8a5f]">{money(data.paidCents)}</p>
              <p className="mt-1 text-xs text-[#8e879f]">{data.payouts.length} payment{data.payouts.length === 1 ? '' : 's'}</p>
            </div>
            <div className={`${card} p-5`}>
              <p className="text-xs font-black uppercase tracking-wider text-[#6e687d]">Total sales</p>
              <p className="mt-2 text-3xl font-black">{money(data.salesCents)}</p>
              <p className="mt-1 text-xs text-[#8e879f]">you keep {100 - data.commissionPercent}% of each sale</p>
            </div>
          </div>

          <p className="mt-4 rounded-xl bg-[#f6f4fb] p-4 text-xs leading-5 text-[#6e687d]">
            The Academy keeps {data.commissionPercent}% of each sale and you keep the rest. A sale becomes ready to be
            paid {data.holdDays} days later, which is the time learners have to ask for a refund. A refunded sale is taken
            back from your balance.
          </p>

          <h2 className="mb-3 mt-8 text-lg font-black">Sales</h2>
          {data.rows.length === 0 ? (
            <Empty text="No sale yet. When a learner buys one of your courses, it appears here." />
          ) : (
            <Table head={['Date', 'Course', 'Learner', 'Paid', 'Academy share', 'You earn', 'Status']}>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-t border-[#f0ecf9]">
                  <Cell>{formatDate(row.date)}</Cell>
                  <Cell>
                    {row.courseTitle}
                    {row.kind === 'refund' ? <span className="ml-2 rounded-full bg-[#ffe9e9] px-2 py-0.5 text-[10px] font-bold text-[#c0264b]">Refund</span> : null}
                  </Cell>
                  <Cell>{row.learner}</Cell>
                  <Cell>{money(row.grossCents)}</Cell>
                  <Cell>{money(row.platformCents)} ({row.commissionPercent}%)</Cell>
                  <Cell><b className={row.netCents < 0 ? 'text-[#c0264b]' : ''}>{money(row.netCents)}</b></Cell>
                  <Cell>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                    {row.status === 'pending' ? <div className="mt-1 text-[11px] text-[#8e879f]">ready {formatDate(row.availableAt)}</div> : null}
                  </Cell>
                </tr>
              ))}
            </Table>
          )}

          <h2 className="mb-3 mt-8 text-lg font-black">Payments we sent you</h2>
          {data.payouts.length === 0 ? (
            <Empty text="No payment yet." />
          ) : (
            <Table head={['Date', 'Amount', 'Method', 'Reference']}>
              {data.payouts.map((payout) => (
                <tr key={payout.id} className="border-t border-[#f0ecf9]">
                  <Cell>{formatDate(payout.paidAt)}</Cell>
                  <Cell><b>{money(payout.amountCents)}</b></Cell>
                  <Cell>{payout.method}</Cell>
                  <Cell>{payout.reference || '—'}</Cell>
                </tr>
              ))}
            </Table>
          )}
        </>
      )}
    </>
  );
}

/* ── Payment details ── */
type PayMethod = 'bank' | 'paypal' | 'wise' | 'other';

const METHODS: { key: PayMethod; label: string; text: string; icon: typeof Landmark }[] = [
  { key: 'bank', label: 'Bank transfer', text: 'IBAN or account number', icon: Landmark },
  { key: 'paypal', label: 'PayPal', text: 'Your PayPal email', icon: Wallet },
  { key: 'wise', label: 'Wise', text: 'Your Wise email', icon: Send },
  { key: 'other', label: 'Other', text: 'Explain how to pay you', icon: Building2 },
];

function PaymentSection() {
  const { data, error, reload } = useApi<{ available?: boolean; method: PayMethod | null; details: Record<string, string>; updatedAt?: string | null }>(
    '/api/academy/instructor/payment-details',
  );
  const [method, setMethod] = useState<PayMethod>('bank');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (data.method) setMethod(data.method);
    setValues(data.details || {});
  }, [data]);

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setProblem('');
    try {
      const response = await fetch('/api/academy/instructor/payment-details', {
        method: 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify({ method, details: values }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setProblem(payload.message || 'Your payment details could not be saved.');
        return;
      }
      setSaved(true);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  const field = (key: string, label: string, placeholder: string, icon: typeof User, type = 'text') => {
    const Icon = icon;
    return (
      <label className="block">
        <span className="text-sm font-bold text-[#302945]">{label}</span>
        <div className="relative mt-1.5">
          <Icon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#9a93ad]" aria-hidden="true" />
          <input
            className={`${inputClass} pl-11`}
            type={type}
            value={values[key] || ''}
            onChange={(event) => set(key, event.target.value)}
            placeholder={placeholder}
          />
        </div>
      </label>
    );
  };

  return (
    <>
      <Title title="Payment details" text="Tell us how you want to be paid. Our team uses these details to send you your earnings." />
      {!data ? (
        <Loading error={error} />
      ) : data.available === false ? (
        <Empty text="Payment details are not available yet." />
      ) : (
        <form onSubmit={save} className={`${card} max-w-3xl space-y-6 p-5 sm:p-8`}>
          <div>
            <p className="text-sm font-black">How do you want to be paid?</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {METHODS.map(({ key, label, text, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMethod(key);
                    setSaved(false);
                  }}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                    method === key ? 'border-[#7c3aed] bg-[#f4f0ff]' : 'border-[#e4ddf4] bg-white hover:border-[#c4b5fd]'
                  }`}
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${method === key ? 'bg-[#7c3aed] text-white' : 'bg-[#f1ebff] text-[#7c3aed]'}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-black">{label}</span>
                    <span className="block text-xs text-[#6e687d]">{text}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {method === 'bank' ? (
              <>
                {field('account_holder', 'Account holder name *', 'Full name on the bank account', User)}
                {field('iban', 'IBAN or account number *', 'e.g. FR76 3000 6000 0112 3456 7890 189', Landmark)}
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('bic', 'BIC / SWIFT', 'e.g. AGRIFRPP', Landmark)}
                  {field('bank_name', 'Bank name', 'e.g. Crédit Agricole', Building2)}
                </div>
                {field('bank_country', 'Country of the bank', 'e.g. France', Building2)}
              </>
            ) : null}
            {method === 'paypal' ? field('paypal_email', 'PayPal email *', 'you@example.com', Mail, 'email') : null}
            {method === 'wise' ? (
              <>
                {field('account_holder', 'Full name on Wise *', 'Your full name', User)}
                {field('wise_email', 'Wise email *', 'you@example.com', Mail, 'email')}
              </>
            ) : null}
            {method === 'other' ? (
              <label className="block">
                <span className="text-sm font-bold text-[#302945]">How should we pay you? *</span>
                <textarea
                  className={`${inputClass} mt-1.5`}
                  rows={5}
                  value={values.instructions || ''}
                  onChange={(event) => set('instructions', event.target.value)}
                  placeholder="Explain the method and give the details we need."
                  maxLength={800}
                />
              </label>
            ) : null}
          </div>

          <p className="rounded-xl bg-[#f6f4fb] p-4 text-xs leading-5 text-[#6e687d]">
            Only you and the Academy team can see these details. You can change them at any time. Check them carefully:
            we send your earnings to exactly what you write here.
          </p>

          {problem ? <p className="text-sm font-semibold text-[#c0264b]">{problem}</p> : null}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7c3aed] px-7 text-sm font-black text-white transition hover:bg-[#6d31dc] disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save my payment details
            </button>
            {saved ? <span className="text-sm font-bold text-[#0f8a5f]">Saved</span> : null}
          </div>
        </form>
      )}
    </>
  );
}

/* ── My profile: photo and password ── */
function ProfileSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const session = getStoredAcademySession();
    if (!session) return;
    setName(getAcademyDisplayName(session));
    setEmail(session.user.email || '');
    setPhoto(getAcademyAvatarUrl(session) || '');
  }, []);

  async function choosePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setFeedback(null);
    try {
      const url = await uploadAcademyAvatar(file);
      // The photo is saved right away: it then shows next to your answers and everywhere else.
      const result = await updateAcademyProfile({ avatarUrl: url });
      if (!result.ok) throw new Error(result.message || 'The photo could not be saved.');
      setPhoto(url);
      setFeedback({ ok: true, text: 'Your photo was updated. It now shows next to your answers.' });
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : 'The photo could not be uploaded.' });
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setSaving(true);
    const result = await updateAcademyProfile({ avatarUrl: '' });
    setSaving(false);
    if (result.ok) {
      setPhoto('');
      setFeedback({ ok: true, text: 'Your photo was removed.' });
    } else {
      setFeedback({ ok: false, text: result.message || 'The photo could not be removed.' });
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      setFeedback({ ok: false, text: 'The new password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ ok: false, text: 'The two passwords do not match.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    const result = await updateAcademyProfile({ password });
    setSaving(false);
    if (result.ok) {
      setPassword('');
      setConfirmPassword('');
      setFeedback({ ok: true, text: 'Your password was changed.' });
    } else {
      setFeedback({ ok: false, text: result.message || 'The password could not be changed.' });
    }
  }

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Title title="My profile" text="Your photo appears next to your answers to your learners and on your courses." />

      <div className="max-w-3xl space-y-6">
        {feedback ? (
          <p className={`rounded-xl border p-4 text-sm font-semibold ${feedback.ok ? 'border-[#c2ebd3] bg-[#f2fbf6] text-[#0f766e]' : 'border-[#fecdca] bg-[#fffbfa] text-[#b42318]'}`}>
            {feedback.text}
          </p>
        ) : null}

        <div className={`${card} p-5 sm:p-8`}>
          <div className="flex flex-wrap items-center gap-6">
            <AcademyAvatar
              src={photo}
              alt={name}
              initials={initials || 'IN'}
              imageClassName="size-24 rounded-full border-2 border-[#dcd5ee] object-cover"
              fallbackClassName="flex size-24 items-center justify-center rounded-full bg-[#7c3aed] text-3xl font-black text-white"
            />
            <div>
              <p className="text-lg font-black">{name}</p>
              <p className="text-sm text-[#6e687d]">{email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#7c3aed] px-5 text-sm font-black text-white transition hover:bg-[#6d31dc]">
                  {uploading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
                  {photo ? 'Change my photo' : 'Add my photo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={choosePhoto} disabled={uploading} />
                </label>
                {photo ? (
                  <button type="button" onClick={() => void removePhoto()} disabled={saving} className="text-sm font-bold text-[#c0264b] hover:underline">
                    Remove
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-[#8e879f]">PNG, JPG or WebP, up to 2 MB. A clear photo of your face works best.</p>
            </div>
          </div>
        </div>

        <form onSubmit={changePassword} className={`${card} space-y-4 p-5 sm:p-8`}>
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-[#7c3aed]" aria-hidden="true" />
            <h2 className="text-base font-black">Change my password</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold">
              New password
              <input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="block text-sm font-bold">
              Confirm the new password
              <input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || !password}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d9d1ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:border-[#7c3aed] disabled:opacity-50"
          >
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            Change the password
          </button>
        </form>
      </div>
    </>
  );
}
