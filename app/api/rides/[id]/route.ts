import { NextRequest, NextResponse } from 'next/server';
import { RideStatus } from '@/lib/campus-transit';
import { requireApiAuth } from '@/lib/server-auth';
import { mutateDatabase, readDatabase, updateRideStatusInDb } from '@/lib/server-store';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await requireApiAuth(req, ['STUDENT', 'DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const status = body.status as RideStatus | undefined;
    const rating = typeof body.rating === 'number' ? body.rating : undefined;

    const dbSnapshot = await readDatabase();
    const targetRide = dbSnapshot.rides.find((r) => r.id === id);
    if (!targetRide) {
      return NextResponse.json({ error: 'Ride booking not found' }, { status: 404 });
    }

    if (auth.role === 'STUDENT') {
      if (targetRide.studentId !== auth.user.id) {
        return NextResponse.json(
          { error: 'Forbidden: You can only modify your own ride bookings' },
          { status: 403 }
        );
      }
      if (rating === undefined && status !== 'Cancelled') {
        return NextResponse.json(
          { error: 'Forbidden: Students may only cancel pending rides or submit ratings' },
          { status: 403 }
        );
      }
    }

    if (auth.role === 'DRIVER') {
      const isAssignedOrOpen =
        targetRide.driverId === auth.user.id ||
        (targetRide.status === 'Pending' && targetRide.driverId === null);
      if (!isAssignedOrOpen) {
        return NextResponse.json(
          { error: 'Forbidden: This ride is assigned to another driver' },
          { status: 403 }
        );
      }
      if (!status || !['Accepted', 'Declined', 'On Trip', 'Completed'].includes(status)) {
        return NextResponse.json(
          { error: 'Forbidden: Invalid driver status transition' },
          { status: 403 }
        );
      }
    }

    const ride = await mutateDatabase((db) => {
      const found = db.rides.find((r) => r.id === id);
      if (found && auth.role === 'DRIVER' && !found.driverId) {
        found.driverId = auth.user.id;
        found.driverName = auth.user.name;
        found.plateNumber = auth.user.plateNumber || 'AFU-102-KE';
      }
      return updateRideStatusInDb(db, id, status ?? targetRide.status, rating);
    });

    return NextResponse.json({ ride });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update ride' },
      { status: 400 }
    );
  }
}
