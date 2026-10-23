'use client';

import { useEffect, useState } from 'react';

/**
 * Profile picture with a safe fallback. Google-hosted photos refuse to load when the
 * browser sends a referrer, so none is sent; if the image still fails, the initials show.
 */
export function AcademyAvatar({
  src,
  alt,
  initials,
  imageClassName,
  fallbackClassName,
}: {
  src?: string | null;
  alt: string;
  initials: string;
  imageClassName: string;
  fallbackClassName: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <div className={fallbackClassName}>{initials}</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={imageClassName}
    />
  );
}
