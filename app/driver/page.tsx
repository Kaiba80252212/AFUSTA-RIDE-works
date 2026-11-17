import { redirect } from 'next/navigation';
import { DriverDashboardClient } from '@/components/DriverDashboardClient';
import { ForbiddenView } from '@/components/ForbiddenView';
import { getUserFromServerCookies } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function DriverDashboardPage() {
  const userAuth = await getUserFromServerCookies('user');

  if (!userAuth) {
    redirect('/login?next=/driver');
  }

  if (userAuth.role !== 'DRIVER') {
    return (
      <ForbiddenView
        title="403 — Driver Portal Only"
        message="This workspace is restricted to verified AFUSTA tricycle drivers."
        backHref="/student"
        backLabel="Return to Student Dashboard"
      />
    );
  }

  return <DriverDashboardClient />;
}
