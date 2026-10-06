import type { Metadata } from 'next';
import MyLearningPage from "@/components/my-learning-page";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MyLearningPage />;
}

