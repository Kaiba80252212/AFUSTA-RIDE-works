import { NextRequest, NextResponse } from 'next/server';
import {
  hashPassword,
  hashResetToken,
  validatePasswordStrength,
} from '@/lib/auth-security';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`reset-password:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many reset attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const token = String(body.token || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and reset token are required.' },
        { status: 400 }
      );
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const tokenHash = hashResetToken(token);
    const nextPasswordHash = await hashPassword(newPassword);

    await mutateDatabase((db) => {
      const record = db.passwordResets.find(
        (r) =>
          r.email.toLowerCase() === email &&
          r.tokenHash === tokenHash &&
          !r.used
      );

      if (!record) {
        throw new Error('Invalid or already-used password reset link.');
      }

      if (new Date(record.expiresAt).getTime() <= Date.now()) {
        record.used = true;
        throw new Error('This password reset link has expired. Request a new one.');
      }

      const user = db.users.find((u) => u.id === record.userId && u.role !== 'ADMIN');
      if (!user) {
        throw new Error('Account not found.');
      }

      user.passwordHash = nextPasswordHash;
      user.emailVerified = true;
      record.used = true;
    });

    return NextResponse.json({
      ok: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to reset password.' },
      { status: 400 }
    );
  }
}
