import { renderCertificatePreviewPng, type CertificateSvgPayload } from '@/lib/academy-certificate';
import { getAcademyAuthHeader, getStoredAcademySession } from '@/lib/academy-session';

/**
 * Makes sure the picture that LinkedIn shows for the verification link is the learner's real
 * certificate. It is created in the browser (where the certificate fonts are) and stored once.
 */
export async function ensureCertificatePreview(payload: CertificateSvgPayload, force = false): Promise<boolean> {
  const session = getStoredAcademySession();
  if (!session || !payload.certificateNumber) return false;

  const key = `emd-cert-preview:${payload.certificateNumber}:${payload.learnerName}:${payload.instructorName || ''}`;
  try {
    if (!force && window.localStorage.getItem(key) === '1') return true;
  } catch {
    // No saved flag: it is simply created again.
  }

  try {
    const response = await fetch('/api/academy/certificate-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...getAcademyAuthHeader(session) },
      body: JSON.stringify({ certificateNumber: payload.certificateNumber }),
    });
    const target = (await response.json().catch(() => ({}))) as { signedUrl?: string };
    if (!response.ok || !target.signedUrl) return false;

    const blob = await renderCertificatePreviewPng(payload);
    const upload = await fetch(target.signedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/png', 'x-upsert': 'true' },
      body: blob,
    });
    if (!upload.ok) return false;

    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // Not remembered: it is created again next time.
    }
    return true;
  } catch {
    return false;
  }
}
