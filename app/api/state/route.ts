import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server-auth';
import { readDatabase } from '@/lib/server-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestedScope = req.nextUrl.searchParams.get('scope')?.toUpperCase();
  const allowedRoles =
    requestedScope === 'STUDENT'
      ? (['STUDENT'] as const)
      : requestedScope === 'DRIVER'
      ? (['DRIVER'] as const)
      : (['STUDENT', 'DRIVER'] as const);

  const { auth, errorResponse } = await requireApiAuth(req, [...allowedRoles]);
  if (errorResponse) return errorResponse;

  try {
    const db = await readDatabase();

    if (auth.role === 'STUDENT') {
      return NextResponse.json({
        user: auth.user,
        rides: db.rides.filter((r) => r.studentId === auth.user.id),
        transactions: db.transactions.filter((t) => t.userId === auth.user.id),
      });
    }

    // DRIVER scope: only rides assigned to this driver or open pending rides
    return NextResponse.json({
      user: auth.user,
      rides: db.rides.filter(
        (r) => r.driverId === auth.user.id || (r.status === 'Pending' && r.driverId === null)
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load portal data' },
      { status: 500 }
    );
  }
}
