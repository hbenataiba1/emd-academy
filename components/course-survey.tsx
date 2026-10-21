'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, Star } from 'lucide-react';

import {
  getAcademyAuthHeader,
  getStoredAcademySession,
} from '@/lib/academy-session';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * End-of-course survey: a star rating and a short, optional comment. A learner who
 * has already answered sees their answer and can change it.
 */
export function CourseSurvey({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const session = getStoredAcademySession();
    if (!session) {
      setLoading(false);
      setAvailable(false);
      return;
    }

    fetch(`/api/academy/survey?courseId=${encodeURIComponent(courseId)}`, {
      headers: getAcademyAuthHeader(session),
    })
      .then(
        (response) =>
          (response.ok ? response.json() : null) as Promise<{
            available?: boolean;
            review?: { rating: number; comment: string | null } | null;
          } | null>,
      )
      .then(
        (payload) => {
          if (cancelled) return;

          if (!payload || payload.available === false) {
            setAvailable(false);
          } else if (payload.review) {
            setRating(payload.review.rating);
            setComment(payload.review.comment || '');
            setSubmitted(true);
          }
        },
      )
      .catch(() => {
        if (!cancelled) setAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function submit() {
    if (rating < 1 || saving) {
      setError('Please choose a star rating first.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/academy/survey', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getAcademyAuthHeader(getStoredAcademySession()),
        },
        body: JSON.stringify({ courseId, rating, comment }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setError(payload.message || 'Your feedback could not be saved. Please try again.');
        return;
      }

      setSubmitted(true);
      setEditing(false);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !available) return null;

  const shown = hover || rating;

  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1b152b] to-[#14101e] p-6 sm:p-7">
      {submitted && !editing ? (
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-9 text-[#34d4c6]" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-black text-white">Thank you for your feedback!</h3>
          <div className="mt-2 flex gap-1" aria-label={`Your rating: ${rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className={`size-5 ${value <= rating ? 'fill-[#f6b44b] text-[#f6b44b]' : 'text-white/25'}`}
              />
            ))}
          </div>
          {comment ? (
            <p className="mt-3 max-w-md text-sm italic leading-6 text-[#c4bdd8]">“{comment}”</p>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-4 text-xs font-bold text-[#b58dfb] transition hover:text-white"
          >
            Change my answer
          </button>
        </div>
      ) : (
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#34d4c6]">Quick survey</p>
          <h3 className="mt-2 text-xl font-black text-white">How was this course?</h3>
          <p className="mt-1 text-sm text-[#c4bdd8]">Your opinion helps us improve it for the next learners.</p>

          <div
            className="mt-5 flex items-center gap-1.5"
            role="radiogroup"
            aria-label="Rating"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value > 1 ? 's' : ''}`}
                onMouseEnter={() => setHover(value)}
                onClick={() => {
                  setRating(value);
                  setError('');
                }}
                className="rounded-md p-0.5 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b58dfb]"
              >
                <Star
                  className={`size-9 transition ${
                    value <= shown ? 'fill-[#f6b44b] text-[#f6b44b]' : 'text-white/25'
                  }`}
                />
              </button>
            ))}
            <span className="ml-3 min-w-[5.5rem] text-sm font-bold text-[#f6b44b]">{LABELS[shown]}</span>
          </div>

          <label className="mt-5 block">
            <span className="sr-only">Comment</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Tell us what you liked or what we could improve (optional)"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/50 focus:border-[#7c3aed]"
            />
            <span className="mt-1 block text-right text-[11px] text-[#8e879f]">{comment.length}/500</span>
          </label>

          {error ? <p className="mt-2 text-sm font-semibold text-[#ffb4b4]">{error}</p> : null}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-6 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:cursor-wait disabled:opacity-70"
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {submitted ? 'Save changes' : 'Send feedback'}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm font-semibold text-[#c4bdd8] transition hover:text-white"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
