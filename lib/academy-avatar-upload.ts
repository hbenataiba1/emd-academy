import { getAcademyAuthHeader, getStoredAcademySession } from '@/lib/academy-session';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Sends a profile picture to storage and returns its web address. */
export async function uploadAcademyAvatar(file: File): Promise<string> {
  const session = getStoredAcademySession();
  if (!session) throw new Error('Please sign in again.');
  if (file.size > MAX_AVATAR_BYTES) throw new Error('The picture must be smaller than 2 MB.');

  const response = await fetch('/api/academy/avatar-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
    body: JSON.stringify({ fileName: file.name }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    signedUrl?: string;
    publicUrl?: string;
    message?: string;
  };
  if (!response.ok || !payload.signedUrl || !payload.publicUrl) {
    throw new Error(payload.message || 'The upload could not be prepared.');
  }

  const upload = await fetch(payload.signedUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'image/jpeg' },
    body: file,
  });
  if (!upload.ok) throw new Error('The picture could not be uploaded. Please try again.');

  return payload.publicUrl;
}
