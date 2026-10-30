import { AuthSkeleton } from '@/components/page-skeletons';

// The application page is public: it has the Academy header, not the dashboard frame.
export default function Loading() {
  return <AuthSkeleton />;
}
