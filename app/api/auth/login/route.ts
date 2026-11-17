import { NextRequest, NextResponse } from 'next/server';
import {
  signJwt,
  USER_SESSION_COOKIE,
  verifyPassword,
} from '@/lib/auth-security';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getCookieSecurityOptions, verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase, readDatabase, sanitizeUser } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`user-login:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const db = await readDatabase();
    const found = db.users.find((u) => u.email.toLowerCase() === email);
    if (!found || found.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    if (found.authProvider === 'google' && !found.passwordHash) {
      return NextResponse.json(
        {
          error:
            'This account is linked with Google Sign-In. Click "Continue with Google", or use Forgot Password to add an email password.',
        },
        { status: 400 }
      );
    }

    const passwordValid = await verifyPassword(password, found.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    if (!found.emailVerified) {
      return NextResponse.json(
        {
          error: 'Your email address is not verified yet. Please verify your email before signing in.',
          code: 'EMAIL_NOT_VERIFIED',
          email: found.email,
        },
        { status: 403 }
      );
    }

    if (found.status === 'Suspended') {
      return NextResponse.json(
        { error: 'Your account has been suspended. Contact the Campus Transport Office.' },
        { status: 403 }
      );
    }

    const safeUser = await mutateDatabase((mutableDb) => {
      const target = mutableDb.users.find((u) => u.id === found.id);
      if (target) {
        target.online = true;
        target.lastLoginAt = new Date().toISOString();
      }
      return sanitizeUser(target ?? found);
    });

    const token = signJwt({
      sub: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
      name: safeUser.name,
    });

    const res = NextResponse.json({ user: safeUser });
    res.cookies.set(USER_SESSION_COOKIE, token, getCookieSecurityOptions(req, 60 * 60 * 12));
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Unable to process login request.' },
      { status: 500 }
    );
  }
}
