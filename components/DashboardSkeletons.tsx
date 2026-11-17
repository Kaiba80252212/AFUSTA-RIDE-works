'use client';

interface SkeletonProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-200 dark:bg-[#232E3C] ${className}`}
    />
  );
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-20 w-20' : 'h-12 w-12';
  return (
    <div
      aria-hidden="true"
      className={`${dim} animate-pulse rounded-full bg-slate-200 dark:bg-[#232E3C] shrink-0`}
    />
  );
}

export function SkeletonText({ lines = 2, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, idx) => (
        <SkeletonBlock
          key={idx}
          className={`h-3.5 ${idx === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-5 space-y-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-11 w-11 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-3.5 w-24" />
          <SkeletonBlock className="h-6 w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] overflow-hidden"
    >
      <div className="border-b border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] px-4 py-3 flex items-center gap-4">
        <SkeletonBlock className="h-3.5 w-24" />
        <SkeletonBlock className="h-3.5 w-32" />
        <SkeletonBlock className="h-3.5 w-20 hidden sm:block" />
        <SkeletonBlock className="h-3.5 w-16 ml-auto" />
      </div>
      <div className="divide-y divide-slate-200 dark:divide-[#2B3848]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 flex items-center gap-4">
            <SkeletonAvatar size="sm" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3.5 w-40" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-md" />
            <SkeletonBlock className="h-4 w-16 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonNotification({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-4 flex items-center gap-3"
        >
          <SkeletonBlock className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonBlock className="h-3.5 w-48" />
            <SkeletonBlock className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardShellSkeleton({
  sidebarItems = 6,
  children,
}: {
  sidebarItems?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard content"
      className="min-h-screen bg-[#F4F7FA] dark:bg-[#0E1621] flex"
    >
      <span className="sr-only">Loading dashboard data...</span>

      {/* Desktop Sidebar Skeleton */}
      <aside
        aria-hidden="true"
        className="hidden lg:flex lg:w-64 lg:flex-col border-r border-slate-800 dark:border-[#2B3848] bg-[#0B2219] dark:bg-[#131C26]"
      >
        <div className="p-5 border-b border-white/10">
          <SkeletonBlock className="h-8 w-36 bg-white/15 dark:bg-[#232E3C]" />
        </div>
        <div className="px-5 py-5 border-b border-white/10 flex flex-col items-center gap-2.5">
          <div className="h-16 w-16 animate-pulse rounded-full bg-white/15 dark:bg-[#232E3C]" />
          <SkeletonBlock className="h-4 w-32 bg-white/15 dark:bg-[#232E3C]" />
          <SkeletonBlock className="h-3 w-20 bg-white/10 dark:bg-[#1E2936]" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: sidebarItems }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <SkeletonBlock className="h-4 w-4 rounded bg-white/15 dark:bg-[#232E3C]" />
              <SkeletonBlock className="h-3.5 w-28 bg-white/15 dark:bg-[#232E3C]" />
            </div>
          ))}
        </div>
      </aside>

      {/* Main Column Skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          aria-hidden="true"
          className="h-20 bg-white dark:bg-[#17212B] border-b border-slate-200 dark:border-[#2B3848] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4"
        >
          <div className="space-y-2">
            <SkeletonBlock className="h-6 w-48 sm:w-60" />
            <SkeletonBlock className="h-3.5 w-36 sm:w-44" />
          </div>
          <div className="flex items-center gap-2.5">
            <SkeletonBlock className="h-9 w-24 rounded-xl hidden sm:block" />
            <SkeletonBlock className="h-9 w-28 rounded-xl" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function StudentDashboardSkeleton() {
  return (
    <DashboardShellSkeleton sidebarItems={7}>
      {/* 3 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Recent Ride Card */}
      <div
        aria-hidden="true"
        className="rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-16 w-24 rounded-xl shrink-0" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-44" />
              <SkeletonBlock className="h-3.5 w-36" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-7 w-24 rounded-lg" />
            <SkeletonBlock className="h-5 w-16" />
          </div>
        </div>
      </div>

      {/* Campus Banner Skeleton */}
      <div
        aria-hidden="true"
        className="rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-5 w-56" />
          <SkeletonBlock className="h-3.5 w-72 max-w-full" />
        </div>
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
      </div>
    </DashboardShellSkeleton>
  );
}

export function DriverDashboardSkeleton() {
  return (
    <DashboardShellSkeleton sidebarItems={5}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          aria-hidden="true"
          className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-4 w-20" />
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-4 space-y-3">
            <SkeletonBlock className="h-4 w-44" />
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-4 w-28" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <SkeletonBlock className="h-10 w-full rounded-xl" />
              <SkeletonBlock className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-5 w-24 rounded-md" />
          </div>
          <SkeletonBlock className="h-60 w-full rounded-xl" />
        </div>
      </div>
    </DashboardShellSkeleton>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <DashboardShellSkeleton sidebarItems={7}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          aria-hidden="true"
          className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-4 w-28" />
          </div>
          <SkeletonBlock className="h-64 w-full rounded-xl" />
        </div>

        <div
          aria-hidden="true"
          className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] p-5 space-y-3"
        >
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
        </div>
      </div>

      <SkeletonTable rows={4} />
    </DashboardShellSkeleton>
  );
}
