import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SITE_URL } from '@/lib/site';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Easy Medical Device Academy',
  description:
    'Online medical device compliance courses for MDR, IVDR, ISO 13485, SaMD, risk management, and market access.',
  openGraph: {
    title: 'Easy Medical Device Academy',
    description:
      'Practical online compliance training for medical device teams.',
    type: 'website',
    siteName: 'Easy Medical Device Academy',
    url: '/academy',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
