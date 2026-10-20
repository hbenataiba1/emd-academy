'use client';

export type AcademySession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

export type AuthResult =
  | { ok: true; session: AcademySession }
  | { ok: false; message: string; needsConfirmation?: boolean };

export const ACADEMY_SESSION_KEY = 'easy_medical_device_academy_session';

export function getStoredAcademySession(): AcademySession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(ACADEMY_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as AcademySession;
    if (!session.access_token || !session.user?.id) {
      clearAcademySession();
      return null;
    }

    return session;
  } catch {
    clearAcademySession();
    return null;
  }
}

export function saveAcademySession(session: AcademySession) {
  window.localStorage.setItem(ACADEMY_SESSION_KEY, JSON.stringify(session));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('academy-auth-change'));
  }
}

export function clearAcademySession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACADEMY_SESSION_KEY);
    window.dispatchEvent(new Event('academy-auth-change'));
  }
}

export function getAcademyAuthHeader(
  session = getStoredAcademySession(),
): Record<string, string> {
  return session ? { authorization: `Bearer ${session.access_token}` } : {};
}

export function getAcademyDisplayName(session: AcademySession | null) {
  const metadata = session?.user.user_metadata;
  const fullName =
    typeof metadata?.full_name === 'string'
      ? metadata.full_name
      : typeof metadata?.name === 'string'
        ? metadata.name
        : undefined;

  return fullName || session?.user.email?.split('@')[0] || 'Learner';
}

export function getAcademyAvatarUrl(session: AcademySession | null) {
  const metadata = session?.user.user_metadata;
  return typeof metadata?.avatar_url === 'string' && metadata.avatar_url.trim()
    ? metadata.avatar_url.trim()
    : null;
}

// ── Keeping the login alive ───────────────────────────────────────────────────
// Supabase access tokens last about an hour. The renewal token saved at login is
// used here to get a new one before (or right after) the old one stops working.

let refreshInFlight: Promise<AcademySession | null> | null = null;

function readTokenExpiry(session: AcademySession) {
  if (session.expires_at) return session.expires_at;

  try {
    const payload = session.access_token.split('.')[1] || '';
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? (json.exp as number) : undefined;
  } catch {
    return undefined;
  }
}

/** Gets a new access token with the saved renewal token. Null if that fails. */
export async function refreshAcademySession(): Promise<AcademySession | null> {
  const session = getStoredAcademySession();
  const config = getPublicSupabaseConfig();
  if (!session?.refresh_token || !config) return null;

  if (!refreshInFlight) {
    const refreshToken = session.refresh_token;

    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: config.anonKey, 'content-type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) return null;

        const payload = (await response.json().catch(() => ({}))) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          user?: AcademySession['user'];
        };
        if (!payload.access_token) return null;

        const next: AcademySession = {
          access_token: payload.access_token,
          refresh_token: payload.refresh_token || refreshToken,
          expires_at: payload.expires_in
            ? Math.floor(Date.now() / 1000) + payload.expires_in
            : undefined,
          user: payload.user || session.user,
        };
        saveAcademySession(next);
        return next;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

/** The stored session, renewed first if it expires within two minutes. */
export async function ensureFreshAcademySession(): Promise<AcademySession | null> {
  const session = getStoredAcademySession();
  if (!session) return null;

  const expiry = readTokenExpiry(session);
  if (!expiry || expiry - Math.floor(Date.now() / 1000) > 120) return session;

  return (await refreshAcademySession()) || session;
}

const ACADEMY_API_PATH = /^\/(api\/academy|api\/checkout)(\/|$)/;

/**
 * Wraps fetch so every call to the academy API carries a fresh login token, and
 * is retried once with a renewed token if the server says the login expired.
 */
export function installAcademyFetchAuth() {
  if (typeof window === 'undefined') return;

  const flagged = window as unknown as { __academyFetchAuth?: boolean };
  if (flagged.__academyFetchAuth) return;
  flagged.__academyFetchAuth = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let target: URL | null = null;

    try {
      if (typeof input === 'string' || input instanceof URL) {
        target = new URL(String(input), window.location.origin);
      }
    } catch {
      target = null;
    }

    const isAcademyApi =
      target !== null &&
      target.origin === window.location.origin &&
      ACADEMY_API_PATH.test(target.pathname);
    const headers = new Headers(init?.headers);

    if (!isAcademyApi || !headers.has('authorization')) {
      return original(input, init);
    }

    const fresh = await ensureFreshAcademySession();
    if (fresh) headers.set('authorization', `Bearer ${fresh.access_token}`);

    const response = await original(input, { ...init, headers });
    if (response.status !== 401) return response;

    const renewed = await refreshAcademySession();
    if (!renewed || renewed.access_token === fresh?.access_token) return response;

    headers.set('authorization', `Bearer ${renewed.access_token}`);
    return original(input, { ...init, headers });
  };
}

export async function updateAcademyProfile({
  fullName,
  avatarUrl,
  password,
}: {
  fullName?: string;
  avatarUrl?: string;
  password?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const session = getStoredAcademySession();
  const config = getPublicSupabaseConfig();

  if (!session || !config) {
    return { ok: false, message: 'You must be signed in to update your profile.' };
  }

  const updateBody: Record<string, unknown> = {};

  if (password && password.trim()) {
    if (password.trim().length < 6) {
      return { ok: false, message: 'Password must be at least 6 characters.' };
    }
    updateBody.password = password.trim();
  }

  const currentMetadata = session.user.user_metadata || {};
  const newMetadata: Record<string, unknown> = { ...currentMetadata };

  let metadataChanged = false;
  if (typeof fullName === 'string') {
    newMetadata.full_name = fullName.trim();
    newMetadata.name = fullName.trim();
    metadataChanged = true;
  }
  if (typeof avatarUrl === 'string') {
    newMetadata.avatar_url = avatarUrl.trim();
    metadataChanged = true;
  }

  if (metadataChanged) {
    updateBody.data = newMetadata;
  }

  if (Object.keys(updateBody).length === 0) {
    return { ok: true };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(updateBody),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      user_metadata?: Record<string, unknown>;
      error_description?: string;
      msg?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        message:
          payload.error_description ||
          payload.msg ||
          payload.message ||
          'Failed to update profile.',
      };
    }

    const updatedSession: AcademySession = {
      ...session,
      user: {
        ...session.user,
        user_metadata: payload.user_metadata || newMetadata,
      },
    };
    saveAcademySession(updatedSession);

    return { ok: true };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Network error updating profile.',
    };
  }
}

export async function signInAcademyUser(
  email: string,
  password: string,
): Promise<AuthResult> {
  return authRequest('/auth/v1/token?grant_type=password', {
    email,
    password,
  });
}

export async function signUpAcademyUser({
  email,
  password,
  fullName,
}: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthResult> {
  return authRequest('/auth/v1/signup', {
    email,
    password,
    data: { full_name: fullName },
  });
}

const OAUTH_NEXT_KEY = 'easy_medical_device_academy_oauth_next';

export function signInWithGoogle(
  nextPath: string,
): { ok: false; message: string } | void {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return { ok: false, message: 'Academy Supabase is not configured yet.' };
  }

  try {
    window.sessionStorage.setItem(OAUTH_NEXT_KEY, nextPath);
  } catch {
    // ignore storage failures; user lands on the default page
  }

  const redirectTo = `${window.location.origin}/academy/login`;
  window.location.assign(
    `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
  );
}

/**
 * Completes a Supabase OAuth redirect (tokens arrive in the URL hash).
 * Returns the path to continue to, an error message, or null if no OAuth
 * response is present.
 */
export async function completeOAuthSignIn(): Promise<
  { ok: true; next: string } | { ok: false; message: string } | null
> {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const errorDescription = params.get('error_description');

  if (!accessToken && !errorDescription) {
    return null;
  }

  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.search,
  );

  if (!accessToken) {
    return { ok: false, message: errorDescription || 'Google sign-in failed.' };
  }

  const config = getPublicSupabaseConfig();
  if (!config) {
    return { ok: false, message: 'Academy Supabase is not configured yet.' };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      return { ok: false, message: 'Google sign-in failed. Please try again.' };
    }

    const expiresIn = Number(params.get('expires_in'));
    saveAcademySession({
      access_token: accessToken,
      refresh_token: params.get('refresh_token') || undefined,
      expires_at: expiresIn
        ? Math.floor(Date.now() / 1000) + expiresIn
        : undefined,
      user: (await response.json()) as AcademySession['user'],
    });

    let next = '/academy/my-learning';
    try {
      const stored = window.sessionStorage.getItem(OAUTH_NEXT_KEY);
      window.sessionStorage.removeItem(OAUTH_NEXT_KEY);
      if (stored?.startsWith('/academy')) next = stored;
    } catch {
      // ignore
    }
    return { ok: true, next };
  } catch {
    return { ok: false, message: 'Network error. Please try again.' };
  }
}

export async function requestAcademyPasswordReset(
  email: string,
): Promise<{ ok: boolean; message?: string }> {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return { ok: false, message: 'Academy Supabase is not configured yet.' };
  }

  try {
    const redirectTo = `${window.location.origin}/academy/reset-password`;
    const response = await fetch(
      `${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        headers: { apikey: config.anonKey, 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        msg?: string;
        error_description?: string;
        message?: string;
      };
      return {
        ok: false,
        message:
          payload.error_description ||
          payload.msg ||
          payload.message ||
          'We could not send the reset email. Please try again.',
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: 'Network error. Please try again.' };
  }
}

export async function resetAcademyPassword(
  accessToken: string,
  password: string,
): Promise<{ ok: boolean; message?: string }> {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return { ok: false, message: 'Academy Supabase is not configured yet.' };
  }
  if (password.trim().length < 6) {
    return { ok: false, message: 'Password must be at least 6 characters.' };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ password: password.trim() }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        msg?: string;
        error_description?: string;
        message?: string;
      };
      return {
        ok: false,
        message:
          payload.error_description ||
          payload.msg ||
          payload.message ||
          'This reset link has expired. Request a new one.',
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: 'Network error. Please try again.' };
  }
}

async function authRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<AuthResult> {
  const config = getPublicSupabaseConfig();
  if (!config) {
    return {
      ok: false,
      message:
        'Academy Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    } satisfies AuthResult;
  }

  const response = await fetch(`${config.url}${path}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: AcademySession['user'];
    msg?: string;
    error_description?: string;
    message?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      message:
        payload.error_description ||
        payload.msg ||
        payload.message ||
        'Authentication failed. Please check your details.',
    } satisfies AuthResult;
  }

  if (!payload.access_token || !payload.user) {
    return {
      ok: false,
      needsConfirmation: true,
      message:
        'Your account was created. Please confirm your email before signing in.',
    } satisfies AuthResult;
  }

  const session: AcademySession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_in
      ? Math.floor(Date.now() / 1000) + payload.expires_in
      : undefined,
    user: payload.user,
  };

  saveAcademySession(session);

  return { ok: true, session };
}

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}
