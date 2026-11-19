import { academyRestFetch, cleanEnv, json, readJson } from '@/lib/academy-auth';
import { sendAcademyEmail } from '@/lib/academy-email';
import { requireInstructor } from '@/lib/academy-instructor';

export const dynamic = 'force-dynamic';

const TOPICS = ['Question about my course', 'Payments and earnings', 'Technical problem', 'My account', 'Other'];
const INBOX = 'contacts@easymedicaldevice.com';
const MAX_PER_HOUR = 5;

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// An instructor writes to the team. The message arrives by email in the contacts mailbox
// (the one the CRM shows), with the instructor's address as "reply to": the team answers from there.
export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ topic?: string; message?: string }>(request, {});
  const topic = TOPICS.includes(String(body.topic)) ? String(body.topic) : 'Other';
  const message = String(body.message || '').trim();

  if (message.length < 10) return json({ message: 'Please write your message (at least 10 characters).' }, 400);
  if (message.length > 4000) return json({ message: 'Your message is too long (4000 characters at most).' }, 400);

  // No more than a few messages per hour from the same instructor.
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await academyRestFetch(
    `email_logs?select=id&template_key=eq.instructor-contact&metadata->>user_id=eq.${encodeURIComponent(auth.user.id)}&created_at=gte.${encodeURIComponent(since)}`,
    { useServiceRole: true },
  );
  if (recent.ok && ((await recent.json()) as unknown[]).length >= MAX_PER_HOUR) {
    return json({ message: 'You sent several messages already. Please wait a little before writing again.' }, 429);
  }

  const name = auth.instructor.full_name || auth.user.email;
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#191625;line-height:1.55;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7c3aed;font-weight:bold;">Academy instructor message</p>
<p style="margin:0 0 16px;font-size:14px;"><strong>${escapeHtml(name)}</strong><br>Instructor email: ${escapeHtml(auth.user.email)}<br>Topic: ${escapeHtml(topic)}</p>
<div style="white-space:pre-wrap;font-size:15px;border-left:4px solid #7c3aed;padding:4px 0 4px 14px;">${escapeHtml(message)}</div>
<p style="margin:20px 0 0;font-size:12px;color:#6e687d;">Sent from the instructor dashboard of Easy Medical Device Academy. Reply to this email to answer the instructor.</p>
</body></html>`;

  const result = await sendAcademyEmail({
    to: cleanEnv(process.env.ACADEMY_CONTACT_INBOX) || INBOX,
    subject: `[Academy instructor] ${topic} - ${name}`,
    html,
    text: `Academy instructor message\n\n${name}\nInstructor email: ${auth.user.email}\nTopic: ${topic}\n\n${message}`,
    templateKey: 'instructor-contact',
    templateName: 'Instructor contact message',
    recipientName: name,
    replyTo: { address: auth.user.email, name },
    metadata: { user_id: auth.user.id, topic },
  });

  if (!result.sent) {
    return json({ message: `Your message could not be sent. Please write to us at ${INBOX}.` }, 502);
  }
  return json({ ok: true });
}
