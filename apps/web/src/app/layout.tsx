import { Instrument_Serif } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AuthHeader } from '@/components/auth-header';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

const fontDisplay = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
});

export const runtime = 'nodejs';

export const metadata = {
  title: 'Lumion HRIS - Human Resource Management System',
  description: 'Enterprise-grade HR management system for growing companies',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${fontDisplay.variable}`}>
        <QueryProvider>
          <AuthHeader />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
