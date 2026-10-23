import { academyRestFetch } from '@/lib/academy-auth';
import { SITE } from '@/lib/academy-email-templates';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const SENDER_NAME = 'Easy Medical Device Academy';
const DEFAULT_SENDER = 'contacts@easymedicaldevice.com';

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

function senderMailbox() {
  return (process.env.ACADEMY_EMAIL_SENDER || DEFAULT_SENDER).trim();
}

function microsoftConfigured() {
  return Boolean(
    process.env.MICROSOFT_TENANT_ID && process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
  );
}

// The Microsoft login token lasts about an hour, so it is reused between emails.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function graphAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const response = await fetch(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      }),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || 'Could not sign in to Microsoft.');
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

async function updateLog(id: string, patch: Record<string, unknown>) {
  await academyRestFetch(`email_logs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    prefer: 'return=minimal',
    useServiceRole: true,
  });
}

/** A one-pixel image at the end of the email: loading it counts as an "open". */
function withOpenPixel(html: string, logId: string) {
  const pixel = `<img src="${SITE}/api/academy/email-open/${logId}" width="1" height="1" alt="" style="display:none;border:0;" />`;
  return html.includes('</body>') ? html.replace('</body>', `${pixel}</body>`) : html + pixel;
}

/**
 * Sends one Academy email from the Microsoft 365 mailbox (the same one the CRM uses,
 * through Microsoft Graph) and records it in `email_logs`.
 * Returns what happened; it never throws, so an email problem can not break the
 * learner's page. A `dedupeKey` makes sure the same email is not sent twice.
 */
export async function sendAcademyEmail(
  input: AcademyEmailInput,
): Promise<{ sent: boolean; reason?: string }> {
  if (!microsoftConfigured()) {
    return { sent: false, reason: 'Microsoft email is not set up (MICROSOFT_* variables).' };
  }

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
        provider: 'microsoft',
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

    // 2. Send it through Microsoft Graph.
    const mailbox = senderMailbox();
    const response = await fetch(`${GRAPH_BASE_URL}/users/${encodeURIComponent(mailbox)}/sendMail`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await graphAccessToken()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: 'HTML', content: withOpenPixel(input.html, row.id) },
          from: { emailAddress: { name: SENDER_NAME, address: mailbox } },
          toRecipients: [{ emailAddress: { address: input.to } }],
        },
        // Automated emails would only fill the mailbox's Sent folder.
        saveToSentItems: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = text;
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message || text;
      } catch {
        // Keep the raw text.
      }
      await updateLog(row.id, {
        status: 'failed',
        error_message: (message || `Microsoft error ${response.status}`).slice(0, 500),
      });
      return { sent: false, reason: message || 'Microsoft refused the email.' };
    }

    await updateLog(row.id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      error_message: null,
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Email failed.' };
  }
}
