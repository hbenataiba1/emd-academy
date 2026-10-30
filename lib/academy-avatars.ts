import { getAcademySupabaseConfig } from '@/lib/academy-auth';

/**
 * The profile picture each account has right now (an empty text means "no picture").
 * Questions and answers keep a copy of the picture from when they were written, so this
 * is used to show the latest one, for example after an instructor changes their photo.
 */
export async function getCurrentAvatars(userIds: (string | null | undefined)[]) {
  const result = new Map<string, string>();
  const config = getAcademySupabaseConfig(true);
  if (!config?.serviceRoleKey) return result;

  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))].slice(0, 25);
  const base = config.url.replace(/\/$/, '');

  await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
          headers: { apikey: config.serviceRoleKey!, authorization: `Bearer ${config.serviceRoleKey}` },
          cache: 'no-store',
        });
        if (!response.ok) return;
        const user = (await response.json()) as { user_metadata?: { avatar_url?: unknown } };
        const picture = user.user_metadata?.avatar_url;
        result.set(id, typeof picture === 'string' && /^https?:\/\//i.test(picture) ? picture : '');
      } catch {
        // Keep the copy saved with the message.
      }
    }),
  );

  return result;
}
