import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/server-auth';
import { mutateDatabase, sanitizeUser } from '@/lib/server-store';

export async function PATCH(req: NextRequest) {
  const { errorResponse } = await requireApiAuth(req, ['ADMIN']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const action = body.action as 'toggleUserStatus' | 'updateTricycleStatus' | 'addTricycle';

    if (action === 'toggleUserStatus') {
      const targetUserId = String(body.userId || '');
      const updated = await mutateDatabase((db) => {
        const user = db.users.find((u) => u.id === targetUserId);
        if (!user) throw new Error('User not found');
        if (user.role === 'ADMIN') throw new Error('Cannot suspend administrator');
        user.status = user.status === 'Active' ? 'Suspended' : 'Active';
        if (user.status === 'Suspended') {
          user.available = false;
          user.online = false;
        }
        return sanitizeUser(user);
      });
      return NextResponse.json({ user: updated });
    }

    if (action === 'updateTricycleStatus') {
      const tricycleId = String(body.tricycleId || '');
      const status = body.status as 'Active' | 'Maintenance' | 'Offline';
      if (!['Active', 'Maintenance', 'Offline'].includes(status)) {
        return NextResponse.json({ error: 'Invalid tricycle status' }, { status: 400 });
      }
      const updated = await mutateDatabase((db) => {
        const trike = db.tricycles.find((t) => t.id === tricycleId);
        if (!trike) throw new Error('Tricycle not found');
        trike.status = status;
        trike.lastInspection = new Date().toISOString().slice(0, 10);
        return trike;
      });
      return NextResponse.json({ tricycle: updated });
    }

    if (action === 'addTricycle') {
      const plateNumber = String(body.plateNumber || '').trim().toUpperCase();
      const model = String(body.model || '').trim();
      const routeZone = String(body.routeZone || '').trim();
      if (!plateNumber || !model) {
        return NextResponse.json(
          { error: 'Plate number and tricycle model are required' },
          { status: 400 }
        );
      }
      const created = await mutateDatabase((db) => {
        const nextNum = db.tricycles.length + 1;
        const code = `AFU-TR-${String(nextNum).padStart(2, '0')}`;
        const trike = {
          id: `trk-${Date.now()}`,
          code,
          plateNumber,
          model,
          driverId: null,
          driverName: 'Unassigned Pool',
          routeZone: routeZone || 'Main Gate · Library · Senate',
          status: 'Active' as const,
          lastInspection: new Date().toISOString().slice(0, 10),
        };
        db.tricycles.unshift(trike);
        return trike;
      });
      return NextResponse.json({ tricycle: created }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid admin action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin operation failed' },
      { status: 400 }
    );
  }
}
