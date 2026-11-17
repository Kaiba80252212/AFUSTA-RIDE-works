import { NextRequest, NextResponse } from 'next/server';
import { hashResetToken } from '@/lib/auth-security';
import { verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase } from '@/lib/server-store';

async function processVerification(rawToken: string) {
  const token = rawToken.trim();
  if (!token) {
    return NextResponse.json({ error: 'Verification token is missing.' }, { status: 400 });
  }

  const tokenHash = hashResetToken(token);

  try {
    const result = await mutateDatabase((db) => {
      const record = db.emailVerifications.find(
        (rec) => rec.tokenHash === tokenHash && !rec.used
      );
      if (!record) {
        throw new Error('This verification link is invalid or has already been used.');
      }

      if (new Date(record.expiresAt).getTime() <= Date.now()) {
        record.used = true;
        throw new Error('This verification link has expired. Request a new verification email.');
      }

      const user = db.users.find((u) => u.id === record.userId);
      if (!user) {
        throw new Error('Associated account was not found.');
      }

      user.emailVerified = true;
      record.used = true;
      return { email: user.email, role: user.role };
    });

    return NextResponse.json({
      ok: true,
      email: result.email,
      role: result.role,
      message: 'Your email address has been verified. You can now sign in.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed.' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  try {
    const body = await req.json();
    return processVerification(String(body.token || ''));
  } catch {
    return NextResponse.json({ error: 'Invalid verification request.' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  return processVerification(token);
}
