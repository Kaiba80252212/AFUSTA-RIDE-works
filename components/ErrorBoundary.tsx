'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = 'Something went wrong while loading this view. Please refresh to continue.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          friendlyMessage = parsed.error.includes('permissions')
            ? 'Your session does not have permission to access that resource.'
            : parsed.error;
        }
      } catch {
        if (this.state.message && !this.state.message.startsWith('{')) {
          friendlyMessage = this.state.message;
        }
      }

      return (
        <div className="min-h-screen bg-[#F4F7FA] dark:bg-[#0E1621] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Unable to Complete Request
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
