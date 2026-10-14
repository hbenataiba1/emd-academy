'use client';

import { useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';

export type PromoTracking = {
  /** Course the learner is in, sent as utm_campaign. */
  course: string;
  /** Lesson the promo is shown on, sent as utm_content. */
  lesson: string;
};

export type LessonPromo = {
  title: string;
  description?: string;
  ctaLabel?: string;
  url?: string;
};

// Accepts "www.site.com" as well as full links; anything else is ignored.
function normalizeUrl(value?: string) {
  const text = (value || '').trim();
  if (!text || text === '#') return '';

  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;

  try {
    const parsed = new URL(withScheme);
    return parsed.hostname.includes('.') ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Adds UTM parameters so the promo's traffic is attributable to this academy,
// course and lesson. UTM values the editor typed into the link are kept as is.
function withUtm(url: string, tracking?: PromoTracking) {
  if (!url || !tracking) return url;

  const link = new URL(url);
  const utm: Record<string, string> = {
    utm_source: 'easymedicaldeviceacademy',
    utm_medium: 'lesson-promo',
    utm_campaign: slugify(tracking.course),
    utm_content: slugify(tracking.lesson),
  };

  Object.entries(utm).forEach(([key, value]) => {
    if (value && !link.searchParams.has(key)) {
      link.searchParams.set(key, value);
    }
  });

  return link.toString();
}

/**
 * Sponsored card for a lesson. The "sidebar" variant is a compact vertical
 * card pinned under the course content; "inline" is a slim bar shown under the
 * lesson when the sidebar is collapsed. Learners can always hide it.
 */
export function LessonPromoCard({
  promo,
  variant = 'sidebar',
  tracking,
}: {
  promo: LessonPromo;
  variant?: 'sidebar' | 'inline';
  tracking?: PromoTracking;
}) {
  const [dismissed, setDismissed] = useState(false);
  // If the link was typed into the button-text field (and the link field is not a
  // valid link), use it as the link and fall back to a default button text.
  const labelIsLink = /^(https?:\/\/|www\.)/i.test(promo.ctaLabel?.trim() || '');
  const url = withUtm(
    normalizeUrl(promo.url) || (labelIsLink ? normalizeUrl(promo.ctaLabel) : ''),
    tracking,
  );
  const ctaLabel =
    (!labelIsLink && promo.ctaLabel?.trim()) || 'Learn more';

  if (dismissed || !promo.title) return null;

  const button = url ? (
    <a
      href={url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#6d31dc] ${
        variant === 'sidebar' ? 'mt-3 w-full' : 'shrink-0'
      }`}
    >
      {ctaLabel}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  ) : null;

  const dismiss = (
    <button
      type="button"
      onClick={() => setDismissed(true)}
      className="absolute right-2 top-2 rounded p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
      aria-label="Hide sponsored message"
      title="Hide"
    >
      <X className="size-3.5" />
    </button>
  );

  if (variant === 'inline') {
    return (
      <aside
        aria-label="Sponsored"
        className="relative border-t border-white/10 bg-[#120e1c] px-4 py-3 sm:px-6"
      >
        <div className="flex flex-col gap-3 rounded-xl border border-[#7c3aed]/30 bg-gradient-to-r from-[#7c3aed]/15 via-[#1b152b] to-[#34d4c6]/10 py-3 pl-4 pr-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b58dfb]">
              Sponsored
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">{promo.title}</p>
            {promo.description ? (
              <p className="mt-0.5 text-xs leading-5 text-[#c4bdd8]">
                {promo.description}
              </p>
            ) : null}
          </div>
          {button}
        </div>
        {dismiss}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Sponsored"
      className="relative shrink-0 border-t border-white/10 bg-[#14101e] p-3"
    >
      <div className="relative rounded-xl border border-[#7c3aed]/35 bg-gradient-to-br from-[#7c3aed]/20 via-[#1b152b] to-[#34d4c6]/10 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#b58dfb]">
          Sponsored
        </p>
        <p className="mt-1.5 pr-5 text-sm font-bold leading-snug text-white">
          {promo.title}
        </p>
        {promo.description ? (
          <p className="mt-1.5 text-xs leading-5 text-[#c4bdd8]">
            {promo.description}
          </p>
        ) : null}
        {button}
        {dismiss}
      </div>
    </aside>
  );
}
