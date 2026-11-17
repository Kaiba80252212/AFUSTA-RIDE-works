import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server-auth';
import {
  computeSystemSummary,
  readDatabase,
  sanitizeUser,
} from '@/lib/server-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await requireApiAuth(req, ['ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const db = await readDatabase();
    return NextResponse.json({
      admin: auth.user,
      users: db.users.map(sanitizeUser),
      tricycles: db.tricycles,
      rides: db.rides,
      inquiries: db.inquiries,
      summary: computeSystemSummary(db),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load admin console' },
      { status: 500 }
    );
  }
}
