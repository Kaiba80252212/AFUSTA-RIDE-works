import crypto from 'node:crypto';
import firebaseConfig from '@/firebase-applet-config.json';

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  phoneNumber?: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
  signInProvider?: string;
}

export interface VerifyFirebaseTokenOptions {
  allowUnverified?: boolean;
}

interface CertCacheEntry {
  certs: Record<string, string>;
  expiresAtMs: number;
}

declare global {
  var __afustaFirebaseCertCache: CertCacheEntry | undefined;
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) return 3600;
  const match = cacheControl.match(/max-age=(\d+)/i);
  if (!match) return 3600;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 60 ? parsed : 3600;
}

export async function fetchFirebasePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const cached = globalThis.__afustaFirebaseCertCache;
  if (!forceRefresh && cached && cached.expiresAtMs > Date.now()) {
    return cached.certs;
  }

  const res = await fetch(FIREBASE_CERTS_URL, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error('Unable to fetch Firebase public verification certificates.');
  }

  const certs = (await res.json()) as Record<string, string>;
  const maxAge = parseMaxAgeSeconds(res.headers.get('cache-control'));
  globalThis.__afustaFirebaseCertCache = {
    certs,
    expiresAtMs: Date.now() + maxAge * 1000,
  };
  return certs;
}

export function verifyFirebaseJwtWithCerts(
  idToken: string,
  certs: Record<string, string>,
  projectId: string = firebaseConfig.projectId,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  options?: VerifyFirebaseTokenOptions
): VerifiedFirebaseUser {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing Firebase authentication token.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Firebase authentication token.');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) {
    throw new Error('Malformed Firebase authentication token segments.');
  }

  let header: { alg?: string; kid?: string; typ?: string };
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    auth_time?: number;
    email?: string;
    email_verified?: boolean;
    phone_number?: string;
    name?: string;
    picture?: string;
    firebase?: { sign_in_provider?: string };
  };

  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Invalid Firebase token encoding.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Firebase token signing algorithm.');
  }

  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('UNKNOWN_KID');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = base64UrlDecode(sigB64);

  if (!verifier.verify(certPem, signature)) {
    throw new Error('Firebase token signature verification failed.');
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.aud !== projectId) {
    throw new Error('Firebase token audience mismatch.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Firebase token issuer mismatch.');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Firebase token subject is invalid.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Firebase sign-in session expired. Please authenticate again.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300) {
    throw new Error('Firebase token issued-at timestamp is invalid.');
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSeconds + 300) {
    throw new Error('Firebase token auth_time timestamp is invalid.');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const phoneNumber =
    typeof payload.phone_number === 'string' ? payload.phone_number.trim() : '';
  const hasValidEmail = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const hasValidPhone = Boolean(phoneNumber && /^\+?[0-9]{6,20}$/.test(phoneNumber));
  const isVerified = payload.email_verified === true;
  const signInProvider = payload.firebase?.sign_in_provider;

  if (!hasValidEmail && !hasValidPhone) {
    throw new Error('Firebase token does not contain a valid email address or phone number.');
  }

  if (!options?.allowUnverified && !isVerified && !hasValidPhone) {
    throw new Error('Your account must have a verified email address before signing in.');
  }

  const rawName = typeof payload.name === 'string' ? payload.name.trim() : '';
  const name = rawName || (hasValidEmail ? email.split('@')[0] : phoneNumber);

  return {
    uid: payload.sub,
    email: hasValidEmail ? email : '',
    ...(hasValidPhone ? { phoneNumber } : {}),
    name,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    emailVerified: isVerified,
    signInProvider,
  };
}

export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string = firebaseConfig.projectId,
  options?: VerifyFirebaseTokenOptions
): Promise<VerifiedFirebaseUser> {
  const certs = await fetchFirebasePublicCerts(false);
  try {
    return verifyFirebaseJwtWithCerts(idToken, certs, projectId, undefined, options);
  } catch (err) {
    if (err instanceof Error && err.message === 'UNKNOWN_KID') {
      const refreshed = await fetchFirebasePublicCerts(true);
      return verifyFirebaseJwtWithCerts(idToken, refreshed, projectId, undefined, options);
    }
    throw err;
  }
}
