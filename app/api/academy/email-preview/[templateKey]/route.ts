import { welcomeEmail } from '@/lib/academy-email-templates';

export const dynamic = 'force-dynamic';

// Shows an Academy email with sample data. Used by the CRM "Automated Emails" preview.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateKey: string }> },
) {
  const { templateKey } = await params;

  const preview = templateKey === 'welcome' ? welcomeEmail({ name: 'Alex Morgan' }) : null;

  if (!preview) {
    return new Response('Email preview not found', { status: 404 });
  }

  return new Response(preview.html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
