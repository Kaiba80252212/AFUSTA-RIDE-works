import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server-auth';
import { mutateDatabase, sanitizeUser } from '@/lib/server-store';

export async function PATCH(req: NextRequest) {
  const { auth, errorResponse } = await requireApiAuth(req, ['DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const available = Boolean(body.available);

    const driver = await mutateDatabase((db) => {
      const user = db.users.find((u) => u.id === auth.user.id && u.role === 'DRIVER');
      if (!user) throw new Error('Driver account not found');
      user.available = available;
      user.online = available;
      if (user.tricycleId) {
        const trike = db.tricycles.find((t) => t.id === user.tricycleId);
        if (trike && trike.status !== 'Maintenance') {
          trike.status = available ? 'Active' : 'Offline';
        }
      }
      return sanitizeUser(user);
    });

    return NextResponse.json({ driver });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle availability' },
      { status: 400 }
    );
  }
}
