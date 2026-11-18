'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { UserRole } from '@/lib/campus-transit';
import { normalizePhoneToE164, validateOtpCode } from '@/lib/phone';
import {
  auth,
  ConfirmationResult,
  mapFirebaseEmailError,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  syncFirebaseProfileToFirestore,
  updateProfile,
} from '@/lib/firebase';

interface PhoneAuthFormProps {
  mode: 'login' | 'signup';
  role: 'STUDENT' | 'DRIVER';
  nextPath?: string;
  compact?: boolean;
  onError?: (message: string | null) => void;
  onSuccess?: (targetUrl: string) => void;
}

export function PhoneAuthForm({
  mode,
  role,
  nextPath,
  compact = false,
  onError,
  onSuccess,
}: PhoneAuthFormProps) {
  const [name, setName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [sentPhone, setSentPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  const recaptchaId = useId();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    return () => {
      try {
        recaptchaVerifierRef.current?.clear();
      } catch {
        // Ignore cleanup errors
      }
      recaptchaVerifierRef.current = null;
    };
  }, []);

  function clearRecaptcha() {
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {
      // Ignore cleanup errors
    }
    recaptchaVerifierRef.current = null;
  }

  function destinationForRole(r: UserRole) {
    if (nextPath && nextPath.startsWith('/')) {
      if (r === 'DRIVER' && nextPath.startsWith('/driver')) return nextPath;
      if (r === 'STUDENT' && nextPath.startsWith('/student')) return nextPath;
    }
    return r === 'DRIVER' ? '/driver' : '/student';
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    onError?.(null);

    const normalized = normalizePhoneToE164(phoneInput);
    if (!normalized) {
      onError?.(
        'Enter a valid phone number (for example +234 803 000 0000 or 0803 000 0000).'
      );
      return;
    }

    if (!recaptchaContainerRef.current) {
      onError?.('Phone verification widget is not ready yet. Please try again.');
      return;
    }

    setLoading(true);
    try {
      clearRecaptcha();
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible',
      });
      recaptchaVerifierRef.current = verifier;

      const confirmation = await signInWithPhoneNumber(auth, normalized, verifier);
      confirmationRef.current = confirmation;
      setSentPhone(normalized);
      setOtp('');
      setStep('otp');
    } catch (err) {
      clearRecaptcha();
      onError?.(mapFirebaseEmailError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    onError?.(null);

    const otpError = validateOtpCode(otp);
    if (otpError) {
      onError?.(otpError);
      return;
    }

    if (!confirmationRef.current) {
      onError?.('Your verification session expired. Please request a new SMS code.');
      setStep('phone');
      return;
    }

    setLoading(true);
    try {
      const digits = otp.replace(/\s+/g, '');
      const cred = await confirmationRef.current.confirm(digits);
      const cleanName = name.trim();
      if (cleanName && !cred.user.displayName) {
        await updateProfile(cred.user, { displayName: cleanName }).catch(() => undefined);
      }

      const idToken = await cred.user.getIdToken(true);
      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'user',
          role,
          nextPath,
          idToken,
          name: cleanName || cred.user.displayName || undefined,
          phone: cred.user.phoneNumber || sentPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.user) {
        await signOut(auth).catch(() => undefined);
        throw new Error(data.error || 'Unable to establish your phone sign-in session.');
      }

      const resolvedRole: 'STUDENT' | 'DRIVER' =
        data.user.role === 'DRIVER' ? 'DRIVER' : 'STUDENT';

      try {
        await syncFirebaseProfileToFirestore({
          uid: cred.user.uid,
          displayName: data.user.name || cleanName || sentPhone || 'AFUSTA User',
          email: data.user.email || cred.user.email || '',
          role: resolvedRole,
          phone: data.user.phone || cred.user.phoneNumber || sentPhone,
          matricNo: data.user.matricNo,
          department: data.user.department,
          licenseNo: data.user.licenseNo,
          plateNumber: data.user.plateNumber,
          available: Boolean(data.user.available),
          walletBalance: typeof data.user.walletBalance === 'number' ? data.user.walletBalance : 0,
        });
      } catch {
        // Proceed with verified server session cookie
      }

      const target =
        typeof data.nextUrl === 'string'
          ? data.nextUrl
          : destinationForRole(data.user.role);

      if (onSuccess) {
        onSuccess(target);
      } else {
        window.location.assign(target);
      }
    } catch (err) {
      onError?.(mapFirebaseEmailError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <div id={`recaptcha-${recaptchaId}`} ref={recaptchaContainerRef} />

      {step === 'phone' ? (
        <form onSubmit={handleSendCode} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label
                htmlFor={`phone-name-${recaptchaId}`}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Full Name <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id={`phone-name-${recaptchaId}`}
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
              htmlFor={`phone-number-${recaptchaId}`}
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Phone Number
            </label>
            <div className="relative">
              <Phone className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id={`phone-number-${recaptchaId}`}
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+234 803 000 0000"
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Works with any mobile number (e.g. 0803... or +234...). Firebase sends a one-time SMS code.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 ${
              compact ? 'py-2.5' : 'py-3'
            } text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-60 transition-colors`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? 'Sending SMS code...' : 'Send SMS Verification Code'}</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3.5">
          <div className="rounded-xl border border-sky-200 dark:border-[#2481CC]/40 bg-sky-50 dark:bg-[#2481CC]/15 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0 mt-0.5" />
            <span>
              Enter the 6-digit SMS verification code sent to{' '}
              <strong className="font-semibold">{sentPhone}</strong>.
            </span>
          </div>

          <div>
            <label
              htmlFor={`phone-otp-${recaptchaId}`}
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              6-Digit SMS Code
            </label>
            <input
              id={`phone-otp-${recaptchaId}`}
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-center tracking-[0.35em] font-mono text-base font-semibold text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 ${
              compact ? 'py-2.5' : 'py-3'
            } text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-60 transition-colors`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? 'Verifying code...' : 'Verify & Continue'}</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              onError?.(null);
              clearRecaptcha();
              setOtp('');
              setStep('phone');
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#2B3848] disabled:opacity-60 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Change phone number or resend code</span>
          </button>
        </form>
      )}
    </div>
  );
}
