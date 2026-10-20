'use client';

import { useEffect } from 'react';

import {
  ensureFreshAcademySession,
  installAcademyFetchAuth,
} from '@/lib/academy-session';

// Installed as soon as this file loads in the browser, before any page code runs,
// so the very first request of a page already carries a fresh login token.
installAcademyFetchAuth();

/** Keeps the learner logged in: renews the login in the background. */
export function AcademyAuthKeeper() {
  useEffect(() => {
    void ensureFreshAcademySession();

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
