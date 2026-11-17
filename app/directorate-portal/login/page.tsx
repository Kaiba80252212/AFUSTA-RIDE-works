import { redirect } from 'next/navigation';
import { AdminLoginClient } from '@/components/AdminLoginClient';
import { getUserFromServerCookies } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function DirectorateLoginPage() {
  const adminAuth = await getUserFromServerCookies('admin');
  if (adminAuth) {
    redirect('/directorate-portal');
  }

  return <AdminLoginClient />;
}
