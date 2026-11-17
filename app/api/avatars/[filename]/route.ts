import { NextRequest, NextResponse } from 'next/server';
import {
  getMimeTypeForAvatarFilename,
  isSafeAvatarFilename,
  readStoredAvatarFile,
} from '@/lib/avatar-storage';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  const { filename } = await context.params;

  if (!isSafeAvatarFilename(filename)) {
    return NextResponse.json({ error: 'Invalid avatar filename' }, { status: 400 });
  }

  const buffer = await readStoredAvatarFile(filename);
  if (!buffer) {
    return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': getMimeTypeForAvatarFilename(filename),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
