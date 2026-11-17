'use client';

import { AlertCircle, ArrowRight, Loader2, MailCheck, RefreshCw } from 'lucide-react';

interface EmailVerificationScreenProps {
  email: string;
  blockedOnLogin?: boolean;
  initialNotice?: string | null;
  resending?: boolean;
  resendMessage?: string | null;
  resendError?: string | null;
  canResend?: boolean;
  onResend?: () => void;
  onGoToLogin: () => void;
}

export function EmailVerificationScreen({
  email,
  blockedOnLogin = false,
  initialNotice = null,
  resending = false,
  resendMessage = null,
  resendError = null,
  canResend = false,
  onResend,
  onGoToLogin,
}: EmailVerificationScreenProps) {
  return (
    <div
      data-testid="email-verification-screen"
      className="space-y-5 text-center py-2"
    >
      <div className="mx-auto h-14 w-14 rounded-2xl border border-sky-200 dark:border-[#2481CC]/40 bg-sky-50 dark:bg-[#2481CC]/15 flex items-center justify-center">
        <MailCheck className="h-7 w-7 text-[#2481CC] dark:text-[#4EA4F6]" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
          Check your email &amp; verify, then log in
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          We sent a verification link to{' '}
          <span className="font-semibold text-slate-900 dark:text-slate-100 break-all">
            {email}
          </span>
          . Open the link in your inbox (or spam folder) before logging in.
        </p>
      </div>

      {blockedOnLogin && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-left text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200 flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>
            Login blocked: your email address is not verified yet. Please verify your email first, then try logging in again.
          </span>
        </div>
      )}

      {initialNotice && !resendMessage && !resendError && (
        <div
          role="status"
          className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] px-4 py-3 text-left text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {initialNotice}
        </div>
      )}

      {resendMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-left text-xs sm:text-sm font-medium text-emerald-900 dark:text-emerald-200"
        >
          {resendMessage}
        </div>
      )}

      {resendError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-left text-xs sm:text-sm font-medium text-red-700 dark:text-red-300"
        >
          {resendError}
        </div>
      )}

      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          onClick={onGoToLogin}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
        >
          <span>Login</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {canResend && onResend && (
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#2B3848] disabled:opacity-60 transition-colors"
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>{resending ? 'Sending verification email...' : 'Resend verification email'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
