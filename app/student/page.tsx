import { redirect } from 'next/navigation';
import { ForbiddenView } from '@/components/ForbiddenView';
import { StudentDashboardClient } from '@/components/StudentDashboardClient';
import { RideType } from '@/lib/campus-transit';
import { getUserFromServerCookies } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function StudentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const userAuth = await getUserFromServerCookies('user');

  if (!userAuth) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.type) qs.set('type', params.type);
    if (params.tab) qs.set('tab', params.tab);
    const nextUrl = qs.toString() ? `/student?${qs.toString()}` : '/student';
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  if (userAuth.role !== 'STUDENT') {
    return (
      <ForbiddenView
        title="403 — Student Portal Only"
        message="This workspace is restricted to registered AFUSTA student riders."
        backHref="/driver"
        backLabel="Return to Driver Dashboard"
      />
    );
  }

  const rideType: RideType =
    params.type === 'shared' || params.type === 'express' ? params.type : 'normal';

  return (
    <StudentDashboardClient
      initialFrom={params.from || 'main-gate'}
      initialTo={params.to || 'library'}
      initialType={rideType}
      initialTab={params.tab || 'dashboard'}
    />
  );
}
