import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyFirebaseJwtWithCerts } from './firebase-token';

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signTestRs256Jwt(
  payload: Record<string, unknown>,
  privateKey: string,
  kid = 'test-kid-1'
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${body}`);
  signer.end();
  const sig = signer.sign(privateKey);
  return `${header}.${body}.${base64UrlEncode(sig)}`;
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const PROJECT_ID = 'afusta-ride';
const NOW = 1_800_000_000;

test('verifyFirebaseJwtWithCerts accepts valid signed Firebase RS256 token', () => {
  const token = signTestRs256Jwt(
    {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      sub: 'firebase-uid-123',
      iat: NOW - 30,
      auth_time: NOW - 30,
      exp: NOW + 3600,
      email: 'Student@afusta.edu.ng',
      email_verified: true,
      name: 'Fatima Abdullahi',
      firebase: { sign_in_provider: 'google.com' },
    },
    privateKey
  );

  const verified = verifyFirebaseJwtWithCerts(token, { 'test-kid-1': publicKey }, PROJECT_ID, NOW);
  assert.equal(verified.uid, 'firebase-uid-123');
  assert.equal(verified.email, 'student@afusta.edu.ng');
  assert.equal(verified.name, 'Fatima Abdullahi');
  assert.equal(verified.emailVerified, true);
  assert.equal(verified.signInProvider, 'google.com');
});

test('verifyFirebaseJwtWithCerts rejects unverified email, expired token, and wrong project audience', () => {
  const unverified = signTestRs256Jwt(
    {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      sub: 'firebase-uid-123',
      iat: NOW - 10,
      exp: NOW + 300,
      email: 'spoof@afusta.edu.ng',
      email_verified: false,
    },
    privateKey
  );
  assert.throws(
    () => verifyFirebaseJwtWithCerts(unverified, { 'test-kid-1': publicKey }, PROJECT_ID, NOW),
    /verified email/i
  );

  const expired = signTestRs256Jwt(
    {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      sub: 'firebase-uid-123',
      iat: NOW - 4000,
      exp: NOW - 1,
      email: 'student@afusta.edu.ng',
      email_verified: true,
    },
    privateKey
  );
  assert.throws(
    () => verifyFirebaseJwtWithCerts(expired, { 'test-kid-1': publicKey }, PROJECT_ID, NOW),
    /expired/i
  );

  const wrongAud = signTestRs256Jwt(
    {
      aud: 'other-project',
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      sub: 'firebase-uid-123',
      iat: NOW - 10,
      exp: NOW + 300,
      email: 'student@afusta.edu.ng',
      email_verified: true,
    },
    privateKey
  );
  assert.throws(
    () => verifyFirebaseJwtWithCerts(wrongAud, { 'test-kid-1': publicKey }, PROJECT_ID, NOW),
    /audience mismatch/i
  );

  const allowedUnverified = verifyFirebaseJwtWithCerts(
    unverified,
    { 'test-kid-1': publicKey },
    PROJECT_ID,
    NOW,
    { allowUnverified: true }
  );
  assert.equal(allowedUnverified.uid, 'firebase-uid-123');
  assert.equal(allowedUnverified.email, 'spoof@afusta.edu.ng');
  assert.equal(allowedUnverified.emailVerified, false);
});

test('verifyFirebaseJwtWithCerts accepts valid Firebase Phone Auth token without email', () => {
  const phoneToken = signTestRs256Jwt(
    {
      aud: PROJECT_ID,
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      sub: 'firebase-phone-uid-456',
      iat: NOW - 15,
      auth_time: NOW - 15,
      exp: NOW + 3600,
      phone_number: '+2348031234567',
      firebase: { sign_in_provider: 'phone' },
    },
    privateKey
  );

  const verified = verifyFirebaseJwtWithCerts(
    phoneToken,
    { 'test-kid-1': publicKey },
    PROJECT_ID,
    NOW
  );
  assert.equal(verified.uid, 'firebase-phone-uid-456');
  assert.equal(verified.phoneNumber, '+2348031234567');
  assert.equal(verified.email, '');
  assert.equal(verified.name, '+2348031234567');
  assert.equal(verified.signInProvider, 'phone');
});

