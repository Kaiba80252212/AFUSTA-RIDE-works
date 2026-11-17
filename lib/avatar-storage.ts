import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export type AvatarImageExt = 'jpg' | 'png' | 'webp';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const AVATAR_UPLOAD_DIR = path.join(process.cwd(), '.data', 'uploads', 'avatars');

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]{4,80}\.(jpg|png|webp)$/;

/**
 * Inspects file magic bytes to prevent spoofed Content-Type or malicious SVG/HTML uploads.
 */
export function detectImageFormat(buffer: Buffer): AvatarImageExt | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

export function isSafeAvatarFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false;
  }
  return SAFE_FILENAME_REGEX.test(filename);
}

export function getMimeTypeForAvatarFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export function extractAvatarFilenameFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const prefix = '/api/avatars/';
  if (!url.startsWith(prefix)) return null;
  const candidate = url.slice(prefix.length).split('?')[0];
  return isSafeAvatarFilename(candidate) ? candidate : null;
}

export function validateAvatarUpload(params: {
  mimeType: string;
  buffer: Buffer;
}): { ok: true; ext: AvatarImageExt } | { ok: false; error: string } {
  const normalizedMime = String(params.mimeType || '').toLowerCase().trim();
  if (!ALLOWED_AVATAR_MIME_TYPES.has(normalizedMime)) {
    return {
      ok: false,
      error: 'Unsupported file format. Please upload a JPG, JPEG, PNG, or WebP image.',
    };
  }

  if (!params.buffer || params.buffer.length === 0) {
    return { ok: false, error: 'Selected image file is empty.' };
  }

  if (params.buffer.length > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: 'Image size exceeds 2 MB limit. Please choose a smaller photo.',
    };
  }

  const detectedExt = detectImageFormat(params.buffer);
  if (!detectedExt) {
    return {
      ok: false,
      error: 'File content is not a valid JPG, PNG, or WebP image.',
    };
  }

  return { ok: true, ext: detectedExt };
}

export async function saveAvatarBuffer(
  userId: string,
  buffer: Buffer,
  ext: AvatarImageExt
): Promise<{ filename: string; publicUrl: string }> {
  const safeUserSlug = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'user';
  const nonce = crypto.randomBytes(6).toString('hex');
  const filename = `${safeUserSlug}-${Date.now()}-${nonce}.${ext}`;

  await fs.mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(AVATAR_UPLOAD_DIR, filename), buffer);

  return {
    filename,
    publicUrl: `/api/avatars/${filename}`,
  };
}

export async function deleteStoredAvatarByUrl(avatarUrl?: string | null): Promise<void> {
  const filename = extractAvatarFilenameFromUrl(avatarUrl);
  if (!filename) return;
  try {
    await fs.unlink(path.join(AVATAR_UPLOAD_DIR, filename));
  } catch {
    // Ignore missing files on disk
  }
}

export async function readStoredAvatarFile(filename: string): Promise<Buffer | null> {
  if (!isSafeAvatarFilename(filename)) return null;
  try {
    return await fs.readFile(path.join(AVATAR_UPLOAD_DIR, filename));
  } catch {
    return null;
  }
}
