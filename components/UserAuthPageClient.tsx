'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Phone,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { EmailVerificationScreen } from './EmailVerificationScreen';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PhoneAuthForm } from './PhoneAuthForm';
import { QuickThemeButton } from './ThemeProvider';
import { UserRole } from '@/lib/campus-transit';
import {
  clearPendingSignupProfile,
  readPendingSignupProfile,
  savePendingSignupProfile,
} from '@/lib/pending-signup';
import {
  auth,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  mapFirebaseEmailError,
  sendFirebasePasswordResetEmailSafe,
  sendFirebaseVerificationEmailSafe,
  signInWithEmailAndPassword,
  signOut,
  syncFirebaseProfileToFirestore,
  updateProfile,
  validateFirebasePassword,
  verifyPasswordResetCode,
} from '@/lib/firebase';

interface UserAuthPageClientProps {
  mode: 'login' | 'signup' | 'forgot';
  nextPath?: string;
  initialEmail?: string;
  initialResetToken?: string;
  initialResetEmail?: string;
  initialOobCode?: string;
}

export function UserAuthPageClient({
  mode,
  nextPath,
  initialEmail = '',
  initialResetToken = '',
  initialResetEmail = '',
  initialOobCode = '',
}: UserAuthPageClientProps) {
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState(initialResetEmail || initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'DRIVER'>(
    nextPath?.startsWith('/driver') ? 'DRIVER' : 'STUDENT'
  );
  const [matricNo, setMatricNo] = useState('');
  const [department, setDepartment] = useState('');
  const [licenseNo, setLicenseNo] = useState('');

  // Forgot password state
  const [resetToken] = useState(initialResetToken);
  const [oobCode] = useState(initialOobCode);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'sent' | 'reset' | 'done'>(
    initialOobCode || (initialResetToken && initialResetEmail) ? 'reset' : 'request'
  );

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'forgot' || !oobCode) return;
    let active = true;
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        if (!active) return;
        if (verifiedEmail) setEmail(verifiedEmail);
        setForgotStep('reset');
      })
      .catch((err) => {
        if (!active) return;
        setError(mapFirebaseEmailError(err));
        setForgotStep('request');
      });
    return () => {
      active = false;
    };
  }, [mode, oobCode]);

  function destinationForRole(r: UserRole) {
    if (nextPath && nextPath.startsWith('/')) {
      if (r === 'DRIVER' && nextPath.startsWith('/driver')) return nextPath;
      if (r === 'STUDENT' && nextPath.startsWith('/student')) return nextPath;
    }
    return r === 'DRIVER' ? '/driver' : '/student';
  }

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
        nextPath,
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

    const target =
      typeof data.nextUrl === 'string'
        ? data.nextUrl
        : destinationForRole(data.user.role);
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
    const targetEmail = verificationScreen?.email || email.trim().toLowerCase();
    setPendingPassword('');
    setVerificationScreen(null);
    setResendMessage(null);
    setResendError(null);
    setError(null);
    setStatusMessage(null);
    setPassword('');

    if (mode === 'signup') {
      const qs = new URLSearchParams();
      if (nextPath) qs.set('next', nextPath);
      if (targetEmail) qs.set('email', targetEmail);
      const query = qs.toString();
      window.location.assign(query ? `/login?${query}` : '/login');
    }
  }

  async function handleLoginOrSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
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

      // Login mode: authenticate with Firebase Auth and block if email is not verified
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

        window.location.assign(destinationForRole(data.user.role));
      }
    } catch (err) {
      setError(
        err instanceof Error && !('code' in err) ? err.message : mapFirebaseEmailError(err)
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid registered email address.');
      }
      await sendFirebasePasswordResetEmailSafe(cleanEmail);
      setStatusMessage(
        `If an account exists for ${cleanEmail}, Firebase Authentication has sent a password reset link. Check your inbox and spam folder.`
      );
      setForgotStep('sent');
    } catch (err) {
      setError(mapFirebaseEmailError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const pwError = validateFirebasePassword(newPassword);
      if (pwError) {
        throw new Error(pwError);
      }

      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, newPassword);
        setStatusMessage(
          'Password updated successfully via Firebase Authentication. You can now sign in with your new password.'
        );
        setForgotStep('done');
        return;
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setStatusMessage(data.message);
      setForgotStep('done');
    } catch (err) {
      setError(mapFirebaseEmailError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] dark:bg-[#0E1621] flex flex-col justify-between p-4 sm:p-6 transition-colors duration-200">
      <header className="mx-auto w-full max-w-5xl flex items-center justify-between gap-4 py-2">
        <Link href="/" prefetch={false}>
          <BrandLogo variant="auto" size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <QuickThemeButton syncServer={false} variant="surface" />
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md my-8">
        <div className="glass-surface rounded-2xl p-6 sm:p-8">
          {verificationScreen ? (
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
          ) : (
            <>
              {mode !== 'forgot' && (
                <div className="flex rounded-xl bg-slate-100 dark:bg-[#0E1621] border border-slate-200 dark:border-[#2B3848] p-1 mb-5">
                  <Link
                    href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
                    prefetch={false}
                    className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
                      mode === 'login'
                        ? 'bg-white dark:bg-[#17212B] text-slate-900 dark:text-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Sign In
                  </Link>
                  <Link
                    href={nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : '/signup'}
                    prefetch={false}
                    className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
                      mode === 'signup'
                        ? 'bg-white dark:bg-[#17212B] text-slate-900 dark:text-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    Create Account
                  </Link>
                </div>
              )}

              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {mode === 'login'
                  ? 'Campus Account Sign In'
                  : mode === 'signup'
                  ? 'Register for AFUSTA Ride'
                  : 'Reset Your Password'}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {mode === 'login'
                  ? 'Continue with Google or sign in using your verified email and password.'
                  : mode === 'signup'
                  ? 'Select Student or Driver role and register via Google or email.'
                  : forgotStep === 'reset'
                  ? 'Create a new strong password for your AFUSTA Ride account.'
                  : 'Enter your registered email address to receive a Firebase password reset link.'}
              </p>

              {mode !== 'forgot' && (
                <>
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
                      nextPath={nextPath}
                      label={`Continue with Google as ${role === 'DRIVER' ? 'Driver' : 'Student'}`}
                      onError={(msg) => setError(msg)}
                    />
                    <p className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
                      Redirects automatically to your Student or Driver dashboard after login.
                    </p>
                  </div>

                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-[#2B3848]" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      or continue with
                    </span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-[#2B3848]" />
                  </div>

                  <div
                    className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-[#0E1621] border border-slate-200 dark:border-[#2B3848] p-1"
                    role="group"
                    aria-label="Sign-in method"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('email');
                        setError(null);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-colors ${
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
                      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-colors ${
                        authMethod === 'phone'
                          ? 'bg-white dark:bg-[#17212B] text-slate-900 dark:text-slate-100 shadow-[0_1px_4px_rgba(0,0,0,0.08)]'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Phone (SMS)</span>
                    </button>
                  </div>
                </>
              )}

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300"
                >
                  <p>{error}</p>
                </div>
              )}

              {statusMessage && (
                <div
                  role="status"
                  className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-200 flex items-start gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {mode !== 'forgot' && authMethod === 'phone' ? (
                <div className="mt-4">
                  <PhoneAuthForm
                    mode={mode}
                    role={role}
                    nextPath={nextPath}
                    onError={(msg) => setError(msg)}
                  />
                </div>
              ) : mode !== 'forgot' ? (
                <form onSubmit={handleLoginOrSignup} className="mt-4 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="page-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Full Name <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="page-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Fatima Abdullahi"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="page-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="page-email"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="page-phone"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Phone Number <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="page-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 803 000 0000"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
                    />
                  </div>
                  {role === 'STUDENT' ? (
                    <div>
                      <label
                        htmlFor="page-matric"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Matric Number
                      </label>
                      <input
                        id="page-matric"
                        type="text"
                        value={matricNo}
                        onChange={(e) => setMatricNo(e.target.value)}
                        placeholder="AFU/23/CSC/001"
                        className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="page-license"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Driver License No.
                      </label>
                      <input
                        id="page-license"
                        type="text"
                        value={licenseNo}
                        onChange={(e) => setLicenseNo(e.target.value)}
                        placeholder="AFU-DRV-099"
                        className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {mode === 'signup' && role === 'STUDENT' && (
                <div>
                  <label
                    htmlFor="page-dept"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Department
                  </label>
                  <input
                    id="page-dept"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="page-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  {mode === 'login' && (
                    <Link
                      href="/forgot-password"
                      prefetch={false}
                      className="text-xs font-semibold text-[#2481CC] dark:text-[#4EA4F6] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="page-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'signup'
                        ? 'At least 6 characters'
                        : 'Enter your password'
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
                {mode === 'signup' && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Use at least 6 characters. Any valid email address is welcome.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-60 transition-colors"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {mode === 'login' ? 'Sign In with Email' : 'Create Account with Email'}
                </span>
              </button>
            </form>
          ) : forgotStep === 'request' ? (
            <form onSubmit={handleForgotRequest} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="fp-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Registered Email Address
                </label>
                <input
                  id="fp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@afusta.edu.ng"
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Send Firebase Reset Link</span>
              </button>
              <div className="text-center">
                <a
                  href="/login"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:underline"
                >
                  Back to Sign In
                </a>
              </div>
            </form>
          ) : forgotStep === 'sent' ? (
            <div className="mt-5 space-y-4">
              <a
                href="/login"
                className="block w-full text-center rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#2B3848]"
              >
                Return to Sign In
              </a>
            </div>
          ) : forgotStep === 'reset' ? (
            <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="fp-newpass"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="fp-newpass"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, upper/lowercase & number"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-60"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Update Password</span>
              </button>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <a
                href="/login"
                className="block w-full text-center rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
              >
                Proceed to Sign In
              </a>
            </div>
          )}
            </>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 dark:text-slate-400 py-2">
        © 2026 AFUSTA Ride · Campus Mobility Platform
      </footer>
    </div>
  );
}
