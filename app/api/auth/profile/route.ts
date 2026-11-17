import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server-auth';
import { mutateDatabase, sanitizeUser } from '@/lib/server-store';

export async function PATCH(req: NextRequest) {
  const { auth, errorResponse } = await requireApiAuth(req, ['STUDENT', 'DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const updated = await mutateDatabase((db) => {
      const user = db.users.find((u) => u.id === auth.user.id);
      if (!user) throw new Error('Account not found');

      if (typeof body.name === 'string' && body.name.trim().length >= 2) {
        user.name = body.name.trim();
      }
      if (typeof body.phone === 'string' && body.phone.trim().length >= 7) {
        user.phone = body.phone.trim();
      }
      if (auth.role === 'STUDENT') {
        if (typeof body.department === 'string') user.department = body.department.trim();
        if (typeof body.matricNo === 'string') user.matricNo = body.matricNo.trim();
      }
      if (typeof body.notifySms === 'boolean') user.notifySms = body.notifySms;
      if (typeof body.autoWalletPay === 'boolean') user.autoWalletPay = body.autoWalletPay;

      return sanitizeUser(user);
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Profile update failed' },
      { status: 400 }
    );
  }
}
