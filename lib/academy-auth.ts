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

export type AcademyEnrollmentRow = {
  id?: string;
  user_id?: string;
  course_id: string;
  learner_email?: string;
  learner_name?: string;
  amount_cents?: number;
  currency?: string;
  stripe_checkout_session_id?: string;
  stripe_customer_id?: string;
  status?: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type SaveAcademyEnrollmentInput = {
  userId: string;
  learnerEmail: string;
  learnerName?: string;
  courseId: string;
  amountCents?: number;
  currency?: string;
  stripeCheckoutSessionId?: string;
  stripeCustomerId?: string | null;
  status?: string;
  completedAt?: string | null;
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

export async function getAcademyEnrollmentForUser({
  userId,
  learnerEmail,
  courseId,
}: {
  userId: string;
  learnerEmail: string;
  courseId: string;
}) {
  const modernResponse = await academyRestFetch(
    `enrollments?select=*&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`,
    { useServiceRole: true },
  );

  if (modernResponse.ok) {
    const rows = (await modernResponse.json()) as AcademyEnrollmentRow[];
    if (rows.length > 0) {
      return rows[0];
    }
  }

  const emailResponse = await academyRestFetch(
    `enrollments?select=*&learner_email=eq.${encodeURIComponent(learnerEmail)}&course_id=eq.${encodeURIComponent(courseId)}&limit=1`,
    { useServiceRole: true },
  );

  if (!emailResponse.ok) {
    return null;
  }

  const rows = (await emailResponse.json()) as AcademyEnrollmentRow[];
  return rows[0] || null;
}

export async function getAcademyEnrollmentsForUser({
  userId,
  learnerEmail,
}: {
  userId: string;
  learnerEmail: string;
}) {
  const byUserId = await academyRestFetch(
    `enrollments?select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc`,
    { useServiceRole: true },
  );

  if (byUserId.ok) {
    const rows = (await byUserId.json()) as AcademyEnrollmentRow[];
    if (rows.length > 0) {
      return rows;
    }
  }

  const byEmail = await academyRestFetch(
    `enrollments?select=*&learner_email=eq.${encodeURIComponent(learnerEmail)}&order=updated_at.desc`,
    { useServiceRole: true },
  );

  if (!byEmail.ok) {
    throw new Error(await byEmail.text());
  }

  return (await byEmail.json()) as AcademyEnrollmentRow[];
}

export async function saveAcademyEnrollment({
  userId,
  learnerEmail,
  learnerName,
  courseId,
  amountCents = 0,
  currency = 'usd',
  stripeCheckoutSessionId,
  stripeCustomerId,
  status = 'active',
  completedAt,
}: SaveAcademyEnrollmentInput) {
  const now = new Date().toISOString();
  const modernPayload = removeUndefinedValues({
    user_id: userId,
    learner_email: learnerEmail,
    learner_name: learnerName,
    course_id: courseId,
    amount_cents: amountCents,
    currency,
    stripe_checkout_session_id: stripeCheckoutSessionId,
    stripe_customer_id: stripeCustomerId,
    status,
    completed_at: completedAt,
    updated_at: now,
  });

  const modernResponse = await academyRestFetch(
    'enrollments?on_conflict=user_id,course_id',
    {
      method: 'POST',
      body: JSON.stringify(modernPayload),
      prefer: 'resolution=merge-duplicates,return=representation',
      useServiceRole: true,
    },
  );

  if (modernResponse.ok) {
    return (await modernResponse.json().catch(() => null)) as
      | AcademyEnrollmentRow[]
      | null;
  }

  const modernError = await modernResponse.text();
  const legacyPayload = removeUndefinedValues({
    learner_email: learnerEmail,
    learner_name: learnerName,
    course_id: courseId,
    amount_cents: amountCents,
    currency,
    stripe_checkout_session_id: stripeCheckoutSessionId,
    stripe_customer_id: stripeCustomerId,
    status,
    completed_at: completedAt,
    updated_at: now,
  });

  const existing = await getAcademyEnrollmentForUser({
    userId,
    learnerEmail,
    courseId,
  });

  if (existing?.id) {
    const patchResponse = await academyRestFetch(
      `enrollments?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(legacyPayload),
        prefer: 'return=representation',
        useServiceRole: true,
      },
    );

    if (patchResponse.ok) {
      return (await patchResponse.json().catch(() => null)) as
        | AcademyEnrollmentRow[]
        | null;
    }
  }

  const legacyResponse = await academyRestFetch('enrollments', {
    method: 'POST',
    body: JSON.stringify(legacyPayload),
    prefer: 'return=representation',
    useServiceRole: true,
  });

  if (!legacyResponse.ok) {
    const legacyError = await legacyResponse.text();
    throw new Error(explainSupabaseEnrollmentError(legacyError || modernError));
  }

  return (await legacyResponse.json().catch(() => null)) as
    | AcademyEnrollmentRow[]
    | null;
}

export function explainSupabaseEnrollmentError(errorText: string) {
  if (/violates foreign key constraint/i.test(errorText)) {
    return 'This course must be published in the Academy Supabase courses table before enrollment is available.';
  }

  if (/Could not find|schema cache|column/i.test(errorText)) {
    return 'The Academy Supabase enrollment table needs the latest schema or compatibility fields.';
  }

  return errorText || 'Enrollment could not be saved. Check the Academy Supabase schema.';
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}
