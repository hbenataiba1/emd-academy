import {
  getAcademyCourseForAccess,
  getAcademyUserFromRequest,
  json,
  readJson,
} from '@/lib/academy-auth';
import { validateCoupon } from '@/lib/academy-coupons';

type ValidateBody = {
  courseId?: string;
  code?: string;
};

// Checks a coupon code for a course and returns the discounted total, without
// reserving anything. The real check happens again when checkout is created.
export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to continue.' }, 401);
  }

  const body = await readJson<ValidateBody>(request, {});
  const course = body.courseId
    ? await getAcademyCourseForAccess(body.courseId)
    : undefined;

  if (!course || !body.code) {
    return json({ valid: false, message: 'Enter a coupon code.' });
  }

  const result = await validateCoupon({
    code: body.code,
    userId: user.id,
    courseId: course.id,
    priceCents: Math.max(0, Math.round(course.price * 100)),
  });

  if (!result.ok) {
    return json({ valid: false, message: result.message });
  }

  return json({
    valid: true,
    code: result.coupon.code,
    priceCents: result.priceCents,
    discountCents: result.discountCents,
    finalCents: result.finalCents,
  });
}
