import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCampusDistanceKm,
  calculateEtaMinutes,
  calculateFare,
  canTransitionRideStatus,
  formatNaira,
  getPopularCampusRoutes,
} from './campus-transit';

test('Main Gate to Library Normal Ride matches ₦200 tariff', () => {
  assert.equal(calculateFare('main-gate', 'library', 'normal'), 200);
  assert.equal(calculateFare('main-gate', 'library', 'shared'), 130);
  assert.equal(calculateFare('main-gate', 'library', 'express'), 300);
});

test('Rejects identical origin and destination', () => {
  assert.throws(() => calculateFare('main-gate', 'main-gate', 'normal'), {
    message: /must be different/,
  });
});

test('Distance and ETA scale positively for valid routes', () => {
  const shortKm = calculateCampusDistanceKm('senate', 'sub');
  const longKm = calculateCampusDistanceKm('main-gate', 'faculty-eng');
  assert.ok(shortKm > 0);
  assert.ok(longKm > shortKm);
  assert.ok(calculateEtaMinutes('main-gate', 'faculty-eng') >= calculateEtaMinutes('senate', 'sub'));
});

test('Ride status transitions follow strict workflow', () => {
  assert.equal(canTransitionRideStatus('Pending', 'Accepted'), true);
  assert.equal(canTransitionRideStatus('Pending', 'Declined'), true);
  assert.equal(canTransitionRideStatus('Pending', 'Completed'), false);
  assert.equal(canTransitionRideStatus('Accepted', 'On Trip'), true);
  assert.equal(canTransitionRideStatus('On Trip', 'Completed'), true);
  assert.equal(canTransitionRideStatus('Completed', 'Cancelled'), false);
});

test('Popular routes and Naira formatting return expected values', () => {
  const routes = getPopularCampusRoutes();
  assert.equal(routes.length, 6);
  assert.equal(formatNaira(2500), '₦2,500');
  assert.equal(formatNaira(4500000), '₦4,500,000');
});
