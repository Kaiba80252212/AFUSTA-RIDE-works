import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, validatePasswordStrength } from '@/lib/auth-security';
import { UserRole } from '@/lib/campus-transit';
import { verifyFirebaseIdToken } from '@/lib/firebase-token';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyCsrfOrigin } from '@/lib/server-auth';
import { mutateDatabase, sanitizeUser, UserRecord } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const csrfError = verifyCsrfOrigin(req);
  if (csrfError) return csrfError;

  const ip = getClientIp(req.headers);
  const limit = checkRateLimit(`register:${ip}`, 100, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const firebaseIdToken =
      typeof body.firebaseIdToken === 'string' ? body.firebaseIdToken.trim() : '';
    const phone = String(body.phone || '').trim();
    const requestedRole = String(body.role || 'STUDENT').toUpperCase();
    const matricNo = String(body.matricNo || '').trim();
    const department = String(body.department || '').trim();
    const licenseNo = String(body.licenseNo || '').trim();

    if (requestedRole === 'ADMIN') {
      return NextResponse.json(
        { error: 'Administrator accounts cannot be created via public registration.' },
        { status: 403 }
      );
    }

    const role: UserRole = requestedRole === 'DRIVER' ? 'DRIVER' : 'STUDENT';

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!phone || phone.length < 7) {
      return NextResponse.json({ error: 'A valid phone number is required.' }, { status: 400 });
    }

    let firebaseUid: string | undefined;
    let isVerified = false;
    let passwordHash = '';

    if (firebaseIdToken) {
      const verified = await verifyFirebaseIdToken(firebaseIdToken, undefined, {
        allowUnverified: true,
      });
      if (verified.email !== email) {
        return NextResponse.json(
          { error: 'Registration email does not match your Firebase account.' },
          { status: 400 }
        );
      }
      firebaseUid = verified.uid;
      isVerified = verified.emailVerified;
    } else {
      const strengthError = validatePasswordStrength(password);
      if (strengthError) {
        return NextResponse.json({ error: strengthError }, { status: 400 });
      }
      passwordHash = await hashPassword(password);
    }

    const safeUser = await mutateDatabase((db) => {
      const existing = db.users.find((u) => u.email.toLowerCase() === email);
      if (existing) {
        if (existing.role === 'ADMIN') {
          throw new Error('Administrator accounts cannot be modified via public registration.');
        }
        if (
          firebaseUid &&
          (!existing.firebaseUid || existing.firebaseUid === firebaseUid) &&
          !existing.emailVerified
        ) {
          existing.name = name;
          existing.phone = phone;
          existing.firebaseUid = firebaseUid;
          existing.authProvider = 'email';
          existing.emailVerified = isVerified;
          existing.role = role;
          if (role === 'STUDENT') {
            existing.matricNo = matricNo || existing.matricNo;
            existing.department = department || existing.department;
          } else {
            existing.licenseNo = licenseNo || existing.licenseNo;
          }
          return sanitizeUser(existing);
        }
        throw new Error('An account with this email already exists.');
      }

      const now = new Date().toISOString();
      const id = `usr-${role === 'DRIVER' ? 'drv' : 'stu'}-${Date.now()}`;
      const newUser: UserRecord = {
        id,
        name,
        email,
        passwordHash,
        authProvider: 'email',
        emailVerified: isVerified,
        ...(firebaseUid ? { firebaseUid } : {}),
        role,
        phone,
        status: 'Active',
        online: false,
        rating: 5.0,
        ...(role === 'STUDENT'
          ? {
              matricNo: matricNo || `AFU/26/REG/${Math.floor(100 + Math.random() * 899)}`,
              department: department || 'General Studies',
              walletBalance: 0,
              totalRides: 0,
              notifySms: true,
              autoWalletPay: true,
            }
          : {
              licenseNo: licenseNo || `AFU-DRV-${Math.floor(100 + Math.random() * 899)}`,
              plateNumber: `AFU-${Math.floor(140 + Math.random() * 800)}-KE`,
              available: false,
              todayTrips: 0,
              todayEarnings: 0,
              totalEarnings: 0,
              notifySms: true,
            }),
        createdAt: now,
      };

      db.users.push(newUser);
      return sanitizeUser(newUser);
    });

    return NextResponse.json(
      {
        user: safeUser,
        requiresVerification: !safeUser.emailVerified,
        emailSent: Boolean(firebaseUid),
        provider: 'firebase',
        message: safeUser.emailVerified
          ? `Account created and verified for ${safeUser.email}.`
          : `Account created! Firebase has sent a verification email to ${safeUser.email}. Check your inbox and verify before signing in.`,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed.' },
      { status: 400 }
    );
  }
}
