import { academyRestFetch, cleanEnv } from '@/lib/academy-auth';
import { sendAcademyEmail } from '@/lib/academy-email';
import {
  abandonedCheckoutEmail,
  certificateReadyEmail,
  courseChangesRequestedEmail,
  coursePublishedEmail,
  enrollmentFreeEmail,
  instructorApplicationEmail,
  instructorApprovedEmail,
  instructorPayoutEmail,
  instructorQuestionReminderEmail,
  instructorRejectedEmail,
  paymentFailedEmail,
  paymentReceiptEmail,
  purchaseConfirmationEmail,
  questionAnsweredEmail,
  surveyRequestEmail,
} from '@/lib/academy-email-messages';

// One place that decides when each automated email goes out. Every function is
// safe to call more than once: the email log makes sure nobody gets it twice, and
// a problem sending never reaches the learner's page.

type Learner = { userId: string; email: string; name?: string | null };

/** The learner's name for the greeting: profile, then enrollment, then the email. */
async function learnerName({ userId, email, name }: Learner) {
  if (name) return name;

  try {
    const profile = await academyRestFetch(
      `profiles?select=full_name&id=eq.${encodeURIComponent(userId)}&limit=1`,
      { useServiceRole: true },
    );
    if (profile.ok) {
      const row = ((await profile.json()) as { full_name?: string | null }[])[0];
      if (row?.full_name) return row.full_name;
    }

    const enrollment = await academyRestFetch(
      `enrollments?select=learner_name&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { useServiceRole: true },
    );
    if (enrollment.ok) {
      const row = ((await enrollment.json()) as { learner_name?: string | null }[])[0];
      if (row?.learner_name) return row.learner_name;
    }
  } catch {
    // Fall back to the email address below.
  }

  return email.split('@')[0];
}

async function isEnrolled(userId: string, courseId: string) {
  try {
    const response = await academyRestFetch(
      `enrollments?select=status&user_id=eq.${encodeURIComponent(userId)}&course_id=eq.${encodeURIComponent(courseId)}&status=in.(active,completed)&limit=1`,
      { useServiceRole: true },
    );
    if (!response.ok) return false;
    return ((await response.json()) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

export async function notifyFreeEnrollment(
  learner: Learner & { courseId: string; courseTitle: string },
) {
  const name = await learnerName(learner);
  const mail = enrollmentFreeEmail({ name, courseTitle: learner.courseTitle, courseId: learner.courseId });

  await sendAcademyEmail({
    to: learner.email,
    ...mail,
    templateKey: 'enrollment_free',
    templateName: 'Free course enrollment',
    recipientName: name,
    recipientUserId: learner.userId,
    dedupeKey: `enrolled:${learner.userId}:${learner.courseId}`,
    metadata: { course_id: learner.courseId },
  });
}

type PaidSession = {
  id: string;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: { course_id?: string; course_title?: string } | null;
};

async function stripeReceiptUrl(paymentIntentId: string) {
  const secret = cleanEnv(process.env.STRIPE_SECRET_KEY);
  if (!secret) return null;

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
      {
        headers: { authorization: `Bearer ${secret}`, 'stripe-version': '2024-06-20' },
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { latest_charge?: { receipt_url?: string } | null };
    return payload.latest_charge?.receipt_url || null;
  } catch {
    return null;
  }
}

/** A paid checkout: the "access is ready" email and the receipt. */
export async function notifyPurchase(learner: Learner, session: PaidSession) {
  const courseId = session.metadata?.course_id;
  if (!courseId) return;

  const name = await learnerName(learner);
  const courseTitle = session.metadata?.course_title || 'your course';
  const common = {
    to: learner.email,
    recipientName: name,
    recipientUserId: learner.userId,
    metadata: { course_id: courseId, checkout_session: session.id },
  };

  const confirmation = purchaseConfirmationEmail({ name, courseTitle, courseId });
  await sendAcademyEmail({
    ...common,
    ...confirmation,
    templateKey: 'purchase_confirmation',
    templateName: 'Purchase confirmation',
    dedupeKey: `purchase:${session.id}`,
  });

  const amountCents = session.amount_total || 0;
  if (amountCents <= 0) return;

  const receiptUrl =
    typeof session.payment_intent === 'string' ? await stripeReceiptUrl(session.payment_intent) : null;
  const receipt = paymentReceiptEmail({
    name,
    courseTitle,
    amountCents,
    currency: session.currency || 'usd',
    receiptUrl,
  });
  await sendAcademyEmail({
    ...common,
    ...receipt,
    templateKey: 'payment_receipt',
    templateName: 'Payment receipt',
    dedupeKey: `receipt:${session.id}`,
  });
}

export async function notifyPaymentFailed(
  intent: {
    id: string;
    metadata?: { user_id?: string; learner_email?: string; course_id?: string; course_title?: string } | null;
    last_payment_error?: { message?: string } | null;
  },
) {
  const { user_id: userId, learner_email: email, course_id: courseId } = intent.metadata || {};
  if (!userId || !email || !courseId) return;

  const name = await learnerName({ userId, email });
  const mail = paymentFailedEmail({
    name,
    courseTitle: intent.metadata?.course_title || 'your course',
    courseId,
    reason: intent.last_payment_error?.message,
  });

  await sendAcademyEmail({
    to: email,
    ...mail,
    templateKey: 'payment_failed',
    templateName: 'Payment failed',
    recipientName: name,
    recipientUserId: userId,
    dedupeKey: `payment_failed:${intent.id}`,
    metadata: { course_id: courseId, payment_intent: intent.id },
  });
}

/** A checkout that expired without being paid (a few hours after it was started). */
export async function notifyAbandonedCheckout(session: {
  id: string;
  metadata?: { user_id?: string; learner_email?: string; course_id?: string; course_title?: string } | null;
}) {
  const { user_id: userId, learner_email: email, course_id: courseId } = session.metadata || {};
  if (!userId || !email || !courseId) return;

  // They paid in the meantime (a newer checkout): nothing to chase.
  if (await isEnrolled(userId, courseId)) return;

  const name = await learnerName({ userId, email });
  const mail = abandonedCheckoutEmail({
    name,
    courseTitle: session.metadata?.course_title || 'your course',
    courseId,
  });

  await sendAcademyEmail({
    to: email,
    ...mail,
    templateKey: 'abandoned_checkout',
    templateName: 'Abandoned checkout',
    recipientName: name,
    recipientUserId: userId,
    // At most one reminder per learner, course and day.
    dedupeKey: `abandoned:${userId}:${courseId}:${new Date().toISOString().slice(0, 10)}`,
    metadata: { course_id: courseId, checkout_session: session.id },
  });
}

/** Only for a certificate that was just issued, so old certificates never trigger it. */
export async function notifyCertificateReady(
  learner: Learner & {
    courseTitle: string;
    certificate: { certificate_number: string; issued_at: string };
  },
) {
  const issued = new Date(learner.certificate.issued_at).getTime();
  if (!Number.isFinite(issued) || Date.now() - issued > 10 * 60_000) return;

  const name = await learnerName(learner);
  const mail = certificateReadyEmail({
    name,
    courseTitle: learner.courseTitle,
    certificateNumber: learner.certificate.certificate_number,
  });

  await sendAcademyEmail({
    to: learner.email,
    ...mail,
    templateKey: 'certificate_ready',
    templateName: 'Certificate ready',
    recipientName: name,
    recipientUserId: learner.userId,
    dedupeKey: `certificate:${learner.certificate.certificate_number}`,
    metadata: { certificate_number: learner.certificate.certificate_number },
  });
}

/** Sent by the daily job, a day after the learner earned the certificate. */
export async function notifySurveyRequest(
  learner: Learner & { courseId: string; courseTitle: string },
) {
  const name = await learnerName(learner);
  const mail = surveyRequestEmail({ name, courseTitle: learner.courseTitle, courseId: learner.courseId });

  return sendAcademyEmail({
    to: learner.email,
    ...mail,
    templateKey: 'survey_request',
    templateName: 'Survey request',
    recipientName: name,
    recipientUserId: learner.userId,
    dedupeKey: `survey:${learner.userId}:${learner.courseId}`,
    metadata: { course_id: learner.courseId },
  });
}

/** A team reply to a learner's question: tell the learner who asked it. */
export async function notifyQuestionAnswered(replyId: string) {
  try {
    const replyResponse = await academyRestFetch(
      `lesson_comments?select=id,course_id,lesson_id,author_name,is_staff,parent_id,body&id=eq.${encodeURIComponent(replyId)}&limit=1`,
      { useServiceRole: true },
    );
    const reply = replyResponse.ok
      ? ((await replyResponse.json()) as {
          id: string;
          course_id: string;
          lesson_id: string;
          author_name: string;
          is_staff: boolean;
          parent_id: string | null;
          body: string;
        }[])[0]
      : null;
    if (!reply || !reply.is_staff || !reply.parent_id) return { sent: false, reason: 'not_a_team_reply' };

    const rootResponse = await academyRestFetch(
      `lesson_comments?select=user_id,author_name,author_email,body&id=eq.${encodeURIComponent(reply.parent_id)}&limit=1`,
      { useServiceRole: true },
    );
    const root = rootResponse.ok
      ? ((await rootResponse.json()) as {
          user_id: string | null;
          author_name: string;
          author_email: string | null;
          body: string;
        }[])[0]
      : null;
    if (!root?.author_email) return { sent: false, reason: 'no_recipient' };

    const [courseResponse, lessonResponse] = await Promise.all([
      academyRestFetch(`courses?select=title&id=eq.${encodeURIComponent(reply.course_id)}&limit=1`, { useServiceRole: true }),
      academyRestFetch(`lessons?select=title&id=eq.${encodeURIComponent(reply.lesson_id)}&limit=1`, { useServiceRole: true }),
    ]);
    const courseTitle = courseResponse.ok
      ? ((await courseResponse.json()) as { title?: string }[])[0]?.title
      : undefined;
    const lessonTitle = lessonResponse.ok
      ? ((await lessonResponse.json()) as { title?: string }[])[0]?.title
      : undefined;

    const mail = questionAnsweredEmail({
      name: root.author_name,
      courseTitle: courseTitle || 'your course',
      courseId: reply.course_id,
      lessonTitle: lessonTitle || 'a lesson',
      question: root.body,
      answer: reply.body,
      answeredBy: reply.author_name,
    });

    return await sendAcademyEmail({
      to: root.author_email,
      ...mail,
      templateKey: 'question_answered',
      templateName: 'Question answered',
      recipientName: root.author_name,
      recipientUserId: root.user_id || undefined,
      dedupeKey: `question-answer:${reply.id}`,
      metadata: { course_id: reply.course_id, lesson_id: reply.lesson_id },
    });
  } catch {
    return { sent: false, reason: 'error' };
  }
}

/** The applicant gets a confirmation that the team will review the application. */
export async function notifyInstructorApplication({
  userId,
  email,
  name,
}: {
  userId: string;
  email: string;
  name: string;
}) {
  try {
    const mail = instructorApplicationEmail({ name });
    await sendAcademyEmail({
      to: email,
      ...mail,
      templateKey: 'instructor_application',
      templateName: 'Instructor application received',
      recipientName: name,
      recipientUserId: userId,
      // A new submission (also after a declined one) sends a new confirmation.
      dedupeKey: `instructor-application:${userId}:${new Date().toISOString().slice(0, 13)}`,
    });
  } catch {
    // The application is saved: a missing email never blocks it.
  }
}

/** The decision of the team on an application (called by the CRM). */
export async function notifyInstructorDecision(userId: string) {
  try {
    const response = await academyRestFetch(
      `instructors?select=status,full_name,email,review_note,reviewed_at&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { useServiceRole: true },
    );
    const row = response.ok
      ? ((await response.json()) as {
          status: string;
          full_name: string;
          email: string;
          review_note: string | null;
          reviewed_at: string | null;
        }[])[0]
      : null;
    if (!row || !['approved', 'rejected'].includes(row.status)) return { sent: false, reason: 'no_decision' };

    const mail =
      row.status === 'approved'
        ? instructorApprovedEmail({ name: row.full_name, note: row.review_note })
        : instructorRejectedEmail({ name: row.full_name, note: row.review_note });

    return await sendAcademyEmail({
      to: row.email,
      ...mail,
      templateKey: row.status === 'approved' ? 'instructor_approved' : 'instructor_rejected',
      templateName: row.status === 'approved' ? 'Instructor approved' : 'Instructor declined',
      recipientName: row.full_name,
      recipientUserId: userId,
      dedupeKey: `instructor-${row.status}:${userId}:${row.reviewed_at || ''}`,
    });
  } catch {
    return { sent: false, reason: 'error' };
  }
}

/** A decision of the team on an instructor course (called by the CRM). */
export async function notifyCourseDecision(courseId: string, event: 'changes_requested' | 'published') {
  try {
    const courseResponse = await academyRestFetch(
      `courses?select=id,title,instructor_id,review_note,updated_at&id=eq.${encodeURIComponent(courseId)}&limit=1`,
      { useServiceRole: true },
    );
    const course = courseResponse.ok
      ? ((await courseResponse.json()) as {
          id: string;
          title: string;
          instructor_id: string | null;
          review_note: string | null;
          updated_at: string;
        }[])[0]
      : null;
    if (!course?.instructor_id) return { sent: false, reason: 'no_instructor' };

    const instructorResponse = await academyRestFetch(
      `instructors?select=full_name,email&user_id=eq.${encodeURIComponent(course.instructor_id)}&limit=1`,
      { useServiceRole: true },
    );
    const instructor = instructorResponse.ok
      ? ((await instructorResponse.json()) as { full_name: string; email: string }[])[0]
      : null;
    if (!instructor) return { sent: false, reason: 'no_recipient' };

    const mail =
      event === 'published'
        ? coursePublishedEmail({ name: instructor.full_name, courseTitle: course.title, courseId: course.id })
        : courseChangesRequestedEmail({
            name: instructor.full_name,
            courseTitle: course.title,
            courseId: course.id,
            note: course.review_note || 'Please check your course and send it again.',
          });

    return await sendAcademyEmail({
      to: instructor.email,
      ...mail,
      templateKey: event === 'published' ? 'course_published' : 'course_changes_requested',
      templateName: event === 'published' ? 'Course published' : 'Course changes requested',
      recipientName: instructor.full_name,
      recipientUserId: course.instructor_id,
      dedupeKey: `course-${event}:${course.id}:${course.updated_at}`,
      metadata: { course_id: course.id },
    });
  } catch {
    return { sent: false, reason: 'error' };
  }
}

/** The instructor is told when a payment was sent (called by the CRM). */
export async function notifyInstructorPayout(payoutId: string) {
  try {
    const payoutResponse = await academyRestFetch(
      `instructor_payouts?select=id,instructor_id,amount_cents,currency,method,reference&id=eq.${encodeURIComponent(payoutId)}&limit=1`,
      { useServiceRole: true },
    );
    const payout = payoutResponse.ok
      ? ((await payoutResponse.json()) as {
          id: string;
          instructor_id: string;
          amount_cents: number;
          currency: string;
          method: string;
          reference: string | null;
        }[])[0]
      : null;
    if (!payout) return { sent: false, reason: 'no_payout' };

    const instructorResponse = await academyRestFetch(
      `instructors?select=full_name,email&user_id=eq.${encodeURIComponent(payout.instructor_id)}&limit=1`,
      { useServiceRole: true },
    );
    const instructor = instructorResponse.ok
      ? ((await instructorResponse.json()) as { full_name: string; email: string }[])[0]
      : null;
    if (!instructor) return { sent: false, reason: 'no_recipient' };

    const mail = instructorPayoutEmail({
      name: instructor.full_name,
      amountCents: payout.amount_cents,
      currency: payout.currency,
      method: payout.method,
      reference: payout.reference,
    });

    return await sendAcademyEmail({
      to: instructor.email,
      ...mail,
      templateKey: 'instructor_payout',
      templateName: 'Instructor payout sent',
      recipientName: instructor.full_name,
      recipientUserId: payout.instructor_id,
      dedupeKey: `payout:${payout.id}`,
    });
  } catch {
    return { sent: false, reason: 'error' };
  }
}

// ─── Reminders to instructors ────────────────────────────────────────────────

/** A question is mentioned only once it has waited this long... */
const REMINDER_AFTER_DAYS = 3;
/** ...and not any more after this long (very old questions are left alone). */
const REMINDER_UNTIL_DAYS = 30;
/** One instructor never gets two reminders closer than this. */
const REMINDER_EVERY_DAYS = 4;

async function rows<T>(path: string): Promise<T[]> {
  const response = await academyRestFetch(path, { useServiceRole: true });
  return response.ok ? ((await response.json()) as T[]) : [];
}

/**
 * Runs once a day. An instructor with questions that waited at least 3 days gets ONE short
 * email listing them, and then nothing for at least 4 days, whatever happens. Questions
 * older than 30 days are not mentioned. Instructors with nothing waiting get nothing.
 */
export async function remindInstructorsOfQuestions() {
  const now = Date.now();
  const day = 86_400_000;
  const result = { instructors: 0, sent: 0, skipped: 0 };

  const instructors = await rows<{ user_id: string; full_name: string; email: string }>(
    'instructors?select=user_id,full_name,email&status=eq.approved',
  );
  if (instructors.length === 0) return result;

  const courses = await rows<{ id: string; title: string; instructor_id: string }>(
    `courses?select=id,title,instructor_id&instructor_id=in.(${instructors.map((row) => row.user_id).join(',')})`,
  );
  if (courses.length === 0) return result;

  const courseIds = courses.map((course) => encodeURIComponent(course.id)).join(',');
  const since = new Date(now - REMINDER_UNTIL_DAYS * day).toISOString();
  const comments = await rows<{
    id: string;
    course_id: string;
    lesson_id: string;
    parent_id: string | null;
    is_staff: boolean;
    body: string;
    created_at: string;
  }>(
    `lesson_comments?select=id,course_id,lesson_id,parent_id,is_staff,body,created_at&course_id=in.(${courseIds})&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=5000`,
  );

  const answered = new Set(comments.filter((row) => row.is_staff && row.parent_id).map((row) => row.parent_id));
  const waiting = comments.filter(
    (row) =>
      !row.parent_id &&
      !row.is_staff &&
      !answered.has(row.id) &&
      now - new Date(row.created_at).getTime() >= REMINDER_AFTER_DAYS * day,
  );
  if (waiting.length === 0) return result;

  const lessons = await rows<{ id: string; title: string }>(
    `lessons?select=id,title&id=in.(${[...new Set(waiting.map((row) => row.lesson_id))].map(encodeURIComponent).join(',')})`,
  );
  const lessonTitles = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const courseById = new Map(courses.map((course) => [course.id, course]));

  for (const instructor of instructors) {
    const own = waiting.filter((row) => courseById.get(row.course_id)?.instructor_id === instructor.user_id);
    if (own.length === 0) continue;
    result.instructors += 1;

    // Not disturbing: at most one reminder every few days.
    const recent = await rows<{ id: string }>(
      `email_logs?select=id&template_key=eq.instructor_question_reminder&recipient_user_id=eq.${encodeURIComponent(instructor.user_id)}&status=neq.failed&created_at=gte.${encodeURIComponent(new Date(now - REMINDER_EVERY_DAYS * day).toISOString())}&limit=1`,
    );
    if (recent.length > 0) {
      result.skipped += 1;
      continue;
    }

    const mail = instructorQuestionReminderEmail({
      name: instructor.full_name,
      total: own.length,
      items: own.map((row) => ({
        courseTitle: courseById.get(row.course_id)?.title || 'Your course',
        lessonTitle: lessonTitles.get(row.lesson_id) || 'a lesson',
        question: row.body,
        waitingDays: Math.floor((now - new Date(row.created_at).getTime()) / day),
      })),
    });

    const sent = await sendAcademyEmail({
      to: instructor.email,
      ...mail,
      templateKey: 'instructor_question_reminder',
      templateName: 'Instructor question reminder',
      recipientName: instructor.full_name,
      recipientUserId: instructor.user_id,
      // One per day at most, even if the job runs twice.
      dedupeKey: `question-reminder:${instructor.user_id}:${new Date(now).toISOString().slice(0, 10)}`,
      metadata: { waiting: own.length },
    });

    if (sent.sent) result.sent += 1;
    else result.skipped += 1;
  }

  return result;
}
