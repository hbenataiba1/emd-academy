'use client';

import { useEffect } from 'react';

import {
  ensureFreshAcademySession,
  getAcademyAuthHeader,
  getStoredAcademySession,
  installAcademyFetchAuth,
} from '@/lib/academy-session';

// Installed as soon as this file loads in the browser, before any page code runs,
// so the very first request of a page already carries a fresh login token.
installAcademyFetchAuth();

/** Keeps the learner logged in: renews the login in the background. */
export function AcademyAuthKeeper() {
  useEffect(() => {
    void ensureFreshAcademySession().then(() => {
      // Welcome email: asked once per learner and browser; the server sends it only once.
      const session = getStoredAcademySession();
      const userId = session?.user?.id;
      if (!session || !userId) return;

      const flag = `emd-academy-welcome:${userId}`;
      try {
        if (window.localStorage.getItem(flag)) return;
      } catch {
        return;
      }

      fetch('/api/academy/welcome', {
        method: 'POST',
        headers: getAcademyAuthHeader(session),
      })
        .then(
          (response) =>
            (response.ok ? response.json() : null) as Promise<{
              sent?: boolean;
              reason?: string;
            } | null>,
        )
        .then((result) => {
          // Remember it unless the email could not be sent yet (for example no setup).
          if (result && (result.sent || result.reason === 'Already sent.')) {
            try {
              window.localStorage.setItem(flag, '1');
            } catch {
              // Ignore: the server still sends it only once.
            }
          }
        })
        .catch(() => undefined);
    });

    const renew = () => void ensureFreshAcademySession();
    const interval = window.setInterval(renew, 4 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') renew();
    };

    window.addEventListener('focus', renew);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', renew);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
