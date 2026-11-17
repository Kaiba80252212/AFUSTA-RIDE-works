import { NextRequest, NextResponse } from 'next/server';
import {
  deleteStoredAvatarByUrl,
  saveAvatarBuffer,
  validateAvatarUpload,
} from '@/lib/avatar-storage';
import { requireApiAuth } from '@/lib/server-auth';
import { mutateDatabase, sanitizeUser } from '@/lib/server-store';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await requireApiAuth(req, ['STUDENT', 'DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const formData = await req.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || typeof fileEntry === 'string') {
      return NextResponse.json(
        { error: 'Please select an image file to upload.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateAvatarUpload({
      mimeType: fileEntry.type,
      buffer,
    });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const saved = await saveAvatarBuffer(auth.user.id, buffer, validation.ext);
    let previousCustomUrl: string | undefined;

    const updatedUser = await mutateDatabase((db) => {
      const target = db.users.find((u) => u.id === auth.user.id);
      if (!target) {
        throw new Error('Account not found');
      }
      previousCustomUrl = target.customAvatarUrl;
      target.customAvatarUrl = saved.publicUrl;
      target.avatarUrl = saved.publicUrl;
      return sanitizeUser(target);
    });

    if (previousCustomUrl && previousCustomUrl !== saved.publicUrl) {
      await deleteStoredAvatarByUrl(previousCustomUrl);
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to upload profile photo.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { auth, errorResponse } = await requireApiAuth(req, ['STUDENT', 'DRIVER']);
  if (errorResponse) return errorResponse;

  try {
    const mode = req.nextUrl.searchParams.get('mode') === 'google' ? 'google' : 'remove';
    let previousCustomUrl: string | undefined;

    const updatedUser = await mutateDatabase((db) => {
      const target = db.users.find((u) => u.id === auth.user.id);
      if (!target) {
        throw new Error('Account not found');
      }
      previousCustomUrl = target.customAvatarUrl;
      target.customAvatarUrl = undefined;

      if (mode === 'google' && target.googleAvatarUrl) {
        target.avatarUrl = target.googleAvatarUrl;
      } else {
        target.avatarUrl = undefined;
      }

      return sanitizeUser(target);
    });

    if (previousCustomUrl) {
      await deleteStoredAvatarByUrl(previousCustomUrl);
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update profile photo.' },
      { status: 400 }
    );
  }
}
