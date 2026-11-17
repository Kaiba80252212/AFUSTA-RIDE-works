'use client';

import { useState } from 'react';
import { Lock, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

export function AdminLoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeCount, setShakeCount] = useState(0);

  function triggerInvalid(message: string) {
    setError(message);
    setShakeCount((prev) => prev + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      triggerInvalid('Administrator email and password are required.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        triggerInvalid(data.error || 'Invalid administrator email or password.');
        return;
      }
      window.location.assign('/directorate-portal');
    } catch (err) {
      triggerInvalid(err instanceof Error ? err.message : 'Unable to authenticate administrator.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA] dark:bg-[#0E1621] flex flex-col items-center justify-center p-4 text-slate-900 dark:text-slate-100">
      <motion.div
        key={shakeCount}
        initial={shakeCount > 0 ? { x: 0 } : false}
        animate={shakeCount > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.42, ease: 'easeInOut' }}
        className={`w-full max-w-md rounded-2xl bg-white/95 dark:bg-[#17212B]/95 backdrop-blur-xl border p-8 shadow-[0_20px_50px_rgba(15,23,42,0.14)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-colors ${
          error
            ? 'border-red-400 dark:border-red-500/70'
            : 'border-slate-200 dark:border-[#2B3848]'
        }`}
      >
        <div className="flex justify-center pb-6 border-b border-slate-200 dark:border-[#2B3848]">
          <BrandLogo variant="auto" size="md" />
        </div>

        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Admin Email Address
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={Boolean(error)}
              placeholder="admin@afusta.edu.ng"
              className={`w-full rounded-xl border bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none transition-colors ${
                error
                  ? 'border-red-400 dark:border-red-500/80 focus:border-red-500'
                  : 'border-slate-300 dark:border-[#2B3848] focus:border-[#2481CC] dark:focus:border-[#4EA4F6]'
              }`}
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Admin Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={Boolean(error)}
                placeholder="Enter administrator password"
                className={`w-full rounded-xl border bg-white dark:bg-[#232E3C] pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none transition-colors ${
                  error
                    ? 'border-red-400 dark:border-red-500/80 focus:border-red-500'
                    : 'border-slate-300 dark:border-[#2B3848] focus:border-[#2481CC] dark:focus:border-[#4EA4F6]'
                }`}
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
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] dark:hover:bg-[#38BDF8] disabled:opacity-60 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            <span>{loading ? 'Signing In...' : 'Login'}</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
