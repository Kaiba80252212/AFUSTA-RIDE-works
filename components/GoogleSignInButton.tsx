'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { ChevronDown, ChevronUp, Loader2, Mail, Trash2, Users } from 'lucide-react';
import {
  auth,
  createGoogleAuthProvider,
  syncFirebaseProfileToFirestore,
} from '@/lib/firebase';

interface GoogleAccountHint {
  email: string;
  name: string;
  avatarUrl?: string;
}

const STORAGE_KEY = 'afusta_google_account_hints';
const EMPTY_HINTS: GoogleAccountHint[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedParsed: GoogleAccountHint[] = EMPTY_HINTS;

function subscribeHints(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getHintsSnapshot(): GoogleAccountHint[] {
  if (typeof window === 'undefined') return EMPTY_HINTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY_HINTS;
      return cachedParsed;
    }
    const parsed = JSON.parse(raw);
    cachedParsed = Array.isArray(parsed)
      ? parsed.filter(
          (item): item is GoogleAccountHint =>
            Boolean(item && typeof item.email === 'string' && typeof item.name === 'string')
        )
      : EMPTY_HINTS;
    return cachedParsed;
  } catch {
    cachedParsed = EMPTY_HINTS;
    return cachedParsed;
  }
}

function getServerHintsSnapshot(): GoogleAccountHint[] {
  return EMPTY_HINTS;
}

function saveAccountHint(hint: GoogleAccountHint) {
  if (typeof window === 'undefined') return;
  try {
    const current = getHintsSnapshot().filter(
      (item) => item.email.toLowerCase() !== hint.email.toLowerCase()
    );
    const next = [hint, ...current].slice(0, 4);
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedParsed = next;
    listeners.forEach((cb) => cb());
  } catch {
    // Ignore storage quota errors
  }
}

function removeAccountHint(email: string) {
  if (typeof window === 'undefined') return;
  try {
    const next = getHintsSnapshot().filter(
      (item) => item.email.toLowerCase() !== email.toLowerCase()
    );
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedParsed = next;
    listeners.forEach((cb) => cb());
  } catch {
    // Ignore storage errors
  }
}

function mapFirebaseAuthError(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code?: string }).code || '');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null;
    }
    if (code === 'auth/popup-blocked') {
      return 'Browser blocked the Google sign-in window. Please allow popups for this site and try again.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not yet authorized in Firebase Authentication. Add this hostname under Firebase Console → Authentication → Settings → Authorized domains.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Google Sign-In is not enabled yet in Firebase Console → Authentication → Sign-in method.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network error while connecting to Google Authentication. Check your connection and try again.';
    }
  }
  return err instanceof Error ? err.message : 'Unable to start Google authentication.';
}

interface GoogleSignInButtonProps {
  scope?: 'user';
  role?: 'STUDENT' | 'DRIVER';
  nextPath?: string;
  label?: string;
  allowAccountChoice?: boolean;
  onError?: (message: string) => void;
  onSuccess?: (nextUrl: string) => void;
}

export function GoogleSignInButton({
  scope = 'user',
  role = 'STUDENT',
  nextPath,
  label = 'Continue with Google',
  allowAccountChoice = true,
  onError,
  onSuccess,
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const savedAccounts = useSyncExternalStore(
    subscribeHints,
    getHintsSnapshot,
    getServerHintsSnapshot
  );

  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  const nextPathRef = useRef(nextPath);

  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
    nextPathRef.current = nextPath;
  }, [onError, onSuccess, nextPath]);

  async function launchFirebaseGoogleAuth(options?: {
    loginHint?: string;
    promptMode?: 'select_account' | 'select_account consent';
  }) {
    const trimmedHint = (options?.loginHint || '').trim().toLowerCase();
    if (trimmedHint && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedHint)) {
      onErrorRef.current?.('Please enter a valid Google email address.');
      return;
    }

    setLoading(true);
    try {
      const provider = createGoogleAuthProvider({
        loginHint: trimmedHint || undefined,
        prompt: options?.promptMode || 'select_account',
      });

      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();

      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          role,
          nextPath: nextPathRef.current,
          idToken,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.user) {
        await signOut(auth).catch(() => undefined);
        throw new Error(data.error || 'Unable to establish your Google session.');
      }

      const resolvedRole: 'STUDENT' | 'DRIVER' =
        data.user.role === 'DRIVER' ? 'DRIVER' : 'STUDENT';

      try {
        await syncFirebaseProfileToFirestore({
          uid: credential.user.uid,
          displayName: data.user.name || credential.user.displayName || 'AFUSTA User',
          email: data.user.email || credential.user.email || '',
          role: resolvedRole,
          phone: data.user.phone,
          matricNo: data.user.matricNo,
          department: data.user.department,
          licenseNo: data.user.licenseNo,
          plateNumber: data.user.plateNumber,
          available: Boolean(data.user.available),
          walletBalance: typeof data.user.walletBalance === 'number' ? data.user.walletBalance : 0,
        });
      } catch {
        // Structured Firestore error is already logged by handleFirestoreError; proceed to dashboard with verified session
      }

      if (data.user.email && data.user.name) {
        saveAccountHint({
          email: data.user.email,
          name: data.user.name,
          avatarUrl: data.user.avatarUrl,
        });
      }

      const target =
        typeof data.nextUrl === 'string'
          ? data.nextUrl
          : nextPathRef.current || (resolvedRole === 'DRIVER' ? '/driver' : '/student');

      if (onSuccessRef.current) {
        setLoading(false);
        onSuccessRef.current(target);
      } else {
        window.location.assign(target);
      }
    } catch (err) {
      setLoading(false);
      const friendly = mapFirebaseAuthError(err);
      if (friendly) {
        onErrorRef.current?.(friendly);
      }
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => launchFirebaseGoogleAuth({ promptMode: 'select_account' })}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#2B3848] hover:border-slate-400 disabled:opacity-60 transition-colors shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-700 dark:text-slate-200" />
        ) : (
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
        )}
        <span>{loading ? 'Connecting to Google...' : label}</span>
      </button>

      {allowAccountChoice && (
        <div>
          <button
            type="button"
            onClick={() => setPickerOpen((prev) => !prev)}
            aria-expanded={pickerOpen}
            className="w-full inline-flex items-center justify-center gap-1.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Choose which Google account to use</span>
            {pickerOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {pickerOpen && (
            <div className="mt-2 rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50/90 dark:bg-[#1E2936] p-3 space-y-2.5 text-left">
              {savedAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Recent Google accounts on this device
                  </p>
                  <div className="space-y-1.5">
                    {savedAccounts.map((acc) => (
                      <div
                        key={acc.email}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-2.5 py-2"
                      >
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            launchFirebaseGoogleAuth({
                              loginHint: acc.email,
                              promptMode: 'select_account',
                            })
                          }
                          className="flex-1 min-w-0 flex items-center gap-2.5 text-left hover:opacity-80 disabled:opacity-60"
                        >
                          <span className="h-7 w-7 rounded-full bg-[#2481CC] dark:bg-[#4EA4F6] text-white dark:text-[#0E1621] text-xs font-bold flex items-center justify-center shrink-0">
                            {acc.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {acc.name}
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {acc.email}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAccountHint(acc.email)}
                          aria-label={`Remove ${acc.email}`}
                          className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor={`google-hint-${scope}`}
                  className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Enter Google account email to pick up
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      id={`google-hint-${scope}`}
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customEmail.trim()) {
                            launchFirebaseGoogleAuth({
                              loginHint: customEmail,
                              promptMode: 'select_account',
                            });
                          }
                        }
                      }}
                      placeholder="yourname@gmail.com"
                      className="w-full rounded-lg border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading || !customEmail.trim()}
                    onClick={() =>
                      launchFirebaseGoogleAuth({
                        loginHint: customEmail,
                        promptMode: 'select_account',
                      })
                    }
                    className="rounded-lg bg-[#2481CC] dark:bg-[#4EA4F6] px-3 py-1.5 text-xs font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-50 whitespace-nowrap transition-colors"
                  >
                    Use Account
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => launchFirebaseGoogleAuth({ promptMode: 'select_account' })}
                className="w-full rounded-lg border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2B3848] disabled:opacity-60 transition-colors"
              >
                Use another Google account (Show full chooser)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
