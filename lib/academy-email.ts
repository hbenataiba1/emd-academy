import { academyRestFetch } from '@/lib/academy-auth';

const DEFAULT_FROM = 'Easy Medical Device Academy <services@easymedicaldevice.com>';
const DEFAULT_REPLY_TO = 'services@easymedicaldevice.com';

export type AcademyEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateKey: string;
  templateName: string;
  recipientName?: string;
  recipientUserId?: string;
  /** Set for an email that must only ever go out once (for example the welcome). */
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
};

type LogRow = { id: string; status: string };

function emailFrom() {
  return (process.env.ACADEMY_EMAIL_FROM || DEFAULT_FROM).trim();
}

async function updateLog(id: string, patch: Record<string, unknown>) {
  await academyRestFetch(`email_logs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    prefer: 'return=minimal',
    useServiceRole: true,
  });
}

/**
 * Sends one Academy email through Resend and records it in `email_logs`.
 * Returns what happened; it never throws, so an email problem can not break the
 * learner's page. A `dedupeKey` makes sure the same email is not sent twice.
 */
export async function sendAcademyEmail(
  input: AcademyEmailInput,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY is not set.' };

  try {
    // 1. Reserve the log row first. With a dedupe key, a second request finds it.
    const reserve = await academyRestFetch('email_logs?on_conflict=dedupe_key', {
      method: 'POST',
      body: JSON.stringify({
        template_key: input.templateKey,
        template_name: input.templateName,
        recipient_email: input.to,
        recipient_name: input.recipientName || null,
        recipient_user_id: input.recipientUserId || null,
        subject: input.subject,
        status: 'queued',
        dedupe_key: input.dedupeKey || null,
        metadata: input.metadata || null,
      }),
      prefer: 'resolution=ignore-duplicates,return=representation',
      useServiceRole: true,
    });

    // The log table has not been created yet: do not send what can not be tracked.
    if (!reserve.ok) return { sent: false, reason: 'The email log table is missing.' };

    let row = ((await reserve.json()) as LogRow[])[0];

    if (!row && input.dedupeKey) {
      const existing = await academyRestFetch(
        `email_logs?select=id,status&dedupe_key=eq.${encodeURIComponent(input.dedupeKey)}&limit=1`,
        { useServiceRole: true },
      );
      const found = existing.ok ? ((await existing.json()) as LogRow[])[0] : undefined;
      // Already sent (or being sent): nothing to do. A failed one is tried again.
      if (!found || found.status !== 'failed') return { sent: false, reason: 'Already sent.' };
      row = found;
    }

    if (!row) return { sent: false, reason: 'Could not record the email.' };

    // 2. Send it.
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        reply_to: process.env.ACADEMY_EMAIL_REPLY_TO || DEFAULT_REPLY_TO,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      await updateLog(row.id, {
        status: 'failed',
        error_message: (payload.message || `Resend error ${response.status}`).slice(0, 500),
      });
      return { sent: false, reason: payload.message || 'Resend refused the email.' };
    }

    await updateLog(row.id, {
      status: 'sent',
      provider_message_id: payload.id || null,
      sent_at: new Date().toISOString(),
      error_message: null,
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Email failed.' };
  }
}
