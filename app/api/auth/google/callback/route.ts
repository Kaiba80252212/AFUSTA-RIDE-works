import { NextRequest, NextResponse } from 'next/server';
import {
  consumeOAuthNonce,
  OAUTH_STATE_COOKIE,
  signGoogleHandoffToken,
  signJwt,
  USER_SESSION_COOKIE,
  verifyOAuthState,
} from '@/lib/auth-security';
import { exchangeGoogleAuthCode, fetchVerifiedGoogleProfile } from '@/lib/google-oauth';
import { getCookieSecurityOptions } from '@/lib/server-auth';
import { mutateDatabase, UserRecord } from '@/lib/server-store';

function renderPopupResultHtml(payload: {
  type: 'AFUSTA_GOOGLE_AUTH_SUCCESS' | 'AFUSTA_GOOGLE_AUTH_ERROR';
  role?: string;
  nextUrl?: string;
  handoffToken?: string;
  targetOrigin?: string;
  error?: string;
  profile?: {
    email: string;
    name: string;
    avatarUrl?: string;
  };
}) {
  const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
  const fallbackHref =
    payload.type === 'AFUSTA_GOOGLE_AUTH_SUCCESS' && payload.nextUrl
      ? payload.nextUrl
      : '/login';
  const message =
    payload.type === 'AFUSTA_GOOGLE_AUTH_SUCCESS'
      ? 'Google authentication complete. Returning to AFUSTA Ride...'
      : payload.error || 'Google authentication did not complete.';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AFUSTA Ride Authentication</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
      .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { font-size: 14px; color: #475569; margin: 0 0 16px; line-height: 1.5; }
      a { display: inline-block; background: #059669; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 18px; border-radius: 10px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${payload.type === 'AFUSTA_GOOGLE_AUTH_SUCCESS' ? 'Sign-In Verified' : 'Sign-In Not Completed'}</h1>
      <p>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      <a href="${fallbackHref.replace(/"/g, '&quot;')}">Continue</a>
    </div>
    <script>
      (function () {
        var result = ${serialized};
        var targetOrigin = result.targetOrigin || window.location.origin;
        if (window.opener) {
          window.opener.postMessage(result, targetOrigin);
          setTimeout(function () { window.close(); }, 350);
        } else if (result.type === 'AFUSTA_GOOGLE_AUTH_SUCCESS' && result.nextUrl) {
          window.location.assign(result.nextUrl);
        }
      })();
    </script>
  </body>
</html>`;
}

function htmlErrorResponse(req: NextRequest, error: string, status = 400) {
  const res = new NextResponse(
    renderPopupResultHtml({ type: 'AFUSTA_GOOGLE_AUTH_ERROR', error }),
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
  res.cookies.set(OAUTH_STATE_COOKIE, '', getCookieSecurityOptions(req, 0));
  return res;
}

export async function GET(req: NextRequest) {
  const oauthError = req.nextUrl.searchParams.get('error');
  if (oauthError) {
    const friendly =
      oauthError === 'access_denied'
        ? 'Google sign-in was cancelled before completion.'
        : `Google authentication returned an error: ${oauthError}`;
    return htmlErrorResponse(req, friendly, 400);
  }

  const code = req.nextUrl.searchParams.get('code');
  const stateParam = req.nextUrl.searchParams.get('state');

  if (!code || !stateParam) {
    return htmlErrorResponse(req, 'Missing Google OAuth authorization code or state.', 400);
  }

  const statePayload = verifyOAuthState(stateParam, undefined);
  if (!statePayload || !consumeOAuthNonce(statePayload.nonce, statePayload.exp)) {
    return htmlErrorResponse(
      req,
      'Security state check failed or expired. Please try continuing with Google again.',
      403
    );
  }

  try {
    const accessToken = await exchangeGoogleAuthCode({
      code,
      redirectUri: statePayload.redirectUri,
    });
    const profile = await fetchVerifiedGoogleProfile(accessToken);

    const outcome = await mutateDatabase((db) => {
      const now = new Date().toISOString();
      const existing = db.users.find(
        (u) => u.email.toLowerCase() === profile.email.toLowerCase()
      );

      if (statePayload.scope !== 'user') {
        return {
          ok: false as const,
          status: 403,
          error:
            'Administrator accounts cannot sign in with Google. Use administrator email and password.',
        };
      }

      // Public user portal (STUDENT or DRIVER only)
      if (existing) {
        if (existing.role === 'ADMIN') {
          return {
            ok: false as const,
            status: 403,
            error: 'This account cannot sign in through the student/driver portal.',
          };
        }
        if (existing.status === 'Suspended') {
          return {
            ok: false as const,
            status: 403,
            error: 'Your account has been suspended. Contact the Campus Transport Office.',
          };
        }

        existing.emailVerified = true;
        existing.lastLoginAt = now;
        existing.online = true;
        existing.googleSub = profile.sub;
        if (profile.picture) {
          existing.googleAvatarUrl = profile.picture;
          if (!existing.customAvatarUrl) {
            existing.avatarUrl = profile.picture;
          }
        }
        if (!existing.name && profile.name) existing.name = profile.name;

        const targetUrl =
          existing.role === 'DRIVER'
            ? statePayload.nextPath.startsWith('/driver')
              ? statePayload.nextPath
              : '/driver'
            : statePayload.nextPath.startsWith('/student')
            ? statePayload.nextPath
            : '/student';

        return {
          ok: true as const,
          userId: existing.id,
          email: existing.email,
          role: existing.role,
          name: existing.name,
          nextUrl: targetUrl,
        };
      }

      // First-time Google sign-in creates STUDENT or DRIVER only (never ADMIN)
      const assignedRole = statePayload.role === 'DRIVER' ? 'DRIVER' : 'STUDENT';
      const newUser: UserRecord = {
        id: `usr-${assignedRole === 'DRIVER' ? 'drv' : 'stu'}-${Date.now()}`,
        name: profile.name,
        email: profile.email,
        passwordHash: '',
        authProvider: 'google',
        emailVerified: true,
        avatarUrl: profile.picture,
        googleAvatarUrl: profile.picture,
        googleSub: profile.sub,
        role: assignedRole,
        phone: '+234 800 000 0000',
        status: 'Active',
        online: true,
        rating: 5.0,
        ...(assignedRole === 'STUDENT'
          ? {
              matricNo: `AFU/26/GL/${Math.floor(100 + Math.random() * 899)}`,
              department: 'General Studies',
              walletBalance: 0,
              totalRides: 0,
              notifySms: true,
              autoWalletPay: true,
            }
          : {
              licenseNo: `AFU-DRV-${Math.floor(100 + Math.random() * 899)}`,
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
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        nextUrl: assignedRole === 'DRIVER' ? '/driver' : statePayload.nextPath.startsWith('/student') ? statePayload.nextPath : '/student',
      };
    });

    if (!outcome.ok) {
      return htmlErrorResponse(req, outcome.error, outcome.status);
    }

    const handoffRole: 'STUDENT' | 'DRIVER' = outcome.role === 'DRIVER' ? 'DRIVER' : 'STUDENT';
    const handoffToken = signGoogleHandoffToken({
      sub: outcome.userId,
      email: outcome.email,
      role: handoffRole,
      name: outcome.name,
    });

    const maxAge = 60 * 60 * 12;
    const jwt = signJwt(
      {
        sub: outcome.userId,
        email: outcome.email,
        role: handoffRole,
        name: outcome.name,
      },
      maxAge
    );

    const res = new NextResponse(
      renderPopupResultHtml({
        type: 'AFUSTA_GOOGLE_AUTH_SUCCESS',
        role: handoffRole,
        nextUrl: outcome.nextUrl,
        handoffToken,
        targetOrigin: new URL(statePayload.redirectUri).origin,
        profile: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
    res.cookies.set(OAUTH_STATE_COOKIE, '', getCookieSecurityOptions(req, 0));
    res.cookies.set(
      USER_SESSION_COOKIE,
      jwt,
      getCookieSecurityOptions(req, maxAge)
    );
    return res;
  } catch (err) {
    return htmlErrorResponse(
      req,
      err instanceof Error ? err.message : 'Google authentication failed.',
      400
    );
  }
}
