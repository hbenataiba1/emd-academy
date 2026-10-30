import { academyRestFetch, json, readJson } from '@/lib/academy-auth';
import { getOwnCourses, requireInstructor } from '@/lib/academy-instructor';

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'amount';
  percent_off: number | null;
  amount_off_cents: number | null;
  max_redemptions: number | null;
  max_per_user: number;
  expires_at: string | null;
  course_ids: string[] | null;
  is_active: boolean;
  created_at: string;
};

const MISSING = /instructor_id|coupons|schema cache|does not exist/i;

// The instructor's coupons, with how many times each was used.
export async function GET(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const courses = await getOwnCourses(auth.user.id);
  const response = await academyRestFetch(
    `coupons?select=id,code,description,discount_type,percent_off,amount_off_cents,max_redemptions,max_per_user,expires_at,course_ids,is_active,created_at&instructor_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc`,
    { useServiceRole: true },
  );

  if (!response.ok) {
    const text = await response.text();
    if (MISSING.test(text)) return json({ available: false, coupons: [], courses });
    return json({ message: 'Your coupons could not be loaded.' }, 502);
  }

  const coupons = (await response.json()) as CouponRow[];
  const used = new Map<string, number>();
  if (coupons.length) {
    const usage = await academyRestFetch(
      `coupon_redemptions?select=coupon_id&status=eq.redeemed&coupon_id=in.(${coupons.map((c) => c.id).join(',')})`,
      { useServiceRole: true },
    );
    if (usage.ok) {
      ((await usage.json()) as { coupon_id: string }[]).forEach((row) =>
        used.set(row.coupon_id, (used.get(row.coupon_id) || 0) + 1),
      );
    }
  }

  return json({
    available: true,
    courses: courses.map((course) => ({ id: course.id, title: course.title })),
    coupons: coupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discount_type,
      percentOff: coupon.percent_off,
      amountOffCents: coupon.amount_off_cents,
      maxRedemptions: coupon.max_redemptions,
      maxPerUser: coupon.max_per_user,
      expiresAt: coupon.expires_at,
      courseIds: coupon.course_ids || [],
      isActive: coupon.is_active,
      redeemed: used.get(coupon.id) || 0,
    })),
  });
}

// Creates a coupon that only works on the instructor's own courses.
export async function POST(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const body = await readJson<{
    code?: string;
    description?: string;
    discountType?: string;
    value?: number;
    maxRedemptions?: number | null;
    maxPerUser?: number;
    expiresAt?: string | null;
    courseIds?: string[];
  }>(request, {});

  const code = String(body.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return json({ message: 'The code must be 3-32 characters: letters, numbers, dashes or underscores.' }, 400);
  }

  const isPercent = body.discountType !== 'amount';
  const value = Number(body.value);
  if (isPercent && (!Number.isFinite(value) || value <= 0 || value > 100)) {
    return json({ message: 'A percentage discount must be between 1 and 100.' }, 400);
  }
  if (!isPercent && (!Number.isFinite(value) || value <= 0)) {
    return json({ message: 'A fixed discount must be greater than zero.' }, 400);
  }

  const owned = new Set((await getOwnCourses(auth.user.id)).map((course) => course.id));
  const courseIds = (body.courseIds || []).filter((id) => owned.has(id));
  if (courseIds.length === 0) {
    return json({ message: 'Choose at least one of your courses.' }, 400);
  }

  const maxRedemptions =
    body.maxRedemptions === null || body.maxRedemptions === undefined || String(body.maxRedemptions) === ''
      ? null
      : Math.floor(Number(body.maxRedemptions));
  if (maxRedemptions !== null && (!Number.isFinite(maxRedemptions) || maxRedemptions < 1)) {
    return json({ message: 'Total uses must be at least 1, or empty for unlimited.' }, 400);
  }

  const maxPerUser = Math.floor(Number(body.maxPerUser ?? 1));
  if (!Number.isFinite(maxPerUser) || maxPerUser < 1) {
    return json({ message: 'Uses per learner must be at least 1.' }, 400);
  }

  const expires = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expires && Number.isNaN(expires.getTime())) return json({ message: 'The end date is not valid.' }, 400);

  const response = await academyRestFetch('coupons', {
    method: 'POST',
    body: JSON.stringify({
      code,
      description: String(body.description || '').trim().slice(0, 200) || null,
      discount_type: isPercent ? 'percent' : 'amount',
      percent_off: isPercent ? value : null,
      amount_off_cents: isPercent ? null : Math.round(value * 100),
      max_redemptions: maxRedemptions,
      max_per_user: maxPerUser,
      expires_at: expires ? expires.toISOString() : null,
      course_ids: courseIds,
      is_active: true,
      instructor_id: auth.user.id,
    }),
    prefer: 'return=minimal',
    useServiceRole: true,
  });

  if (!response.ok) {
    const text = await response.text();
    if (/duplicate key|unique/i.test(text)) {
      return json({ message: `The code ${code} already exists. Choose another code.` }, 409);
    }
    return json({ message: MISSING.test(text) ? 'Coupons are not available yet.' : 'The coupon could not be saved.' }, 502);
  }

  return json({ saved: true });
}

// Turns one of the instructor's coupons on or off.
export async function PATCH(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ id?: string; isActive?: boolean }>(request, {});
  if (!body.id) return json({ message: 'Missing coupon.' }, 400);

  const response = await academyRestFetch(
    `coupons?id=eq.${encodeURIComponent(body.id)}&instructor_id=eq.${encodeURIComponent(auth.user.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ is_active: Boolean(body.isActive), updated_at: new Date().toISOString() }),
      prefer: 'return=minimal',
      useServiceRole: true,
    },
  );
  return response.ok ? json({ saved: true }) : json({ message: 'The coupon could not be changed.' }, 502);
}

// Deletes one of the instructor's coupons.
export async function DELETE(request: Request) {
  const auth = await requireInstructor(request);
  if (auth instanceof Response) return auth;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ message: 'Missing coupon.' }, 400);

  const response = await academyRestFetch(
    `coupons?id=eq.${encodeURIComponent(id)}&instructor_id=eq.${encodeURIComponent(auth.user.id)}`,
    { method: 'DELETE', useServiceRole: true },
  );
  return response.ok ? json({ deleted: true }) : json({ message: 'The coupon could not be deleted.' }, 502);
}
