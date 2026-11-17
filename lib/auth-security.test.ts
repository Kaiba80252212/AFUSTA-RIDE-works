import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeOAuthNonce,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  hashPassword,
  hashResetToken,
  hasRequiredRole,
  signGoogleHandoffToken,
  signJwt,
  signOAuthState,
  validatePasswordStrength,
  verifyAndConsumeGoogleHandoffToken,
  verifyJwt,
  verifyOAuthState,
  verifyPassword,
} from './auth-security';
import { checkRateLimit, resetRateLimitStore } from './rate-limit';
import {
  buildGoogleAuthorizationUrl,
  fetchVerifiedGoogleProfile,
  isGoogleOAuthConfigured,
} from './google-oauth';

const TEST_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';

test('bcrypt password hashing verifies matching password and rejects wrong password', async () => {
  const hash = await hashPassword('CampusRide2026!');
  assert.notEqual(hash, 'CampusRide2026!');
  assert.equal(await verifyPassword('CampusRide2026!', hash), true);
  assert.equal(await verifyPassword('WrongPass99', hash), false);
});

test('JWT signing verifies valid token and rejects tampered or expired tokens', () => {
  const token = signJwt(
    {
      sub: 'usr-stu-1',
      email: 'mubarak@afusta.edu.ng',
      role: 'STUDENT',
      name: 'Mubarak Abubakar',
    },
    3600,
    TEST_SECRET
  );

  const decoded = verifyJwt(token, TEST_SECRET);
  assert.ok(decoded);
  assert.equal(decoded.sub, 'usr-stu-1');
  assert.equal(decoded.role, 'STUDENT');

  const tampered = `${token.slice(0, -4)}zzzz`;
  assert.equal(verifyJwt(tampered, TEST_SECRET), null);

  const expired = signJwt(
    {
      sub: 'usr-stu-1',
      email: 'mubarak@afusta.edu.ng',
      role: 'STUDENT',
      name: 'Mubarak Abubakar',
    },
    -10,
    TEST_SECRET
  );
  assert.equal(verifyJwt(expired, TEST_SECRET), null);
});

test('OAuth state signing verifies nonce and rejects tampered state', () => {
  const { stateToken, nonce } = signOAuthState(
    {
      scope: 'user',
      role: 'STUDENT',
      nextPath: '/student',
      redirectUri: 'https://example.run.app/api/auth/google/callback',
    },
    600,
    TEST_SECRET
  );

  const valid = verifyOAuthState(stateToken, nonce, TEST_SECRET);
  assert.ok(valid);
  assert.equal(valid.scope, 'user');
  assert.equal(valid.role, 'STUDENT');
  assert.equal(verifyOAuthState(stateToken, 'wrong-nonce', TEST_SECRET), null);
  assert.equal(verifyOAuthState(`${stateToken}x`, nonce, TEST_SECRET), null);

  assert.equal(consumeOAuthNonce(valid.nonce, valid.exp), true);
  assert.equal(consumeOAuthNonce(valid.nonce, valid.exp), false);
});

test('Google handoff token verifies once and rejects replay or tampering', () => {
  const token = signGoogleHandoffToken(
    {
      sub: 'usr-stu-99',
      email: 'student@afusta.edu.ng',
      role: 'STUDENT',
      name: 'Student Tester',
    },
    120,
    TEST_SECRET
  );

  assert.equal(verifyAndConsumeGoogleHandoffToken(`${token}x`, TEST_SECRET), null);
  const redeemed = verifyAndConsumeGoogleHandoffToken(token, TEST_SECRET);
  assert.ok(redeemed);
  assert.equal(redeemed.sub, 'usr-stu-99');
  assert.equal(redeemed.role, 'STUDENT');
  assert.equal(verifyAndConsumeGoogleHandoffToken(token, TEST_SECRET), null);
});

test('RBAC role check enforces strict role separation', () => {
  assert.equal(hasRequiredRole('STUDENT', ['STUDENT']), true);
  assert.equal(hasRequiredRole('STUDENT', ['DRIVER']), false);
  assert.equal(hasRequiredRole('STUDENT', ['ADMIN']), false);
  assert.equal(hasRequiredRole('DRIVER', ['ADMIN']), false);
  assert.equal(hasRequiredRole('ADMIN', ['ADMIN']), true);
  assert.equal(hasRequiredRole(null, ['STUDENT']), false);
});

test('Password reset, email verification tokens, and password strength rules validate properly', () => {
  const reset = generatePasswordResetToken();
  assert.equal(hashResetToken(reset.rawToken), reset.tokenHash);
  assert.ok(new Date(reset.expiresAt).getTime() > Date.now());

  const verify = generateEmailVerificationToken();
  assert.equal(hashResetToken(verify.rawToken), verify.tokenHash);
  assert.ok(new Date(verify.expiresAt).getTime() > Date.now());

  assert.equal(validatePasswordStrength('short1A'), 'Password must be at least 8 characters long');
  assert.equal(validatePasswordStrength('lowercase123'), 'Password must include at least one uppercase letter');
  assert.equal(validatePasswordStrength('UPPERCASE123'), 'Password must include at least one lowercase letter');
  assert.equal(validatePasswordStrength('NoNumbersHere'), 'Password must include at least one number');
  assert.equal(validatePasswordStrength('StrongPass2026'), null);
});

test('Rate limiter blocks after max attempts within window and resets after window', () => {
  resetRateLimitStore();
  const baseTime = 1_700_000_000_000;
  for (let i = 0; i < 3; i += 1) {
    const res = checkRateLimit('login:1.2.3.4', 3, 60_000, baseTime + i * 1000);
    assert.equal(res.allowed, true);
  }
  const blocked = checkRateLimit('login:1.2.3.4', 3, 60_000, baseTime + 5000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  const afterWindow = checkRateLimit('login:1.2.3.4', 3, 60_000, baseTime + 65_000);
  assert.equal(afterWindow.allowed, true);
});

test('Google OAuth helpers validate configuration and require verified email', async () => {
  const prevId = process.env.GOOGLE_CLIENT_ID;
  const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.equal(isGoogleOAuthConfigured(), false);

  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  assert.equal(isGoogleOAuthConfigured(), true);

  const authUrl = new URL(
    buildGoogleAuthorizationUrl({
      redirectUri: 'https://example.run.app/api/auth/google/callback',
      state: 'signed-state',
      loginHint: 'Student@Gmail.com',
      prompt: 'select_account consent',
    })
  );
  assert.equal(authUrl.origin, 'https://accounts.google.com');
  assert.equal(authUrl.searchParams.get('client_id'), 'test-client-id');
  assert.equal(authUrl.searchParams.get('scope'), 'openid email profile');
  assert.equal(authUrl.searchParams.get('login_hint'), 'student@gmail.com');
  assert.equal(authUrl.searchParams.get('prompt'), 'select_account consent');

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ sub: '123', email: 'u@example.com', email_verified: false }), {
        status: 200,
      })) as typeof fetch;

    await assert.rejects(
      () => fetchVerifiedGoogleProfile('token'),
      /verified email address/
    );

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          sub: '123',
          email: 'Student@AFUSTA.edu.ng',
          email_verified: true,
          name: 'Student Name',
          picture: 'https://lh3.googleusercontent.com/avatar.jpg',
        }),
        { status: 200 }
      )) as typeof fetch;

    const profile = await fetchVerifiedGoogleProfile('token');
    assert.equal(profile.email, 'student@afusta.edu.ng');
    assert.equal(profile.emailVerified, true);
    assert.equal(profile.picture, 'https://lh3.googleusercontent.com/avatar.jpg');
  } finally {
    globalThis.fetch = originalFetch;
    if (prevId !== undefined) process.env.GOOGLE_CLIENT_ID = prevId;
    else delete process.env.GOOGLE_CLIENT_ID;
    if (prevSecret !== undefined) process.env.GOOGLE_CLIENT_SECRET = prevSecret;
    else delete process.env.GOOGLE_CLIENT_SECRET;
  }
});
