'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Award, Check, Copy, Download, ExternalLink, LoaderCircle, Megaphone, MessageCircle, Send, Share2, Sparkles, Star, X } from 'lucide-react';

import { openLinkedInCertificate } from '@/lib/academy-certificate';
import { ensureCertificatePreview } from '@/lib/certificate-preview';
import { getAcademyAuthHeader, getStoredAcademySession } from '@/lib/academy-session';
import { LINKEDIN_POST_COUNT, buildLinkedInPost } from '@/lib/linkedin-posts';

function shuffled(from: number[]) {
  const copy = [...from];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/**
 * "Share on LinkedIn": a post that is already written. One click opens LinkedIn with the
 * text in the new-post box (it is also copied, in case LinkedIn leaves the box empty).
 * "Write another post" gives a different version each time.
 */
export function LinkedInShareDialog({
  open,
  onClose,
  courseTitle,
  certificateTitle,
  certificateNumber,
  issuedAt,
  learnerName,
  issuedDate,
  instructorName,
  instructorTitle,
  onDownload,
}: {
  open: boolean;
  onClose: () => void;
  courseTitle: string;
  certificateTitle: string;
  certificateNumber: string;
  issuedAt?: string;
  /** Used to draw the real certificate as the preview of the link. */
  learnerName?: string;
  issuedDate?: string;
  /** Who signs the certificate (the instructor of the course). */
  instructorName?: string;
  instructorTitle?: string;
  /** Lets the learner download the certificate to attach it to the post. */
  onDownload?: () => void;
}) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<'idle' | 'preparing' | 'ready' | 'failed'>('idle');
  // Optional: the learner sends us the link of their published post.
  const [postLink, setPostLink] = useState('');
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [sendMessage, setSendMessage] = useState('');
  const [nudge, setNudge] = useState(false);
  const shareBoxRef = useRef<HTMLDivElement | null>(null);
  const deck = useRef<number[]>([]);
  const current = useRef(0);
  const timers = useRef<number[]>([]);

  const stopTimers = useCallback(() => {
    timers.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timers.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      stopTimers();
      return;
    }
    // Every learner gets their own random order, starting with a random post.
    const order = shuffled(Array.from({ length: LINKEDIN_POST_COUNT }, (_, index) => index));
    current.current = order[0];
    deck.current = order.slice(1);
    setText(buildLinkedInPost({ courseTitle, certificateNumber, index: order[0] }));
    setCopied(false);
    setGenerating(false);
    setPostLink('');
    setSendState('idle');
    setSendMessage('');
    setNudge(false);
    return stopTimers;
  }, [open, courseTitle, certificateNumber, stopTimers]);

  // The picture LinkedIn will show for the link is the learner's real certificate.
  useEffect(() => {
    if (!open || !learnerName || !issuedDate) return;
    let active = true;
    setPreview('preparing');
    ensureCertificatePreview({ learnerName, courseTitle, certificateTitle, certificateNumber, issuedDate, instructorName, instructorTitle })
      .then((ok) => {
        if (active) setPreview(ok ? 'ready' : 'failed');
      })
      .catch(() => {
        if (active) setPreview('failed');
      });
    return () => {
      active = false;
    };
  }, [open, learnerName, issuedDate, courseTitle, certificateTitle, certificateNumber, instructorName, instructorTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  // A different post each time: all of them are used before one comes back.
  function generate() {
    if (generating) return;
    stopTimers();

    if (deck.current.length === 0) {
      deck.current = shuffled(
        Array.from({ length: LINKEDIN_POST_COUNT }, (_, index) => index).filter((index) => index !== current.current),
      );
    }
    const next = deck.current.shift() as number;
    current.current = next;
    const target = buildLinkedInPost({ courseTitle, certificateNumber, index: next });

    setGenerating(true);
    setCopied(false);
    setText('');

    // A short moment of "writing", then the post appears as if it was being typed.
    const wait = window.setTimeout(() => {
      let shown = 0;
      const step = Math.max(2, Math.ceil(target.length / 70));
      const typing = window.setInterval(() => {
        shown += step;
        if (shown >= target.length) {
          window.clearInterval(typing);
          setText(target);
          setGenerating(false);
        } else {
          setText(target.slice(0, shown));
        }
      }, 18);
      timers.current.push(typing);
    }, 700 + Math.floor(Math.random() * 500));
    timers.current.push(wait);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // The learner can still select the text by hand.
    }
  }

  async function sendPostToUs() {
    const session = getStoredAcademySession();
    if (!session || sendState === 'sending') return;

    setSendState('sending');
    setSendMessage('');
    try {
      const response = await fetch('/api/academy/community-submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
        body: JSON.stringify({ linkedinUrl: postLink, certificateNumber }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setSendMessage(payload.message || (response.ok ? 'Thank you!' : 'Your post could not be sent.'));
      setSendState(response.ok ? 'done' : 'error');
    } catch {
      setSendMessage('Network error. Please try again.');
      setSendState('error');
    }
  }

  async function post() {
    await copy();
    window.open(
      `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
    // Back in the Academy after posting: lead the learner to the "share with us" box.
    setNudge(true);
    window.setTimeout(() => shareBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
  }

  // Shown on the page itself (not inside the card that opened it), so a card effect can not move it.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="linkedin-share-title"
        className="relative my-auto w-full max-w-xl rounded-2xl bg-white p-6 text-[#191625] shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-[#8e879f] transition hover:bg-[#f1eef8] hover:text-[#3b3650]"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-[#0a66c2] text-white">
            <Share2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="linkedin-share-title" className="text-lg font-black">
              Share your certificate on LinkedIn
            </h2>
            <p className="text-xs text-[#6e687d]">Your post is ready. Change it if you like, then publish it.</p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={11}
          readOnly={generating}
          placeholder={generating ? 'Writing your post...' : undefined}
          className="mt-5 w-full rounded-xl border border-[#d9d1ee] bg-[#faf8ff] p-4 text-sm leading-6 outline-none focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10"
        />

        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d9d1ee] bg-white px-4 text-sm font-bold text-[#6d28d9] transition hover:border-[#7c3aed] hover:bg-[#faf8ff] disabled:opacity-70"
        >
          {generating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
          {generating ? 'Writing your post...' : 'Write another post'}
        </button>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void post()}
            disabled={generating || preview === 'preparing'}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-5 text-sm font-black text-white transition hover:bg-[#004182] disabled:opacity-60"
          >
            <ExternalLink className="size-4" aria-hidden="true" /> Post on LinkedIn
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={generating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#d9d1ee] bg-white px-5 text-sm font-bold text-[#302945] transition hover:border-[#0a66c2] disabled:opacity-60"
          >
            {copied ? <Check className="size-4 text-[#0f8a5f]" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy the text'}
          </button>
        </div>

        <div
          ref={shareBoxRef}
          className={`mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#3b0764] to-[#7c3aed] p-5 text-white shadow-lg transition ${
            nudge && sendState !== 'done' ? 'ring-4 ring-[#34d4c6]' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Megaphone className="size-5 text-[#34d4c6]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-base font-black">Share it with us!</p>
              <p className="mt-0.5 text-sm leading-5 text-[#e2d8ff]">
                Send us the link of your post, so we can comment on it and show it on our website.
              </p>
            </div>
          </div>

          {sendState === 'done' ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/10 p-3 text-sm font-semibold">
              <Check className="mt-0.5 size-4 shrink-0 text-[#34d4c6]" aria-hidden="true" /> {sendMessage}
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5 text-xs font-semibold text-[#efe8ff]">
                <li className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-[#34d4c6]" aria-hidden="true" /> We comment on your post
                </li>
                <li className="flex items-center gap-2">
                  <Star className="size-4 text-[#34d4c6]" aria-hidden="true" /> You can appear on the Academy home page
                </li>
              </ul>

              {nudge ? (
                <p className="mt-3 rounded-lg bg-[#34d4c6] px-3 py-2 text-xs font-black text-[#06352f]">
                  Posted? Paste the link of your post here.
                </p>
              ) : null}

              <input
                type="url"
                value={postLink}
                onChange={(event) => setPostLink(event.target.value)}
                placeholder="https://www.linkedin.com/posts/..."
                className="mt-3 h-11 w-full rounded-lg border-0 bg-white px-3 text-sm text-[#191625] outline-none focus:ring-4 focus:ring-[#34d4c6]/60"
              />
              <p className="mt-1.5 text-[11px] leading-4 text-[#cdbdf3]">
                On LinkedIn: click the three dots on your post, then Copy link to post.
              </p>
              {sendState === 'error' ? (
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#c0264b]">{sendMessage}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void sendPostToUs()}
                disabled={!postLink.trim() || sendState === 'sending'}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#34d4c6] px-5 text-sm font-black text-[#06352f] transition hover:bg-[#2bc2b4] disabled:opacity-50"
              >
                {sendState === 'sending' ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                Send it to Easy Medical Device Academy
              </button>
            </>
          )}
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#6e687d]">
          {preview === 'preparing' ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> Preparing your certificate preview...
            </>
          ) : preview === 'ready' ? (
            <>
              <Check className="size-3.5 text-[#0f8a5f]" aria-hidden="true" /> Your certificate will appear in the LinkedIn post.
            </>
          ) : null}
        </p>

        <p className="mt-2 text-xs leading-5 text-[#6e687d]">
          LinkedIn opens with this text in a new post. If the box is empty, just paste it: the text is already copied.
          To tag us, click <strong>@Easy Medical Device</strong> in the post and pick our company page.
        </p>

        <div className="mt-5 grid gap-2 border-t border-[#ede8fb] pt-4 sm:grid-cols-2">
          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f4f0ff] px-4 py-2.5 text-xs font-bold text-[#6d28d9] transition hover:bg-[#ebe4ff]"
            >
              <Download className="size-4" aria-hidden="true" /> Download the certificate to attach it
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => openLinkedInCertificate({ courseTitle, certificateTitle, certificateNumber, issuedAt })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f4f0ff] px-4 py-2.5 text-xs font-bold text-[#6d28d9] transition hover:bg-[#ebe4ff]"
          >
            <Award className="size-4" aria-hidden="true" /> Add it to my profile (Licenses &amp; certifications)
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
