'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Loader2, Eye, EyeOff, Mail, Phone } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { EmailVerificationScreen } from './EmailVerificationScreen';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PhoneAuthForm } from './PhoneAuthForm';
import { UserRole } from '@/lib/campus-transit';
import {
  clearPendingSignupProfile,
  readPendingSignupProfile,
  savePendingSignupProfile,
} from '@/lib/pending-signup';
import {
  auth,
  createUserWithEmailAndPassword,
  mapFirebaseEmailError,
  sendFirebaseVerificationEmailSafe,
  signInWithEmailAndPassword,
  signOut,
  syncFirebaseProfileToFirestore,
  updateProfile,
  validateFirebasePassword,
} from '@/lib/firebase';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'signup';
  onClose: () => void;
  onSuccessRedirect?: string;
  promptNotice?: string | null;
}

export function AuthModal({
  open,
  initialMode = 'login',
  onClose,
  onSuccessRedirect,
  promptNotice,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'DRIVER'>(
    onSuccessRedirect?.startsWith('/driver') ? 'DRIVER' : 'STUDENT'
  );
  const [matricNo, setMatricNo] = useState('');
  const [department, setDepartment] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingPassword, setPendingPassword] = useState('');
  const [verificationScreen, setVerificationScreen] = useState<{
    email: string;
    blockedOnLogin: boolean;
    initialNotice?: string | null;
  } | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const routeForRole = (r: UserRole) => {
    if (onSuccessRedirect && onSuccessRedirect.startsWith('/')) {
      if (r === 'DRIVER' && onSuccessRedirect.startsWith('/driver')) return onSuccessRedirect;
      if (r === 'STUDENT' && onSuccessRedirect.startsWith('/student')) return onSuccessRedirect;
    }
    return r === 'DRIVER' ? '/driver' : '/student';
  };

  async function exchangeFirebaseSession(params: {
    idToken: string;
    uid: string;
    fallbackName: string;
    fallbackEmail: string;
  }) {
    const pendingProfile = readPendingSignupProfile(params.fallbackEmail);
    const res = await fetch('/api/auth/firebase', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'user',
        role: pendingProfile?.role || role,
        nextPath: onSuccessRedirect,
        idToken: params.idToken,
        phone: pendingProfile?.phone,
        matricNo: pendingProfile?.matricNo,
        department: pendingProfile?.department,
        licenseNo: pendingProfile?.licenseNo,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.user) {
      throw new Error(data.error || 'Unable to establish your campus session.');
    }

    clearPendingSignupProfile(params.fallbackEmail);

    const resolvedRole: 'STUDENT' | 'DRIVER' =
      data.user.role === 'DRIVER' ? 'DRIVER' : 'STUDENT';

    try {
      await syncFirebaseProfileToFirestore({
        uid: params.uid,
        displayName: data.user.name || params.fallbackName || 'AFUSTA User',
        email: data.user.email || params.fallbackEmail,
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
      // Proceed to dashboard once server session cookie is established
    }

    onClose();
    const target =
      typeof data.nextUrl === 'string'
        ? data.nextUrl
        : routeForRole(data.user.role);
    window.location.assign(target);
  }

  async function handleResendVerification() {
    if (!verificationScreen || !pendingPassword) {
      setResendError('Click Login below and sign in with your password to resend the verification email.');
      return;
    }

    const targetEmail = verificationScreen.email;
    setResending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      const cred = await signInWithEmailAndPassword(auth, targetEmail, pendingPassword);
      await cred.user.reload();

      if (cred.user.emailVerified) {
        await signOut(auth).catch(() => undefined);
        setResendMessage('Your email is verified! Click Login below to sign in.');
        return;
      }

      await sendFirebaseVerificationEmailSafe(cred.user);
      await signOut(auth).catch(() => undefined);
      setResendMessage(
        `A fresh Firebase verification link has been sent to ${targetEmail}.`
      );
    } catch (err) {
      await signOut(auth).catch(() => undefined);
      setResendError(mapFirebaseEmailError(err));
    } finally {
      setResending(false);
    }
  }

  function handleGoToLoginFromVerification() {
    setPendingPassword('');
    setVerificationScreen(null);
    setResendMessage(null);
    setResendError(null);
    setError(null);
    setPassword('');
    setMode('login');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    setResendError(null);
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (mode === 'signup') {
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('Please enter a valid email address.');
        }
        const pwError = validateFirebasePassword(password);
        if (pwError) {
          throw new Error(pwError);
        }

        const displayName = name.trim() || cleanEmail.split('@')[0] || 'AFUSTA User';

        // Firebase Auth Only: create account, send verification email, then sign out immediately (no auto-login, no Firestore/DB writes)
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName }).catch(() => undefined);

        savePendingSignupProfile(cleanEmail, {
          name: displayName,
          role,
          phone: phone.trim() || undefined,
          matricNo: matricNo.trim() || undefined,
          department: department.trim() || undefined,
          licenseNo: licenseNo.trim() || undefined,
        });

        let initialNotice: string | null = null;
        try {
          await sendFirebaseVerificationEmailSafe(cred.user);
        } catch (verifyErr) {
          initialNotice = `Account created, but sending the verification email reported: ${mapFirebaseEmailError(verifyErr)}`;
        }

        await signOut(auth).catch(() => undefined);

        setPendingPassword(password);
        setPassword('');
        setVerificationScreen({
          email: cleanEmail,
          blockedOnLogin: false,
          initialNotice,
        });
        return;
      }

      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        await cred.user.reload();

        if (!cred.user.emailVerified) {
          await signOut(auth).catch(() => undefined);
          setPendingPassword(password);
          setPassword('');
          setVerificationScreen({
            email: cred.user.email || cleanEmail,
            blockedOnLogin: true,
            initialNotice: null,
          });
          return;
        }

        const idToken = await cred.user.getIdToken(true);
        await exchangeFirebaseSession({
          idToken,
          uid: cred.user.uid,
          fallbackName: cred.user.displayName || cleanEmail.split('@')[0],
          fallbackEmail: cred.user.email || cleanEmail,
        });
        return;
      } catch (firebaseErr) {
        const code =
          firebaseErr && typeof firebaseErr === 'object' && 'code' in firebaseErr
            ? String((firebaseErr as { code?: string }).code || '')
            : '';

        const shouldFallbackToLocal =
          code === 'auth/user-not-found' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/operation-not-allowed';

        if (!shouldFallbackToLocal) {
          throw new Error(mapFirebaseEmailError(firebaseErr));
        }

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.code === 'EMAIL_NOT_VERIFIED') {
            setPendingPassword('');
            setPassword('');
            setVerificationScreen({
              email: data.email || cleanEmail,
              blockedOnLogin: true,
              initialNotice: null,
            });
            return;
          }
          throw new Error(data.error || 'Invalid email or password.');
        }

        onClose();
        window.location.assign(routeForRole(data.user.role));
      }
    } catch (err) {
      setError(
        err instanceof Error && !('code' in err) ? err.message : mapFirebaseEmailError(err)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white/95 dark:bg-[#17212B]/95 backdrop-blur-xl border border-slate-200 dark:border-[#2B3848] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)] my-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
          <BrandLogo variant="auto" size="sm" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#232E3C] hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {verificationScreen ? (
          <div className="mt-4">
            <EmailVerificationScreen
              email={verificationScreen.email}
              blockedOnLogin={verificationScreen.blockedOnLogin}
              initialNotice={verificationScreen.initialNotice}
              resending={resending}
              resendMessage={resendMessage}
              resendError={resendError}
              canResend={Boolean(pendingPassword)}
              onResend={handleResendVerification}
              onGoToLogin={handleGoToLoginFromVerification}
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex rounded-xl bg-slate-100 dark:bg-[#0E1621] border border-slate-200 dark:border-[#2B3848] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  mode === 'login'
                    ? 'bg-white dark:bg-[#17212B] text-slate-900 dark:text-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-[#17212B] text-slate-900 dark:text-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Sign Up
              </button>
            </div>

            <h2
              id="auth-modal-title"
              className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              {mode === 'login' ? 'Sign in to AFUSTA Ride' : 'Create your campus account'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {promptNotice ||
                (mode === 'login'
                  ? 'Continue with Google or sign in with your verified AFUSTA email.'
                  : 'Choose Student or Driver role and continue with Google or email.')}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Portal role selection">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  role === 'STUDENT'
                    ? 'border-[#2481CC] dark:border-[#4EA4F6] bg-sky-50 dark:bg-[#2481CC]/20 text-[#1D6FB8] dark:text-[#4EA4F6]'
                    : 'border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#2B3848]'
                }`}
              >
                Student Rider
              </button>
              <button
                type="button"
                onClick={() => setRole('DRIVER')}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  role === 'DRIVER'
                    ? 'border-[#2481CC] dark:border-[#4EA4F6] bg-sky-50 dark:bg-[#2481CC]/20 text-[#1D6FB8] dark:text-[#4EA4F6]'
                    : 'border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#2B3848]'
                }`}
              >
                Tricycle Driver
              </button>
            </div>

            <div className="mt-4">
              <GoogleSignInButton
                scope="user"
                role={role}
                nextPath={onSuccessRedirect}
                label={`Continue with Google as ${role === 'DRIVER' ? 'Driver' : 'Student'}`}
                onError={(msg) => setError(msg)}
                onSuccess={(target) => {
                  onClose();
                  window.location.assign(target);
                }}
              />
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-[#2B3848]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                or continue with
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-[#2B3848]" />
            </div>

            <div
              className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-[#0E1621] border border-slate-200 dark:border-[#2B3848] p-1"
              role="group"
              aria-label="Sign-in method"
            >
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setError(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  authMethod === 'email'
                    ? 'bg-white dark:bg-[#17212B] text-slate-900 dark:text-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone');
                  setError(null);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  authMethod === 'phone'
                    ? 'bg-white dark:bg-[#17212B] text-slate-900 dark:text-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Phone (SMS)</span>
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300"
              >
                <p>{error}</p>
              </div>
            )}

            {authMethod === 'phone' ? (
              <PhoneAuthForm
                mode={mode}
                role={role}
                nextPath={onSuccessRedirect}
                compact
                onError={(msg) => setError(msg)}
                onSuccess={(target) => {
                  onClose();
                  window.location.assign(target);
                }}
              />
            ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="modal-signup-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Full Name <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="modal-signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fatima Abdullahi"
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="modal-auth-email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Email Address
            </label>
            <input
              id="modal-auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com or name@afusta.edu.ng"
              className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
            />
          </div>

          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="modal-signup-phone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Phone Number <span className="font-normal text-slate-400">(opt.)</span>
                </label>
                <input
                  id="modal-signup-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 803..."
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
              {role === 'STUDENT' ? (
                <div>
                  <label
                    htmlFor="modal-signup-matric"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Matric Number
                  </label>
                  <input
                    id="modal-signup-matric"
                    type="text"
                    value={matricNo}
                    onChange={(e) => setMatricNo(e.target.value)}
                    placeholder="AFU/23/CSC/001"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="modal-signup-license"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Driver License No.
                  </label>
                  <input
                    id="modal-signup-license"
                    type="text"
                    value={licenseNo}
                    onChange={(e) => setLicenseNo(e.target.value)}
                    placeholder="AFU-DRV-099"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {mode === 'signup' && role === 'STUDENT' && (
            <div>
              <label
                htmlFor="modal-signup-dept"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Department
              </label>
              <input
                id="modal-signup-dept"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Computer Science"
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="modal-auth-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              {mode === 'login' && (
                <Link
                  href="/forgot-password"
                  prefetch={false}
                  onClick={onClose}
                  className="text-xs font-semibold text-[#2481CC] dark:text-[#4EA4F6] hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <input
                id="modal-auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'signup'
                    ? 'At least 6 characters'
                    : 'Enter password'
                }
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{mode === 'login' ? 'Sign In with Email' : 'Create Account with Email'}</span>
          </button>
        </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
