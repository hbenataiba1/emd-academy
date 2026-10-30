import { getAcademySupabaseConfig, getAcademyUserFromRequest, json, readJson } from '@/lib/academy-auth';

const IMAGES = ['.png', '.jpg', '.jpeg', '.webp'];

// A one-time address to send a profile picture straight to storage.
export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id) return json({ message: 'Please log in to continue.' }, 401);

  const body = await readJson<{ fileName?: string }>(request, {});
  const fileName = String(body.fileName || '').trim();
  const dot = fileName.lastIndexOf('.');
  const extension = dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
  if (!IMAGES.includes(extension)) {
    return json({ message: 'Choose a picture (PNG, JPG or WebP).' }, 400);
  }

  const config = getAcademySupabaseConfig(true);
  if (!config?.serviceRoleKey) return json({ message: 'Uploads are not available yet.' }, 503);

  const base = config.url.replace(/\/$/, '');
  const path = `avatars/${user.id}/${Date.now()}${extension}`;
  const response = await fetch(`${base}/storage/v1/object/upload/sign/academy-media/${path}`, {
    method: 'POST',
    headers: { apikey: config.serviceRoleKey, authorization: `Bearer ${config.serviceRoleKey}` },
  });
  if (!response.ok) return json({ message: 'The upload could not be prepared.' }, 502);

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) return json({ message: 'The upload could not be prepared.' }, 502);

  return json({
    signedUrl: `${base}/storage/v1${payload.url}`,
    publicUrl: `${base}/storage/v1/object/public/academy-media/${path}`,
  });
}
