export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://easymedicaldevice.com').replace(/\/$/, '');

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type Layout = {
  preview: string;
  eyebrow: string;
  title: string;
  /** Paragraphs and blocks, already HTML. */
  content: string;
  cta: { label: string; href: string };
};

/** Shared look of every Academy email: purple header, white card, one button. */
export function layout({ preview, eyebrow, title, content, cta }: Layout) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f1fb;font-family:Helvetica,Arial,sans-serif;color:#191625;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1fb;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4ddf4;">
    <tr><td style="background:#3b0764;background-image:linear-gradient(135deg,#3b0764,#7c3aed);padding:28px 32px;">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:3px;color:#34d4c6;">EASY MEDICAL DEVICE ACADEMY</p>
      <p style="margin:18px 0 0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#d8c6ff;">${escapeHtml(eyebrow)}</p>
      <h1 style="margin:6px 0 0;font-size:28px;line-height:1.25;color:#ffffff;">${escapeHtml(title)}</h1>
    </td></tr>
    <tr><td style="padding:32px;font-size:16px;line-height:1.65;color:#302945;">
      ${content}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;"><tr><td style="background:#7c3aed;border-radius:10px;">
        <a href="${cta.href}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(cta.label)}</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:20px 32px 28px;border-top:1px solid #ede8fb;font-size:12px;line-height:1.6;color:#8e879f;">
      Questions? Just reply to this email, we read every message.<br>
      <a href="${SITE}/academy" style="color:#7c3aed;text-decoration:none;">easymedicaldevice.com/academy</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function step(number: string, title: string, text: string) {
  return `<tr>
    <td valign="top" style="width:40px;padding:6px 0;"><div style="width:30px;height:30px;border-radius:15px;background:#f4f0ff;color:#7c3aed;font-weight:800;font-size:14px;line-height:30px;text-align:center;">${number}</div></td>
    <td style="padding:6px 0;"><strong style="color:#191625;">${escapeHtml(title)}</strong><br><span style="color:#625b75;font-size:14px;">${escapeHtml(text)}</span></td>
  </tr>`;
}

export function welcomeEmail({ name }: { name: string }) {
  const firstName = (name || '').trim().split(/\s+/)[0] || 'there';
  const href = `${SITE}/academy#courses`;
  const subject = 'Welcome to Easy Medical Device Academy';

  const html = layout({
    preview: 'Your account is ready. Here is how to get started.',
    eyebrow: 'Welcome aboard',
    title: `Welcome, ${firstName}!`,
    content: `
      <p style="margin:0 0 16px;">Your Easy Medical Device Academy account is ready. You can now learn medical device regulation at your own pace, with practical courses taught by industry experts.</p>
      <p style="margin:0 0 8px;font-weight:700;color:#191625;">Here is how to get started:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${step('1', 'Pick a course', 'Browse the catalog. Some courses are free, so you can start right away.')}
        ${step('2', 'Learn at your pace', 'Videos, articles and resources. Your progress is saved automatically.')}
        ${step('3', 'Get certified', 'Pass the final exam to earn a certificate you can verify and share on LinkedIn.')}
        ${step('4', 'Earn Skill Points', 'Every completed course adds to your Career Record.')}
      </table>`,
    cta: { label: 'Explore courses', href },
  });

  const text = [
    `Welcome, ${firstName}!`,
    '',
    'Your Easy Medical Device Academy account is ready.',
    '',
    '1. Pick a course: some courses are free, so you can start right away.',
    '2. Learn at your pace: your progress is saved automatically.',
    '3. Get certified: pass the final exam to earn a certificate.',
    '4. Earn Skill Points: every completed course adds to your Career Record.',
    '',
    `Explore courses: ${href}`,
    '',
    'Questions? Just reply to this email.',
  ].join('\n');

  return { subject, html, text };
}
