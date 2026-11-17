export type RideType = 'normal' | 'shared' | 'express';
export type RideStatus = 'Pending' | 'Accepted' | 'On Trip' | 'Completed' | 'Cancelled' | 'Declined';
export type UserRole = 'STUDENT' | 'DRIVER' | 'ADMIN';
export type PaymentMethod = 'wallet' | 'cash';

export interface CampusStop {
  id: string;
  name: string;
  shortName: string;
  zone: 'Gate' | 'Academic' | 'Hostel' | 'Admin' | 'Health';
  x: number; // 0-100 SVG coordinate
  y: number; // 0-100 SVG coordinate
}

export const CAMPUS_STOPS: CampusStop[] = [
  { id: 'main-gate', name: 'Main Gate', shortName: 'Main Gate', zone: 'Gate', x: 14, y: 78 },
  { id: 'senate', name: 'Senate Building', shortName: 'Senate', zone: 'Admin', x: 34, y: 58 },
  { id: 'library', name: 'Library', shortName: 'Library', zone: 'Academic', x: 56, y: 40 },
  { id: 'faculty-science', name: 'Faculty of Science', shortName: 'Science', zone: 'Academic', x: 46, y: 24 },
  { id: 'faculty-eng', name: 'Faculty of Engineering', shortName: 'Engineering', zone: 'Academic', x: 74, y: 22 },
  { id: 'convocation', name: 'Convocation Square', shortName: 'Convocation', zone: 'Admin', x: 66, y: 58 },
  { id: 'medical-center', name: 'Medical Center', shortName: 'Medical', zone: 'Health', x: 30, y: 34 },
  { id: 'boys-hostel', name: 'Boys Hostel', shortName: 'Boys Hostel', zone: 'Hostel', x: 84, y: 46 },
  { id: 'girls-hostel', name: 'Girls Hostel', shortName: 'Girls Hostel', zone: 'Hostel', x: 80, y: 76 },
  { id: 'sub', name: 'Student Union Building', shortName: 'SUB', zone: 'Admin', x: 44, y: 78 },
];

export const RIDE_TYPE_CONFIG: Record<
  RideType,
  { label: string; multiplier: number; seats: string; description: string }
> = {
  normal: {
    label: 'Normal Ride',
    multiplier: 1,
    seats: 'Up to 3 passengers',
    description: 'Standard AFUSTA campus point-to-point fare',
  },
  shared: {
    label: 'Shared Ride',
    multiplier: 0.65,
    seats: '1 seat (Shared)',
    description: 'Budget-friendly shared route with fellow students',
  },
  express: {
    label: 'Express Private',
    multiplier: 1.6,
    seats: 'Private tricycle',
    description: 'Direct non-stop dispatch for urgent lectures or exams',
  },
};

export function getCampusStop(idOrName: string): CampusStop | undefined {
  const normalized = idOrName.trim().toLowerCase();
  return CAMPUS_STOPS.find(
    (s) => s.id.toLowerCase() === normalized || s.name.toLowerCase() === normalized
  );
}

/**
 * Computes Euclidean campus road distance in kilometers between two campus stops.
 */
export function calculateCampusDistanceKm(fromId: string, toId: string): number {
  const from = getCampusStop(fromId);
  const to = getCampusStop(toId);
  if (!from || !to) {
    throw new Error('Invalid campus stop selection');
  }
  if (from.id === to.id) return 0;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Campus spans roughly 3.2 km across; road factor 1.18 accounts for campus avenues
  const rawKm = (Math.hypot(dx, dy) / 100) * 3.2 * 1.18;
  return Math.max(0.4, Math.round(rawKm * 10) / 10);
}

/**
 * Calculates deterministic Naira fare rounded to nearest ₦50 (or ₦10 for shared),
 * calibrated so standard Main Gate -> Library Normal Ride equals ₦200 matching AFUSTA standard tariff.
 */
export function calculateFare(fromId: string, toId: string, rideType: RideType): number {
  const from = getCampusStop(fromId);
  const to = getCampusStop(toId);
  if (!from || !to) {
    throw new Error('Invalid origin or destination stop');
  }
  if (from.id === to.id) {
    throw new Error('Origin and destination must be different');
  }

  // Standard Main Gate <-> Library anchor = ₦200
  const km = calculateCampusDistanceKm(from.id, to.id);
  const baseStandard = km <= 1.2 ? 150 : km <= 2.4 ? 200 : km <= 3.1 ? 250 : 300;
  const multiplier = RIDE_TYPE_CONFIG[rideType].multiplier;
  const raw = baseStandard * multiplier;

  if (rideType === 'shared') {
    return Math.max(100, Math.round(raw / 10) * 10);
  }
  return Math.max(150, Math.round(raw / 50) * 50);
}

export function calculateEtaMinutes(fromId: string, toId: string): number {
  const km = calculateCampusDistanceKm(fromId, toId);
  if (km === 0) return 0;
  // Average campus tricycle speed ~22 km/h (~2.7 min per km) + 1 min boarding
  return Math.max(2, Math.round(km * 2.7 + 1));
}

const VALID_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  Pending: ['Accepted', 'Declined', 'Cancelled'],
  Accepted: ['On Trip', 'Cancelled'],
  'On Trip': ['Completed'],
  Completed: [],
  Cancelled: [],
  Declined: [],
};

export function canTransitionRideStatus(current: RideStatus, next: RideStatus): boolean {
  return VALID_TRANSITIONS[current].includes(next);
}

export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

export interface RouteStopPair {
  from: CampusStop;
  to: CampusStop;
  distanceKm: number;
  etaMinutes: number;
  normalFare: number;
  sharedFare: number;
  expressFare: number;
}

export function getPopularCampusRoutes(): RouteStopPair[] {
  const pairs: [string, string][] = [
    ['main-gate', 'library'],
    ['main-gate', 'senate'],
    ['boys-hostel', 'faculty-science'],
    ['girls-hostel', 'library'],
    ['senate', 'faculty-eng'],
    ['sub', 'medical-center'],
  ];

  return pairs.map(([fromId, toId]) => {
    const from = getCampusStop(fromId)!;
    const to = getCampusStop(toId)!;
    return {
      from,
      to,
      distanceKm: calculateCampusDistanceKm(fromId, toId),
      etaMinutes: calculateEtaMinutes(fromId, toId),
      normalFare: calculateFare(fromId, toId, 'normal'),
      sharedFare: calculateFare(fromId, toId, 'shared'),
      expressFare: calculateFare(fromId, toId, 'express'),
    };
  });
}
