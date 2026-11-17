import { NextRequest, NextResponse } from 'next/server';
import {
  signJwt,
  USER_SESSION_COOKIE,
  verifyAndConsumeGoogleHandoffToken,
} from '@/lib/auth-security';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getCookieSecurityOptions, verifyCsrfOrigin } from '@/lib/server-auth';
import { readDatabase, sanitizeUser } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`google-exchange:${ip}`, 20, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many authentication exchange attempts. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const handoffToken = typeof body?.handoffToken === 'string' ? body.handoffToken : '';
    const payload = verifyAndConsumeGoogleHandoffToken(handoffToken);
    if (!payload) {
      return NextResponse.json(
        { error: 'Google sign-in session expired. Please click Continue with Google again.' },
        { status: 401 }
      );
    }

    const db = await readDatabase();
    const found = db.users.find((u) => u.id === payload.sub);
    if (!found || found.role === 'ADMIN' || !found.emailVerified || found.status !== 'Active') {
      return NextResponse.json(
        { error: 'Account is unavailable or cannot sign in through this portal.' },
        { status: 403 }
      );
    }

    const maxAge = 60 * 60 * 12;
    const jwt = signJwt(
      {
        sub: found.id,
        email: found.email,
        role: found.role,
        name: found.name,
      },
      maxAge
    );

    const res = NextResponse.json({ ok: true, user: sanitizeUser(found) });
    res.cookies.set(USER_SESSION_COOKIE, jwt, getCookieSecurityOptions(req, maxAge));
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Unable to complete Google authentication session.' },
      { status: 400 }
    );
  }
}
