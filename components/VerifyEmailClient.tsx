'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { QuickThemeButton } from './ThemeProvider';
import {
  applyActionCode,
  auth,
  mapFirebaseEmailError,
} from '@/lib/firebase';

interface VerifyEmailClientProps {
  token: string;
  oobCode?: string;
  actionMode?: string;
}

export function VerifyEmailClient({
  oobCode = '',
  actionMode = '',
}: VerifyEmailClientProps) {
  const hasCode = Boolean(oobCode);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    hasCode ? 'verifying' : 'error'
  );
  const [message, setMessage] = useState<string>(
    hasCode
      ? 'Verifying your email address with Firebase...'
      : 'Check your email & verify via the Firebase link in your inbox, then log in.'
  );

  useEffect(() => {
    let active = true;

    if (oobCode && (!actionMode || actionMode === 'verifyEmail')) {
      applyActionCode(auth, oobCode)
        .then(() => {
          if (!active) return;
          setStatus('success');
          setMessage('Your email address has been verified via Firebase Authentication. You can now log in.');
        })
        .catch((err) => {
          if (!active) return;
          setStatus('error');
          setMessage(mapFirebaseEmailError(err));
        });
    }

    return () => {
      active = false;
    };
  }, [oobCode, actionMode]);

  return (
    <div className="min-h-screen bg-[#F4F7FA] dark:bg-[#0E1621] flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      <header className="mx-auto w-full max-w-5xl flex items-center justify-between gap-4 py-2">
        <Link href="/" prefetch={false}>
          <BrandLogo variant="auto" size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <QuickThemeButton syncServer={false} variant="surface" />
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md my-8">
        <div className="glass-surface rounded-2xl p-6 sm:p-8 text-center space-y-4">
          {status === 'verifying' && (
            <>
              <div className="mx-auto h-12 w-12 rounded-xl border border-sky-200 dark:border-[#2481CC]/40 bg-sky-50 dark:bg-[#2481CC]/20 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#2481CC] dark:text-[#4EA4F6]" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Verifying Email
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto h-12 w-12 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Email Verified
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
              <div className="pt-2">
                <a
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
                >
                  Sign In to Your Account
                </a>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto h-12 w-12 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Email Verification
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>

              <div className="pt-3 border-t border-slate-200 dark:border-[#2B3848] space-y-3">
                <a
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
                >
                  Login
                </a>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 dark:text-slate-400 py-2">
        © 2026 AFUSTA Ride · Campus Mobility Platform
      </footer>
    </div>
  );
}
