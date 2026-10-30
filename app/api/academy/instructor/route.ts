import { after } from 'next/server';

import {
  academyRestFetch,
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  json,
  readJson,
} from '@/lib/academy-auth';
import { notifyInstructorApplication } from '@/lib/academy-notify';

type InstructorRow = {
  status: 'pending' | 'approved' | 'rejected';
  full_name: string;
  headline: string | null;
  country: string | null;
  company: string | null;
  job_title: string | null;
  years_experience: number | null;
  background: string;
  teaching_topics: string | null;
  linkedin_url: string;
  website_url: string | null;
  review_note: string | null;
  submitted_at: string;
};

const MISSING_TABLE = /instructors|schema cache|does not exist/i;
const COLUMNS =
  'status,full_name,headline,country,company,job_title,years_experience,background,teaching_topics,linkedin_url,website_url,review_note,submitted_at';

function clean(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function webAddress(value: unknown) {
  const text = clean(value, 300);
  if (!text) return '';
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withProtocol);
    return url.hostname.includes('.') ? url.toString() : '';
  } catch {
    return '';
  }
}

// The status of the logged-in learner's instructor application.
export async function GET(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id) {
      return json({ message: 'Please log in to continue.' }, 401);
    }

    const response = await academyRestFetch(
      `instructors?select=${COLUMNS}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { useServiceRole: true },
    );

    if (!response.ok) {
      const text = await response.text();
      // The table is not created yet: nobody can apply for now.
      if (MISSING_TABLE.test(text)) return json({ available: false, application: null });
      return json({ message: 'Your application could not be loaded.' }, 502);
    }

    const application = ((await response.json()) as InstructorRow[])[0] || null;
    return json({ available: true, status: application?.status || 'none', application });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'Your application could not be loaded.' },
      500,
    );
  }
}

// Sends the application (or sends it again after it was declined).
export async function POST(request: Request) {
  try {
    const user = await getAcademyUserFromRequest(request);
    if (!user?.id || !user.email) {
      return json({ message: 'Please log in to apply.' }, 401);
    }

    const body = await readJson<Record<string, unknown>>(request, {});
    const fullName = clean(body.fullName, 120);
    const background = clean(body.background, 3000);
    const linkedin = webAddress(body.linkedinUrl);
    const years = Math.round(Number(body.yearsExperience));

    if (body.acceptsQuestions !== true) {
      return json({ message: 'Please confirm that you will answer your learners\u2019 questions.' }, 400);
    }
    if (fullName.length < 2) return json({ message: 'Please enter your full name.' }, 400);
    if (!linkedin || !/linkedin\./i.test(linkedin)) {
      return json({ message: 'Please enter your LinkedIn profile address.' }, 400);
    }
    if (background.length < 50) {
      return json({ message: 'Tell us a little more about your background (at least a few sentences).' }, 400);
    }
    if (!Number.isFinite(years) || years < 0 || years > 80) {
      return json({ message: 'Enter your years of experience as a number.' }, 400);
    }

    const existing = await academyRestFetch(
      `instructors?select=status&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { useServiceRole: true },
    );
    if (!existing.ok) {
      const text = await existing.text();
      return json(
        { message: MISSING_TABLE.test(text) ? 'Applications are not open yet.' : 'Your application could not be saved.' },
        502,
      );
    }

    const current = ((await existing.json()) as { status: string }[])[0];
    if (current && current.status !== 'rejected') {
      return json(
        { message: current.status === 'approved' ? 'You are already an instructor.' : 'Your application is already being reviewed.' },
        409,
      );
    }

    const now = new Date().toISOString();
    const response = await academyRestFetch('instructors?on_conflict=user_id', {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        status: 'pending',
        full_name: fullName,
        email: user.email,
        headline: clean(body.headline, 160) || null,
        country: clean(body.country, 80) || null,
        company: clean(body.company, 160) || null,
        job_title: clean(body.jobTitle, 160) || null,
        years_experience: years,
        background,
        teaching_topics: clean(body.teachingTopics, 1500) || null,
        linkedin_url: linkedin,
        website_url: webAddress(body.websiteUrl) || null,
        review_note: null,
        reviewed_by: null,
        reviewed_at: null,
        submitted_at: now,
        updated_at: now,
      }),
      prefer: 'resolution=merge-duplicates,return=minimal',
      useServiceRole: true,
    });

    if (!response.ok) {
      return json({ message: 'Your application could not be saved.' }, 502);
    }

    after(() => notifyInstructorApplication({ userId: user.id, email: user.email!, name: fullName || getAcademyDisplayName(user) }));

    return json({ saved: true, status: 'pending' });
  } catch (error) {
    return json(
      { message: error instanceof Error ? error.message : 'Your application could not be saved.' },
      500,
    );
  }
}
