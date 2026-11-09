import {
  academyRestFetch,
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  json,
  readJson,
} from '@/lib/academy-auth';
import { extractLinkedInPostUrl, parseLinkedInEmbedUrl } from '@/lib/community-posts';

const MAX_PENDING_PER_LEARNER = 5;

// A learner sends us the link of the LinkedIn post they wrote about their certificate.
// It is saved as "pending" and hidden: the team reviews it in the CRM (Academy > Community)
// and only an approved post is shown on the Academy home page.
export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id) return json({ message: 'Please log in to continue.' }, 401);

  const body = await readJson<{ linkedinUrl?: string; certificateNumber?: string }>(request, {});

  const linkedinUrl = extractLinkedInPostUrl(String(body.linkedinUrl || '')).slice(0, 600);
  if (!/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\//i.test(linkedinUrl)) {
    return json(
      { message: 'Paste the link of your post from linkedin.com (on LinkedIn: three dots on your post, then Copy link to post).' },
      400,
    );
  }

  // Only a learner who owns a certificate can send a post about it.
  const number = String(body.certificateNumber || '').trim();
  if (!/^[A-Za-z0-9-]{6,80}$/.test(number)) return json({ message: 'Invalid certificate.' }, 400);

  const owned = await academyRestFetch(
    `certificates?select=course_id&certificate_number=eq.${encodeURIComponent(number)}&user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&limit=1`,
    { useServiceRole: true },
  );
  const certificate = owned.ok ? ((await owned.json()) as { course_id: string }[])[0] : null;
  if (!certificate) return json({ message: 'This is not your certificate.' }, 403);

  try {
    // The same post is only saved once.
    const existing = await academyRestFetch(
      `community_posts?select=id&linkedin_url=eq.${encodeURIComponent(linkedinUrl)}&limit=1`,
      { useServiceRole: true },
    );
    if (!existing.ok) throw new Error(await existing.text());
    if (((await existing.json()) as unknown[]).length > 0) {
      return json({ ok: true, message: 'Thank you! We already have this post.' });
    }

    const waiting = await academyRestFetch(
      `community_posts?select=id&submitted_by=eq.${encodeURIComponent(user.id)}&status=eq.pending`,
      { useServiceRole: true },
    );
    if (waiting.ok && ((await waiting.json()) as unknown[]).length >= MAX_PENDING_PER_LEARNER) {
      return json({ message: 'You already have several posts waiting for our review. Please try again later.' }, 429);
    }

    const courseResponse = await academyRestFetch(
      `courses?select=title&id=eq.${encodeURIComponent(certificate.course_id)}&limit=1`,
      { useServiceRole: true },
    );
    const courseTitle = courseResponse.ok
      ? ((await courseResponse.json()) as { title?: string }[])[0]?.title || null
      : null;

    const insert = await academyRestFetch('community_posts', {
      method: 'POST',
      body: JSON.stringify({
        linkedin_url: linkedinUrl,
        embed_url: parseLinkedInEmbedUrl(linkedinUrl),
        author_name: getAcademyDisplayName(user),
        course: courseTitle,
        is_published: false,
        status: 'pending',
        submitted_by: user.id,
        submitter_email: user.email || null,
        certificate_number: number,
        consent_at: new Date().toISOString(),
        sort_order: 100,
      }),
      prefer: 'return=minimal',
      useServiceRole: true,
    });
    if (!insert.ok) throw new Error(await insert.text());

    return json({ ok: true, message: 'Thank you! We will review your post and may show it on the Academy website.' });
  } catch {
    return json({ message: 'Sharing your post with us is not available right now. Please try again later.' }, 502);
  }
}
