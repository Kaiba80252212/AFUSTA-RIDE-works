import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectImageFormat,
  extractAvatarFilenameFromUrl,
  getMimeTypeForAvatarFilename,
  isSafeAvatarFilename,
  MAX_AVATAR_BYTES,
  validateAvatarUpload,
} from './avatar-storage';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const WEBP_HEADER = Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'latin1');

test('detectImageFormat detects JPEG, PNG, and WebP signatures and rejects spoofs', () => {
  assert.equal(detectImageFormat(PNG_HEADER), 'png');
  assert.equal(detectImageFormat(JPG_HEADER), 'jpg');
  assert.equal(detectImageFormat(WEBP_HEADER), 'webp');

  assert.equal(detectImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(detectImageFormat(Buffer.from('GIF89a1234567890')), null);
  assert.equal(detectImageFormat(Buffer.from([0xff, 0xd8])), null);
});

test('validateAvatarUpload enforces MIME allowlist, size limit, and magic bytes', () => {
  const validPng = validateAvatarUpload({ mimeType: 'image/png', buffer: PNG_HEADER });
  assert.equal(validPng.ok, true);
  if (validPng.ok) assert.equal(validPng.ext, 'png');

  const validJpegAlias = validateAvatarUpload({ mimeType: 'image/jpg', buffer: JPG_HEADER });
  assert.equal(validJpegAlias.ok, true);
  if (validJpegAlias.ok) assert.equal(validJpegAlias.ext, 'jpg');

  const validWebp = validateAvatarUpload({ mimeType: 'image/webp', buffer: WEBP_HEADER });
  assert.equal(validWebp.ok, true);
  if (validWebp.ok) assert.equal(validWebp.ext, 'webp');

  const svgRejected = validateAvatarUpload({
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg></svg>'),
  });
  assert.equal(svgRejected.ok, false);

  const spoofRejected = validateAvatarUpload({
    mimeType: 'image/png',
    buffer: Buffer.from('<script>alert(1)</script>'),
  });
  assert.equal(spoofRejected.ok, false);

  const oversized = Buffer.alloc(MAX_AVATAR_BYTES + 1);
  PNG_HEADER.copy(oversized);
  const sizeRejected = validateAvatarUpload({ mimeType: 'image/png', buffer: oversized });
  assert.equal(sizeRejected.ok, false);

  const emptyRejected = validateAvatarUpload({ mimeType: 'image/png', buffer: Buffer.alloc(0) });
  assert.equal(emptyRejected.ok, false);
});

test('isSafeAvatarFilename blocks traversal and unexpected extensions', () => {
  assert.equal(isSafeAvatarFilename('usr-stu-1-1731510000-abcdef.png'), true);
  assert.equal(isSafeAvatarFilename('usr_drv_2-1731510000-123456.webp'), true);

  assert.equal(isSafeAvatarFilename('../afusta-db.json'), false);
  assert.equal(isSafeAvatarFilename('sub/file.png'), false);
  assert.equal(isSafeAvatarFilename('sub\\file.png'), false);
  assert.equal(isSafeAvatarFilename('payload.svg'), false);
  assert.equal(isSafeAvatarFilename('script.js'), false);
});

test('extractAvatarFilenameFromUrl and MIME lookup work safely', () => {
  assert.equal(
    extractAvatarFilenameFromUrl('/api/avatars/usr-stu-1-12345-ab12cd.jpg'),
    'usr-stu-1-12345-ab12cd.jpg'
  );
  assert.equal(
    extractAvatarFilenameFromUrl('/api/avatars/usr-stu-1-12345-ab12cd.jpg?v=99'),
    'usr-stu-1-12345-ab12cd.jpg'
  );
  assert.equal(extractAvatarFilenameFromUrl('https://lh3.googleusercontent.com/photo'), null);
  assert.equal(extractAvatarFilenameFromUrl('/api/avatars/../../etc/passwd'), null);

  assert.equal(getMimeTypeForAvatarFilename('avatar.png'), 'image/png');
  assert.equal(getMimeTypeForAvatarFilename('avatar.webp'), 'image/webp');
  assert.equal(getMimeTypeForAvatarFilename('avatar.jpg'), 'image/jpeg');
});
