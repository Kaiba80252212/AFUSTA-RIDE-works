import { LandingClient } from '@/components/LandingClient';
import { getUserFromServerCookies } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userAuth = await getUserFromServerCookies('user');
  const initialUserRole =
    userAuth?.role === 'DRIVER'
      ? 'DRIVER'
      : userAuth?.role === 'STUDENT'
      ? 'STUDENT'
      : null;

  return <LandingClient initialUserRole={initialUserRole} />;
}
