import fs from 'node:fs/promises';
import path from 'node:path';
import { hashPassword } from './auth-security';
import {
  calculateCampusDistanceKm,
  calculateEtaMinutes,
  calculateFare,
  canTransitionRideStatus,
  getCampusStop,
  PaymentMethod,
  RideStatus,
  RideType,
  UserRole,
} from './campus-transit';

export type AuthProvider = 'email' | 'google' | 'phone';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  authProvider: AuthProvider;
  emailVerified: boolean;
  avatarUrl?: string;
  customAvatarUrl?: string;
  googleAvatarUrl?: string;
  googleSub?: string;
  firebaseUid?: string;
  role: UserRole;
  phone: string;
  status: 'Active' | 'Suspended';
  online: boolean;
  rating: number;
  // Student fields
  matricNo?: string;
  department?: string;
  walletBalance?: number;
  totalRides?: number;
  // Driver fields
  licenseNo?: string;
  tricycleId?: string;
  plateNumber?: string;
  available?: boolean;
  todayTrips?: number;
  todayEarnings?: number;
  totalEarnings?: number;
  // Preferences
  notifySms?: boolean;
  autoWalletPay?: boolean;
  themePreference?: ThemePreference;
  createdAt: string;
  lastLoginAt?: string;
}

export interface TricycleRecord {
  id: string;
  code: string;
  plateNumber: string;
  model: string;
  driverId: string | null;
  driverName: string;
  routeZone: string;
  status: 'Active' | 'Maintenance' | 'Offline';
  lastInspection: string;
}

export interface RideRecord {
  id: string;
  bookingRef: string;
  studentId: string;
  studentName: string;
  driverId: string | null;
  driverName: string;
  plateNumber: string;
  fromStopId: string;
  fromName: string;
  toStopId: string;
  toName: string;
  rideType: RideType;
  paymentMethod: PaymentMethod;
  fare: number;
  distanceKm: number;
  etaMinutes: number;
  status: RideStatus;
  studentRating?: number;
  createdAt: string;
  displayTime: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'Top-Up' | 'Ride Payment' | 'Refund' | 'Driver Payout';
  amount: number;
  description: string;
  createdAt: string;
  reference: string;
}

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  createdAt: string;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface EmailVerificationRecord {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface AfustaDatabase {
  users: UserRecord[];
  tricycles: TricycleRecord[];
  rides: RideRecord[];
  transactions: WalletTransaction[];
  inquiries: ContactInquiry[];
  passwordResets: PasswordResetRecord[];
  emailVerifications: EmailVerificationRecord[];
  baselineStats: {
    totalUsersBase: number;
    totalRidesBase: number;
    totalRevenueBase: number;
  };
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'afusta-db.json');

let writeQueue: Promise<void> = Promise.resolve();

function normalizeRole(role: string): UserRole {
  const upper = String(role || '').toUpperCase();
  if (upper === 'ADMIN') return 'ADMIN';
  if (upper === 'DRIVER') return 'DRIVER';
  return 'STUDENT';
}

async function createSeedDatabase(): Promise<AfustaDatabase> {
  const userDefaultSecret = process.env.SEED_USER_PASSWORD || 'AfustaUser2026!';
  const adminBootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@afusta.edu.ng')
    .trim()
    .toLowerCase();
  const adminDefaultSecret = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'AfustaDirectorate2026!';

  const [studentHash, driverHash, adminHash] = await Promise.all([
    hashPassword(userDefaultSecret),
    hashPassword(userDefaultSecret),
    hashPassword(adminDefaultSecret),
  ]);

  const users: UserRecord[] = [
    {
      id: 'usr-stu-1',
      name: 'Mubarak Abubakar',
      email: 'mubarak@afusta.edu.ng',
      passwordHash: studentHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'STUDENT',
      phone: '+234 803 412 8890',
      status: 'Active',
      online: false,
      rating: 4.9,
      matricNo: 'AFU/22/CSC/0142',
      department: 'Computer Science',
      walletBalance: 2500,
      totalRides: 12,
      notifySms: true,
      autoWalletPay: true,
      createdAt: '2026-09-12T08:30:00.000Z',
      lastLoginAt: '2026-11-12T09:00:00.000Z',
    },
    {
      id: 'usr-stu-2',
      name: 'Amina Yusuf',
      email: 'amina@afusta.edu.ng',
      passwordHash: studentHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'STUDENT',
      phone: '+234 805 221 7743',
      status: 'Active',
      online: false,
      rating: 4.8,
      matricNo: 'AFU/23/BCH/0089',
      department: 'Biochemistry',
      walletBalance: 1850,
      totalRides: 9,
      notifySms: true,
      autoWalletPay: true,
      createdAt: '2026-09-18T10:15:00.000Z',
      lastLoginAt: '2026-11-11T11:20:00.000Z',
    },
    {
      id: 'usr-stu-3',
      name: 'Chinedu Okafor',
      email: 'chinedu@afusta.edu.ng',
      passwordHash: studentHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'STUDENT',
      phone: '+234 812 609 4412',
      status: 'Active',
      online: false,
      rating: 4.7,
      matricNo: 'AFU/21/EEE/0204',
      department: 'Electrical Engineering',
      walletBalance: 3200,
      totalRides: 19,
      notifySms: false,
      autoWalletPay: true,
      createdAt: '2026-09-20T14:00:00.000Z',
      lastLoginAt: '2026-11-10T15:05:00.000Z',
    },
    {
      id: 'usr-drv-1',
      name: 'Ibrahim Musa',
      email: 'ibrahim@afusta.edu.ng',
      passwordHash: driverHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'DRIVER',
      phone: '+234 806 991 3341',
      status: 'Active',
      online: false,
      rating: 4.9,
      licenseNo: 'AFU-DRV-041',
      tricycleId: 'trk-01',
      plateNumber: 'AFU-102-KE',
      available: true,
      todayTrips: 8,
      todayEarnings: 8500,
      totalEarnings: 142500,
      notifySms: true,
      createdAt: '2026-08-05T07:00:00.000Z',
      lastLoginAt: '2026-11-12T07:30:00.000Z',
    },
    {
      id: 'usr-drv-2',
      name: 'Sani Bello',
      email: 'sani@afusta.edu.ng',
      passwordHash: driverHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'DRIVER',
      phone: '+234 809 314 5520',
      status: 'Active',
      online: false,
      rating: 4.8,
      licenseNo: 'AFU-DRV-042',
      tricycleId: 'trk-02',
      plateNumber: 'AFU-108-KE',
      available: true,
      todayTrips: 6,
      todayEarnings: 6200,
      totalEarnings: 118400,
      notifySms: true,
      createdAt: '2026-08-09T07:00:00.000Z',
      lastLoginAt: '2026-11-12T08:00:00.000Z',
    },
    {
      id: 'usr-drv-3',
      name: 'Kabiru Danladi',
      email: 'kabiru@afusta.edu.ng',
      passwordHash: driverHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'DRIVER',
      phone: '+234 814 780 9921',
      status: 'Active',
      online: false,
      rating: 4.7,
      licenseNo: 'AFU-DRV-043',
      tricycleId: 'trk-03',
      plateNumber: 'AFU-114-KE',
      available: false,
      todayTrips: 4,
      todayEarnings: 3900,
      totalEarnings: 94200,
      notifySms: true,
      createdAt: '2026-08-14T07:00:00.000Z',
      lastLoginAt: '2026-11-09T12:15:00.000Z',
    },
    {
      id: 'usr-adm-1',
      name: 'Dr. Abdullahi Garba',
      email: adminBootstrapEmail,
      passwordHash: adminHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'ADMIN',
      phone: '+234 802 100 0045',
      status: 'Active',
      online: false,
      rating: 5.0,
      department: 'Campus Transport Directorate',
      createdAt: '2026-07-01T08:00:00.000Z',
      lastLoginAt: '2026-11-12T08:45:00.000Z',
    },
  ];

  const tricycles: TricycleRecord[] = [
    {
      id: 'trk-01',
      code: 'AFU-TR-01',
      plateNumber: 'AFU-102-KE',
      model: 'Bajaj RE Compact 2025',
      driverId: 'usr-drv-1',
      driverName: 'Ibrahim Musa',
      routeZone: 'Main Gate · Library · Senate',
      status: 'Active',
      lastInspection: '2026-11-02',
    },
    {
      id: 'trk-02',
      code: 'AFU-TR-02',
      plateNumber: 'AFU-108-KE',
      model: 'TVS King Deluxe 2025',
      driverId: 'usr-drv-2',
      driverName: 'Sani Bello',
      routeZone: 'Boys Hostel · Science · Engineering',
      status: 'Active',
      lastInspection: '2026-11-04',
    },
    {
      id: 'trk-03',
      code: 'AFU-TR-03',
      plateNumber: 'AFU-114-KE',
      model: 'Bajaj RE Compact 2024',
      driverId: 'usr-drv-3',
      driverName: 'Kabiru Danladi',
      routeZone: 'Girls Hostel · Convocation · SUB',
      status: 'Offline',
      lastInspection: '2026-10-28',
    },
    {
      id: 'trk-04',
      code: 'AFU-TR-04',
      plateNumber: 'AFU-119-KE',
      model: 'TVS King Deluxe 2025',
      driverId: null,
      driverName: 'Unassigned Pool',
      routeZone: 'Medical Center · Main Gate',
      status: 'Maintenance',
      lastInspection: '2026-10-19',
    },
  ];

  const rides: RideRecord[] = [
    {
      id: 'ride-pending-01',
      bookingRef: 'AFU-8842',
      studentId: 'usr-stu-2',
      studentName: 'Amina Yusuf',
      driverId: 'usr-drv-1',
      driverName: 'Ibrahim Musa',
      plateNumber: 'AFU-102-KE',
      fromStopId: 'main-gate',
      fromName: 'Main Gate',
      toStopId: 'library',
      toName: 'Library',
      rideType: 'normal',
      paymentMethod: 'wallet',
      fare: 200,
      distanceKm: 2.3,
      etaMinutes: 7,
      status: 'Pending',
      createdAt: '2026-11-13T06:12:00.000Z',
      displayTime: '2 min ago',
    },
    {
      id: 'ride-stu-recent',
      bookingRef: 'AFU-8819',
      studentId: 'usr-stu-1',
      studentName: 'Mubarak Abubakar',
      driverId: 'usr-drv-1',
      driverName: 'Ibrahim Musa',
      plateNumber: 'AFU-102-KE',
      fromStopId: 'main-gate',
      fromName: 'Main Gate',
      toStopId: 'library',
      toName: 'Library',
      rideType: 'normal',
      paymentMethod: 'wallet',
      fare: 200,
      distanceKm: 2.3,
      etaMinutes: 7,
      status: 'Completed',
      studentRating: 5,
      createdAt: '2026-11-01T10:24:00.000Z',
      displayTime: 'Nov 1, 2026 · 10:24 AM',
    },
    {
      id: 'ride-stu-02',
      bookingRef: 'AFU-8790',
      studentId: 'usr-stu-1',
      studentName: 'Mubarak Abubakar',
      driverId: 'usr-drv-2',
      driverName: 'Sani Bello',
      plateNumber: 'AFU-108-KE',
      fromStopId: 'boys-hostel',
      fromName: 'Boys Hostel',
      toStopId: 'faculty-science',
      toName: 'Faculty of Science',
      rideType: 'shared',
      paymentMethod: 'wallet',
      fare: 130,
      distanceKm: 1.7,
      etaMinutes: 6,
      status: 'Completed',
      studentRating: 5,
      createdAt: '2026-10-30T08:15:00.000Z',
      displayTime: 'Oct 30, 2026 · 8:15 AM',
    },
    {
      id: 'ride-stu-03',
      bookingRef: 'AFU-8754',
      studentId: 'usr-stu-3',
      studentName: 'Chinedu Okafor',
      driverId: 'usr-drv-2',
      driverName: 'Sani Bello',
      plateNumber: 'AFU-108-KE',
      fromStopId: 'senate',
      fromName: 'Senate Building',
      toStopId: 'faculty-eng',
      toName: 'Faculty of Engineering',
      rideType: 'express',
      paymentMethod: 'cash',
      fare: 300,
      distanceKm: 2.0,
      etaMinutes: 6,
      status: 'Completed',
      studentRating: 4,
      createdAt: '2026-10-29T13:45:00.000Z',
      displayTime: 'Oct 29, 2026 · 1:45 PM',
    },
  ];

  const transactions: WalletTransaction[] = [
    {
      id: 'tx-01',
      userId: 'usr-stu-1',
      type: 'Top-Up',
      amount: 3000,
      description: 'Campus Paystack Wallet Deposit',
      createdAt: '2026-10-28T09:10:00.000Z',
      reference: 'PAY-994012',
    },
    {
      id: 'tx-02',
      userId: 'usr-stu-1',
      type: 'Ride Payment',
      amount: -130,
      description: 'Shared Ride · Boys Hostel to Faculty of Science',
      createdAt: '2026-10-30T08:15:00.000Z',
      reference: 'AFU-8790',
    },
    {
      id: 'tx-03',
      userId: 'usr-stu-1',
      type: 'Ride Payment',
      amount: -200,
      description: 'Normal Ride · Main Gate to Library',
      createdAt: '2026-11-01T10:24:00.000Z',
      reference: 'AFU-8819',
    },
  ];

  return {
    users,
    tricycles,
    rides,
    transactions,
    inquiries: [],
    passwordResets: [],
    emailVerifications: [],
    baselineStats: {
      totalUsersBase: 12573,
      totalRidesBase: 45226,
      totalRevenueBase: 4499370,
    },
  };
}

async function migrateIfLegacy(parsed: AfustaDatabase): Promise<{ db: AfustaDatabase; changed: boolean }> {
  let changed = false;
  if (!Array.isArray(parsed.passwordResets)) {
    parsed.passwordResets = [];
    changed = true;
  }
  if (!Array.isArray(parsed.emailVerifications)) {
    parsed.emailVerifications = [];
    changed = true;
  }

  for (const user of parsed.users as Array<UserRecord & { password?: string }>) {
    const normalized = normalizeRole(user.role);
    if (user.role !== normalized) {
      user.role = normalized;
      changed = true;
    }
    if (!user.authProvider) {
      user.authProvider = 'email';
      changed = true;
    }
    if (typeof user.emailVerified !== 'boolean') {
      user.emailVerified = true;
      changed = true;
    }
    if (!user.lastLoginAt) {
      user.lastLoginAt = user.createdAt;
      changed = true;
    }
    if (
      user.themePreference &&
      user.themePreference !== 'light' &&
      user.themePreference !== 'dark' &&
      user.themePreference !== 'system'
    ) {
      user.themePreference = 'system';
      changed = true;
    }
    if (user.authProvider === 'google' && user.avatarUrl && !user.googleAvatarUrl && !user.customAvatarUrl) {
      user.googleAvatarUrl = user.avatarUrl;
      changed = true;
    }
    if (!user.passwordHash && user.password) {
      user.passwordHash = await hashPassword(user.password);
      delete user.password;
      changed = true;
    } else if (user.password) {
      delete user.password;
      changed = true;
    }
  }

  const hasAnyAdmin = parsed.users.some((u) => u.role === 'ADMIN');
  if (!hasAnyAdmin) {
    const adminBootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@afusta.edu.ng')
      .trim()
      .toLowerCase();
    const adminDefaultSecret = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'AfustaDirectorate2026!';
    const adminHash = await hashPassword(adminDefaultSecret);
    parsed.users.push({
      id: `usr-adm-${Date.now()}`,
      name: 'Dr. Abdullahi Garba',
      email: adminBootstrapEmail,
      passwordHash: adminHash,
      authProvider: 'email',
      emailVerified: true,
      role: 'ADMIN',
      phone: '+234 802 100 0045',
      status: 'Active',
      online: false,
      rating: 5.0,
      department: 'Campus Transport Directorate',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    });
    changed = true;
  }

  return { db: parsed, changed };
}

async function ensureDbFile(): Promise<AfustaDatabase> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as AfustaDatabase;
    const { db, changed } = await migrateIfLegacy(parsed);
    if (changed) {
      await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    }
    return db;
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const seed = await createSeedDatabase();
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
}

export async function readDatabase(): Promise<AfustaDatabase> {
  return ensureDbFile();
}

export async function mutateDatabase<T>(
  mutator: (db: AfustaDatabase) => Promise<T> | T
): Promise<T> {
  const next = writeQueue.then(async () => {
    const db = await ensureDbFile();
    const result = await mutator(db);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    return result;
  });
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

export function sanitizeUser(
  user: UserRecord
): Omit<UserRecord, 'passwordHash' | 'googleSub' | 'firebaseUid'> {
  const {
    passwordHash: _removed,
    googleSub: _subRemoved,
    firebaseUid: _fbRemoved,
    ...rest
  } = user;
  const legacyRemoved = { ...(rest as Record<string, unknown>) };
  delete legacyRemoved.password;
  return legacyRemoved as Omit<UserRecord, 'passwordHash' | 'googleSub' | 'firebaseUid'>;
}

export function computeSystemSummary(db: AfustaDatabase) {
  const completedRides = db.rides.filter((r) => r.status === 'Completed');
  const liveRevenue = completedRides.reduce((sum, r) => sum + r.fare, 0);
  return {
    totalUsers: db.baselineStats.totalUsersBase + db.users.length,
    totalRides: db.baselineStats.totalRidesBase + db.rides.length,
    totalRevenue: db.baselineStats.totalRevenueBase + liveRevenue,
    activeTricycles: db.tricycles.filter((t) => t.status === 'Active').length,
    pendingRidesCount: db.rides.filter((r) => r.status === 'Pending').length,
  };
}

export function createRideInDb(
  db: AfustaDatabase,
  params: {
    studentId: string;
    fromStopId: string;
    toStopId: string;
    rideType: RideType;
    paymentMethod: PaymentMethod;
  }
): RideRecord {
  const student = db.users.find((u) => u.id === params.studentId && u.role === 'STUDENT');
  if (!student) {
    throw new Error('Student account not found');
  }
  const fromStop = getCampusStop(params.fromStopId);
  const toStop = getCampusStop(params.toStopId);
  if (!fromStop || !toStop) {
    throw new Error('Invalid campus location selected');
  }
  if (fromStop.id === toStop.id) {
    throw new Error('Pickup and destination locations must be different');
  }

  const fare = calculateFare(fromStop.id, toStop.id, params.rideType);
  const distanceKm = calculateCampusDistanceKm(fromStop.id, toStop.id);
  const etaMinutes = calculateEtaMinutes(fromStop.id, toStop.id);

  if (params.paymentMethod === 'wallet') {
    const currentWallet = student.walletBalance ?? 0;
    if (currentWallet < fare) {
      throw new Error(`Insufficient wallet balance (₦${currentWallet} available, ₦${fare} required)`);
    }
    student.walletBalance = currentWallet - fare;
  }

  const availableDrivers = db.users.filter(
    (u) => u.role === 'DRIVER' && u.status === 'Active' && u.available
  );
  const assignedDriver = availableDrivers[0] ?? db.users.find((u) => u.role === 'DRIVER') ?? null;

  const bookingRef = `AFU-${Math.floor(8850 + Math.random() * 1100)}`;
  const now = new Date();
  const ride: RideRecord = {
    id: `ride-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    bookingRef,
    studentId: student.id,
    studentName: student.name,
    driverId: assignedDriver ? assignedDriver.id : null,
    driverName: assignedDriver ? assignedDriver.name : 'Pending Dispatch',
    plateNumber: assignedDriver?.plateNumber ?? 'AFU-102-KE',
    fromStopId: fromStop.id,
    fromName: fromStop.name,
    toStopId: toStop.id,
    toName: toStop.name,
    rideType: params.rideType,
    paymentMethod: params.paymentMethod,
    fare,
    distanceKm,
    etaMinutes,
    status: 'Pending',
    createdAt: now.toISOString(),
    displayTime: 'Just now',
  };

  db.rides.unshift(ride);
  student.totalRides = (student.totalRides ?? 0) + 1;

  if (params.paymentMethod === 'wallet') {
    db.transactions.unshift({
      id: `tx-${Date.now()}`,
      userId: student.id,
      type: 'Ride Payment',
      amount: -fare,
      description: `${params.rideType === 'express' ? 'Express' : params.rideType === 'shared' ? 'Shared' : 'Normal'} Ride · ${fromStop.name} to ${toStop.name}`,
      createdAt: now.toISOString(),
      reference: bookingRef,
    });
  }

  return ride;
}

export function updateRideStatusInDb(
  db: AfustaDatabase,
  rideId: string,
  nextStatus: RideStatus,
  rating?: number
): RideRecord {
  const ride = db.rides.find((r) => r.id === rideId);
  if (!ride) {
    throw new Error('Ride booking not found');
  }

  if (typeof rating === 'number' && ride.status === 'Completed') {
    ride.studentRating = Math.min(5, Math.max(1, Math.round(rating)));
    return ride;
  }

  if (!canTransitionRideStatus(ride.status, nextStatus)) {
    throw new Error(`Cannot move ride from ${ride.status} to ${nextStatus}`);
  }

  ride.status = nextStatus;

  if (nextStatus === 'Completed' && ride.driverId) {
    const driver = db.users.find((u) => u.id === ride.driverId);
    if (driver) {
      driver.todayTrips = (driver.todayTrips ?? 0) + 1;
      driver.todayEarnings = (driver.todayEarnings ?? 0) + ride.fare;
      driver.totalEarnings = (driver.totalEarnings ?? 0) + ride.fare;
    }
  }

  if ((nextStatus === 'Cancelled' || nextStatus === 'Declined') && ride.paymentMethod === 'wallet') {
    const student = db.users.find((u) => u.id === ride.studentId);
    if (student) {
      student.walletBalance = (student.walletBalance ?? 0) + ride.fare;
      db.transactions.unshift({
        id: `tx-ref-${Date.now()}`,
        userId: student.id,
        type: 'Refund',
        amount: ride.fare,
        description: `Refund for ${nextStatus.toLowerCase()} ride ${ride.bookingRef}`,
        createdAt: new Date().toISOString(),
        reference: ride.bookingRef,
      });
    }
  }

  return ride;
}
