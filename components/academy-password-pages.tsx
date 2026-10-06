'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Mail } from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import {
  requestAcademyPasswordReset,
  resetAcademyPassword,
} from '@/lib/academy-session';

const inputClass =
  'h-11 w-full rounded-lg border border-[#dcd5ee] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12';
const buttonClass =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:cursor-wait disabled:opacity-70';

function PasswordShell({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof KeyRound;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="auth" />
      <section className="mx-auto flex min-h-[calc(100vh-240px)] max-w-md items-center px-4 py-12">
        <div className="w-full rounded-xl border border-[#e4ddf4] bg-white p-6 shadow-[0_24px_70px_rgb(38_29_68/10%)] sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-[#171321]">{title}</h1>
              <p className="mt-1 text-sm text-[#6e687d]">{subtitle}</p>
            </div>
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#f4f0ff] text-[#7c3aed]">
              <Icon className="size-6" />
            </div>
          </div>
          {children}
        </div>
      </section>
      <AcademyFooter />
    </main>
  );
}

/* /academy/forgot-password */
export function AcademyForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const result = await requestAcademyPasswordReset(email);

    setPending(false);
    if (result.ok) {
      setSent(true);
      return;
    }
    setMessage(result.message || 'We could not send the reset email.');
  }

  return (
    <PasswordShell
      title="Forgot your password?"
      subtitle="Enter your email and we will send you a reset link."
      icon={KeyRound}
    >
      {sent ? (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-lg border border-[#bdeee9] bg-[#effbf9] px-4 py-3 text-sm font-medium text-[#067b75]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>
              If an account exists for <strong>{email}</strong>, a password reset link is on
              its way. Check your inbox and spam folder.
            </p>
          </div>
          <Link
            href="/academy/login"
            className="block text-center text-sm font-bold text-[#7c3aed] hover:text-[#6d31dc]"
          >
            Back to log in
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-bold text-[#302945]">Email</span>
            <span className="relative mt-2 block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b849a]" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className={inputClass}
                placeholder="you@company.com"
              />
            </span>
          </label>

          {message ? (
            <div className="rounded-lg border border-[#efd2d2] bg-[#fff8f8] px-4 py-3 text-sm font-medium text-[#8f2d2d]">
              {message}
            </div>
          ) : null}

          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? 'Sending...' : 'Send reset link'}
            <ArrowRight className="size-4" />
          </button>

          <p className="text-center text-sm text-[#625b75]">
            Remembered it?{' '}
            <Link href="/academy/login" className="font-bold text-[#7c3aed] hover:text-[#6d31dc]">
              Log in
            </Link>
          </p>
        </form>
      )}
    </PasswordShell>
  );
}

/* /academy/reset-password  (opened from the email link) */
export function AcademyResetPasswordPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash: #access_token=...&type=recovery
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('access_token');
    const error = params.get('error_description');

    if (token && params.get('type') === 'recovery') {
      setAccessToken(token);
    } else {
      setLinkError(
        error?.replace(/\+/g, ' ') ||
          'This reset link is invalid or has expired. Request a new one.',
      );
    }
    // Remove the token from the address bar.
    window.history.replaceState(null, '', window.location.pathname);
    setReady(true);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password !== confirm) {
      setMessage('The two passwords do not match.');
      return;
    }
    if (!accessToken) return;

    setPending(true);
    const result = await resetAcademyPassword(accessToken, password);
    setPending(false);

    if (result.ok) {
      setDone(true);
      return;
    }
    setMessage(result.message || 'Could not update your password.');
  }

  return (
    <PasswordShell
      title="Choose a new password"
      subtitle="Use at least 6 characters."
      icon={LockKeyhole}
    >
      {!ready ? null : done ? (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-lg border border-[#bdeee9] bg-[#effbf9] px-4 py-3 text-sm font-medium text-[#067b75]">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>Your password has been updated. You can now log in.</p>
          </div>
          <Link href="/academy/login" className={buttonClass}>
            Log in
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : linkError ? (
        <div className="space-y-5">
          <div className="rounded-lg border border-[#efd2d2] bg-[#fff8f8] px-4 py-3 text-sm font-medium text-[#8f2d2d]">
            {linkError}
          </div>
          <Link href="/academy/forgot-password" className={buttonClass}>
            Request a new link
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-bold text-[#302945]">New password</span>
            <span className="relative mt-2 block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b849a]" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="Minimum 6 characters"
              />
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-[#302945]">Confirm password</span>
            <span className="relative mt-2 block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8b849a]" />
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={6}
                className={inputClass}
                placeholder="Repeat your password"
              />
            </span>
          </label>

          {message ? (
            <div className="rounded-lg border border-[#efd2d2] bg-[#fff8f8] px-4 py-3 text-sm font-medium text-[#8f2d2d]">
              {message}
            </div>
          ) : null}

          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? 'Saving...' : 'Update password'}
            <ArrowRight className="size-4" />
          </button>
        </form>
      )}
    </PasswordShell>
  );
}
