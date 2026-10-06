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
