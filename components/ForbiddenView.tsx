import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface ForbiddenViewProps {
  title?: string;
  message?: string;
  backHref?: string;
  backLabel?: string;
}

export function ForbiddenView({
  title = '403 — Access Forbidden',
  message = 'You do not have permission to access this portal with your current account role.',
  backHref = '/',
  backLabel = 'Return Home',
}: ForbiddenViewProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F7FA] dark:bg-[#0E1621] p-6 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md glass-surface rounded-2xl p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{message}</p>
        <div className="pt-2">
          <a
            href={backHref}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-5 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backLabel}</span>
          </a>
        </div>
      </div>
    </main>
  );
}
