import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfOrigin } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  return NextResponse.json(
    {
      error:
        'Verification emails are delivered directly through Firebase Authentication. Sign in on /login to resend your Firebase verification link.',
      provider: 'firebase',
    },
    { status: 410 }
  );
}
