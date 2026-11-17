import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

export type CanonicalRole = 'STUDENT' | 'DRIVER' | 'ADMIN';

export interface JwtSessionPayload {
  sub: string;
  email: string;
  role: CanonicalRole;
  name: string;
  iat: number;
  exp: number;
}

export interface OAuthStatePayload {
  nonce: string;
  scope: 'user';
  role: 'STUDENT' | 'DRIVER';
  nextPath: string;
  redirectUri: string;
  exp: number;
}

export const USER_SESSION_COOKIE = 'afusta_user_token';
export const ADMIN_SESSION_COOKIE = 'afusta_admin_token';
export const OAUTH_STATE_COOKIE = 'afusta_oauth_state';

const BCRYPT_ROUNDS = 10;

declare global {
  var __afustaRuntimeJwtSecret: string | undefined;
}

export function getRuntimeJwtSecret(): string {
  if (process.env.AUTH_JWT_SECRET && process.env.AUTH_JWT_SECRET.length >= 16) {
    return process.env.AUTH_JWT_SECRET;
  }
  if (globalThis.__afustaRuntimeJwtSecret) {
    return globalThis.__afustaRuntimeJwtSecret;
  }
  const dataDir = path.join(process.cwd(), '.data');
  const secretPath = path.join(dataDir, '.jwt-secret');
  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 32) {
      globalThis.__afustaRuntimeJwtSecret = existing;
      return existing;
    }
  } catch {
    // Generate and persist a random server secret in .data/
  }
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(secretPath, generated, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Keep in-memory secret if filesystem is read-only
  }
  globalThis.__afustaRuntimeJwtSecret = generated;
  return generated;
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  if (!plainPassword || !passwordHash) return false;
  return bcrypt.compare(plainPassword, passwordHash);
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function signJwt(
  claims: Omit<JwtSessionPayload, 'iat' | 'exp'>,
  expiresInSeconds = 60 * 60 * 12,
  secretOverride?: string
): string {
  const secret = secretOverride || getRuntimeJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtSessionPayload = {
    ...claims,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${header}.${payload}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

export function verifyJwt(
  token: string | undefined | null,
  secretOverride?: string
): JwtSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, sigPart] = parts;
  if (!headerPart || !payloadPart || !sigPart) return null;

  try {
    const secret = secretOverride || getRuntimeJwtSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerPart}.${payloadPart}`)
      .digest();
    const actualSig = base64UrlDecode(sigPart);

    if (expectedSig.length !== actualSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const payloadJson = base64UrlDecode(payloadPart).toString('utf8');
    const decoded = JSON.parse(payloadJson) as JwtSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp <= now) return null;
    if (!decoded.sub || !decoded.role) return null;
    return decoded;
  } catch {
    return null;
  }
}

export interface GoogleHandoffPayload {
  jti: string;
  sub: string;
  email: string;
  role: 'STUDENT' | 'DRIVER';
  name: string;
  exp: number;
}

declare global {
  var __afustaUsedOAuthNonces: Map<string, number> | undefined;
}

function getUsedNonceStore(): Map<string, number> {
  if (!globalThis.__afustaUsedOAuthNonces) {
    globalThis.__afustaUsedOAuthNonces = new Map<string, number>();
  }
  const now = Math.floor(Date.now() / 1000);
  if (globalThis.__afustaUsedOAuthNonces.size > 500) {
    for (const [key, exp] of globalThis.__afustaUsedOAuthNonces.entries()) {
      if (exp <= now) {
        globalThis.__afustaUsedOAuthNonces.delete(key);
      }
    }
  }
  return globalThis.__afustaUsedOAuthNonces;
}

export function consumeOAuthNonce(nonce: string, expUnixSeconds: number): boolean {
  if (!nonce) return false;
  const now = Math.floor(Date.now() / 1000);
  if (expUnixSeconds <= now) return false;
  const store = getUsedNonceStore();
  const existingExp = store.get(nonce);
  if (existingExp && existingExp > now) {
    return false;
  }
  store.set(nonce, expUnixSeconds);
  return true;
}

export function signOAuthState(
  claims: Omit<OAuthStatePayload, 'nonce' | 'exp'>,
  ttlSeconds = 600,
  secretOverride?: string
): { stateToken: string; nonce: string } {
  const secret = secretOverride || getRuntimeJwtSecret();
  const nonce = crypto.randomBytes(16).toString('hex');
  const payloadObj: OAuthStatePayload = {
    ...claims,
    nonce,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest();
  return {
    stateToken: `${encoded}.${base64UrlEncode(sig)}`,
    nonce,
  };
}

export function verifyOAuthState(
  stateToken: string | undefined | null,
  expectedNonce?: string | null,
  secretOverride?: string
): OAuthStatePayload | null {
  if (!stateToken || typeof stateToken !== 'string') return null;
  const parts = stateToken.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sigPart] = parts;
  if (!encoded || !sigPart) return null;

  try {
    const secret = secretOverride || getRuntimeJwtSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest();
    const actualSig = base64UrlDecode(sigPart);
    if (expectedSig.length !== actualSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const decoded = JSON.parse(base64UrlDecode(encoded).toString('utf8')) as OAuthStatePayload;
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp <= now) return null;
    if (expectedNonce && decoded.nonce !== expectedNonce) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function signGoogleHandoffToken(
  claims: Omit<GoogleHandoffPayload, 'jti' | 'exp'>,
  ttlSeconds = 120,
  secretOverride?: string
): string {
  const secret = secretOverride || getRuntimeJwtSecret();
  const jti = `gh_${crypto.randomBytes(16).toString('hex')}`;
  const payloadObj: GoogleHandoffPayload = {
    ...claims,
    jti,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest();
  return `${encoded}.${base64UrlEncode(sig)}`;
}

export function verifyAndConsumeGoogleHandoffToken(
  token: string | undefined | null,
  secretOverride?: string
): GoogleHandoffPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sigPart] = parts;
  if (!encoded || !sigPart) return null;

  try {
    const secret = secretOverride || getRuntimeJwtSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest();
    const actualSig = base64UrlDecode(sigPart);
    if (expectedSig.length !== actualSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const decoded = JSON.parse(base64UrlDecode(encoded).toString('utf8')) as GoogleHandoffPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!decoded.exp || decoded.exp <= now) return null;
    if (!decoded.sub || !decoded.jti) return null;
    if (decoded.role !== 'STUDENT' && decoded.role !== 'DRIVER') return null;
    if (!consumeOAuthNonce(decoded.jti, decoded.exp)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function hasRequiredRole(
  role: CanonicalRole | undefined | null,
  allowedRoles: CanonicalRole[]
): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generatePasswordResetToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: string;
} {
  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return { rawToken, tokenHash, expiresAt };
}

export function generateEmailVerificationToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: string;
} {
  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return { rawToken, tokenHash, expiresAt };
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number';
  }
  return null;
}
