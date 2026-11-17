'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  MapPin,
  History,
  Wallet,
  User,
  Settings,
  Star,
  CarFront,
  ArrowRight,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import { DashboardShell, DashboardNavItem } from './DashboardShell';
import { CampusRouteMap } from './CampusRouteMap';
import { AvatarUploader } from './AvatarUploader';
import { StudentDashboardSkeleton } from './DashboardSkeletons';
import { ThemeToggle, useTheme } from './ThemeProvider';
import { MEDIA_ASSETS } from '@/lib/media';
import {
  CAMPUS_STOPS,
  PaymentMethod,
  RideType,
  RIDE_TYPE_CONFIG,
  calculateEtaMinutes,
  calculateFare,
  formatNaira,
} from '@/lib/campus-transit';
import type { RideRecord, WalletTransaction } from '@/lib/server-store';
import type { SafeUser } from '@/lib/server-auth';

interface StudentDashboardClientProps {
  initialFrom?: string;
  initialTo?: string;
  initialType?: RideType;
  initialTab?: string;
}

export function StudentDashboardClient({
  initialFrom = 'main-gate',
  initialTo = 'library',
  initialType = 'normal',
  initialTab = 'dashboard',
}: StudentDashboardClientProps) {
  const { hydrateFromServer } = useTheme();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [student, setStudent] = useState<SafeUser | null>(null);
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Booking form state
  const [fromStopId, setFromStopId] = useState(initialFrom);
  const [toStopId, setToStopId] = useState(initialTo);
  const [rideType, setRideType] = useState<RideType>(initialType);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');

  // Filter state
  const [rideFilter, setRideFilter] = useState<'All' | 'Active' | 'Completed' | 'Cancelled'>('All');

  // Top-up state
  const [topUpAmount, setTopUpAmount] = useState('1000');

  // Profile form state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileDept, setProfileDept] = useState('');
  const [profileMatric, setProfileMatric] = useState('');

  const loadState = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/state?scope=STUDENT', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        window.location.replace('/login?next=/student');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load student data');
      const stu = data.user as SafeUser;
      setStudent(stu);
      setProfileName(stu.name);
      setProfilePhone(stu.phone);
      setProfileDept(stu.department || '');
      setProfileMatric(stu.matricNo || '');
      setRides(data.rides as RideRecord[]);
      setTransactions(data.transactions as WalletTransaction[]);
      if (stu.themePreference) {
        hydrateFromServer(stu.themePreference);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load Student Dashboard');
    } finally {
      setLoading(false);
    }
  }, [hydrateFromServer]);

  useEffect(() => {
    let active = true;
    fetch('/api/state?scope=STUDENT', { cache: 'no-store' })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          window.location.replace('/login?next=/student');
          return null;
        }
        return res.json().then((data) => ({ ok: res.ok, data }));
      })
      .then((result) => {
        if (!active || !result) return;
        const { ok, data } = result;
        if (!ok) throw new Error(data.error || 'Failed to load student data');
        const stu = data.user as SafeUser;
        setStudent(stu);
        setProfileName(stu.name);
        setProfilePhone(stu.phone);
        setProfileDept(stu.department || '');
        setProfileMatric(stu.matricNo || '');
        setRides(data.rides as RideRecord[]);
        setTransactions(data.transactions as WalletTransaction[]);
        if (stu.themePreference) {
          hydrateFromServer(stu.themePreference);
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hydrateFromServer]);

  const navItems: DashboardNavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'book', label: 'Book Ride', icon: <MapPin className="h-4 w-4" /> },
    { id: 'rides', label: 'My Rides', icon: <History className="h-4 w-4" /> },
    { id: 'wallet', label: 'Wallet', icon: <Wallet className="h-4 w-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  const sameStops = fromStopId === toStopId;
  const computedFare = sameStops ? 0 : calculateFare(fromStopId, toStopId, rideType);
  const computedEta = sameStops ? 0 : calculateEtaMinutes(fromStopId, toStopId);

  async function handleBookRide(e: React.FormEvent) {
    e.preventDefault();
    if (!student || sameStops) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromStopId,
          toStopId,
          rideType,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setFeedback({
        type: 'success',
        text: `Ride ${data.ride.bookingRef} booked (${data.ride.fromName} to ${data.ride.toName}) · Driver ${data.ride.driverName} notified.`,
      });
      await loadState();
      setActiveTab('dashboard');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to complete booking',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRide(rideId: string) {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not cancel ride');
      setFeedback({ type: 'success', text: `Ride ${data.ride.bookingRef} cancelled.` });
      await loadState();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Cancellation failed',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRateRide(rideId: string, rating: number) {
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        await loadState();
      }
    } catch {
      // ignore
    }
  }

  async function handleTopUp(amount: number) {
    if (!student) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          channel: 'AFUSTA Campus Pay',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Top-up failed');
      setFeedback({
        type: 'success',
        text: `Added ${formatNaira(amount)} to your campus wallet.`,
      });
      await loadState();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Top-up error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          department: profileDept,
          matricNo: profileMatric,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setFeedback({ type: 'success', text: 'Profile information saved.' });
      await loadState();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save profile',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const activeRide = rides.find((r) => ['Pending', 'Accepted', 'On Trip'].includes(r.status));
  const recentRide = activeRide ?? rides[0] ?? null;

  const filteredRides = rides.filter((r) => {
    if (rideFilter === 'All') return true;
    if (rideFilter === 'Active') return ['Pending', 'Accepted', 'On Trip'].includes(r.status);
    if (rideFilter === 'Completed') return r.status === 'Completed';
    return r.status === 'Cancelled' || r.status === 'Declined';
  });

  if (loading) {
    return <StudentDashboardSkeleton />;
  }

  if (loadError || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FA] dark:bg-[#0E1621] p-4">
        <div className="glass-surface rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <XCircle className="h-10 w-10 text-red-500 mx-auto" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Unable to Load Student Portal
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {loadError || 'Your session could not be verified.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadState();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  const firstName = student.name.split(' ')[0];

  return (
    <DashboardShell
      portalTitle="Student Dashboard"
      portalSubtitle={`Welcome back, ${firstName}!`}
      userName={student.name}
      userRoleLabel={`Student · ${student.matricNo || 'AFUSTA'}`}
      avatarSrc={student.avatarUrl || MEDIA_ASSETS.avatarStudent}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerAction={
        <button
          type="button"
          onClick={() => setActiveTab('book')}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] dark:hover:bg-[#38BDF8] transition-colors shadow-[0_4px_12px_rgba(36,129,204,0.25)] whitespace-nowrap"
        >
          <CarFront className="h-4 w-4" />
          <span>Quick Book</span>
        </button>
      }
    >
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
              : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* 3 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-surface rounded-2xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-sky-50 dark:bg-[#2481CC]/20 border border-sky-200 dark:border-[#2481CC]/40 flex items-center justify-center shrink-0">
                <Wallet className="h-6 w-6 text-[#2481CC] dark:text-[#4EA4F6]" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Wallet Balance</p>
                <p
                  data-testid="student-wallet-balance"
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5"
                >
                  {formatNaira(student.walletBalance ?? 0)}
                </p>
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                <CarFront className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Rides</p>
                <p
                  data-testid="student-total-rides"
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5"
                >
                  {student.totalRides ?? rides.length}
                </p>
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0">
                <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Rating</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {student.rating.toFixed(1)} ★
                </p>
              </div>
            </div>
          </div>

          {/* Recent Ride Card */}
          <div className="glass-surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {activeRide ? 'Active Campus Ride' : 'Recent Ride'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('rides')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-[#2481CC] dark:text-[#4EA4F6] hover:underline"
              >
                <span>View All</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {recentRide ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50/70 dark:bg-[#1E2936] p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-24 overflow-hidden rounded-xl border border-slate-200 dark:border-[#2B3848] shrink-0 bg-slate-100 dark:bg-[#232E3C]">
                      <Image
                        src={MEDIA_ASSETS.tricycleCard}
                        alt="AFUSTA Tricycle"
                        fill
                        sizes="96px"
                        referrerPolicy="no-referrer"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        From: {recentRide.fromName}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        To: {recentRide.toName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {recentRide.displayTime} · {recentRide.driverName} ({recentRide.plateNumber})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        recentRide.status === 'Completed'
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                          : recentRide.status === 'Pending'
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50'
                          : recentRide.status === 'Cancelled' || recentRide.status === 'Declined'
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/50'
                          : 'bg-[#2481CC] text-white'
                      }`}
                    >
                      {recentRide.status}
                    </span>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatNaira(recentRide.fare)}
                    </p>
                  </div>
                </div>

                {activeRide && (
                  <div className="space-y-3">
                    <CampusRouteMap
                      fromStopId={activeRide.fromStopId}
                      toStopId={activeRide.toStopId}
                      statusLabel={activeRide.status}
                      heightClass="h-52"
                    />
                    {activeRide.status === 'Pending' && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleCancelRide(activeRide.id)}
                          className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                        >
                          Cancel Request
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">No rides booked yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('book')}
                  className="mt-3 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
                >
                  Book Your First Ride
                </button>
              </div>
            )}
          </div>

          {/* Campus Wide Quick Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-[#2B3848] bg-[#101C26] dark:bg-[#17212B] text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#64B5F6]">AFUSTA Campus Mobility</p>
              <h3 className="mt-1 text-xl font-bold">Ride Smart, Campus Wide!</h3>
              <p className="mt-1 text-sm text-slate-300 max-w-xl">
                Connect between Main Gate, Senate Building, Central Library, Academic Faculties, and Hostels in under 8 minutes.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('wallet')}
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                Top Up Wallet
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className="rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors whitespace-nowrap"
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'book' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleBookRide}
            className="lg:col-span-5 glass-surface rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Book a Campus Tricycle
            </h2>

            <div>
              <label
                htmlFor="stu-from"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Pickup Location (From)
              </label>
              <select
                id="stu-from"
                value={fromStopId}
                onChange={(e) => setFromStopId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
              >
                {CAMPUS_STOPS.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="stu-to"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Drop-off Destination (To)
              </label>
              <select
                id="stu-to"
                value={toStopId}
                onChange={(e) => setToStopId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
              >
                {CAMPUS_STOPS.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="stu-type"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Ride Type
              </label>
              <select
                id="stu-type"
                value={rideType}
                onChange={(e) => setRideType(e.target.value as RideType)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
              >
                {Object.entries(RIDE_TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label} ({cfg.seats})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Payment Method
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    paymentMethod === 'wallet'
                      ? 'border-[#2481CC] dark:border-[#4EA4F6] bg-sky-50 dark:bg-[#2481CC]/20 text-[#1D6FB8] dark:text-[#4EA4F6]'
                      : 'border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#2B3848]'
                  }`}
                >
                  Wallet ({formatNaira(student.walletBalance ?? 0)})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    paymentMethod === 'cash'
                      ? 'border-[#2481CC] dark:border-[#4EA4F6] bg-sky-50 dark:bg-[#2481CC]/20 text-[#1D6FB8] dark:text-[#4EA4F6]'
                      : 'border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#2B3848]'
                  }`}
                >
                  Cash on Arrival
                </button>
              </div>
            </div>

            {sameStops ? (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                Please choose a different destination from your pickup point.
              </p>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Fare & Time</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatNaira(computedFare)} · ~{computedEta} min
                  </p>
                </div>
                <Navigation className="h-5 w-5 text-[#2481CC] dark:text-[#4EA4F6]" />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || sameStops}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-3 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] disabled:opacity-50 transition-colors"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Confirm & Dispatch Tricycle</span>
            </button>
          </form>

          <div className="lg:col-span-7 glass-surface rounded-2xl p-6 flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Campus Route Preview
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Live AFUSTA road network routing between verified campus pickup points.
              </p>
            </div>
            <CampusRouteMap
              fromStopId={fromStopId}
              toStopId={toStopId}
              statusLabel={sameStops ? 'Select Stops' : `~${computedEta} min`}
              heightClass="h-80"
            />
          </div>
        </div>
      )}

      {activeTab === 'rides' && (
        <div className="glass-surface rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              My Ride History
            </h2>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0E1621] border border-slate-200 dark:border-[#2B3848]">
              {(['All', 'Active', 'Completed', 'Cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRideFilter(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    rideFilter === tab
                      ? 'bg-[#2481CC] dark:bg-[#4EA4F6] text-white dark:text-[#0E1621] shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {filteredRides.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No rides match this filter.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2B3848] text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 pr-4">Ref</th>
                    <th className="py-3 pr-4">Route</th>
                    <th className="py-3 pr-4">Driver / Plate</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4 text-right">Fare</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2B3848] text-sm">
                  {filteredRides.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#1E2936]/70 transition-colors"
                    >
                      <td className="py-3.5 pr-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {r.bookingRef}
                      </td>
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {r.fromName} → {r.toName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {r.displayTime}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4 text-slate-700 dark:text-slate-300">
                        <p className="font-medium">{r.driverName}</p>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {r.plateNumber}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`inline-flex rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                            r.status === 'Completed'
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                              : r.status === 'Pending'
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
                              : r.status === 'Cancelled' || r.status === 'Declined'
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                              : 'bg-[#2481CC] text-white'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatNaira(r.fare)}
                      </td>
                      <td className="py-3.5 text-right">
                        {r.status === 'Pending' ? (
                          <button
                            type="button"
                            onClick={() => handleCancelRide(r.id)}
                            className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                          >
                            Cancel
                          </button>
                        ) : r.status === 'Completed' ? (
                          <div className="inline-flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((starVal) => (
                              <button
                                key={starVal}
                                type="button"
                                aria-label={`Rate ${starVal} stars`}
                                onClick={() => handleRateRide(r.id, starVal)}
                                className="p-0.5"
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${
                                    (r.studentRating ?? 0) >= starVal
                                      ? 'text-amber-500 fill-amber-500'
                                      : 'text-slate-300 dark:text-slate-600'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 glass-surface rounded-2xl p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Available Balance
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatNaira(student.walletBalance ?? 0)}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Quick Top-Up
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 2500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleTopUp(amt)}
                    className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#232E3C] px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 hover:border-[#2481CC] dark:hover:border-[#4EA4F6] hover:bg-sky-50 dark:hover:bg-[#2481CC]/20 transition-colors tabular-nums"
                  >
                    +{formatNaira(amt)}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTopUp(Number(topUpAmount));
              }}
              className="space-y-3 pt-3 border-t border-slate-200 dark:border-[#2B3848]"
            >
              <label
                htmlFor="custom-topup"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Custom Deposit (₦100 – ₦50,000)
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-topup"
                  type="number"
                  min={100}
                  max={50000}
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Fund</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-7 glass-surface rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-[#2B3848]">
              Wallet Ledger
            </h2>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-[#2B3848]">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {tx.description}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {tx.type} · {tx.reference}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      tx.amount >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {tx.amount >= 0
                      ? `+${formatNaira(tx.amount)}`
                      : `-${formatNaira(Math.abs(tx.amount))}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-2xl">
          <div className="glass-surface rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Student Profile & Avatar
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Upload a custom photo or manage your student identity across AFUSTA Ride.
              </p>
            </div>
            <AvatarUploader user={student} onUserUpdated={(updated) => setStudent(updated)} />
          </div>

          <form onSubmit={handleSaveProfile} className="glass-surface rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Academic & Contact Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="prof-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="prof-phone"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Phone Number
                </label>
                <input
                  id="prof-phone"
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="prof-matric"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Matriculation Number
                </label>
                <input
                  id="prof-matric"
                  type="text"
                  value={profileMatric}
                  onChange={(e) => setProfileMatric(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="prof-dept"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Department
                </label>
                <input
                  id="prof-dept"
                  type="text"
                  value={profileDept}
                  onChange={(e) => setProfileDept(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-5 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
            >
              Save Changes
            </button>
          </form>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          <div className="glass-surface rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Appearance &amp; Theme
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Telegram-inspired Light or Dark mode synchronized automatically to your account.
                </p>
              </div>
              <ThemeToggle scope="user" />
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Account Contact Sync
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="set-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Display Name
                  </label>
                  <input
                    id="set-name"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="set-phone"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    SMS Alert Phone
                  </label>
                  <input
                    id="set-phone"
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-5 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
              >
                Save Preferences
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
