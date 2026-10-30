'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LoaderCircle, MessageSquare, Trash2 } from 'lucide-react';

import { AcademyAvatar } from '@/components/academy-avatar';
import {
  getAcademyAuthHeader,
  getStoredAcademySession,
} from '@/lib/academy-session';

type LessonComment = {
  id: string;
  parentId: string | null;
  author: string;
  avatar?: string | null;
  isStaff: boolean;
  isInstructor?: boolean;
  body: string;
  createdAt: string;
  mine: boolean;
};

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function Avatar({ name, staff, src }: { name: string; staff: boolean; src?: string | null }) {
  return (
    <AcademyAvatar
      src={src}
      alt={name}
      initials={(name.trim()[0] || '?').toUpperCase()}
      imageClassName="size-8 shrink-0 rounded-full object-cover"
      fallbackClassName={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
        staff ? 'bg-[#7c3aed]' : 'bg-white/15'
      }`}
    />
  );
}

/**
 * Comments under a lesson. Everyone enrolled in the course sees them; the team
 * answers from the CRM and those answers show with a "Team" badge.
 */
export function LessonComments({
  courseId,
  lessonId,
  lessonTitle,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle?: string;
}) {
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const session = getStoredAcademySession();
    if (!session) {
      setSignedIn(false);
      setLoading(false);
      return;
    }

    setSignedIn(true);
    try {
      const response = await fetch(
        `/api/academy/comments?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`,
        { headers: getAcademyAuthHeader(session) },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        available?: boolean;
        comments?: LessonComment[];
        message?: string;
      };

      if (!response.ok) {
        setError(payload.message || 'The questions could not be loaded.');
        setComments([]);
      } else {
        setError('');
        setAvailable(payload.available !== false);
        setComments(payload.comments || []);
      }
    } catch {
      setError('The questions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    setLoading(true);
    setReplyTo(null);
    setText('');
    void load();
  }, [load]);

  const threads = useMemo(() => {
    const roots = comments.filter((comment) => !comment.parentId);
    return roots
      .map((root) => ({
        root,
        replies: comments.filter((comment) => comment.parentId === root.id),
      }))
      .reverse();
  }, [comments]);

  async function send(body: string, parentId: string | null) {
    const session = getStoredAcademySession();
    if (!session || !body.trim() || saving) return;

    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/academy/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
        body: JSON.stringify({ courseId, lessonId, body, parentId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        comment?: LessonComment;
        message?: string;
      };

      if (!response.ok || !payload.comment) {
        setError(payload.message || 'Your question could not be saved.');
        return;
      }

      setComments((prev) => [...prev, payload.comment as LessonComment]);
      if (parentId) {
        setReplyText('');
        setReplyTo(null);
      } else {
        setText('');
      }
    } catch {
      setError('Your question could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const session = getStoredAcademySession();
    if (!session) return;

    const response = await fetch(`/api/academy/comments?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAcademyAuthHeader(session),
    }).catch(() => null);

    if (response?.ok) {
      setComments((prev) => prev.filter((comment) => comment.id !== id && comment.parentId !== id));
    }
  }

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#171322] p-6 text-sm text-[#c6bed8]">
        Sign in to read and ask questions on this lesson.
      </div>
    );
  }

  if (!available) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#171322] p-6 text-sm text-[#c6bed8]">
        Questions are not available yet.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-white">
          <MessageSquare className="size-4 text-[#b58dfb]" aria-hidden="true" />
          Questions{comments.length ? ` (${comments.length})` : ''}
        </h3>
        {lessonTitle ? <p className="mt-1 text-xs text-[#b9b1cf]">On: {lessonTitle}</p> : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#171322] p-4">
        <textarea
          rows={3}
          maxLength={2000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask a question about this lesson..."
          className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/60 focus:border-[#7c3aed] focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#b9b1cf]">Everyone in this course can see your question.</p>
          <button
            type="button"
            onClick={() => void send(text, null)}
            disabled={saving || !text.trim()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-bold text-white transition hover:bg-[#6d31dc] disabled:opacity-50"
          >
            {saving && !replyTo ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            Ask question
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-[#fca5a5]">{error}</p> : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#b9b1cf]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading questions...
        </p>
      ) : threads.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-[#b9b1cf]">
          No questions yet. Be the first to ask one.
        </p>
      ) : (
        <div className="space-y-4">
          {threads.map(({ root, replies }) => (
            <div key={root.id} className="rounded-2xl border border-white/10 bg-[#171322] p-4">
              <CommentBody comment={root} onDelete={remove} />
              <button
                type="button"
                onClick={() => {
                  setReplyTo((current) => (current === root.id ? null : root.id));
                  setReplyText('');
                }}
                className="mt-2 text-xs font-bold text-[#b58dfb] hover:text-white"
              >
                Reply
              </button>

              {replies.length > 0 ? (
                <div className="mt-3 space-y-3 border-l-2 border-white/10 pl-4">
                  {replies.map((reply) => (
                    <CommentBody key={reply.id} comment={reply} onDelete={remove} />
                  ))}
                </div>
              ) : null}

              {replyTo === root.id ? (
                <div className="mt-3 flex items-start gap-2">
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder={`Reply to ${root.author}...`}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white placeholder:text-white/60 focus:border-[#7c3aed] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void send(replyText, root.id)}
                    disabled={saving || !replyText.trim()}
                    className="h-9 rounded-lg bg-[#7c3aed] px-3 text-sm font-bold text-white hover:bg-[#6d31dc] disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentBody({
  comment,
  onDelete,
}: {
  comment: LessonComment;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={comment.author} staff={comment.isStaff} src={comment.avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold text-white">{comment.author}</span>
          {comment.isStaff ? (
            <span className="rounded-full bg-[#7c3aed] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {comment.isInstructor ? 'Instructor' : 'Team'}
            </span>
          ) : null}
          <span className="text-[11px] text-[#b9b1cf]">{timeAgo(comment.createdAt)}</span>
          {comment.mine ? (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="ml-auto text-[#b9b1cf] hover:text-[#fca5a5]"
              aria-label="Delete my question"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-[#dcd6ec]">
          {comment.body}
        </p>
      </div>
    </div>
  );
}
