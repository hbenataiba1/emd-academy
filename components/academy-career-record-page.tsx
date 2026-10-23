'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Award, Clock, Download, LoaderCircle, Trophy } from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import {
  getAcademyAuthHeader,
  getStoredAcademySession,
} from '@/lib/academy-session';
import {
  type CareerCourseInput,
  CAREER_LEVELS,
  buildCareerRecord,
  downloadCareerRecordPdf,
  formatHours,
} from '@/lib/career-record';

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AcademyCareerRecordPage() {
  const [courses, setCourses] = useState<CareerCourseInput[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const session = getStoredAcademySession();
    if (!session) {
      window.location.assign('/academy/login?next=/academy/career-record');
      return;
    }

    let active = true;

    fetch('/api/academy/me', { headers: getAcademyAuthHeader(session) })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          courses?: CareerCourseInput[];
          user?: { name?: string };
          message?: string;
        };

        if (!active) return;

        if (response.status === 401) {
          window.location.assign('/academy/login?next=/academy/career-record');
          return;
        }

        if (!response.ok) {
          setError(payload.message || 'Your career record could not be loaded.');
          return;
        }

        setName(payload.user?.name || '');
        setCourses(payload.courses || []);
      })
      .catch(() => {
        if (active) setError('Network error. Please try again.');
      });

    return () => {
      active = false;
    };
  }, []);

  const record = useMemo(() => (courses ? buildCareerRecord(courses) : null), [courses]);

  async function download() {
    if (!record || downloading) return;
    setDownloading(true);
    try {
      await downloadCareerRecordPdf(record, name || 'Learner');
    } catch {
      setError('The PDF could not be created. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="career" />

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/academy/my-learning"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#625b75] transition hover:text-[#7c3aed]"
        >
          <ArrowLeft className="size-4" />
          Back to my learning
        </Link>

        {error ? (
          <div className="mt-6 rounded-xl border border-[#efd2d2] bg-[#fff8f8] px-5 py-4 text-sm font-medium text-[#8f2d2d]">
            {error}
          </div>
        ) : null}

        {!record ? (
          error ? null : (
            <div className="mt-6 h-64 animate-pulse rounded-2xl border border-[#e4ddf4] bg-white" />
          )
        ) : (
          <>
            <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3b0764] to-[#7c3aed] p-6 text-white shadow-lg sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#34d4c6]">
                    Career Record
                  </p>
                  <h1 className="mt-2 text-2xl font-black sm:text-3xl">{name || 'Your career record'}</h1>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                    <Trophy className="size-3.5 text-[#f6b44b]" />
                    Level: {record.level.name}
                  </span>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-6xl font-black leading-none sm:text-7xl">{record.totalPoints}</p>
                  <p className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-[#34d4c6]">
                    Skill Points
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-[#34d4c6] transition-all"
                    style={{ width: `${Math.max(record.levelProgress, 3)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-[#e6dcff]">
                  {record.nextLevel
                    ? `${record.nextLevel.min - record.totalPoints} points to reach ${record.nextLevel.name}`
                    : 'You reached the highest level.'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { icon: Award, value: record.entries.length, label: 'Courses completed' },
                { icon: Clock, value: formatHours(record.totalMinutes), label: 'Learning time' },
                {
                  icon: Trophy,
                  value: record.entries.filter((entry) => entry.certificateNumber).length,
                  label: 'Certificates',
                },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-xl border border-[#e4ddf4] bg-white p-4 text-center shadow-sm">
                  <Icon className="mx-auto size-5 text-[#7c3aed]" aria-hidden="true" />
                  <p className="mt-1.5 text-2xl font-black text-[#171321]">{value}</p>
                  <p className="text-xs font-semibold text-[#625b75]">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black text-[#171321]">Completed courses</h2>
              <button
                type="button"
                onClick={download}
                disabled={downloading || record.entries.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloading ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
                Download PDF summary
              </button>
            </div>

            {record.entries.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[#d9ceff] bg-white px-6 py-14 text-center">
                <p className="text-lg font-bold text-[#171321]">No Skill Points yet</p>
                <p className="mt-1 text-sm text-[#625b75]">
                  Finish a course to earn your first Skill Points and start your Career Record.
                </p>
                <Link
                  href="/academy#courses"
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
                >
                  Browse courses
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {record.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[#e4ddf4] bg-white p-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-[#171321]">{entry.title}</p>
                      <p className="mt-0.5 text-xs text-[#625b75]">
                        {[entry.category, formatHours(entry.minutes), formatDate(entry.completedAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#f4f0ff] px-3 py-1 text-sm font-black text-[#7c3aed]">
                      +{entry.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 rounded-xl border border-[#e4ddf4] bg-white p-5 text-sm text-[#625b75]">
              <p className="font-bold text-[#171321]">How Skill Points work</p>
              <p className="mt-1">
                You earn Skill Points each time you complete a course: 100 points per hour of content
                (minimum 50). Levels: {CAREER_LEVELS.map((level) => `${level.name} ${level.min}+`).join(' · ')}.
              </p>
            </div>
          </>
        )}
      </section>

      <AcademyFooter />
    </main>
  );
}
