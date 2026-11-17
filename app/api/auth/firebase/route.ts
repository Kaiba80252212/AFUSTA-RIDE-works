import { NextRequest, NextResponse } from 'next/server';
import { signJwt, USER_SESSION_COOKIE } from '@/lib/auth-security';
import { verifyFirebaseIdToken } from '@/lib/firebase-token';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getCookieSecurityOptions, verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase, sanitizeUser, UserRecord } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`firebase-auth:${ip}`, 25, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many authentication attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const requestedScope = typeof body?.scope === 'string' ? body.scope.toLowerCase() : 'user';
    if (requestedScope === 'admin') {
      return NextResponse.json(
        {
          error:
            'Google Sign-In is disabled for administrator accounts. Sign in with administrator email and password.',
        },
        { status: 403 }
      );
    }

    const idToken = typeof body?.idToken === 'string' ? body.idToken.trim() : '';
    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing Firebase authentication token.' },
        { status: 400 }
      );
    }

    const requestedRoleRaw = typeof body?.role === 'string' ? body.role.toUpperCase() : 'STUDENT';
    const requestedRole: 'STUDENT' | 'DRIVER' = requestedRoleRaw === 'DRIVER' ? 'DRIVER' : 'STUDENT';
    const nextParam = typeof body?.nextPath === 'string' ? body.nextPath : '';
    const safeNextPath =
      nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/directorate-portal')
        ? nextParam
        : requestedRole === 'DRIVER'
        ? '/driver'
        : '/student';

    const verified = await verifyFirebaseIdToken(idToken);

    const outcome = await mutateDatabase((db) => {
      const now = new Date().toISOString();
      const existing = db.users.find(
        (u) => u.email.toLowerCase() === verified.email.toLowerCase()
      );

      if (existing) {
        if (existing.role === 'ADMIN') {
          return {
            ok: false as const,
            status: 403,
            error: 'Administrator accounts must sign in using email and password on the admin portal.',
          };
        }
        if (existing.status === 'Suspended') {
          return {
            ok: false as const,
            status: 403,
            error: 'Your account has been suspended. Contact the Campus Transport Office.',
          };
        }
        if (existing.firebaseUid && existing.firebaseUid !== verified.uid) {
          return {
            ok: false as const,
            status: 403,
            error: 'This email is already linked to a different Firebase identity.',
          };
        }

        existing.emailVerified = true;
        existing.lastLoginAt = now;
        existing.online = true;
        existing.firebaseUid = verified.uid;
        if (verified.picture) {
          existing.googleAvatarUrl = verified.picture;
          if (!existing.customAvatarUrl) {
            existing.avatarUrl = verified.picture;
          }
        }
        if (!existing.name && verified.name) existing.name = verified.name;

        const targetUrl =
          existing.role === 'DRIVER'
            ? safeNextPath.startsWith('/driver')
              ? safeNextPath
              : '/driver'
            : safeNextPath.startsWith('/student')
            ? safeNextPath
            : '/student';

        return {
          ok: true as const,
          user: sanitizeUser(existing),
          role: existing.role === 'DRIVER' ? ('DRIVER' as const) : ('STUDENT' as const),
          nextUrl: targetUrl,
        };
      }

      // First-time Firebase sign-in (Google or Email/Password) creates STUDENT or DRIVER only (never ADMIN)
      const providerType = verified.signInProvider === 'password' ? 'email' : 'google';
      const newUser: UserRecord = {
        id: `usr-${requestedRole === 'DRIVER' ? 'drv' : 'stu'}-${Date.now()}`,
        name: verified.name,
        email: verified.email,
        passwordHash: '',
        authProvider: providerType,
        emailVerified: true,
        avatarUrl: verified.picture,
        googleAvatarUrl: verified.picture,
        firebaseUid: verified.uid,
        role: requestedRole,
        phone: typeof body?.phone === 'string' && body.phone.trim() ? body.phone.trim() : '+234 800 000 0000',
        status: 'Active',
        online: true,
        rating: 5.0,
        ...(requestedRole === 'STUDENT'
          ? {
              matricNo:
                typeof body?.matricNo === 'string' && body.matricNo.trim()
                  ? body.matricNo.trim()
                  : `AFU/26/GL/${Math.floor(100 + Math.random() * 899)}`,
              department:
                typeof body?.department === 'string' && body.department.trim()
                  ? body.department.trim()
                  : 'General Studies',
              walletBalance: 0,
              totalRides: 0,
              notifySms: true,
              autoWalletPay: true,
            }
          : {
              licenseNo:
                typeof body?.licenseNo === 'string' && body.licenseNo.trim()
                  ? body.licenseNo.trim()
                  : `AFU-DRV-${Math.floor(100 + Math.random() * 899)}`,
              plateNumber: `AFU-${Math.floor(140 + Math.random() * 800)}-KE`,
              available: false,
              todayTrips: 0,
              todayEarnings: 0,
              totalEarnings: 0,
              notifySms: true,
            }),
        createdAt: now,
        lastLoginAt: now,
      };

      db.users.push(newUser);

      return {
        ok: true as const,
        user: sanitizeUser(newUser),
        role: requestedRole,
        nextUrl:
          requestedRole === 'DRIVER'
            ? '/driver'
            : safeNextPath.startsWith('/student')
            ? safeNextPath
            : '/student',
      };
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    }

    const maxAge = 60 * 60 * 12;
    const jwt = signJwt(
      {
        sub: outcome.user.id,
        email: outcome.user.email,
        role: outcome.role,
        name: outcome.user.name,
      },
      maxAge
    );

    const res = NextResponse.json({
      ok: true,
      user: outcome.user,
      nextUrl: outcome.nextUrl,
    });
    res.cookies.set(USER_SESSION_COOKIE, jwt, getCookieSecurityOptions(req, maxAge));
    return res;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Unable to verify Firebase Google authentication.',
      },
      { status: 401 }
    );
  }
}
