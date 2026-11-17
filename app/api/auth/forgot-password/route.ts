import { NextRequest, NextResponse } from 'next/server';
import { verifyCsrfOrigin } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  return NextResponse.json(
    {
      error:
        'Password reset emails are delivered directly through Firebase Authentication. Use the Forgot Password form on /forgot-password.',
      provider: 'firebase',
    },
    { status: 410 }
  );
}
