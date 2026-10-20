import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { AcademyCheckoutPage } from '@/components/academy-checkout-page';
import { isFreeCourse } from '@/lib/academy-auth';
import { decodeRouteParam } from '@/lib/route-params';
import { getPublishedCoursesFromSupabase } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Secure checkout | Easy Medical Device Academy',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type CheckoutRouteProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CheckoutRoute({ params }: CheckoutRouteProps) {
  const { courseId: rawCourseId } = await params;
  const courseId = decodeRouteParam(rawCourseId);
  const courses = await getPublishedCoursesFromSupabase();
  const course = courses?.find(
    (item) => item.id === courseId || item.slug === courseId,
  );

  if (!course) {
    notFound();
  }

  // Free courses never need a payment form.
  if (isFreeCourse(course)) {
    redirect(`/academy/learn/${course.id}`);
  }

  return (
    <AcademyCheckoutPage
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        image: course.image,
        level: course.level,
        lessons: course.lessons,
        duration: course.duration,
        priceLabel: course.priceLabel,
        priceCents: Math.max(0, Math.round(course.price * 100)),
      }}
    />
  );
}
