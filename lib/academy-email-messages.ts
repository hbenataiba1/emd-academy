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
