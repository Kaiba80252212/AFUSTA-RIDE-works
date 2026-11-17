import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentBookPath,
  resolveBookingCtaHref,
  resolvePortalHref,
} from './navigation';

test('buildStudentBookPath formats query parameters in deterministic order', () => {
  assert.equal(
    buildStudentBookPath('main-gate', 'library', 'normal'),
    '/student?from=main-gate&to=library&type=normal&tab=book'
  );
});

test('resolveBookingCtaHref sends guests directly to /login with encoded student booking next URL', () => {
  assert.equal(
    resolveBookingCtaHref({
      authenticatedRole: null,
      fromStopId: 'main-gate',
      toStopId: 'library',
      rideType: 'normal',
    }),
    '/login?next=%2Fstudent%3Ffrom%3Dmain-gate%26to%3Dlibrary%26type%3Dnormal%26tab%3Dbook'
  );
});

test('resolveBookingCtaHref sends signed-in students directly to /student booking tab', () => {
  assert.equal(
    resolveBookingCtaHref({
      authenticatedRole: 'STUDENT',
      fromStopId: 'hostel-a',
      toStopId: 'senate',
      rideType: 'express',
    }),
    '/student?from=hostel-a&to=senate&type=express&tab=book'
  );
});

test('resolvePortalHref avoids login redirect when authenticated and encodes next path for guests', () => {
  assert.equal(resolvePortalHref(null, 'STUDENT'), '/login?next=%2Fstudent');
  assert.equal(resolvePortalHref(null, 'DRIVER'), '/login?next=%2Fdriver');
  assert.equal(resolvePortalHref('STUDENT', 'STUDENT'), '/student');
  assert.equal(resolvePortalHref('DRIVER', 'DRIVER'), '/driver');
});
