import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneToE164, phonesMatch, validateOtpCode } from './phone';

test('normalizePhoneToE164 handles international, local Nigerian, and formatted numbers', () => {
  assert.equal(normalizePhoneToE164('+234 803 123 4567'), '+2348031234567');
  assert.equal(normalizePhoneToE164('0803 123 4567'), '+2348031234567');
  assert.equal(normalizePhoneToE164('8031234567'), '+2348031234567');
  assert.equal(normalizePhoneToE164('001 415 555 2671'), '+14155552671');
  assert.equal(normalizePhoneToE164('+44 (7911) 123456'), '+447911123456');
  assert.equal(normalizePhoneToE164('123'), null);
  assert.equal(normalizePhoneToE164(''), null);
});

test('phonesMatch compares local and E.164 phone numbers accurately', () => {
  assert.equal(phonesMatch('0803 123 4567', '+2348031234567'), true);
  assert.equal(phonesMatch('+2348031234567', '+2348031234568'), false);
  assert.equal(phonesMatch('', '+2348031234567'), false);
});

test('validateOtpCode checks 6-digit numeric codes', () => {
  assert.equal(validateOtpCode('123456'), null);
  assert.equal(validateOtpCode(' 123 456 '), null);
  assert.notEqual(validateOtpCode('12345'), null);
  assert.notEqual(validateOtpCode('12ab56'), null);
});
