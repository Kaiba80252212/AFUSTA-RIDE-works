import { VerifyEmailClient } from '@/components/VerifyEmailClient';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; oobCode?: string; mode?: string }>;
}) {
  const params = await searchParams;
  return (
    <VerifyEmailClient
      token={params.token || ''}
      oobCode={params.oobCode || ''}
      actionMode={params.mode || ''}
    />
  );
}
