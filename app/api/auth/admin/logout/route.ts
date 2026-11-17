import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/auth-security';
import { getCookieSecurityOptions, getUserFromRequest, verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  const adminAuth = await getUserFromRequest(req, 'admin');
  if (adminAuth) {
    await mutateDatabase((db) => {
      const target = db.users.find((u) => u.id === adminAuth.user.id);
      if (target) target.online = false;
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', getCookieSecurityOptions(req, 0));
  return res;
}
