import { NextRequest, NextResponse } from 'next/server';
import { OAUTH_STATE_COOKIE, signOAuthState } from '@/lib/auth-security';
import { buildGoogleAuthorizationUrl, isGoogleOAuthConfigured } from '@/lib/google-oauth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getAppBaseUrl, getCookieSecurityOptions } from '@/lib/server-auth';

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`google-url:${ip}`, 20, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many authentication attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  const requestedScope = req.nextUrl.searchParams.get('scope')?.toLowerCase();
  if (requestedScope === 'admin') {
    return NextResponse.json(
      {
        error:
          'Google Sign-In is disabled for administrator accounts. Sign in with administrator email and password.',
      },
      { status: 403 }
    );
  }

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          'Google OAuth 2.0 is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.',
      },
      { status: 503 }
    );
  }

  const scopeParam = 'user' as const;
  const requestedRole = req.nextUrl.searchParams.get('role')?.toUpperCase();
  const role: 'STUDENT' | 'DRIVER' = requestedRole === 'DRIVER' ? 'DRIVER' : 'STUDENT';
  const rawHint = (req.nextUrl.searchParams.get('loginHint') || '').trim().toLowerCase();
  if (rawHint && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawHint)) {
    return NextResponse.json(
      { error: 'Please enter a valid Google email address.' },
      { status: 400 }
    );
  }
  const promptMode =
    req.nextUrl.searchParams.get('promptMode') === 'consent'
      ? ('select_account consent' as const)
      : ('select_account' as const);

  const nextParam = req.nextUrl.searchParams.get('next') || '';
  const safeNextPath =
    nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/directorate-portal')
      ? nextParam
      : role === 'DRIVER'
      ? '/driver'
      : '/student';

  const baseUrl = getAppBaseUrl(req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const { stateToken, nonce } = signOAuthState({
    scope: scopeParam,
    role,
    nextPath: safeNextPath,
    redirectUri,
  });

  const url = buildGoogleAuthorizationUrl({
    redirectUri,
    state: stateToken,
    loginHint: rawHint || undefined,
    prompt: promptMode,
  });

  try {
    const preflight = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(1500),
    });
    const location = preflight.headers.get('location') || '';
    if (location.includes('/signin/oauth/error')) {
      const errUrl = new URL(location);
      const encodedErr = errUrl.searchParams.get('authError') || '';
      const decodedErr = Buffer.from(encodedErr, 'base64url').toString('utf8');
      if (decodedErr.includes('redirect_uri_mismatch')) {
        return NextResponse.json(
          {
            error: `Google OAuth Redirect URI is not registered yet in Google Cloud Console. Add this exact Authorized Redirect URI: ${redirectUri}`,
            redirectUri,
          },
          { status: 400 }
        );
      }
      if (decodedErr.includes('deleted_client') || decodedErr.includes('invalid_client')) {
        return NextResponse.json(
          {
            error:
              'Configured GOOGLE_CLIENT_ID was deleted or is invalid. Update environment secrets or sign in via Firebase Authentication.',
          },
          { status: 503 }
        );
      }
    }
  } catch {
    // Ignore transient network timeouts and proceed with normal OAuth redirect
  }

  const res = NextResponse.json({ url, redirectUri });
  res.cookies.set(OAUTH_STATE_COOKIE, nonce, getCookieSecurityOptions(req, 600));
  return res;
}
