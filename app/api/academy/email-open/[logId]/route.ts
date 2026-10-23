import { academyRestFetch } from '@/lib/academy-auth';

export const dynamic = 'force-dynamic';

// A transparent 1x1 GIF.
const PIXEL = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (char) => char.charCodeAt(0),
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Called when an email is opened (its tiny image loads). Counts the open for the CRM.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
  const { logId } = await params;

  if (UUID.test(logId)) {
    try {
      const response = await academyRestFetch(
        `email_logs?select=open_count,first_opened_at,status&id=eq.${logId}&limit=1`,
        { useServiceRole: true },
      );
      const row = response.ok
        ? ((await response.json()) as { open_count?: number; first_opened_at?: string | null; status?: string }[])[0]
        : undefined;

      if (row) {
        const now = new Date().toISOString();
        await academyRestFetch(`email_logs?id=eq.${logId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            open_count: (row.open_count || 0) + 1,
            first_opened_at: row.first_opened_at || now,
            last_opened_at: now,
            // An open also proves the email arrived.
            delivered_at: row.first_opened_at ? undefined : now,
            status: row.status === 'sent' || row.status === 'delivered' ? 'opened' : row.status,
          }),
          prefer: 'return=minimal',
          useServiceRole: true,
        });
      }
    } catch {
      // Never fail the image: the email must still look right.
    }
  }

  return new Response(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
