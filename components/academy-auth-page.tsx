'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import {
  getStoredAcademySession,
  signInAcademyUser,
  signUpAcademyUser,
} from '@/lib/academy-session';

type AcademyAuthPageProps = {
  mode: 'login' | 'signup';
};

export function AcademyAuthPage({ mode }: AcademyAuthPageProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return '/academy/my-learning';
    }

    const requested = new URLSearchParams(window.location.search).get('next');
    return requested?.startsWith('/academy')
      ? requested
      : '/academy/my-learning';
  }, []);

  useEffect(() => {
    if (getStoredAcademySession()) {
      window.location.assign(nextPath);
    }
  }, [nextPath]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const result =
      mode === 'login'
        ? await signInAcademyUser(email, password)
        : await signUpAcademyUser({ email, password, fullName });

    setPending(false);

    if (result.ok) {
      window.location.assign(nextPath);
      return;
    }

    setMessage(result.message);
  }

  const isSignup = mode === 'signup';

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="auth" />

      <section className="mx-auto grid min-h-[calc(100vh-240px)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#7c3aed]">
            Easy Medical Device Academy
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-[#171321] sm:text-5xl">
            {isSignup ? 'Create your learner account' : 'Welcome back'}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#625b75]">
            Sign in before you buy a paid course or start a free course. Your
            progress, completion history, and certificates stay connected to
            your account.
          </p>
          <div className="mt-8 grid gap-3 text-sm font-semibold text-[#514b63] sm:grid-cols-3">
            {['Saved progress', 'Course access', 'Certificates'].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-[#e4ddf4] bg-white px-4 py-3"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#e4ddf4] bg-white p-6 shadow-[0_24px_70px_rgb(38_29_68/10%)] sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#171321]">
                {isSignup ? 'Sign up' : 'Log in'}
              </h2>
              <p className="mt-1 text-sm text-[#6e687d]">
                Use the email you want on your certificates.
              </p>
            </div>
            <div className="flex size-12 items-center justify-center rounded-lg bg-[#f4f0ff] text-[#7c3aed]">
              <LockKeyhole className="size-6" />
            </div>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {isSignup ? (
              <label className="block">
                <span className="text-sm font-bold text-[#302945]">
                  Full name
                </span>
                <span className="relative mt-2 block">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b849a]" />
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="h-11 w-full rounded-lg border border-[#dcd5ee] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
                    placeholder="Monir El Azzouzi"
                  />
                </span>
              </label>
            ) : null}

            <label className="block">
              <span className="text-sm font-bold text-[#302945]">Email</span>
              <span className="relative mt-2 block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b849a]" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-11 w-full rounded-lg border border-[#dcd5ee] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
                  placeholder="you@company.com"
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-[#302945]">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="mt-2 h-11 w-full rounded-lg border border-[#dcd5ee] bg-white px-3 text-sm outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
                placeholder="Minimum 6 characters"
              />
            </label>

            {message ? (
              <div className="rounded-lg border border-[#efd2d2] bg-[#fff8f8] px-4 py-3 text-sm font-medium text-[#8f2d2d]">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:cursor-wait disabled:opacity-70"
            >
              {pending
                ? isSignup
                  ? 'Creating account...'
                  : 'Signing in...'
                : isSignup
                  ? 'Create account'
                  : 'Log in'}
              <ArrowRight className="size-4" />
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#625b75]">
            {isSignup ? 'Already have an account?' : 'New to the academy?'}{' '}
            <Link
              href={
                isSignup
                  ? `/academy/login?next=${encodeURIComponent(nextPath)}`
                  : `/academy/signup?next=${encodeURIComponent(nextPath)}`
              }
              className="font-bold text-[#7c3aed] hover:text-[#6d31dc]"
            >
              {isSignup ? 'Log in' : 'Create one'}
            </Link>
          </p>
        </div>
      </section>

      <AcademyFooter />
    </main>
  );
}
