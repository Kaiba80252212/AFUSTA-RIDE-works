import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FirebaseProvider } from '@/components/FirebaseProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AFUSTA Ride — Online Campus Tricycles Booking System',
  description:
    'Book verified tricycles within AFUSTA campus in real-time, track your ride, and pay seamlessly via Campus Wallet.',
  openGraph: {
    title: 'AFUSTA Ride — Online Campus Tricycles Booking System',
    description:
      'Book verified tricycles within AFUSTA campus in real-time, track your ride, and pay seamlessly via Campus Wallet.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AFUSTA Ride — Online Campus Tricycles Booking System',
    description:
      'Book verified tricycles within AFUSTA campus in real-time, track your ride, and pay seamlessly via Campus Wallet.',
  },
};

const ANTI_FOUC_THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('afusta_theme_preference')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ANTI_FOUC_THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-[#F4F7FA] dark:bg-[#0E1621] text-slate-900 dark:text-slate-100 antialiased selection:bg-[#2481CC] selection:text-white transition-colors duration-200">
        <ErrorBoundary>
          <FirebaseProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </FirebaseProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
