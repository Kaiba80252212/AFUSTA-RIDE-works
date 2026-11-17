import { redirect } from 'next/navigation';
import { UserAuthPageClient } from '@/components/UserAuthPageClient';
import { getUserFromServerCookies } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const userAuth = await getUserFromServerCookies('user');
  if (userAuth) {
    redirect(userAuth.role === 'DRIVER' ? '/driver' : '/student');
  }

  return <UserAuthPageClient mode="signup" nextPath={params.next} />;
}
