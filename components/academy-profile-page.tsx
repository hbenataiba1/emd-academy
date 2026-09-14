'use client';

import { FormEvent, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  KeyRound,
  LogOut,
  Save,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import {
  clearAcademySession,
  getAcademyAvatarUrl,
  getAcademyDisplayName,
  getStoredAcademySession,
  type AcademySession,
  updateAcademyProfile,
} from '@/lib/academy-session';

export function AcademyProfilePage() {
  const [session, setSession] = useState<AcademySession | null | undefined>(undefined);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const active = getStoredAcademySession();
    if (!active) {
      window.location.assign('/academy/login?next=/academy/profile');
      return;
    }
    setSession(active);
    setFullName(getAcademyDisplayName(active));
    setAvatarUrl(getAcademyAvatarUrl(active) || '');
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ kind: 'error', message: 'Picture must be smaller than 2MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        setFeedback(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setFeedback(null);

    if (newPassword && newPassword.length < 6) {
      setFeedback({ kind: 'error', message: 'New password must be at least 6 characters long.' });
      setPending(false);
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setFeedback({ kind: 'error', message: 'Passwords do not match.' });
      setPending(false);
      return;
    }

    const result = await updateAcademyProfile({
      fullName,
      avatarUrl,
      password: newPassword || undefined,
    });

    setPending(false);

    if (result.ok) {
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ kind: 'success', message: 'Your profile has been updated successfully.' });
      const refreshed = getStoredAcademySession();
      setSession(refreshed);
    } else {
      setFeedback({ kind: 'error', message: result.message || 'Could not update profile.' });
    }
  };

  const handleSignOut = () => {
    clearAcademySession();
    window.location.assign('/academy');
  };

  if (session === undefined) {
    return (
      <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
        <AcademyHeader activePage="profile" />
        <div className="flex h-96 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-4 border-[#7c3aed] border-t-transparent" />
        </div>
        <AcademyFooter />
      </main>
    );
  }

  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'LE';

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="profile" />

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/academy/my-learning"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#625b75] transition hover:text-[#7c3aed]"
          >
            <ArrowLeft className="size-4" />
            Back to My Learning
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0c7c7] bg-[#fff8f8] px-3 py-1.5 text-xs font-bold text-[#b42318] transition hover:bg-[#fee4e2]"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>

        <div className="rounded-2xl border border-[#e4ddf4] bg-white p-6 shadow-[0_12px_45px_rgb(38_29_68/6%)] sm:p-8">
          {/* Profile Overview Row */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-[#ede8fb] pb-6">
            <div className="flex items-center gap-5">
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName}
                    className="size-20 rounded-full border-2 border-[#dcd5ee] object-cover shadow-sm sm:size-24"
                  />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-full bg-[#7c3aed] text-2xl font-black text-white shadow-sm sm:size-24 sm:text-3xl">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-[#191625] text-white shadow-md transition hover:bg-[#7c3aed]"
                  title="Upload picture"
                >
                  <Camera className="size-3.5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              <div>
                <h1 className="text-2xl font-black text-[#171321] sm:text-3xl">
                  {fullName || 'Learner'}
                </h1>
                <p className="mt-0.5 text-sm font-medium text-[#6e687d]">
                  {session?.user.email}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7c3aed] transition hover:text-[#6d31dc]"
                  >
                    <Camera className="size-3.5" />
                    Upload picture
                  </button>
                  {avatarUrl ? (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-xs font-semibold text-[#8b849a] transition hover:text-[#b42318]"
                    >
                      Remove picture
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#dcd5ee] bg-[#f8f6ff] px-3.5 py-1.5 text-xs font-bold text-[#7c3aed]">
              <ShieldCheck className="size-3.5" />
              Verified Learner Account
            </div>
          </div>

          {feedback ? (
            <div
              className={`mt-6 rounded-xl border p-4 text-sm font-medium ${
                feedback.kind === 'success'
                  ? 'border-[#c2ebd3] bg-[#f2fbf6] text-[#0f766e]'
                  : 'border-[#fecdca] bg-[#fffbfa] text-[#b42318]'
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          {/* Profile Edit Form */}
          <form onSubmit={handleSaveProfile} className="mt-8 space-y-8">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#7c3aed]">
                Personal Information
              </h3>
              <p className="mt-1 text-xs text-[#6e687d]">
                Your full name will appear on official certificates issued by the Academy.
              </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold text-[#302945]">Full Name</span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Monir El Azzouzi"
                      className="mt-1.5 h-11 w-full rounded-lg border border-[#dcd5ee] bg-white px-3 text-sm outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-[#8b849a]">Email (Read-only)</span>
                    <input
                      type="email"
                      value={session?.user.email || ''}
                      disabled
                      className="mt-1.5 h-11 w-full rounded-lg border border-[#e4ddf4] bg-[#f9f8fc] px-3 text-sm text-[#7a748c] outline-none"
                    />
                  </label>
                </div>
              </div>

              {/* Section 3: Change Password */}
              <div className="border-t border-[#ede8fb] pt-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#7c3aed]">
                  Change Password
                </h3>
                <p className="mt-1 text-xs text-[#6e687d]">
                  Leave these fields blank if you do not want to change your password.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold text-[#302945]">New Password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      className="mt-1.5 h-11 w-full rounded-lg border border-[#dcd5ee] bg-white px-3 text-sm outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-bold text-[#302945]">Confirm New Password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      minLength={6}
                      className="mt-1.5 h-11 w-full rounded-lg border border-[#dcd5ee] bg-white px-3 text-sm outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
                    />
                  </label>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ede8fb] pt-6">
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-6 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:opacity-70"
                >
                  <Save className="size-4" />
                  {pending ? 'Saving changes...' : 'Save Changes'}
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-[#b42318] transition hover:bg-[#fee4e2]"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </form>
        </div>
      </section>

      <AcademyFooter />
    </main>
  );
}
