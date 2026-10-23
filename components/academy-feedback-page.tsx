'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import { CourseSurvey } from '@/components/course-survey';
import { getStoredAcademySession } from '@/lib/academy-session';

/** The page the "How was your course?" email links to. */
export function AcademyFeedbackPage({ courseId }: { courseId: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredAcademySession()) {
      window.location.assign(
        `/academy/login?next=${encodeURIComponent(`/academy/feedback/${courseId}`)}`,
      );
      return;
    }
    setReady(true);
  }, [courseId]);

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="my-learning" />

      <section className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        {ready ? <CourseSurvey courseId={courseId} /> : null}

        <div className="mt-6 text-center">
          <Link
            href="/academy/my-learning"
            className="text-sm font-semibold text-[#7c3aed] transition hover:text-[#6d31dc]"
          >
            Back to my learning
          </Link>
        </div>
      </section>

      <AcademyFooter />
    </main>
  );
}
