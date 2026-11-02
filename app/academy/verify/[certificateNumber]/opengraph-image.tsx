import { ImageResponse } from 'next/og';

import { formatCertificateDate } from '@/lib/academy-certificate';
import { getAcademySupabaseConfig } from '@/lib/academy-auth';
import { lookupCertificate } from '@/lib/academy-verify';

// The picture LinkedIn (and other sites) show when the verification link is shared:
// the certificate itself.
export const alt = 'Certificate of completion, Easy Medical Device Academy';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-dynamic';

export default async function Image({ params }: { params: Promise<{ certificateNumber: string }> }) {
  const { certificateNumber } = await params;
  const certificate = await lookupCertificate(decodeURIComponent(certificateNumber));
  const valid = Boolean(certificate && !certificate.revoked);

  // The real certificate, when the learner has opened the share window (it is stored then).
  if (certificate && !certificate.revoked) {
    const config = getAcademySupabaseConfig();
    if (config) {
      try {
        const stored = await fetch(
          `${config.url.replace(/\/$/, '')}/storage/v1/object/public/academy-media/certificate-previews/${encodeURIComponent(certificate.certificateNumber)}.png`,
          { cache: 'no-store' },
        );
        if (stored.ok && (stored.headers.get('content-type') || '').startsWith('image/')) {
          return new Response(await stored.arrayBuffer(), {
            headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' },
          });
        }
      } catch {
        // Not stored yet: the drawn certificate below is used.
      }
    }
  }

  if (!certificate) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8f6ff',
            color: '#3b0764',
          }}
        >
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, letterSpacing: 6, color: '#7c3aed' }}>
            EASY MEDICAL DEVICE ACADEMY
          </div>
          <div style={{ display: 'flex', marginTop: 24, fontSize: 56, fontWeight: 800 }}>Certificate not found</div>
        </div>
      ),
      size,
    );
  }

  const longCourse = certificate.courseTitle.length > 48;
  const longName = certificate.learnerName.length > 26;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#3b0764',
          padding: 26,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fffdf7',
            border: '6px solid #d4b062',
            position: 'relative',
            padding: '0 80px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
              bottom: 16,
              border: '2px solid #e6d3a3',
              display: 'flex',
            }}
          />

          <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, letterSpacing: 8, color: '#7c3aed' }}>
            EASY MEDICAL DEVICE ACADEMY
          </div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 30, fontWeight: 700, letterSpacing: 6, color: '#8a6a1f' }}>
            CERTIFICATE OF COMPLETION
          </div>

          <div style={{ display: 'flex', marginTop: 34, fontSize: 24, color: '#6e687d' }}>This certifies that</div>
          <div
            style={{
              display: 'flex',
              marginTop: 10,
              fontSize: longName ? 62 : 80,
              fontWeight: 800,
              fontStyle: 'italic',
              color: '#3b0764',
              textAlign: 'center',
            }}
          >
            {certificate.learnerName}
          </div>

          <div style={{ display: 'flex', marginTop: 18, fontSize: 24, color: '#6e687d' }}>has successfully completed</div>
          <div
            style={{
              display: 'flex',
              marginTop: 10,
              fontSize: longCourse ? 38 : 46,
              fontWeight: 800,
              color: '#7c3aed',
              textAlign: 'center',
            }}
          >
            {certificate.courseTitle}
          </div>

          <div style={{ display: 'flex', marginTop: 40, alignItems: 'center', gap: 28, fontSize: 22, color: '#6e687d' }}>
            <div style={{ display: 'flex' }}>{formatCertificateDate(certificate.issuedAt)}</div>
            <div style={{ display: 'flex', color: '#d4b062' }}>•</div>
            <div style={{ display: 'flex' }}>ID {certificate.certificateNumber}</div>
          </div>

          <div
            style={{
              position: 'absolute',
              right: 56,
              bottom: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 124,
              height: 124,
              borderRadius: 62,
              background: valid ? '#10b981' : '#dc2626',
              color: '#ffffff',
              fontSize: 20,
              fontWeight: 800,
              textAlign: 'center',
              border: '6px solid #d9f7ea',
            }}
          >
            {valid ? 'VERIFIED' : 'REVOKED'}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
