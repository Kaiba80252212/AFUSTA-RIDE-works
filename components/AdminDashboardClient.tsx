'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CarFront,
  CalendarCheck,
  FileBarChart,
  Settings,
  Wallet,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { DashboardShell, DashboardNavItem } from './DashboardShell';
import { BookingsChart } from './BookingsChart';
import { AdminDashboardSkeleton } from './DashboardSkeletons';
import { ThemeToggle, useTheme } from './ThemeProvider';
import { MEDIA_ASSETS } from '@/lib/media';
import { formatNaira } from '@/lib/campus-transit';
import type { RideRecord, TricycleRecord } from '@/lib/server-store';
import type { SafeUser } from '@/lib/server-auth';

interface SystemSummary {
  totalUsers: number;
  totalRides: number;
  totalRevenue: number;
  activeTricycles: number;
  pendingRidesCount: number;
}

export function AdminDashboardClient() {
  const { hydrateFromServer } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [range, setRange] = useState<'This Month' | 'This Week' | 'Today'>('This Month');
  const [admin, setAdmin] = useState<SafeUser | null>(null);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [tricycles, setTricycles] = useState<TricycleRecord[]>([]);
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add Tricycle form
  const [newPlate, setNewPlate] = useState('');
  const [newModel, setNewModel] = useState('Bajaj RE Compact 2025');
  const [newZone, setNewZone] = useState('Main Gate · Library · Senate');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  const loadState = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/state', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        window.location.replace('/directorate-portal/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load admin console');
      const adm = data.admin as SafeUser;
      setAdmin(adm);
      setUsers(data.users);
      setTricycles(data.tricycles);
      setRides(data.rides);
      setSummary(data.summary);
      if (adm.themePreference) {
        hydrateFromServer(adm.themePreference);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load Directorate Console');
    } finally {
      setLoading(false);
    }
  }, [hydrateFromServer]);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/state', { cache: 'no-store' })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          window.location.replace('/directorate-portal/login');
          return null;
        }
        return res.json().then((data) => ({ ok: res.ok, data }));
      })
      .then((result) => {
        if (!active || !result) return;
        if (!result.ok) {
          setLoadError(result.data?.error || 'Failed to load admin console');
          return;
        }
        setLoadError(null);
        const adm = result.data.admin as SafeUser;
        setAdmin(adm);
        setUsers(result.data.users);
        setTricycles(result.data.tricycles);
        setRides(result.data.rides);
        setSummary(result.data.summary);
        if (adm.themePreference) {
          hydrateFromServer(adm.themePreference);
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load Directorate Console');
        }
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
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'drivers', label: 'Drivers', icon: <UserCheck className="h-4 w-4" /> },
    { id: 'tricycles', label: 'Tricycles', icon: <CarFront className="h-4 w-4" /> },
    { id: 'bookings', label: 'Bookings', icon: <CalendarCheck className="h-4 w-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileBarChart className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  async function toggleUserStatus(userId: string) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleUserStatus', userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setFeedback(`Updated status for ${data.user.name} to ${data.user.status}.`);
      await loadState();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateTricycleStatus(
    tricycleId: string,
    status: 'Active' | 'Maintenance' | 'Offline'
  ) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateTricycleStatus', tricycleId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setFeedback(`Tricycle ${data.tricycle.code} set to ${data.tricycle.status}.`);
      await loadState();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddTricycle(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlate.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addTricycle',
          plateNumber: newPlate,
          model: newModel,
          routeZone: newZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add tricycle');
      setNewPlate('');
      setFeedback(`Registered tricycle ${data.tricycle.code} (${data.tricycle.plateNumber}).`);
      await loadState();
    } finally {
      setSubmitting(false);
    }
  }

  function exportBookingsCsv() {
    const header = 'Ref,Student,Driver,From,To,Type,Fare,Status\n';
    const rows = rides
      .map(
        (r) =>
          `${r.bookingRef},"${r.studentName}","${r.driverName}","${r.fromName}","${r.toName}",${r.rideType},${r.fare},${r.status}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afusta-ride-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (loadError || !admin || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FA] dark:bg-[#0E1621] p-4">
        <div className="glass-surface rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <XCircle className="h-10 w-10 text-red-500 mx-auto" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Unable to Load Directorate Console
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {loadError || 'Administrator session could not be verified.'}
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

  const studentsList = users.filter(
    (u) =>
      u.role === 'STUDENT' &&
      (u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const driversList = users.filter((u) => u.role === 'DRIVER');

  return (
    <DashboardShell
      portalTitle="Transport Directorate Console"
      portalSubtitle="System Overview & Fleet Administration"
      userName={admin.name}
      userRoleLabel="Directorate Administrator"
      userStatusText="Authorized Session"
      avatarSrc={admin.avatarUrl || MEDIA_ASSETS.avatarAdmin}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      themeVariant="admin"
      logoutEndpoint="/api/auth/admin/logout"
      logoutRedirect="/directorate-portal/login"
      homeHref="/directorate-portal"
      headerAction={
        <select
          aria-label="Select analytics time range"
          value={range}
          onChange={(e) => setRange(e.target.value as 'This Month' | 'This Week' | 'Today')}
          className="rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#17212B] px-3.5 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
        >
          <option value="This Month">This Month</option>
          <option value="This Week">This Week</option>
          <option value="Today">Today</option>
        </select>
      }
    >
      {feedback && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline"
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
                <Users className="h-6 w-6 text-[#2481CC] dark:text-[#4EA4F6]" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Users</p>
                <p
                  data-testid="admin-total-users"
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5"
                >
                  {summary.totalUsers.toLocaleString('en-NG')}
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
                  data-testid="admin-total-rides"
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5"
                >
                  {summary.totalRides.toLocaleString('en-NG')}
                </p>
              </div>
            </div>

            <div className="glass-surface rounded-2xl p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-center justify-center shrink-0">
                <Wallet className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Revenue
                </p>
                <p
                  data-testid="admin-total-revenue"
                  className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5"
                >
                  {formatNaira(summary.totalRevenue)}
                </p>
              </div>
            </div>
          </div>

          {/* 2-Column Split: Bookings Overview + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 glass-surface rounded-2xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#2B3848] mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Bookings Overview
                </h2>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {range}
                </span>
              </div>
              <BookingsChart range={range} />
            </div>

            <div className="lg:col-span-4 glass-surface rounded-2xl p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-200 dark:border-[#2B3848]">
                Quick Actions
              </h2>
              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('users')}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:border-[#2481CC] dark:hover:border-[#4EA4F6] hover:bg-sky-50/70 dark:hover:bg-[#232E3C] transition-colors"
                >
                  <Users className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                  <span>Manage Users</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('drivers')}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:border-[#2481CC] dark:hover:border-[#4EA4F6] hover:bg-sky-50/70 dark:hover:bg-[#232E3C] transition-colors"
                >
                  <UserCheck className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                  <span>Manage Drivers</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:border-[#2481CC] dark:hover:border-[#4EA4F6] hover:bg-sky-50/70 dark:hover:bg-[#232E3C] transition-colors"
                >
                  <FileBarChart className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                  <span>View Reports</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-50 dark:bg-[#1E2936] px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:border-[#2481CC] dark:hover:border-[#4EA4F6] hover:bg-sky-50/70 dark:hover:bg-[#232E3C] transition-colors"
                >
                  <Settings className="h-4 w-4 text-[#2481CC] dark:text-[#4EA4F6] shrink-0" />
                  <span>System Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="glass-surface rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Registered Students
            </h2>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student name or email..."
              className="rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 sm:w-64 focus:border-[#2481CC] dark:focus:border-[#4EA4F6] focus:outline-none"
            />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2B3848] text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Matric No</th>
                  <th className="py-3 pr-4">Auth / Verification</th>
                  <th className="py-3 pr-4 text-right">Wallet</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2B3848] text-sm">
                {studentsList.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#1E2936]/70 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{u.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {u.matricNo}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                        {u.authProvider || 'email'} · {u.emailVerified ? 'Verified' : 'Pending'}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        {u.lastLoginAt
                          ? `Last login: ${new Date(u.lastLoginAt).toLocaleDateString('en-NG')}`
                          : 'Never logged in'}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatNaira(u.walletBalance ?? 0)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                          u.status === 'Active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => toggleUserStatus(u.id)}
                        className="rounded-lg border border-slate-300 dark:border-[#2B3848] px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232E3C]"
                      >
                        {u.status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'drivers' && (
        <div className="glass-surface rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
            Verified Campus Drivers
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2B3848] text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 pr-4">Driver</th>
                  <th className="py-3 pr-4">License / Plate</th>
                  <th className="py-3 pr-4 text-right">Today Trips</th>
                  <th className="py-3 pr-4 text-right">Today Earnings</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2B3848] text-sm">
                {driversList.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#1E2936]/70 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{d.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{d.phone}</p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {d.licenseNo} · {d.plateNumber}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {d.todayTrips ?? 0}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {formatNaira(d.todayEarnings ?? 0)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                          d.status === 'Active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                            : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => toggleUserStatus(d.id)}
                        className="rounded-lg border border-slate-300 dark:border-[#2B3848] px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232E3C]"
                      >
                        {d.status === 'Active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'tricycles' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddTricycle}
            className="glass-surface rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label
                htmlFor="trk-plate"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Plate Number
              </label>
              <input
                id="trk-plate"
                type="text"
                required
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                placeholder="AFU-142-KE"
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3 py-2 text-sm font-mono uppercase text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="trk-model"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Model
              </label>
              <input
                id="trk-model"
                type="text"
                required
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor="trk-zone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Assigned Zone
              </label>
              <input
                id="trk-zone"
                type="text"
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2 text-sm font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
            >
              <Plus className="h-4 w-4" />
              <span>Register Tricycle</span>
            </button>
          </form>

          <div className="glass-surface rounded-2xl p-6 overflow-x-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
              AFUSTA Tricycle Fleet ({tricycles.length})
            </h2>
            <table className="mt-4 w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2B3848] text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 pr-4">Fleet Code</th>
                  <th className="py-3 pr-4">Plate</th>
                  <th className="py-3 pr-4">Model</th>
                  <th className="py-3 pr-4">Driver</th>
                  <th className="py-3 pr-4">Route Zone</th>
                  <th className="py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2B3848] text-sm">
                {tricycles.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#1E2936]/70 transition-colors"
                  >
                    <td className="py-3 pr-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {t.code}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {t.plateNumber}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{t.model}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {t.driverName}
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-400">
                      {t.routeZone}
                    </td>
                    <td className="py-3 text-right">
                      <select
                        aria-label={`Status for ${t.code}`}
                        value={t.status}
                        onChange={(e) =>
                          updateTricycleStatus(
                            t.id,
                            e.target.value as 'Active' | 'Maintenance' | 'Offline'
                          )
                        }
                        className="rounded-lg border border-slate-300 dark:border-[#2B3848] bg-white dark:bg-[#232E3C] px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100"
                      >
                        <option value="Active">Active</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Offline">Offline</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === 'bookings' || activeTab === 'reports') && (
        <div className="glass-surface rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {activeTab === 'reports' ? 'Campus Mobility Reports' : 'All Campus Bookings'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live booking ledger across all AFUSTA zones
              </p>
            </div>
            <button
              type="button"
              onClick={exportBookingsCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2481CC] dark:bg-[#4EA4F6] px-4 py-2 text-xs font-semibold text-white dark:text-[#0E1621] hover:bg-[#1D6FB8]"
            >
              <Download className="h-4 w-4" />
              <span>Download CSV</span>
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2B3848] text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-3 pr-4">Ref</th>
                  <th className="py-3 pr-4">Student</th>
                  <th className="py-3 pr-4">Route</th>
                  <th className="py-3 pr-4">Driver</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Fare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2B3848] text-sm">
                {rides.map((r) => (
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
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                      {r.driverName}
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
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          <div className="glass-surface rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#2B3848]">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Console Appearance
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Switch between Telegram Light, Dark, or System mode for your Administrator Console.
                </p>
              </div>
              <ThemeToggle scope="admin" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Campus Tariff &amp; Operating Hours
              </h3>
              <div className="mt-3 divide-y divide-slate-200 dark:divide-[#2B3848] text-sm">
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Standard Campus Base Tariff
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    ₦150 – ₦250
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Shared Ride Multiplier</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    0.65x
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Express Private Multiplier
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    1.60x
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Daily Campus Operating Window
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    06:00 AM – 10:30 PM
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
