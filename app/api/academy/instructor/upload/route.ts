import { getAcademySupabaseConfig, json, readJson } from '@/lib/academy-auth';
import { requireInstructor, slugify } from '@/lib/academy-instructor';

const VIDEO = ['.mp4', '.mov', '.m4v', '.webm'];
const FILES = ['.pdf', '.docx', '.xlsx', '.ppt', '.pptx', '.zip', '.png', '.jpg', '.jpeg'];

// A one-time address to send a video or a resource file straight to storage.
export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ fileName?: string; folder?: string }>(request, {});
  const fileName = String(body.fileName || '').trim();
  const folder = body.folder === 'resources' ? 'resources' : 'videos';
  const dot = fileName.lastIndexOf('.');
  const extension = dot >= 0 ? fileName.slice(dot).toLowerCase() : '';

  if (!(folder === 'videos' ? VIDEO : FILES).includes(extension)) {
    return json(
      {
        message:
          folder === 'videos'
            ? `Upload a video file (${VIDEO.join(', ')}).`
            : `This file type is not accepted (${FILES.join(', ')}).`,
      },
      400,
    );
  }

  const config = getAcademySupabaseConfig(true);
  if (!config?.serviceRoleKey) {
    return json({ message: 'Uploads are not available yet.' }, 503);
  }

  const base = config.url.replace(/\/$/, '');
  const path = `instructors/${auth.user.id}/${folder}/${Date.now()}-${slugify(fileName.replace(/\.[^.]+$/, '')) || 'file'}${extension}`;

  const response = await fetch(`${base}/storage/v1/object/upload/sign/academy-media/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('Instructor upload: storage refused the signed address', response.status, detail.slice(0, 300));
    return json({ message: 'The upload could not be prepared.' }, 502);
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) return json({ message: 'The upload could not be prepared.' }, 502);

  return json({
    signedUrl: `${base}/storage/v1${payload.url}`,
    publicUrl: `${base}/storage/v1/object/public/academy-media/${path}`,
  });
}
