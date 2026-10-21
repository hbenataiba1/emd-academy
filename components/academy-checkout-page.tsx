'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  LoaderCircle,
  LockKeyhole,
  PlayCircle,
  Tag,
  X,
} from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import {
  getAcademyAuthHeader,
  getStoredAcademySession,
} from '@/lib/academy-session';

type CheckoutCourse = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  level: string;
  lessons: number;
  duration: string;
  priceLabel: string;
  priceCents: number;
};

type Phase = 'preparing' | 'paying' | 'confirming' | 'done' | 'error';

type AppliedCoupon = {
  code: string;
  discountCents: number;
  finalCents: number;
};

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );

export function AcademyCheckoutPage({ course }: { course: CheckoutCourse }) {
  const [phase, setPhase] = useState<Phase>('preparing');
  const [message, setMessage] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const started = useRef(false);
  const checkoutPath = `/academy/checkout/${course.slug || course.id}`;

  function goToLogin() {
    window.location.assign(`/academy/login?next=${encodeURIComponent(checkoutPath)}`);
  }

  // Poll until the payment webhook has unlocked the course.
  async function confirmEnrollment() {
    const session = getStoredAcademySession();
    setPhase('confirming');

    for (let attempt = 0; attempt < 15; attempt += 1) {
      try {
        // Ask the server to check the payment with Stripe and unlock the course now;
        // this does not depend on Stripe's webhook having arrived yet.
        const confirm = await fetch('/api/academy/checkout/confirm', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...getAcademyAuthHeader(session),
          },
          body: JSON.stringify({ courseId: course.id }),
        });
        const confirmed = (await confirm.json().catch(() => ({}))) as { enrolled?: boolean };

        if (confirmed.enrolled) {
          setPhase('done');
          return;
        }

        const response = await fetch('/api/academy/enroll', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...getAcademyAuthHeader(session),
          },
          body: JSON.stringify({ courseId: course.id }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          enrolled?: boolean;
        };

        if (payload.enrolled) {
          setPhase('done');
          return;
        }
      } catch {
        // keep trying
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Payment went through; the unlock is just taking longer than usual.
    setPhase('done');
  }

  // Opens (or re-opens) the payment form, optionally with a coupon applied.
  // Returns false when something went wrong (the message is already shown).
  async function preparePayment(code: string) {
    const session = getStoredAcademySession();
    if (!session) {
      goToLogin();
      return false;
    }

    try {
      const headers = {
        'content-type': 'application/json',
        ...getAcademyAuthHeader(session),
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          courseId: course.id,
          embedded: true,
          couponCode: code || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        clientSecret?: string;
        enrolled?: boolean;
        message?: string;
      };

      if (response.status === 401) {
        goToLogin();
        return false;
      }

      // A 100% coupon unlocks the course without any payment.
      if (payload.enrolled) {
        window.location.assign(`/academy/learn/${course.id}`);
        return true;
      }

      if (!response.ok || !payload.clientSecret) {
        setCouponMessage(payload.message || '');
        setPhase(code ? 'paying' : 'error');
        setMessage(payload.message || 'Checkout could not be opened.');
        return false;
      }

      setClientSecret(payload.clientSecret);
      setPhase('paying');
      return true;
    } catch {
      setPhase('error');
      setMessage('Network error. Please check your connection and try again.');
      return false;
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const session = getStoredAcademySession();
    if (!session) {
      goToLogin();
      return;
    }

    // Returning from a redirect-based payment method.
    if (new URLSearchParams(window.location.search).get('payment') === 'return') {
      void confirmEnrollment();
      return;
    }

    if (!stripePromise) {
      setPhase('error');
      setMessage(
        'Online payments are not set up yet. Please contact us and we will enrol you.',
      );
      return;
    }

    async function prepare() {
      // Already unlocked? Go straight to the course.
      try {
        const enroll = await fetch('/api/academy/enroll', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...getAcademyAuthHeader(session),
          },
          body: JSON.stringify({ courseId: course.id }),
        });

        if (enroll.status === 401) {
          goToLogin();
          return;
        }

        const enrollPayload = (await enroll.json().catch(() => ({}))) as {
          enrolled?: boolean;
        };

        if (enrollPayload.enrolled) {
          window.location.assign(`/academy/learn/${course.id}`);
          return;
        }
      } catch {
        setPhase('error');
        setMessage('Network error. Please check your connection and try again.');
        return;
      }

      await preparePayment('');
    }

    void prepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponBusy) return;

    const session = getStoredAcademySession();
    if (!session) {
      goToLogin();
      return;
    }

    setCouponBusy(true);
    setCouponMessage('');

    try {
      const response = await fetch('/api/academy/coupons/validate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getAcademyAuthHeader(session),
        },
        body: JSON.stringify({ courseId: course.id, code }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        valid?: boolean;
        code?: string;
        discountCents?: number;
        finalCents?: number;
        message?: string;
      };

      if (response.status === 401) {
        goToLogin();
        return;
      }

      if (!payload.valid) {
        setCouponMessage(payload.message || 'This coupon code is not valid.');
        return;
      }

      // Reload the payment form with the discount applied.
      setPhase('preparing');
      const ok = await preparePayment(payload.code || code);

      if (ok) {
        setApplied({
          code: payload.code || code.toUpperCase(),
          discountCents: payload.discountCents || 0,
          finalCents: payload.finalCents || 0,
        });
        setCouponInput('');
      } else {
        // Restore the previous (undiscounted or previous-coupon) form.
        await preparePayment(applied?.code || '');
      }
    } catch {
      setCouponMessage('Network error. Please try again.');
    } finally {
      setCouponBusy(false);
    }
  }

  async function removeCoupon() {
    if (couponBusy) return;
    setCouponBusy(true);
    setCouponMessage('');
    setPhase('preparing');
    setApplied(null);
    await preparePayment('');
    setCouponBusy(false);
  }

  const checkoutOptions = useMemo(
    () =>
      clientSecret
        ? {
            fetchClientSecret: async () => clientSecret,
            onComplete: () => {
              void confirmEnrollment();
            },
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientSecret],
  );

  const total = applied ? applied.finalCents : course.priceCents;
  const canEditCoupon = phase === 'paying' || phase === 'preparing';

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="home" />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href={`/academy/course/${course.slug || course.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#625b75] transition hover:text-[#7c3aed]"
        >
          <ArrowLeft className="size-4" />
          Back to course
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
          {/* Order summary */}
          <aside className="overflow-hidden rounded-xl border border-[#e4ddf4] bg-white shadow-sm lg:sticky lg:top-24">
            {course.image ? (
              <img
                src={course.image}
                alt=""
                className="aspect-[16/9] w-full object-cover"
              />
            ) : null}
            <div className="p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7c3aed]">
                Your order
              </p>
              <h1 className="mt-2 text-lg font-black leading-snug text-[#171321]">
                {course.title}
              </h1>
              {course.subtitle ? (
                <p className="mt-2 text-sm leading-6 text-[#625b75]">
                  {course.subtitle}
                </p>
              ) : null}

              <ul className="mt-4 space-y-2 text-sm text-[#514b63]">
                {course.lessons ? (
                  <li className="flex items-center gap-2">
                    <PlayCircle className="size-4 text-[#7c3aed]" />
                    {course.lessons} lessons
                  </li>
                ) : null}
                {course.duration ? (
                  <li className="flex items-center gap-2">
                    <Clock className="size-4 text-[#7c3aed]" />
                    {course.duration}
                  </li>
                ) : null}
                <li className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-[#7c3aed]" />
                  Certificate of completion
                </li>
              </ul>

              {/* Coupon */}
              {canEditCoupon ? (
                <div className="mt-5 border-t border-[#ece7f7] pt-4">
                  {applied ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-[#ecfdf5] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 font-bold text-[#047857]">
                        <Tag className="size-4" />
                        {applied.code} applied
                      </span>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        disabled={couponBusy}
                        className="rounded p-1 text-[#047857] transition hover:bg-white disabled:opacity-60"
                        aria-label="Remove coupon"
                        title="Remove coupon"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ) : couponOpen ? (
                    <div>
                      <div className="flex gap-2">
                        <input
                          value={couponInput}
                          onChange={(event) => {
                            setCouponInput(event.target.value);
                            setCouponMessage('');
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void applyCoupon();
                          }}
                          placeholder="Coupon code"
                          autoCapitalize="characters"
                          className="h-10 min-w-0 flex-1 rounded-lg border border-[#dcd5ee] bg-white px-3 text-sm font-semibold uppercase outline-none focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/12"
                        />
                        <button
                          type="button"
                          onClick={applyCoupon}
                          disabled={couponBusy || !couponInput.trim()}
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7c3aed] px-4 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {couponBusy ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCouponOpen(true)}
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#7c3aed] transition hover:text-[#6d31dc]"
                    >
                      <Tag className="size-4" />
                      Have a coupon code?
                    </button>
                  )}

                  {couponMessage ? (
                    <p className="mt-2 text-xs font-semibold text-[#b42318]">
                      {couponMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Totals */}
              <div className="mt-5 space-y-2 border-t border-[#ece7f7] pt-4 text-sm">
                {applied ? (
                  <>
                    <div className="flex items-center justify-between text-[#625b75]">
                      <span>Price</span>
                      <span>{money(course.priceCents)}</span>
                    </div>
                    <div className="flex items-center justify-between font-semibold text-[#047857]">
                      <span>Discount ({applied.code})</span>
                      <span>-{money(applied.discountCents)}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#625b75]">Total</span>
                  <span className="text-2xl font-black text-[#171321]">
                    {applied ? money(total) : course.priceLabel}
                  </span>
                </div>
              </div>

              <p className="mt-4 flex items-center gap-2 text-xs text-[#8b849a]">
                <LockKeyhole className="size-3.5" />
                Secure payment. Your card details never touch our servers.
              </p>
            </div>
          </aside>

          {/* Payment */}
          <div className="min-w-0">
            {phase === 'preparing' ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[#e4ddf4] bg-white">
                <div className="flex items-center gap-3 text-sm font-semibold text-[#625b75]">
                  <LoaderCircle className="size-5 animate-spin text-[#7c3aed]" />
                  Preparing secure checkout...
                </div>
              </div>
            ) : null}

            {phase === 'paying' && stripePromise && checkoutOptions ? (
              <div className="overflow-hidden rounded-xl border border-[#e4ddf4] bg-white p-2 shadow-sm sm:p-4">
                <EmbeddedCheckoutProvider
                  key={clientSecret}
                  stripe={stripePromise}
                  options={checkoutOptions}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            ) : null}

            {phase === 'confirming' ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-[#e4ddf4] bg-white p-8 text-center">
                <LoaderCircle className="size-8 animate-spin text-[#7c3aed]" />
                <p className="mt-4 text-lg font-bold text-[#171321]">
                  Payment received
                </p>
                <p className="mt-1 text-sm text-[#625b75]">
                  We are unlocking your course. This takes a few seconds.
                </p>
              </div>
            ) : null}

            {phase === 'done' ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-[#bfe9d9] bg-[#f3fcf8] p-8 text-center">
                <CheckCircle2 className="size-12 text-[#059669]" />
                <h2 className="mt-4 text-2xl font-black text-[#171321]">
                  You&apos;re in. Thank you!
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#4b5563]">
                  Your payment was successful. A receipt is available any time
                  under Billing &amp; invoices.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href={`/academy/learn/${course.id}`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-6 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
                  >
                    <PlayCircle className="size-4" />
                    Start learning
                  </Link>
                  <Link
                    href="/academy/billing"
                    className="inline-flex h-11 items-center justify-center rounded-lg border border-[#cfc4ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:bg-[#f4f1ff]"
                  >
                    View receipt
                  </Link>
                </div>
              </div>
            ) : null}

            {phase === 'error' ? (
              <div className="rounded-xl border border-[#efd2d2] bg-[#fff8f8] p-6">
                <p className="text-base font-bold text-[#8f2d2d]">
                  We couldn&apos;t open the checkout
                </p>
                <p className="mt-1 text-sm text-[#8f2d2d]">{message}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#7c3aed] px-5 text-sm font-bold text-white transition hover:bg-[#6d31dc]"
                  >
                    Try again
                  </button>
                  <a
                    href="https://easymedicaldevice.com/contact/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[#cfc4ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:bg-[#f4f1ff]"
                  >
                    Contact us
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <AcademyFooter />
    </main>
  );
}
