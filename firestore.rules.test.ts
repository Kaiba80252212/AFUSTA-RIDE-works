import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesContent = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'firebase-blueprint.json'), 'utf8')
);

test('firestore.rules enforces global deny-all catch-all and strict email/phone verification', () => {
  assert.match(rulesContent, /rules_version\s*=\s*'2'/);
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /request\.auth\.token\.phone_number is string/);
  assert.doesNotMatch(rulesContent, /allow read\s*:\s*if true/);
  assert.doesNotMatch(rulesContent, /allow write\s*:\s*if true/);
});

test('firestore.rules covers every collection declared in firebase-blueprint.json', () => {
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.includes('/users/{userId}'));
  assert.ok(paths.includes('/users/{userId}/private/{docId}'));
  assert.ok(paths.includes('/admins/{adminId}'));
  assert.ok(paths.includes('/rides/{rideId}'));

  assert.match(rulesContent, /match \/users\/\{userId\}/);
  assert.match(rulesContent, /match \/private\/\{docId\}/);
  assert.match(rulesContent, /match \/admins\/\{adminId\}/);
  assert.match(rulesContent, /match \/rides\/\{rideId\}/);
});

test('firestore.rules blocks Dirty Dozen attack surfaces', () => {
  // No client writes to /admins
  assert.match(rulesContent, /match \/admins\/\{adminId\}[\s\S]*allow create, update, delete: if false;/);
  // Role restricted to STUDENT or DRIVER on public profiles
  assert.match(rulesContent, /function isValidRole\(role\)\s*\{\s*return role in \['STUDENT', 'DRIVER'\];\s*\}/);
  // Strict key checks and affectedKeys allowlists
  assert.match(rulesContent, /data\.keys\(\)\.hasAll/);
  assert.match(rulesContent, /data\.keys\(\)\.hasOnly/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly/);
  // Terminal ride state locking
  assert.match(rulesContent, /!isTerminalRideStatus\(existing\(\)\.status\)/);
  // Server timestamp enforcement
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);
  // No get() or exists() inside allow list lines
  const listLines = rulesContent
    .split('\n')
    .filter((line) => line.includes('allow list:'));
  assert.ok(listLines.length >= 4);
  for (const line of listLines) {
    assert.equal(line.includes('get(') || line.includes('exists('), false, `Disallowed lookup in list rule: ${line}`);
  }
});
