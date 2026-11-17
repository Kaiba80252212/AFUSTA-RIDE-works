'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  History,
  Wallet,
  User,
  Settings,
  Star,
  CarFront,
  CheckCircle2,
  XCircle,
  MapPin,
  Navigation,
  Power,
  RefreshCw,
} from 'lucide-react';
import { DashboardShell, DashboardNavItem } from './DashboardShell';
import { CampusRouteMap } from './CampusRouteMap';
import { AvatarUploader } from './AvatarUploader';
import { DriverDashboardSkeleton } from './DashboardSkeletons';
import { ThemeToggle, useTheme } from './ThemeProvider';
import { MEDIA_ASSETS } from '@/lib/media';
import { formatNaira, RideStatus } from '@/lib/campus-transit';
import type { RideRecord } from '@/lib/server-store';
import type { SafeUser } from '@/lib/server-auth';

export function DriverDashboardClient() {
  const { hydrateFromServer } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [driver, setDriver] = useState<SafeUser | null>(null);
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  const loadState = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/state?scope=DRIVER', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        window.location.replace('/login?next=/driver');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load driver portal');
      const drv = data.user as SafeUser;
      setDriver(drv);
      setProfileName(drv.name);
      setProfilePhone(drv.phone);
      setRides(data.rides as RideRecord[]);
      if (drv.themePreference) {
        hydrateFromServer(drv.themePreference);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load driver dashboard');
    } finally {
      setLoading(false);
    }
  }, [hydrateFromServer]);

  useEffect(() => {
    let active = true;
    fetch('/api/state?scope=DRIVER', { cache: 'no-store' })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          window.location.replace('/login?next=/driver');
          return null;
        }
        return res.json().then((data) => ({ ok: res.ok, data }));
      })
      .then((result) => {
        if (!active || !result) return;
        const { ok, data } = result;
        if (!ok) throw new Error(data.error || 'Failed to load driver portal');
        const drv = data.user as SafeUser;
        setDriver(drv);
        setProfileName(drv.name);
        setProfilePhone(drv.phone);
        setRides(data.rides as RideRecord[]);
        if (drv.themePreference) {
          hydrateFromServer(drv.themePreference);
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load driver dashboard');
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
    { id: 'trips', label: 'My Trips', icon: <History className="h-4 w-4" /> },
    { id: 'earnings', label: 'Earnings', icon: <Wallet className="h-4 w-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  async function toggleAvailability() {
    if (!driver) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/driver/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !driver.available }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Toggle failed');
      setDriver(data.driver);
      setFeedback({
        type: 'success',
        text: data.driver.available
          ? 'You are now Available to receive AFUSTA campus ride requests.'
          : 'You are now Offline.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not update availability',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRideAction(rideId: string, nextStatus: RideStatus) {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setFeedback({
        type: 'success',
        text: `Ride ${data.ride.bookingRef} marked as ${nextStatus}.`,
      });
      await loadState();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update ride',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!driver) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
        }),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      setFeedback({ type: 'success', text: 'Driver profile updated.' });
      await loadState();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Profile update error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <DriverDashboardSkeleton />;
  }

  if (loadError || !driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FA] dark:bg-[#0E1621] p-4">
        <div className="glass-surface rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <XCircle className="h-10 w-10 text-red-500 mx-auto" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Unable to Load Driver Portal
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

  const firstName = driver.name.split(' ')[0];
  const driverRides = rides.filter((r) => r.driverId === driver.id || r.status === 'Pending');
  const activeTrip = driverRides.find((r) => r.status === 'Accepted' || r.status === 'On Trip');
  const pendingRequest = driverRides.find((r) => r.status === 'Pending');
  const mapRide = activeTrip ?? pendingRequest;

  return (
    <DashboardShell
      portalTitle="Driver Dashboard"
      portalSubtitle={`Good day, ${firstName}!`}
      userName={driver.name}
      userRoleLabel={`Driver · ${driver.plateNumber || 'AFU-102-KE'}`}
      userStatusText={driver.available ? 'Online · Available' : 'Offline'}
      avatarSrc={driver.avatarUrl || MEDIA_ASSETS.avatarDriver}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerAction={
        <button
          type="button"
          disabled={submitting}
          onClick={toggleAvailability}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
            driver.available
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_4px_12px_rgba(22,163,74,0.25)]'
              : 'bg-slate-800 dark:bg-[#232E3C] text-white hover:bg-slate-700 dark:hover:bg-[#2B3848]'
          }`}
        >
          {driver.available ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          <span>{driver.available ? 'Available' : 'Go Available'}</span>
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
          <span>{feedback.text}</span>
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
                <CarFront className="h-6 w-6 text-[#2481CC] dark:text-[#4EA4F6]" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Today&apos;s Trips
                </p>
                <p
                  data-testid="driver-today-trips"
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5"
                >
                  {driver.todayTrips ?? 0}
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
                  {driver.rating.toFixed(1)} ★
                </p>
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
                <Wallet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Today&apos;s Earnings
                </p>
                <p
                  data-testid="driver-today-earnings"
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5"
                >
                  {formatNaira(driver.todayEarnings ?? 0)}
                </p>
              </div>
            </div>
          </div>

          {/* 2-Column Split: New Ride Request + Live Location */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 glass-surface rounded-2xl p-5 flex flex-col justify-between">
              {activeTrip ? (
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3848]">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Active Trip Dispatch
                    </h2>
                    <span className="rounded-lg bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      {activeTrip.status}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Passenger:{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {activeTrip.studentName}
                      </strong>
                    </p>
                    <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3.5 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                        <MapPin className="h-4 w-4 text-slate-700 dark:text-slate-300 shrink-0" />
                        <span>
                          From: <strong>{activeTrip.fromName}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                        <Navigation className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                        <span>
                          To: <strong>{activeTrip.toName}</strong>
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-[#2B3848] flex items-center justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Trip Fare</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatNaira(activeTrip.fare)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-3">
                    {activeTrip.status === 'Accepted' ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleRideAction(activeTrip.id, 'On Trip')}
                        className="flex-1 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
                      >
                        Start Trip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleRideAction(activeTrip.id, 'Completed')}
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                      >
                        Complete Trip &amp; Collect {formatNaira(activeTrip.fare)}
                      </button>
                    )}
                  </div>
                </div>
              ) : pendingRequest ? (
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-[#2B3848]">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      New Ride Request
                    </h2>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {pendingRequest.displayTime}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Passenger: {pendingRequest.studentName}</span>
                      <span className="font-mono font-semibold">{pendingRequest.bookingRef}</span>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-4 space-y-2.5">
                      <div className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200">
                        <MapPin className="h-4 w-4 text-slate-700 dark:text-slate-300 shrink-0" />
                        <span>
                          From:{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {pendingRequest.fromName}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200">
                        <MapPin className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                        <span>
                          To:{' '}
                          <strong className="text-slate-900 dark:text-slate-100">
                            {pendingRequest.toName}
                          </strong>
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 dark:border-[#2B3848] flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {pendingRequest.distanceKm} km · ~{pendingRequest.etaMinutes} min
                        </span>
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatNaira(pendingRequest.fare)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleRideAction(pendingRequest.id, 'Accepted')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8] transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleRideAction(pendingRequest.id, 'Declined')}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-2">
                  <CarFront className="h-8 w-8 text-[#2481CC] dark:text-[#4EA4F6] mx-auto" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Awaiting Campus Requests
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {driver.available
                      ? 'Your tricycle is visible to AFUSTA students nearby.'
                      : 'Toggle Available above to start receiving campus bookings.'}
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 glass-surface rounded-2xl p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2B3848] mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Live Location
                </h2>
                <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                  {driver.plateNumber || 'AFU-102-KE'}
                </span>
              </div>
              <CampusRouteMap
                fromStopId={mapRide?.fromStopId ?? 'main-gate'}
                toStopId={mapRide?.toStopId ?? 'library'}
                statusLabel={
                  activeTrip ? activeTrip.status : pendingRequest ? 'Request Nearby' : 'On Standby'
                }
                heightClass="h-72"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trips' && (
        <div className="glass-surface rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
            Assigned Campus Trips
          </h2>
          {driverRides.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No assigned campus trips yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2B3848] text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 pr-4">Booking</th>
                    <th className="py-3 pr-4">Student</th>
                    <th className="py-3 pr-4">Route</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 text-right">Fare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2B3848] text-sm">
                  {driverRides.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#1E2936]/70 transition-colors"
                    >
                      <td className="py-3 pr-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {r.bookingRef}
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                        {r.studentName}
                      </td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                        {r.fromName} → {r.toName}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-lg bg-slate-100 dark:bg-[#232E3C] px-2.5 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {formatNaira(r.fare)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'earnings' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="glass-surface rounded-2xl p-6">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Today&apos;s Earnings
            </p>
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatNaira(driver.todayEarnings ?? 0)}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Completed Trips Today:{' '}
              <strong className="tabular-nums text-slate-900 dark:text-slate-100">
                {driver.todayTrips ?? 0}
              </strong>
            </p>
          </div>
          <div className="glass-surface rounded-2xl p-6">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Cumulative Campus Earnings
            </p>
            <p className="mt-1 text-3xl font-bold text-[#2481CC] dark:text-[#4EA4F6] tabular-nums">
              {formatNaira(driver.totalEarnings ?? 142500)}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Direct payout settled weekly via AFUSTA Bursary Transport Desk.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-xl">
          <div className="glass-surface rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Driver Profile &amp; Photo
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Students see your verified avatar when your tricycle accepts a booking.
              </p>
            </div>
            <AvatarUploader user={driver} onUserUpdated={(updated) => setDriver(updated)} />
          </div>

          <form onSubmit={handleSaveProfile} className="glass-surface rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Driver &amp; Vehicle Registration
            </h3>
            <div>
              <label
                htmlFor="drv-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Driver Name
              </label>
              <input
                id="drv-name"
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="drv-phone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Phone Number
              </label>
              <input
                id="drv-phone"
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p>
                License ID:{' '}
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {driver.licenseNo}
                </span>
              </p>
              <p>
                Assigned Tricycle Plate:{' '}
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {driver.plateNumber}
                </span>
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-5 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
            >
              Save Profile
            </button>
          </form>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="glass-surface rounded-2xl p-6 max-w-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Appearance &amp; Theme
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Choose Light, Dark, or automatic Device theme for night and daytime campus shifts.
              </p>
            </div>
            <ThemeToggle scope="user" />
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Dispatch Contact Settings
            </h3>
            <div>
              <label
                htmlFor="drv-set-phone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Dispatch Phone Number
              </label>
              <input
                id="drv-set-phone"
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-[#2481CC] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-5 py-2.5 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
            >
              Save Settings
            </button>
          </form>
        </div>
      )}
    </DashboardShell>
  );
}
