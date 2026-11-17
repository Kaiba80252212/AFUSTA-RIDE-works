import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  signJwt,
  verifyPassword,
} from '@/lib/auth-security';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getCookieSecurityOptions, verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase, readDatabase, sanitizeUser } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many administrator login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Administrator email and password are required.' },
        { status: 400 }
      );
    }

    const db = await readDatabase();
    const found = db.users.find((u) => u.email.toLowerCase() === email);
    if (!found) {
      return NextResponse.json(
        { error: 'Invalid administrator credentials.' },
        { status: 401 }
      );
    }

    if (found.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Administrator role clearance required.' },
        { status: 403 }
      );
    }

    if (!found.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid administrator credentials.' },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(password, found.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid administrator credentials.' },
        { status: 401 }
      );
    }

    if (!found.emailVerified || found.status === 'Suspended') {
      return NextResponse.json(
        { error: 'Administrator account is disabled.' },
        { status: 403 }
      );
    }

    const safeAdmin = await mutateDatabase((mutableDb) => {
      const target = mutableDb.users.find((u) => u.id === found.id);
      if (target) {
        target.online = true;
        target.lastLoginAt = new Date().toISOString();
      }
      return sanitizeUser(target ?? found);
    });

    const token = signJwt(
      {
        sub: safeAdmin.id,
        email: safeAdmin.email,
        role: 'ADMIN',
        name: safeAdmin.name,
      },
      60 * 60 * 8
    );

    const res = NextResponse.json({ admin: safeAdmin });
    res.cookies.set(ADMIN_SESSION_COOKIE, token, getCookieSecurityOptions(req, 60 * 60 * 8));
    return res;
  } catch {
    return NextResponse.json(
      { error: 'Unable to authenticate administrator.' },
      { status: 500 }
    );
  }
}
