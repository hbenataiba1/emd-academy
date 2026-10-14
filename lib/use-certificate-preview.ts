'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  buildCertificateSvg,
  buildCertificateSvgWithFonts,
  type CertificateSvgPayload,
} from '@/lib/academy-certificate';

const toDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Data URL of the certificate image (undefined until it can be built). It renders at once with system fonts and
 * switches to the embedded premium fonts as soon as they have loaded.
 */
export function useCertificatePreviewUrl(
  payload: CertificateSvgPayload,
  enabled = true,
) {
  const key = JSON.stringify(payload);
  const [withFonts, setWithFonts] = useState<{ key: string; url: string } | null>(
    null,
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Built on the client only, so the server HTML does not carry a large image.
  const fallbackUrl = useMemo(
    () =>
      enabled && mounted
        ? toDataUrl(buildCertificateSvg(JSON.parse(key) as CertificateSvgPayload))
        : undefined,
    [key, enabled, mounted],
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    buildCertificateSvgWithFonts(JSON.parse(key) as CertificateSvgPayload)
      .then((svg) => {
        if (!cancelled) setWithFonts({ key, url: toDataUrl(svg) });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  return withFonts?.key === key ? withFonts.url : fallbackUrl;
}
