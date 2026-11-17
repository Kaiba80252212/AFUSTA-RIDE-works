import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase, ThemePreference } from '@/lib/server-store';

function normalizeThemePreference(input: unknown): ThemePreference | null {
  if (input === 'light' || input === 'dark' || input === 'system') {
    return input;
  }
  return null;
}

export async function PATCH(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  try {
    const body = await req.json();
    const themePreference = normalizeThemePreference(body?.themePreference);
    if (!themePreference) {
      return NextResponse.json(
        { error: 'Invalid theme preference. Must be light, dark, or system.' },
        { status: 400 }
      );
    }

    const scopeHeader = req.headers.get('x-portal-scope') === 'admin' ? 'admin' : 'user';
    const primaryContext = await getUserFromRequest(req, scopeHeader);
    const fallbackContext =
      primaryContext ?? (await getUserFromRequest(req, scopeHeader === 'admin' ? 'user' : 'admin'));

    if (!fallbackContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await mutateDatabase((db) => {
      const target = db.users.find((u) => u.id === fallbackContext.user.id);
      if (target) {
        target.themePreference = themePreference;
      }
    });

    return NextResponse.json({ themePreference });
  } catch {
    return NextResponse.json(
      { error: 'Unable to update theme preference.' },
      { status: 400 }
    );
  }
}
