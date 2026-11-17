import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPendingSignupKey,
  clearPendingSignupProfile,
  readPendingSignupProfile,
  savePendingSignupProfile,
} from './pending-signup';

test('buildPendingSignupKey normalizes email casing and whitespace', () => {
  assert.equal(
    buildPendingSignupKey('  Student@AFUSTA.edu.ng '),
    'afusta_pending_signup:student@afusta.edu.ng'
  );
});

test('pending signup helpers gracefully no-op when window is undefined', () => {
  savePendingSignupProfile('user@afusta.edu.ng', { role: 'DRIVER', phone: '+2348000000000' });
  assert.equal(readPendingSignupProfile('user@afusta.edu.ng'), null);
  clearPendingSignupProfile('user@afusta.edu.ng');
});
