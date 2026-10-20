'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Download, Receipt } from 'lucide-react';

import { AcademyFooter, AcademyHeader } from '@/components/academy-shell';
import {
  getAcademyAuthHeader,
  getStoredAcademySession,
} from '@/lib/academy-session';

type BillingItem = {
  id: string;
  courseId: string;
  courseTitle: string;
  date: string;
  amountCents: number;
  currency: string;
  status: 'paid' | 'refunded' | 'partially_refunded' | 'pending';
  receiptUrl?: string;
  invoiceUrl?: string;
  invoicePdfUrl?: string;
  invoiceNumber?: string;
};

const STATUS_LABEL: Record<BillingItem['status'], string> = {
  paid: 'Paid',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
  pending: 'Pending',
};

const STATUS_STYLE: Record<BillingItem['status'], string> = {
  paid: 'bg-[#ecfdf5] text-[#047857]',
  refunded: 'bg-[#f1f5f9] text-[#475569]',
  partially_refunded: 'bg-[#fffbeb] text-[#b45309]',
  pending: 'bg-[#fff7ed] text-[#c2410c]',
};

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function AcademyBillingPage() {
  const [items, setItems] = useState<BillingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getStoredAcademySession();
    if (!session) {
      window.location.assign('/academy/login?next=/academy/billing');
      return;
    }

    let active = true;

    fetch('/api/academy/billing', { headers: getAcademyAuthHeader(session) })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          items?: BillingItem[];
          message?: string;
        };

        if (!active) return;

        if (response.status === 401) {
          window.location.assign('/academy/login?next=/academy/billing');
          return;
        }

        if (!response.ok) {
          setError(payload.message || 'Your billing could not be loaded.');
          return;
        }

        setItems(payload.items || []);
      })
      .catch(() => {
        if (active) setError('Network error. Please try again.');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#fbfbfe] text-[#191625]">
      <AcademyHeader activePage="billing" />

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/academy/my-learning"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#625b75] transition hover:text-[#7c3aed]"
        >
          <ArrowLeft className="size-4" />
          Back to my learning
        </Link>

        <div className="mt-5 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#f4f0ff] text-[#7c3aed]">
            <Receipt className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#171321]">
              Billing &amp; invoices
            </h1>
            <p className="mt-1 text-sm text-[#625b75]">
              Your course purchases, with receipts and invoices you can open or
              download.
            </p>
          </div>
        </div>

        <div className="mt-8">
          {error ? (
            <div className="rounded-xl border border-[#efd2d2] bg-[#fff8f8] px-5 py-4 text-sm font-medium text-[#8f2d2d]">
              {error}
            </div>
          ) : items === null ? (
            <div className="space-y-3">
              {[0, 1].map((key) => (
                <div
                  key={key}
                  className="h-24 animate-pulse rounded-xl border border-[#e4ddf4] bg-white"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d9ceff] bg-white px-6 py-14 text-center">
              <p className="text-lg font-bold text-[#171321]">No purchases yet</p>
              <p className="mt-1 text-sm text-[#625b75]">
                When you buy a course, your receipt and invoice will appear here.
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
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-4 rounded-xl border border-[#e4ddf4] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-bold text-[#171321]">
                        {item.courseTitle}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[item.status]}`}
                      >
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#625b75]">
                      {formatDate(item.date)}
                      {item.invoiceNumber ? ` · Invoice ${item.invoiceNumber}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <p className="text-lg font-black text-[#171321]">
                      {formatMoney(item.amountCents, item.currency)}
                    </p>

                    {item.invoicePdfUrl ? (
                      <a
                        href={item.invoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-3.5 text-xs font-bold text-white transition hover:bg-[#6d31dc]"
                      >
                        <Download className="size-3.5" />
                        Invoice PDF
                      </a>
                    ) : null}

                    {item.receiptUrl || item.invoiceUrl ? (
                      <a
                        href={item.receiptUrl || item.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#cfc4ee] bg-white px-3.5 text-xs font-bold text-[#302945] transition hover:bg-[#f4f1ff]"
                      >
                        <Receipt className="size-3.5 text-[#7c3aed]" />
                        {item.receiptUrl ? 'View receipt' : 'View invoice'}
                      </a>
                    ) : (
                      <span className="text-xs text-[#8b849a]">
                        Receipt not available yet
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-center text-sm text-[#625b75]">
            Need a different invoice detail, such as a company name or VAT number?{' '}
            <a
              href="https://easymedicaldevice.com/contact/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#7c3aed] hover:text-[#6d31dc]"
            >
              Contact us
            </a>
            .
          </p>
        </div>
      </section>

      <AcademyFooter />
    </main>
  );
}
