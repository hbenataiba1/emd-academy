import {
  getCourseById,
  mapSupabaseCourse,
  type AcademyCourse,
  type SupabaseCourseRow,
} from '@/lib/academy-data';

export type AcademyAuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export type AcademySupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
};

export function getAcademySupabaseConfig(requireService = false) {
  const url = cleanEnv(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anonKey = cleanEnv(
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !anonKey || (requireService && !serviceRoleKey)) {
    return null;
  }

  return { url, anonKey, serviceRoleKey };
}

export async function getAcademyUserFromRequest(request: Request) {
  const token = getBearerToken(request);
  const config = getAcademySupabaseConfig();

  if (!token || !config) {
    return null;
  }

  const endpoint = new URL('/auth/v1/user', config.url);
  const response = await fetch(endpoint, {
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as AcademyAuthUser;
}

export async function academyRestFetch(
  path: string,
  init: RequestInit & {
    prefer?: string;
    useServiceRole?: boolean;
    accessToken?: string;
  } = {},
) {
  const config = getAcademySupabaseConfig(init.useServiceRole);

  if (!config) {
    throw new Error('Academy Supabase environment variables are missing.');
  }

  const endpoint = new URL(
    `/rest/v1/${path.replace(/^\//, '')}`,
    config.url,
  );
  const apiKey = init.useServiceRole
    ? config.serviceRoleKey || config.anonKey
    : config.anonKey;
  const headers = new Headers(init.headers);

  headers.set('apikey', apiKey);
  headers.set('authorization', `Bearer ${init.accessToken || apiKey}`);
  headers.set('content-type', headers.get('content-type') || 'application/json');

  if (init.prefer) {
    headers.set('prefer', init.prefer);
  }

  return fetch(endpoint, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

export async function getAcademyCourseForAccess(courseId: string) {
  const fallback = getCourseById(courseId);

  try {
    const response = await academyRestFetch(
      `courses?select=*&or=(id.eq.${encodeURIComponent(courseId)},slug.eq.${encodeURIComponent(courseId)})&limit=1`,
      { useServiceRole: true },
    );

    if (!response.ok) {
      return fallback;
    }

    const rows = (await response.json()) as SupabaseCourseRow[];
    const mapped = rows[0] ? mapSupabaseCourse(rows[0], 0) : null;

    return mapped || fallback;
  } catch {
    return fallback;
  }
}

export function getAcademyDisplayName(user: AcademyAuthUser) {
  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : undefined;

  return metadataName || user.email?.split('@')[0] || 'Learner';
}

export function getBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  const match = header?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function readJson<T>(request: Request, fallback: T): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return fallback;
  }
}

export function cleanEnv(value?: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.replace(/\/$/, '') : undefined;
}

export function isFreeCourse(course: AcademyCourse) {
  return (
    course.price <= 0 ||
    course.priceLabel?.trim().toLowerCase() === 'free' ||
    course.priceLabel?.trim().toLowerCase() === '$0'
  );
}
