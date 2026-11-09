export type CommunityPost = {
  id: string;
  linkedin_url: string;
  embed_url: string | null;
  author_name: string | null;
  author_role: string | null;
  post_text: string | null;
  course: string | null;
};

const LINKEDIN_EMBED_PREFIX = 'https://www.linkedin.com/embed/feed/update/';

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, '').replace(/\/$/, '') || '';
}

// Only ever iframe LinkedIn's own embed address.
export function isSafeLinkedInEmbedUrl(url?: string | null): url is string {
  return Boolean(url && url.startsWith(LINKEDIN_EMBED_PREFIX));
}

// The link a learner pastes: a normal post link, or pasted embed code. Returns the LinkedIn
// address only (the same rule the CRM uses when the team adds a post).
export function extractLinkedInPostUrl(input: string): string {
  const text = String(input || '').trim();
  const src = text.match(/src="([^"]+)"/i);
  const candidate = (src ? src[1] : text).trim();
  const url = candidate.match(/https?:\/\/[^\s"'<>]+/i);
  return url ? url[0] : candidate;
}

// Builds LinkedIn's own embed address from a post link, so the post can be shown as it is on LinkedIn.
export function parseLinkedInEmbedUrl(input: string): string | null {
  const text = String(input || '').trim();
  if (!text) return null;

  const embedSrc = text.match(/https:\/\/www\.linkedin\.com\/embed\/feed\/update\/urn:li:(?:activity|share|ugcPost):\d+/i);
  if (embedSrc) return embedSrc[0];

  const urn = text.match(/urn:li:(activity|share|ugcPost):(\d{10,})/i);
  if (urn) return `${LINKEDIN_EMBED_PREFIX}urn:li:${urn[1]}:${urn[2]}`;

  const slug = text.match(/[-/](activity|share|ugcPost)[-:](\d{10,})/i);
  if (slug) return `${LINKEDIN_EMBED_PREFIX}urn:li:${slug[1]}:${slug[2]}`;

  return null;
}

export async function getPublishedCommunityPosts(): Promise<CommunityPost[]> {
  const supabaseUrl = cleanEnv(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const supabaseKey = cleanEnv(
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!supabaseUrl || !supabaseKey) return [];

  const endpoint = new URL('/rest/v1/community_posts', supabaseUrl);
  endpoint.searchParams.set(
    'select',
    'id,linkedin_url,embed_url,author_name,author_role,post_text,course',
  );
  endpoint.searchParams.set('is_published', 'eq.true');
  endpoint.searchParams.set('order', 'sort_order.asc,created_at.desc');

  try {
    const response = await fetch(endpoint, {
      headers: { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    });
    if (!response.ok) return [];
    return (await response.json()) as CommunityPost[];
  } catch {
    return [];
  }
}
