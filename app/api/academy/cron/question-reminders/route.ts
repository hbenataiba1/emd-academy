import { cleanEnv, json } from '@/lib/academy-auth';
import { remindInstructorsOfQuestions } from '@/lib/academy-notify';

export const dynamic = 'force-dynamic';

// Runs once a day (see vercel.json). Reminds instructors, gently, of learner questions that
// are still waiting for an answer.
export async function GET(request: Request) {
  const secret = cleanEnv(process.env.CRON_SECRET);
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return json({ message: 'Not allowed.' }, 401);
  }

  return json(await remindInstructorsOfQuestions());
}
