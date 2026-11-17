import { NextResponse } from 'next/server';
import { CAMPUS_STOPS } from '@/lib/campus-transit';
import { readDatabase } from '@/lib/server-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await readDatabase();
    return NextResponse.json({
      activeTricycles: db.tricycles.filter((t) => t.status === 'Active').length,
      campusStopsCount: CAMPUS_STOPS.length,
    });
  } catch {
    return NextResponse.json({ activeTricycles: 2, campusStopsCount: 10 });
  }
}
