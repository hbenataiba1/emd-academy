import {
  academyRestFetch,
  getAcademySupabaseConfig,
  getAcademyUserFromRequest,
  json,
  readJson,
} from '@/lib/academy-auth';
import { isValidCertificateNumber } from '@/lib/academy-verify';

// A one-time address to store the picture of the learner's own certificate (the preview of
// the verification link on LinkedIn).
export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id) return json({ message: 'Please log in to continue.' }, 401);

  const body = await readJson<{ certificateNumber?: string }>(request, {});
  const number = String(body.certificateNumber || '').trim();
  if (!isValidCertificateNumber(number)) return json({ message: 'Invalid certificate.' }, 400);

  // Only the owner of the certificate can set its picture.
  const owned = await academyRestFetch(
    `certificates?select=id&certificate_number=eq.${encodeURIComponent(number)}&user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&limit=1`,
    { useServiceRole: true },
  );
  if (!owned.ok || ((await owned.json()) as unknown[]).length === 0) {
    return json({ message: 'This is not your certificate.' }, 403);
  }

  const config = getAcademySupabaseConfig(true);
  if (!config?.serviceRoleKey) return json({ message: 'Uploads are not available yet.' }, 503);

  const base = config.url.replace(/\/$/, '');
  const path = `certificate-previews/${number}.png`;
  const response = await fetch(`${base}/storage/v1/object/upload/sign/academy-media/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      // The picture is replaced when the learner's name changes.
      'x-upsert': 'true',
    },
  });
  if (!response.ok) return json({ message: 'The upload could not be prepared.' }, 502);

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) return json({ message: 'The upload could not be prepared.' }, 502);

  return json({ signedUrl: `${base}/storage/v1${payload.url}` });
}
