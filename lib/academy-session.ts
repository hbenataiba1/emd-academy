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
