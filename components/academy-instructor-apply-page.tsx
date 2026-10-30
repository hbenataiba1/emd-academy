'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  Clock,
  FileText,
  Globe,
  KeyRound,
  Lightbulb,
  Link2,
  LoaderCircle,
  Mail,
  MessageSquare,
  MapPin,
  User,
  UserRound,
  XCircle,
} from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import { FormSkeleton } from '@/components/instructor-skeletons';
import {
  getAcademyAuthHeader,
  getAcademyDisplayName,
  getStoredAcademySession,
  signUpAcademyUser,
} from '@/lib/academy-session';

const DRAFT_KEY = 'emd-academy-instructor-draft';

type Application = {
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

type FormState = {
  fullName: string;
  headline: string;
  jobTitle: string;
  company: string;
  country: string;
  yearsExperience: string;
  linkedinUrl: string;
  websiteUrl: string;
  background: string;
  teachingTopics: string;
};

const EMPTY: FormState = {
  fullName: '',
  headline: '',
  jobTitle: '',
  company: '',
  country: '',
  yearsExperience: '',
  linkedinUrl: '',
  websiteUrl: '',
  background: '',
  teachingTopics: '',
};

const inputClass =
  'w-full rounded-xl border border-[#d9d1ee] bg-white px-4 py-3 text-sm text-[#191625] outline-none transition placeholder:text-[#9a93ad] focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10';

const iconInputClass = `${inputClass} pl-11`;

function Field({
  label,
  hint,
  required,
  icon: Icon,
  multiline,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  multiline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-[#302945]">
        {label}
        {required ? <span className="text-[#c0264b]"> *</span> : null}
      </span>
      {hint ? <span className="ml-2 text-xs font-medium text-[#8e879f]">{hint}</span> : null}
      <div className="relative mt-1.5">
        <Icon
          className={`pointer-events-none absolute left-4 size-4 text-[#9a93ad] ${multiline ? 'top-3.5' : 'top-1/2 -translate-y-1/2'}`}
          aria-hidden="true"
        />
        {children}
      </div>
    </label>
  );
}

const STEPS = [
  { key: 'about', label: 'About you', icon: User },
  { key: 'profile', label: 'Your profile', icon: Briefcase },
  { key: 'teaching', label: 'Teaching', icon: Lightbulb },
  { key: 'account', label: 'Your account', icon: KeyRound },
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function AcademyInstructorApplyPage() {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [application, setApplication] = useState<Application | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [step, setStep] = useState(0);
  const [acceptsQuestions, setAcceptsQuestions] = useState(false);

  useEffect(() => {
    const session = getStoredAcademySession();
    let active = true;

    // An application started before the account was confirmed is given back.
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) setForm((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<FormState>) }));
    } catch {
      // No draft.
    }

    // Not signed in: the applicant creates their account in the same form.
    if (!session) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setSignedIn(true);
    setForm((prev) => ({ ...prev, fullName: prev.fullName || getAcademyDisplayName(session) }));

    fetch('/api/academy/instructor', { headers: getAcademyAuthHeader(session) })
      .then(async (response) => {
        if (response.status === 401) {
          // The saved login expired: the form below asks for the account again.
          setSignedIn(false);
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as {
          available?: boolean;
          application?: Application | null;
          message?: string;
        };
        if (!active) return;

        if (!response.ok) {
          setError(payload.message || 'Your application could not be loaded.');
          return;
        }

        setAvailable(payload.available !== false);
        if (payload.application) {
          setApplication(payload.application);
          const a = payload.application;
          setForm({
            fullName: a.full_name,
            headline: a.headline || '',
            jobTitle: a.job_title || '',
            company: a.company || '',
            country: a.country || '',
            yearsExperience: a.years_experience == null ? '' : String(a.years_experience),
            linkedinUrl: a.linkedin_url,
            websiteUrl: a.website_url || '',
            background: a.background,
            teachingTopics: a.teaching_topics || '',
          });
        }
      })
      .catch(() => {
        if (active) setError('Network error. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError('');
    try {
      let session = getStoredAcademySession();

      // No account yet: it is created here, with the email and password of the form.
      if (!session) {
        if (!email.trim() || password.length < 6) {
          setError('Enter your email and a password of at least 6 characters.');
          return;
        }

        const created = await signUpAcademyUser({ email: email.trim(), password, fullName: form.fullName });
        if (!created.ok) {
          if (created.needsConfirmation) {
            try {
              window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
            } catch {
              // The applicant can fill the form again after confirming.
            }
            setConfirmEmail(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          setError(
            /already|registered/i.test(created.message)
              ? 'This email already has an account. Use "Sign in" above, then send your application.'
              : created.message,
          );
          return;
        }
        session = created.session;
        setSignedIn(true);
      }

      const response = await fetch('/api/academy/instructor', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
        body: JSON.stringify({ ...form, acceptsQuestions }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setError(payload.message || 'Your application could not be sent.');
        return;
      }

      setApplication({
        status: 'pending',
        full_name: form.fullName,
        headline: form.headline || null,
        country: form.country || null,
        company: form.company || null,
        job_title: form.jobTitle || null,
        years_experience: Number(form.yearsExperience),
        background: form.background,
        teaching_topics: form.teachingTopics || null,
        linkedin_url: form.linkedinUrl,
        website_url: form.websiteUrl || null,
        review_note: null,
        submitted_at: new Date().toISOString(),
      });
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clear.
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader />

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/academy/become-instructor"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#625b75] transition hover:text-[#7c3aed]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Become an instructor
        </Link>

        {confirmEmail ? (
          <div className="mt-6 rounded-2xl border border-[#e4ddf4] bg-white p-8">
            <h1 className="text-2xl font-black">Confirm your email</h1>
            <p className="mt-2 text-sm leading-6 text-[#5f5872]">
              We created your account and sent a confirmation link to <b>{email}</b>. Click the link, then sign in. Your
              answers are saved on this device, so you only have to press &quot;Send my application&quot;.
            </p>
            <Link
              href="/academy/login?next=/academy/instructor/apply"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#7c3aed] px-6 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
            >
              I confirmed my email: sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="mt-6">
            <FormSkeleton />
          </div>
        ) : !available ? (
          <div className="mt-6 rounded-2xl border border-[#e4ddf4] bg-white p-8 text-center">
            <h1 className="text-xl font-black">Applications are not open yet</h1>
            <p className="mt-2 text-sm text-[#5f5872]">Please come back soon.</p>
          </div>
        ) : application && application.status === 'pending' ? (
          <div className="mt-6 rounded-2xl border border-[#e4ddf4] bg-white p-8">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#fff6e0] text-[#b7791f]">
              <Clock className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-black">Your application is being reviewed</h1>
            <p className="mt-2 text-sm leading-6 text-[#5f5872]">
              Thank you, {application.full_name.split(' ')[0]}. We received your application on{' '}
              {formatDate(application.submitted_at)}. Our team will review your background and email you the
              decision.
            </p>
            <Summary application={application} />
          </div>
        ) : application && application.status === 'approved' ? (
          <div className="mt-6 rounded-2xl border border-[#cdeee0] bg-white p-8">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#e6f8ef] text-[#0f8a5f]">
              <BadgeCheck className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-black">You are an instructor</h1>
            <p className="mt-2 text-sm leading-6 text-[#5f5872]">Your application was approved. Welcome to the faculty.</p>
            {application.review_note ? (
              <p className="mt-3 rounded-xl bg-[#f6f4fb] p-4 text-sm italic text-[#3b3650]">{application.review_note}</p>
            ) : null}
            <Link
              href="/academy/instructor"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#7c3aed] px-6 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
            >
              Open my instructor dashboard
            </Link>
          </div>
        ) : (
          <>
            {application && application.status === 'rejected' ? (
              <div className="mt-6 rounded-2xl border border-[#f1d3d3] bg-[#fff8f8] p-6">
                <div className="flex items-center gap-3">
                  <XCircle className="size-6 text-[#c0264b]" aria-hidden="true" />
                  <h1 className="text-lg font-black">Your application was not approved</h1>
                </div>
                {application.review_note ? (
                  <p className="mt-3 text-sm leading-6 text-[#5a2b2b]">
                    <strong>Note from the team:</strong> {application.review_note}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-[#5a2b2b]">You can update your answers below and send it again.</p>
              </div>
            ) : (
              <div className="mt-6">
                <h1 className="text-3xl font-black">Apply to become an instructor</h1>
                <p className="mt-2 text-sm leading-6 text-[#5f5872]">
                  Tell us about yourself. Our team reads every application and replies by email. Fields marked
                  with * are required.
                </p>
                {!signedIn ? (
                  <p className="mt-2 text-sm text-[#5f5872]">
                    You do not need to be a learner. Your account is created with this form. Already have an account?{' '}
                    <Link href="/academy/login?next=/academy/instructor/apply" className="font-bold text-[#7c3aed] underline">
                      Sign in
                    </Link>
                  </p>
                ) : null}
              </div>
            )}

            {(() => {
              const steps = signedIn ? STEPS.slice(0, 3) : STEPS;
              const last = steps.length - 1;
              const current = Math.min(step, last);

              const problem = (index: number) => {
                if (index === 0) {
                  if (form.fullName.trim().length < 2) return 'Please enter your full name.';
                  const years = Number(form.yearsExperience);
                  if (form.yearsExperience === '' || !Number.isFinite(years) || years < 0 || years > 80) {
                    return 'Enter your years of experience as a number.';
                  }
                }
                if (index === 1) {
                  if (!/linkedin\./i.test(form.linkedinUrl)) return 'Please enter your LinkedIn profile address.';
                  if (form.background.trim().length < 50) return 'Tell us a little more about your background (at least a few sentences).';
                }
                if (index === 3) {
                  if (!email.trim() || password.length < 6) return 'Enter your email and a password of at least 6 characters.';
                }
                return '';
              };

              const goNext = () => {
                const message = problem(current);
                if (message) {
                  setError(message);
                  return;
                }
                setError('');
                setStep(current + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              };

              return (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (current < last) {
                      goNext();
                    } else {
                      const message = problem(current) || (acceptsQuestions ? '' : 'Please confirm that you will answer your learners\u2019 questions.');
                      if (message) setError(message);
                      else void submit(event);
                    }
                  }}
                  className="mt-6 rounded-2xl border border-[#e4ddf4] bg-white p-6 sm:p-8"
                >
                  {/* Progress */}
                  <ol className="mb-8 flex items-center">
                    {steps.map((item, index) => {
                      const Icon = item.icon;
                      const done = index < current;
                      const active = index === current;
                      return (
                        <li key={item.key} className="flex flex-1 items-center last:flex-none">
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className={`flex size-10 items-center justify-center rounded-full border-2 transition ${
                                done
                                  ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                                  : active
                                    ? 'border-[#7c3aed] bg-[#f4f0ff] text-[#7c3aed]'
                                    : 'border-[#e4ddf4] bg-white text-[#a89fc0]'
                              }`}
                            >
                              {done ? <Check className="size-5" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
                            </span>
                            <span className={`hidden text-[11px] font-bold sm:block ${active ? 'text-[#7c3aed]' : 'text-[#8e879f]'}`}>{item.label}</span>
                          </div>
                          {index < last ? <span className={`mx-2 mb-0 h-0.5 flex-1 rounded sm:mb-5 ${done ? 'bg-[#7c3aed]' : 'bg-[#e4ddf4]'}`} /> : null}
                        </li>
                      );
                    })}
                  </ol>

                  <p className="mb-5 text-xs font-black uppercase tracking-wider text-[#8e879f]">
                    Step {current + 1} of {steps.length} · {steps[current].label}
                  </p>

                  {current === 0 ? (
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Full name" required icon={UserRound}>
                        <input className={iconInputClass} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} maxLength={120} autoFocus />
                      </Field>
                      <Field label="Country" icon={MapPin}>
                        <input className={iconInputClass} value={form.country} onChange={(e) => update('country', e.target.value)} maxLength={80} />
                      </Field>
                      <Field label="Job title" hint="e.g. Regulatory Affairs Director" icon={Briefcase}>
                        <input className={iconInputClass} value={form.jobTitle} onChange={(e) => update('jobTitle', e.target.value)} maxLength={160} />
                      </Field>
                      <Field label="Company" icon={Building2}>
                        <input className={iconInputClass} value={form.company} onChange={(e) => update('company', e.target.value)} maxLength={160} />
                      </Field>
                      <Field label="Years of experience" required icon={Award}>
                        <input className={iconInputClass} type="number" min={0} max={80} value={form.yearsExperience} onChange={(e) => update('yearsExperience', e.target.value)} />
                      </Field>
                    </div>
                  ) : null}

                  {current === 1 ? (
                    <div className="space-y-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="LinkedIn profile" required icon={Link2}>
                          <input className={iconInputClass} placeholder="https://www.linkedin.com/in/..." value={form.linkedinUrl} onChange={(e) => update('linkedinUrl', e.target.value)} autoFocus />
                        </Field>
                        <Field label="Website" hint="optional" icon={Globe}>
                          <input className={iconInputClass} placeholder="https://" value={form.websiteUrl} onChange={(e) => update('websiteUrl', e.target.value)} />
                        </Field>
                      </div>
                      <Field label="Your background and experience" required hint="at least a few sentences" icon={FileText} multiline>
                        <textarea
                          className={iconInputClass}
                          rows={7}
                          value={form.background}
                          onChange={(e) => update('background', e.target.value)}
                          placeholder="Your roles, the kind of devices and regulations you work with, certifications, years in the field..."
                          maxLength={3000}
                        />
                      </Field>
                    </div>
                  ) : null}

                  {current === 2 ? (
                    <Field label="What would you like to teach?" hint="optional" icon={BookOpen} multiline>
                      <textarea
                        className={iconInputClass}
                        rows={7}
                        value={form.teachingTopics}
                        onChange={(e) => update('teachingTopics', e.target.value)}
                        placeholder="Course ideas or topics you would cover"
                        maxLength={1500}
                        autoFocus
                      />
                    </Field>
                  ) : null}

                  {current === 3 ? (
                    <div className="space-y-5">
                      <p className="text-sm text-[#5f5872]">
                        This is the account you will use to sign in to your instructor dashboard.
                      </p>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Email" required icon={Mail}>
                          <input className={iconInputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                        </Field>
                        <Field label="Password" required hint="at least 6 characters" icon={KeyRound}>
                          <input className={iconInputClass} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </Field>
                      </div>
                    </div>
                  ) : null}

                  {current === last ? (
                    <div className="mt-6 rounded-2xl border border-[#d9d1ee] bg-[#faf8ff] p-5">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="mt-0.5 size-5 shrink-0 text-[#7c3aed]" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-black">You are responsible for your learners&apos; questions</p>
                          <p className="mt-1 text-xs leading-5 text-[#5f5872]">
                            Learners can ask questions under each lesson of your courses. As the instructor, you answer them:
                            it is part of teaching on the Academy, and it is what makes a course trusted.
                          </p>
                          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-[#3b3650]">
                            <li className="flex gap-2">
                              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-[#08a99f]" aria-hidden="true" />
                              <span>
                                It is easy: every question arrives in the <b>Lesson questions</b> page of your dashboard, with a
                                red number to tell you.
                              </span>
                            </li>
                            <li className="flex gap-2">
                              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-[#08a99f]" aria-hidden="true" />
                              <span>You type your answer in one click, and the learner is emailed automatically.</span>
                            </li>
                            <li className="flex gap-2">
                              <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-[#08a99f]" aria-hidden="true" />
                              <span>Our team can see which questions are answered, so please reply in a reasonable time.</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-[#ede8fb]">
                        <input
                          type="checkbox"
                          checked={acceptsQuestions}
                          onChange={(event) => {
                            setAcceptsQuestions(event.target.checked);
                            if (event.target.checked) setError('');
                          }}
                          className="mt-0.5 size-4 shrink-0 accent-[#7c3aed]"
                        />
                        <span className="text-sm font-semibold text-[#302945]">
                          I understand and I will answer the questions learners ask under my lessons.
                          <span className="text-[#c0264b]"> *</span>
                        </span>
                      </label>
                    </div>
                  ) : null}

                  {error ? <p className="mt-5 text-sm font-semibold text-[#c0264b]">{error}</p> : null}

                  <div className="mt-8 flex items-center justify-between gap-3">
                    {current > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setStep(current - 1);
                        }}
                        className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d9d1ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:border-[#7c3aed]"
                      >
                        <ArrowLeft className="size-4" aria-hidden="true" /> Back
                      </button>
                    ) : (
                      <span />
                    )}

                    {current < last ? (
                      <button
                        type="submit"
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#7c3aed] px-7 text-sm font-black text-white transition hover:bg-[#6d31dc]"
                      >
                        Next <ArrowRight className="size-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-7 text-sm font-black text-white transition hover:bg-[#6d31dc] disabled:opacity-60"
                      >
                        {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                        {application ? 'Send my application again' : 'Send my application'}
                      </button>
                    )}
                  </div>
                </form>
              );
            })()}
          </>
        )}

        {error && (loading || !available) ? <p className="mt-4 text-sm font-semibold text-[#c0264b]">{error}</p> : null}
      </section>

      <AcademyFooter />
    </main>
  );
}

function Summary({ application }: { application: Application }) {
  const rows: [string, string | null][] = [
    ['Name', application.full_name],
    ['Job title', application.job_title],
    ['Company', application.company],
    ['Country', application.country],
    ['Experience', application.years_experience == null ? null : `${application.years_experience} years`],
    ['LinkedIn', application.linkedin_url],
  ];

  return (
    <dl className="mt-6 divide-y divide-[#ede8fb] rounded-xl border border-[#ede8fb] bg-[#faf8ff] text-sm">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-[#6e687d]">{label}</dt>
            <dd className="min-w-0 truncate font-semibold text-[#191625]">{value}</dd>
          </div>
        ))}
    </dl>
  );
}
