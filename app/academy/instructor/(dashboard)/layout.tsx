import { InstructorShell } from '@/components/academy-instructor-shell';

// The logo bar and the left menu live here, so they stay in place while pages load.
export default function InstructorDashboardLayout({ children }: { children: React.ReactNode }) {
  return <InstructorShell>{children}</InstructorShell>;
}
