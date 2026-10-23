import {
  getAcademyDisplayName,
  getAcademyUserFromRequest,
  json,
} from '@/lib/academy-auth';
import { sendAcademyEmail } from '@/lib/academy-email';
import { welcomeEmail } from '@/lib/academy-email-templates';

// Sends the welcome email the first time a learner is seen logged in.
// Safe to call again: the email log makes sure it only goes out once.
export async function POST(request: Request) {
  const user = await getAcademyUserFromRequest(request);
  if (!user?.id || !user.email) {
    return json({ message: 'Please log in to continue.' }, 401);
  }

  const name = getAcademyDisplayName(user);
  const { subject, html, text } = welcomeEmail({ name });

  const result = await sendAcademyEmail({
    to: user.email,
    subject,
    html,
    text,
    templateKey: 'welcome',
    templateName: 'Welcome',
    recipientName: name,
    recipientUserId: user.id,
    dedupeKey: `welcome:${user.id}`,
    metadata: { source: 'first_login' },
  });

  return json(result);
}
