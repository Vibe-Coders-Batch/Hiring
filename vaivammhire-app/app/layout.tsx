import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: { default: 'VaivammHire — Vaivamm Capital Careers', template: '%s · VaivammHire' },
  description: 'Open roles at Vaivamm Capital Advisors.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://hiring.vaivammcapital.com'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
