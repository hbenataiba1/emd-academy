'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Plus } from 'lucide-react';

import { ListSkeleton } from '@/components/instructor-skeletons';
import { getAcademyAuthHeader, getStoredAcademySession } from '@/lib/academy-session';

type CourseSummary = {
  id: string;
  title: string;
  subtitle: string | null;
  review_status: 'draft' | 'in_review' | 'changes_requested' | 'approved';
  review_note: string | null;
  is_published: boolean;
  price_cents: number;
  lesson_count: number;
  duration: string | null;
  submitted_at: string | null;
  updated_at: string;
};

export function courseStatusLabel(course: Pick<CourseSummary, 'review_status' | 'is_published'>) {
  if (course.is_published) return { label: 'Published', style: 'bg-[#e6f8ef] text-[#0f8a5f]' };
  switch (course.review_status) {
    case 'in_review':
      return { label: 'In review', style: 'bg-[#fff6e0] text-[#b7791f]' };
    case 'changes_requested':
      return { label: 'Changes requested', style: 'bg-[#ffe9e9] text-[#c0264b]' };
    case 'approved':
      return { label: 'Approved, waiting to go online', style: 'bg-[#e8f1ff] text-[#2563eb]' };
    default:
      return { label: 'Draft', style: 'bg-[#f1eef8] text-[#6e687d]' };
  }
}

export function AcademyInstructorCoursesPage() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getStoredAcademySession();
    if (!session) {
      window.location.assign('/academy/login?next=/academy/instructor/courses');
      return;
    }

    let active = true;
    fetch('/api/academy/instructor/courses', { headers: getAcademyAuthHeader(session) })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          courses?: CourseSummary[];
          message?: string;
        };
        if (!active) return;

        if (response.status === 401 || response.status === 403) {
          window.location.assign('/academy/instructor/apply');
          return;
        }
        if (!response.ok) {
          setError(payload.message || 'Your courses could not be loaded.');
          setCourses([]);
          return;
        }
        setCourses(payload.courses || []);
      })
      .catch(() => {
        if (active) {
          setError('Network error. Please try again.');
          setCourses([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function create() {
    const session = getStoredAcademySession();
    if (!session || creating) return;

    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/academy/instructor/courses', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!response.ok || !payload.id) {
        setError(payload.message || 'The course could not be created.');
        return;
      }
      window.location.assign(`/academy/instructor/courses/${encodeURIComponent(payload.id)}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <section>
        <h1 className="mt-4 text-3xl font-black">My courses</h1>
        <p className="mt-1 text-sm text-[#5f5872]">
          Build your course step by step, then send it to our team. We review it, design the cover and put it online.
        </p>

        <button
          type="button"
          onClick={() => void create()}
          disabled={creating}
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-6 text-sm font-black text-white transition hover:bg-[#6d31dc] disabled:opacity-60"
        >
          {creating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          New course
        </button>

        {error ? <p className="mt-4 text-sm font-semibold text-[#c0264b]">{error}</p> : null}

        <div className="mt-6 space-y-3">
          {courses === null ? (
            <ListSkeleton rows={3} />
          ) : courses.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d9d1ee] p-10 text-center text-sm text-[#6e687d]">
              You have no course yet. Give a title above to start your first one.
            </p>
          ) : (
            courses.map((course) => {
              const status = courseStatusLabel(course);
              return (
                <Link
                  key={course.id}
                  href={`/academy/instructor/courses/${encodeURIComponent(course.id)}`}
                  className="block rounded-2xl border border-[#e4ddf4] bg-white p-5 transition hover:border-[#7c3aed]/50 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-black">{course.title}</h2>
                      <p className="mt-1 text-xs font-medium text-[#6e687d]">
                        {course.lesson_count} lesson{course.lesson_count === 1 ? '' : 's'}
                        {course.duration ? ` · ${course.duration}` : ''} ·{' '}
                        {course.price_cents ? `$${(course.price_cents / 100).toFixed(2)}` : 'Free'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${status.style}`}>{status.label}</span>
                  </div>
                  {course.review_status === 'changes_requested' && course.review_note ? (
                    <p className="mt-3 rounded-xl bg-[#fff8f8] p-3 text-sm text-[#5a2b2b]">
                      <strong>From the team:</strong> {course.review_note}
                    </p>
                  ) : null}
                </Link>
              );
            })
          )}
        </div>
      </section>

    </>
  );
}
