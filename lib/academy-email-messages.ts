import { SITE, escapeHtml, layout } from '@/lib/academy-email-templates';

// The automated emails after signup: enrollment, payment, certificate and survey.
// Each returns the subject plus the HTML and plain-text bodies.

type Built = { subject: string; html: string; text: string };

function firstNameOf(name: string) {
  return (name || '').trim().split(/\s+/)[0] || 'there';
}

function paragraph(value: string) {
  return `<p style="margin:0 0 16px;">${value}</p>`;
}

function detailsTable(rows: Array<[string, string]>) {
  const body = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:10px 14px;font-size:13px;color:#6e687d;border-bottom:1px solid #ede8fb;">${escapeHtml(label)}</td>
        <td style="padding:10px 14px;font-size:14px;font-weight:700;color:#191625;text-align:right;border-bottom:1px solid #ede8fb;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;background:#faf8ff;border:1px solid #ede8fb;border-radius:12px;">${body}</table>`;
}

export function formatEmailMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
  }
}

function formatEmailDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const lines = (items: string[]) => items.join('\n');

export function courseUrl(courseId: string) {
  return `${SITE}/academy/learn/${encodeURIComponent(courseId)}`;
}

type CourseEmail = { name: string; courseTitle: string; courseId: string };

/** Free course (or a course fully covered by a coupon): "you are in". */
export function enrollmentFreeEmail({ name, courseTitle, courseId }: CourseEmail): Built {
  const first = firstNameOf(name);
  const href = courseUrl(courseId);
  const html = layout({
    preview: `You now have access to ${courseTitle}.`,
    eyebrow: 'Enrollment confirmed',
    title: "You're in!",
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, you are now enrolled in <strong>${escapeHtml(courseTitle)}</strong>. It is ready whenever you are, and your progress is saved automatically.`,
      ) + paragraph('Pass the final exam to earn a certificate you can verify and share on LinkedIn.'),
    cta: { label: 'Start course', href },
  });
  return {
    subject: `You're enrolled: ${courseTitle}`,
    html,
    text: lines([`Hi ${first},`, '', `You are now enrolled in ${courseTitle}.`, '', `Start course: ${href}`]),
  };
}

/** Paid course unlocked. */
export function purchaseConfirmationEmail({ name, courseTitle, courseId }: CourseEmail): Built {
  const first = firstNameOf(name);
  const href = courseUrl(courseId);
  const html = layout({
    preview: `Thank you for your purchase. ${courseTitle} is unlocked.`,
    eyebrow: 'Purchase confirmed',
    title: 'Thank you for your purchase',
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, your payment went through and <strong>${escapeHtml(courseTitle)}</strong> is now unlocked. You have full access to every lesson and resource.`,
      ) +
      paragraph(
        'Your receipt is in a separate email, and you can always find it under Billing &amp; invoices in your account.',
      ),
    cta: { label: 'Start course', href },
  });
  return {
    subject: `Your access to ${courseTitle} is ready`,
    html,
    text: lines([`Hi ${first},`, '', `Your payment went through and ${courseTitle} is now unlocked.`, '', `Start course: ${href}`]),
  };
}

/** Receipt: amount, date and a link to the Stripe receipt. */
export function paymentReceiptEmail({
  name,
  courseTitle,
  amountCents,
  currency,
  receiptUrl,
  paidAt,
}: {
  name: string;
  courseTitle: string;
  amountCents: number;
  currency: string;
  receiptUrl?: string | null;
  paidAt?: string;
}): Built {
  const first = firstNameOf(name);
  const href = receiptUrl || `${SITE}/academy/billing`;
  const amount = formatEmailMoney(amountCents, currency);
  const html = layout({
    preview: `Receipt for your ${amount} payment.`,
    eyebrow: 'Payment receipt',
    title: 'Your receipt',
    content:
      paragraph(`Hi ${escapeHtml(first)}, here is the receipt for your purchase.`) +
      detailsTable([
        ['Course', courseTitle],
        ['Amount paid', amount],
        ['Date', formatEmailDate(paidAt)],
      ]) +
      paragraph(
        '<span style="font-size:14px;color:#625b75;">All your receipts and invoices are also under Billing &amp; invoices in your account.</span>',
      ),
    cta: { label: receiptUrl ? 'View receipt' : 'Open billing', href },
  });
  return {
    subject: `Your receipt for ${courseTitle}`,
    html,
    text: lines([
      `Hi ${first},`,
      '',
      `Receipt: ${courseTitle}`,
      `Amount paid: ${amount}`,
      `Date: ${formatEmailDate(paidAt)}`,
      '',
      `${receiptUrl ? 'View receipt' : 'Billing'}: ${href}`,
    ]),
  };
}

/** The card was declined or the payment failed: a way to try again. */
export function paymentFailedEmail({
  name,
  courseTitle,
  courseId,
  reason,
}: CourseEmail & { reason?: string }): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/checkout/${encodeURIComponent(courseId)}`;
  const html = layout({
    preview: 'Your payment did not go through. You can try again in a minute.',
    eyebrow: 'Payment failed',
    title: "Your payment didn't go through",
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, we could not complete your payment for <strong>${escapeHtml(courseTitle)}</strong>. You have not been charged.`,
      ) +
      (reason
        ? paragraph(
            `<span style="display:block;padding:12px 14px;background:#fff8f8;border:1px solid #efd2d2;border-radius:10px;font-size:14px;color:#8f2d2d;">${escapeHtml(reason)}</span>`,
          )
        : '') +
      paragraph(
        'You can try again with the same card or a different one. If it keeps failing, reply to this email and we will help.',
      ),
    cta: { label: 'Try again', href },
  });
  return {
    subject: `Your payment for ${courseTitle} did not go through`,
    html,
    text: lines([
      `Hi ${first},`,
      '',
      `We could not complete your payment for ${courseTitle}. You have not been charged.`,
      reason ? `Reason: ${reason}` : '',
      '',
      `Try again: ${href}`,
    ]),
  };
}

/** A checkout was started but never paid. */
export function abandonedCheckoutEmail({ name, courseTitle, courseId }: CourseEmail): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/checkout/${encodeURIComponent(courseId)}`;
  const html = layout({
    preview: 'Your course is waiting. Pick up where you left off.',
    eyebrow: 'Your course is waiting',
    title: 'Still interested?',
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, you started enrolling in <strong>${escapeHtml(courseTitle)}</strong> but did not finish. Nothing was charged, and your spot is one click away.`,
      ) +
      paragraph(
        'You get practical lessons, resources, and a certificate you can share once you pass the exam.',
      ),
    cta: { label: 'Complete my enrollment', href },
  });
  return {
    subject: `Still interested in ${courseTitle}?`,
    html,
    text: lines([
      `Hi ${first},`,
      '',
      `You started enrolling in ${courseTitle} but did not finish. Nothing was charged.`,
      '',
      `Complete my enrollment: ${href}`,
    ]),
  };
}

/** Certificate earned: link to the verifiable page, where the PDF can be downloaded. */
export function certificateReadyEmail({
  name,
  courseTitle,
  certificateNumber,
}: {
  name: string;
  courseTitle: string;
  certificateNumber: string;
}): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/verify/${encodeURIComponent(certificateNumber)}`;
  const html = layout({
    preview: 'Your certificate is ready to download and share.',
    eyebrow: 'Certificate ready',
    title: `Congratulations, ${first}!`,
    content:
      paragraph(
        `You passed the exam and earned your certificate for <strong>${escapeHtml(courseTitle)}</strong>.`,
      ) +
      detailsTable([
        ['Course', courseTitle],
        ['Certificate number', certificateNumber],
      ]) +
      paragraph(
        'Open your certificate to <strong>download it as a PDF</strong> and share it. Anyone can check that it is genuine with its number or QR code.',
      ),
    cta: { label: 'View & download certificate', href },
  });
  return {
    subject: `Congratulations! Your certificate for ${courseTitle}`,
    html,
    text: lines([
      `Congratulations, ${first}!`,
      '',
      `You earned your certificate for ${courseTitle}.`,
      `Certificate number: ${certificateNumber}`,
      '',
      `View and download the PDF: ${href}`,
    ]),
  };
}

/** A day after finishing: ask for stars and a short comment. */
export function surveyRequestEmail({ name, courseTitle, courseId }: CourseEmail): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/feedback/${encodeURIComponent(courseId)}`;
  const html = layout({
    preview: 'It takes 30 seconds: rate the course and leave a short comment.',
    eyebrow: 'Quick survey',
    title: 'How was your course?',
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, congratulations again on finishing <strong>${escapeHtml(courseTitle)}</strong>.`,
      ) +
      paragraph(
        'Would you rate it? Choose a star rating and, if you like, add a short comment. It takes about 30 seconds and helps us improve the course for the next learners.',
      ),
    cta: { label: 'Rate this course', href },
  });
  return {
    subject: `How was ${courseTitle}?`,
    html,
    text: lines([`Hi ${first},`, '', `How was ${courseTitle}? Rate it in 30 seconds:`, href]),
  };
}

function quote(value: string) {
  return `<div style="margin:0 0 16px;padding:12px 16px;border-left:4px solid #c4b5fd;background:#faf8ff;border-radius:0 10px 10px 0;font-size:14px;line-height:1.6;color:#3b3650;white-space:pre-line;">${escapeHtml(value)}</div>`;
}

function shorten(value: string, max: number) {
  const text = (value || '').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** A team member answered a question the learner asked under a lesson. */
export function questionAnsweredEmail({
  name,
  courseTitle,
  courseId,
  lessonTitle,
  question,
  answer,
  answeredBy,
}: CourseEmail & { lessonTitle: string; question: string; answer: string; answeredBy: string }): Built {
  const first = firstNameOf(name);
  const href = courseUrl(courseId);
  const html = layout({
    preview: `${answeredBy} answered your question.`,
    eyebrow: 'Your question was answered',
    title: 'You have an answer',
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, ${escapeHtml(answeredBy)} answered your question on <strong>${escapeHtml(lessonTitle)}</strong> in <strong>${escapeHtml(courseTitle)}</strong>.`,
      ) +
      `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6e687d;">Your question</p>` +
      quote(shorten(question, 400)) +
      `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6e687d;">${escapeHtml(answeredBy)}'s answer</p>` +
      quote(shorten(answer, 1500)),
    cta: { label: 'Open the course', href },
  });
  return {
    subject: `${answeredBy} answered your question`,
    html,
    text: lines([
      `Hi ${first},`,
      '',
      `${answeredBy} answered your question on "${lessonTitle}" (${courseTitle}).`,
      '',
      `Your question: ${shorten(question, 400)}`,
      '',
      `Answer: ${shorten(answer, 1500)}`,
      '',
      href,
    ]),
  };
}

/** The application was received: the team will review it. */
export function instructorApplicationEmail({ name }: { name: string }): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/instructor/apply`;
  const html = layout({
    preview: 'We received your application to teach on the Academy.',
    eyebrow: 'Instructor application',
    title: 'We received your application',
    content:
      paragraph(`Hi ${escapeHtml(first)}, thank you for applying to teach on Easy Medical Device Academy.`) +
      paragraph(
        'Our team will review your background and your LinkedIn profile. We will email you as soon as we have made a decision. You can check the status of your application at any time.',
      ),
    cta: { label: 'View my application', href },
  });
  return {
    subject: 'We received your instructor application',
    html,
    text: lines([`Hi ${first},`, '', 'Thank you for applying to teach on Easy Medical Device Academy. We will review your application and email you soon.', href]),
  };
}

/** The application was approved: the instructor dashboard is open. */
export function instructorApprovedEmail({ name, note }: { name: string; note?: string | null }): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/instructor`;
  const html = layout({
    preview: 'Your application was approved. Your instructor dashboard is ready.',
    eyebrow: 'Application approved',
    title: 'Welcome to the faculty',
    content:
      paragraph(`Hi ${escapeHtml(first)}, great news: your application was approved. You can now teach on Easy Medical Device Academy.`) +
      (note ? paragraph(`<em>${escapeHtml(note)}</em>`) : '') +
      paragraph('Open your instructor dashboard to get started.'),
    cta: { label: 'Open my instructor dashboard', href },
  });
  return {
    subject: 'Your instructor application was approved',
    html,
    text: lines([`Hi ${first},`, '', 'Your application was approved. Open your instructor dashboard:', href, ...(note ? ['', note] : [])]),
  };
}

/** The application was declined, with the reason written by the team. */
export function instructorRejectedEmail({ name, note }: { name: string; note?: string | null }): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/instructor/apply`;
  const html = layout({
    preview: 'An update on your instructor application.',
    eyebrow: 'Application update',
    title: 'About your application',
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, thank you for your interest in teaching on Easy Medical Device Academy. After reviewing your application, we are not able to approve it at this time.`,
      ) +
      (note ? paragraph(`<strong>Note from the team:</strong><br>${escapeHtml(note)}`) : '') +
      paragraph('You are welcome to update your application and send it again.'),
    cta: { label: 'Update my application', href },
  });
  return {
    subject: 'An update on your instructor application',
    html,
    text: lines([`Hi ${first},`, '', 'We are not able to approve your application at this time.', ...(note ? ['', `Note: ${note}`] : []), '', href]),
  };
}

/** The team asks the instructor to change their course before it can go online. */
export function courseChangesRequestedEmail({
  name,
  courseTitle,
  courseId,
  note,
}: {
  name: string;
  courseTitle: string;
  courseId: string;
  note: string;
}): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/instructor/courses/${encodeURIComponent(courseId)}`;
  const html = layout({
    preview: `Changes requested on ${courseTitle}.`,
    eyebrow: 'Course review',
    title: 'A few changes are needed',
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, we reviewed <strong>${escapeHtml(courseTitle)}</strong>. Thank you for your work: before we can publish it, we need you to change the following.`,
      ) +
      quote(note) +
      paragraph('Update your course and send it for review again when you are ready.'),
    cta: { label: 'Edit my course', href },
  });
  return {
    subject: `Changes needed on "${courseTitle}"`,
    html,
    text: lines([`Hi ${first},`, '', `We reviewed "${courseTitle}". Before we can publish it:`, '', note, '', href]),
  };
}

/** The course is online. */
export function coursePublishedEmail({
  name,
  courseTitle,
  courseId,
}: {
  name: string;
  courseTitle: string;
  courseId: string;
}): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/course/${encodeURIComponent(courseId)}`;
  const html = layout({
    preview: `${courseTitle} is now online.`,
    eyebrow: 'Course published',
    title: 'Your course is online',
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, great news: <strong>${escapeHtml(courseTitle)}</strong> is now published on Easy Medical Device Academy. Learners can find it and enroll.`,
      ) + paragraph('Share the link with your network to welcome your first learners.'),
    cta: { label: 'See my course', href },
  });
  return {
    subject: `"${courseTitle}" is now online`,
    html,
    text: lines([`Hi ${first},`, '', `"${courseTitle}" is now published. See it here:`, href]),
  };
}

/** A payment was sent to the instructor. */
export function instructorPayoutEmail({
  name,
  amountCents,
  currency,
  method,
  reference,
}: {
  name: string;
  amountCents: number;
  currency: string;
  method: string;
  reference?: string | null;
}): Built {
  const first = firstNameOf(name);
  const amount = formatEmailMoney(amountCents, currency);
  const href = `${SITE}/academy/instructor/earnings`;
  const html = layout({
    preview: `We sent you ${amount}.`,
    eyebrow: 'Payment sent',
    title: `We sent you ${amount}`,
    content:
      paragraph(`Hi ${escapeHtml(first)}, we just sent you the earnings from your courses.`) +
      detailsTable([
        ['Amount', amount],
        ['Method', method],
        ...(reference ? ([['Reference', reference]] as Array<[string, string]>) : []),
      ]) +
      paragraph('You can see every sale and payment in the Earnings page of your dashboard.'),
    cta: { label: 'See my earnings', href },
  });
  return {
    subject: `We sent you ${amount}`,
    html,
    text: lines([`Hi ${first},`, '', `We sent you ${amount} (${method}${reference ? `, ref. ${reference}` : ''}).`, '', href]),
  };
}

/** A gentle reminder: questions of learners that are still waiting for the instructor. */
export function instructorQuestionReminderEmail({
  name,
  total,
  items,
}: {
  name: string;
  total: number;
  items: { courseTitle: string; lessonTitle: string; question: string; waitingDays: number }[];
}): Built {
  const first = firstNameOf(name);
  const href = `${SITE}/academy/instructor/questions`;
  const shown = items.slice(0, 5);
  const list = shown
    .map(
      (item) =>
        `<div style="margin:0 0 14px;">
          <p style="margin:0 0 4px;font-size:12px;color:#6e687d;">${escapeHtml(item.courseTitle)} · ${escapeHtml(item.lessonTitle)} · waiting ${item.waitingDays} days</p>
          ${quote(shorten(item.question, 200))}
        </div>`,
    )
    .join('');

  const html = layout({
    preview: `${total} learner question${total === 1 ? '' : 's'} could use your answer.`,
    eyebrow: 'A small reminder',
    title: total === 1 ? 'A learner is waiting for you' : `${total} learners are waiting for you`,
    content:
      paragraph(
        `Hi ${escapeHtml(first)}, ${total === 1 ? 'one question' : `${total} questions`} on your lessons ${total === 1 ? 'has' : 'have'} not been answered yet. Whenever you have a few minutes, a short answer means a lot to your learners.`,
      ) +
      list +
      (total > shown.length ? paragraph(`And ${total - shown.length} more in your dashboard.`) : '') +
      `<p style="margin:16px 0 0;font-size:13px;color:#8e879f;">We only send this reminder from time to time, never more than once every few days.</p>`,
    cta: { label: 'Answer my learners', href },
  });

  return {
    subject: total === 1 ? 'A learner is waiting for your answer' : `${total} learners are waiting for your answers`,
    html,
    text: lines([
      `Hi ${first},`,
      '',
      `${total} question${total === 1 ? '' : 's'} on your lessons ${total === 1 ? 'is' : 'are'} still waiting for an answer.`,
      ...shown.map((item) => `- ${item.courseTitle} / ${item.lessonTitle}: ${shorten(item.question, 120)}`),
      '',
      href,
    ]),
  };
}
