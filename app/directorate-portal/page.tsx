import { redirect } from 'next/navigation';
import { AdminDashboardClient } from '@/components/AdminDashboardClient';
import { ForbiddenView } from '@/components/ForbiddenView';
import { getUserFromServerCookies } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function DirectoratePortalPage() {
  const adminAuth = await getUserFromServerCookies('admin');
  if (adminAuth) {
    return <AdminDashboardClient />;
  }

  const userAuth = await getUserFromServerCookies('user');
  if (userAuth) {
    return (
      <ForbiddenView
        title="403 — Administrator Clearance Required"
        message="Your account does not have Transport Directorate administrator permissions."
        backHref={userAuth.role === 'DRIVER' ? '/driver' : '/student'}
        backLabel={
          userAuth.role === 'DRIVER' ? 'Return to Driver Dashboard' : 'Return to Student Dashboard'
        }
      />
    );
  }

  redirect('/directorate-portal/login');
}
