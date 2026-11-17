'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Camera, CheckCircle2, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { SafeUser } from '@/lib/server-auth';
import { MEDIA_ASSETS } from '@/lib/media';

interface AvatarUploaderProps {
  user: SafeUser;
  onUserUpdated: (updatedUser: SafeUser) => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function AvatarUploader({ user, onUserUpdated }: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const defaultAvatar =
    user.role === 'DRIVER' ? MEDIA_ASSETS.avatarDriver : MEDIA_ASSETS.avatarStudent;

  const activeAvatarSrc = previewUrl || user.avatarUrl || defaultAvatar;
  const hasCustomAvatar = Boolean(user.customAvatarUrl);
  const hasAnyUploadedOrGoogle = Boolean(user.avatarUrl);
  const canRevertToGoogle =
    Boolean(user.googleAvatarUrl) && user.avatarUrl !== user.googleAvatarUrl;

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setNotice(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
      setError('Unsupported format. Please select a JPG, JPEG, PNG, or WebP image.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError('Image is larger than 2 MB. Please choose a smaller photo.');
      e.target.value = '';
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSaveUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not upload profile photo.');
      }
      onUserUpdated(data.user);
      clearPreview();
      setNotice('Profile photo saved and synchronized across your account.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload profile photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveOrRevert(mode: 'remove' | 'google') {
    setRemoving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/profile/avatar?mode=${mode}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update profile photo.');
      }
      clearPreview();
      onUserUpdated(data.user);
      setNotice(
        mode === 'google'
          ? 'Restored your Google account profile picture.'
          : 'Profile photo removed. Default avatar is now active.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile photo.');
    } finally {
      setRemoving(false);
    }
  }

  const isLocalApiUrl = typeof activeAvatarSrc === 'string' && activeAvatarSrc.startsWith('/api/');

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-slate-50/70 dark:bg-[#1E2936] p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-[#2481CC] dark:border-[#4EA4F6] bg-white dark:bg-[#17212B] shrink-0">
          {previewUrl ? (
            // Local blob preview URL before upload
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${user.name} preview`}
              className="h-full w-full object-cover"
            />
          ) : isLocalApiUrl ? (
            // Dynamic runtime-uploaded API asset
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeAvatarSrc}
              alt={user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={activeAvatarSrc}
              alt={user.name}
              fill
              sizes="80px"
              className="object-cover"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Profile Photo
            </h4>
            {previewUrl ? (
              <span className="rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                Preview Ready — Save to Apply
              </span>
            ) : hasCustomAvatar ? (
              <span className="rounded-md bg-sky-100 dark:bg-[#2481CC]/25 px-2 py-0.5 text-[11px] font-semibold text-[#1D6FB8] dark:text-[#4EA4F6]">
                Custom Photo
              </span>
            ) : user.googleAvatarUrl && user.avatarUrl === user.googleAvatarUrl ? (
              <span className="rounded-md bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                Google Photo
              </span>
            ) : (
              <span className="rounded-md bg-slate-200 dark:bg-[#2B3848] px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Default Avatar
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Supports JPG, JPEG, PNG, and WebP up to 2 MB.
            {user.authProvider === 'google'
              ? ' You can keep your Google picture or upload a custom photo.'
              : ''}
          </p>

          <input
            ref={fileInputRef}
            id="avatar-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            className="sr-only"
          />

          <div className="pt-2 flex flex-wrap items-center gap-2">
            {!previewUrl ? (
              <button
                type="button"
                disabled={uploading || removing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-3.5 py-2 text-xs font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] dark:hover:bg-[#38BDF8] disabled:opacity-60 transition-colors"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{hasAnyUploadedOrGoogle ? 'Change Photo' : 'Upload Photo'}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleSaveUpload}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  <span>{uploading ? 'Saving Photo...' : 'Save Photo'}</span>
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#17212B] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232E3C] transition-colors"
                >
                  <span>Choose Another</span>
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={clearPreview}
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <span>Cancel</span>
                </button>
              </>
            )}

            {!previewUrl && canRevertToGoogle && (
              <button
                type="button"
                disabled={uploading || removing}
                onClick={() => handleRemoveOrRevert('google')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#17212B] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232E3C] disabled:opacity-60 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Use Google Photo</span>
              </button>
            )}

            {!previewUrl && hasAnyUploadedOrGoogle && (
              <button
                type="button"
                disabled={uploading || removing}
                onClick={() => handleRemoveOrRevert('remove')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-[#17212B] px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 transition-colors"
              >
                {removing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span>Remove Photo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
