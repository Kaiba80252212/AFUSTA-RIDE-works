import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  CanonicalRole,
  hasRequiredRole,
  USER_SESSION_COOKIE,
  verifyJwt,
} from './auth-security';
import { readDatabase, sanitizeUser, UserRecord } from './server-store';

export type SafeUser = Omit<UserRecord, 'passwordHash' | 'googleSub'>;

export interface AuthContext {
  user: SafeUser;
  role: CanonicalRole;
}

export function getAppBaseUrl(req?: NextRequest): string {
  if (req) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || req.headers.get('host')?.split(',')[0]?.trim();
    if (host && host.endsWith('.run.app')) {
      const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
      return `${proto}://${host}`;
    }
  }

  const configured = process.env.APP_URL?.trim();
  if (
    configured &&
    configured !== 'MY_APP_URL' &&
    (configured.startsWith('https://') || configured.startsWith('http://'))
  ) {
    return configured.replace(/\/+$/, '');
  }

  if (req) {
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }
    return req.nextUrl.origin.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

export function getCookieSecurityOptions(req: NextRequest, maxAgeSeconds: number) {
  const isHttps =
    req.headers.get('x-forwarded-proto') === 'https' ||
    req.nextUrl.protocol === 'https:' ||
    process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    ...(isHttps ? { partitioned: true } : {}),
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function verifyCsrfOrigin(req: NextRequest): NextResponse | null {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return null;
  }

  const origin = req.headers.get('origin');
  if (!origin) {
    return null;
  }

  try {
    const originHost = new URL(origin).host;
    const requestHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const appUrl = getAppBaseUrl(req);
    const appHost = new URL(appUrl).host;

    if (originHost === requestHost || originHost === appHost) {
      return null;
    }

    return NextResponse.json(
      { error: 'Forbidden: Cross-origin CSRF check failed.' },
      { status: 403 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Forbidden: Invalid request origin.' },
      { status: 403 }
    );
  }
}

export async function getUserFromRequest(
  req: NextRequest,
  scope: 'user' | 'admin'
): Promise<AuthContext | null> {
  const cookieName = scope === 'admin' ? ADMIN_SESSION_COOKIE : USER_SESSION_COOKIE;
  const token = req.cookies.get(cookieName)?.value;
  const payload = verifyJwt(token);
  if (!payload) return null;

  const db = await readDatabase();
  const found = db.users.find((u) => u.id === payload.sub);
  if (!found || found.status !== 'Active') return null;
  if (!found.emailVerified) return null;
  if (found.role !== payload.role) return null;
  if (scope === 'admin' && found.role !== 'ADMIN') return null;
  if (scope === 'user' && found.role === 'ADMIN') return null;

  return {
    user: sanitizeUser(found),
    role: found.role,
  };
}

export async function getUserFromServerCookies(
  scope: 'user' | 'admin'
): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const cookieName = scope === 'admin' ? ADMIN_SESSION_COOKIE : USER_SESSION_COOKIE;
  const token = cookieStore.get(cookieName)?.value;
  const payload = verifyJwt(token);
  if (!payload) return null;

  const db = await readDatabase();
  const found = db.users.find((u) => u.id === payload.sub);
  if (!found || found.status !== 'Active') return null;
  if (!found.emailVerified) return null;
  if (found.role !== payload.role) return null;
  if (scope === 'admin' && found.role !== 'ADMIN') return null;
  if (scope === 'user' && found.role === 'ADMIN') return null;

  return {
    user: sanitizeUser(found),
    role: found.role,
  };
}

export async function requireApiAuth(
  req: NextRequest,
  allowedRoles: CanonicalRole[]
): Promise<{ auth: AuthContext; errorResponse?: never } | { auth?: never; errorResponse: NextResponse }> {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) {
    return { errorResponse: csrfError };
  }

  const isAdminOnly = allowedRoles.length === 1 && allowedRoles[0] === 'ADMIN';

  if (isAdminOnly) {
    const adminAuth = await getUserFromRequest(req, 'admin');
    if (adminAuth) {
      return { auth: adminAuth };
    }
    const regularUser = await getUserFromRequest(req, 'user');
    if (regularUser) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Forbidden: Administrator privileges required' },
          { status: 403 }
        ),
      };
    }
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Administrator authentication required' },
        { status: 401 }
      ),
    };
  }

  const userAuth = await getUserFromRequest(req, 'user');
  if (!userAuth) {
    const adminAuth = await getUserFromRequest(req, 'admin');
    if (adminAuth && !hasRequiredRole('ADMIN', allowedRoles)) {
      return {
        errorResponse: NextResponse.json(
          { error: 'Forbidden: Insufficient role permissions for this resource' },
          { status: 403 }
        ),
      };
    }
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Please sign in to continue' },
        { status: 401 }
      ),
    };
  }

  if (!hasRequiredRole(userAuth.role, allowedRoles)) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: You do not have permission to access this resource' },
        { status: 403 }
      ),
    };
  }

  return { auth: userAuth };
}
