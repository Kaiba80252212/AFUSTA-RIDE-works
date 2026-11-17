import { UserAuthPageClient } from '@/components/UserAuthPageClient';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; oobCode?: string; mode?: string }>;
}) {
  const params = await searchParams;
  return (
    <UserAuthPageClient
      mode="forgot"
      initialResetToken={params.token || ''}
      initialResetEmail={params.email || ''}
      initialOobCode={params.mode === 'resetPassword' || params.oobCode ? params.oobCode || '' : ''}
    />
  );
}
