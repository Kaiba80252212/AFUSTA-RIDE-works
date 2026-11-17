import { NextRequest, NextResponse } from 'next/server';
import { PaymentMethod, RideType } from '@/lib/campus-transit';
import { requireApiAuth } from '@/lib/server-auth';
import { createRideInDb, mutateDatabase } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await requireApiAuth(req, ['STUDENT']);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const fromStopId = String(body.fromStopId || '');
    const toStopId = String(body.toStopId || '');
    const rideType = (body.rideType as RideType) || 'normal';
    const paymentMethod = (body.paymentMethod as PaymentMethod) || 'wallet';

    if (!fromStopId || !toStopId) {
      return NextResponse.json(
        { error: 'Please select both pickup and drop-off campus locations' },
        { status: 400 }
      );
    }

    const ride = await mutateDatabase((db) =>
      createRideInDb(db, {
        studentId: auth.user.id,
        fromStopId,
        toStopId,
        rideType,
        paymentMethod,
      })
    );

    return NextResponse.json({ ride }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create booking' },
      { status: 400 }
    );
  }
}
