'use client';

import { useState } from 'react';
import Image, { StaticImageData } from 'next/image';
import Link from 'next/link';
import { Menu, X, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { BrandLogo } from './BrandLogo';
import { QuickThemeButton } from './ThemeProvider';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface DashboardShellProps {
  portalTitle: string;
  portalSubtitle: string;
  userName: string;
  userRoleLabel: string;
  userStatusText?: string;
  avatarSrc: StaticImageData | string;
  navItems: DashboardNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  headerAction?: React.ReactNode;
  logoutEndpoint?: string;
  logoutRedirect?: string;
  homeHref?: string;
  themeVariant?: 'user' | 'admin';
  children: React.ReactNode;
}

export function DashboardShell({
  portalTitle,
  portalSubtitle,
  userName,
  userRoleLabel,
  userStatusText = 'Online',
  avatarSrc,
  navItems,
  activeTab,
  onTabChange,
  headerAction,
  logoutEndpoint = '/api/auth/logout',
  logoutRedirect = '/login',
  homeHref = '/',
  themeVariant = 'user',
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdminTheme = themeVariant === 'admin';
  const sidebarBg = isAdminTheme
    ? 'bg-[#0F172A] dark:bg-[#131C26]'
    : 'bg-[#101C26] dark:bg-[#131C26]';
  const activeItemBg =
    'bg-[#2481CC] dark:bg-[#4EA4F6] text-white dark:text-[#0E1621] font-semibold shadow-[0_2px_10px_rgba(36,129,204,0.28)]';
  const canvasBg = 'bg-[#F4F7FA] dark:bg-[#0E1621]';

  const isRuntimeApiAvatar =
    typeof avatarSrc === 'string' && avatarSrc.startsWith('/api/');

  async function handleLogout() {
    try {
      await fetch(logoutEndpoint, {
        method: 'POST',
      });
      if (!isAdminTheme) {
        await signOut(auth).catch(() => undefined);
      }
    } finally {
      window.location.assign(logoutRedirect);
    }
  }

  const sidebarContent = (
    <div className={`flex h-full flex-col justify-between ${sidebarBg} text-white p-5 transition-colors duration-200`}>
      <div>
        <div className="flex items-center justify-between pb-5 border-b border-white/10">
          <Link
            href={homeHref}
            prefetch={false}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4EA4F6] rounded-lg"
          >
            {isAdminTheme ? (
              <span className="text-base font-bold tracking-tight text-white">
                Directorate Console
              </span>
            ) : (
              <BrandLogo variant="dark" size="sm" />
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation drawer"
            className="lg:hidden rounded-lg p-1.5 text-slate-300 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Profile Block + Quick Theme Switch */}
        <div className="mt-5 flex flex-col items-center text-center pb-5 border-b border-white/10">
          <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-[#4EA4F6] bg-[#1D2A38]">
            {isRuntimeApiAvatar ? (
              // Runtime uploaded avatar endpoint
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt={userName}
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={avatarSrc}
                alt={userName}
                fill
                sizes="56px"
                referrerPolicy="no-referrer"
                className="object-cover"
              />
            )}
          </div>
          <p className="mt-3 text-sm font-bold text-white truncate max-w-full">{userName}</p>
          <p className="text-xs text-slate-300 mt-0.5 truncate max-w-full">{userRoleLabel}</p>
          <p className="mt-1 text-xs font-medium text-[#64B5F6]">{userStatusText}</p>

          <div className="mt-3 w-full flex justify-center">
            <QuickThemeButton
              scope={themeVariant}
              variant="sidebar"
              className="w-full justify-center"
            />
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="mt-5 space-y-1.5" aria-label={`${portalTitle} navigation`}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? activeItemBg
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Logout Only (Zero Cross-Portal or Admin Links) */}
      <div className="pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row ${canvasBg} text-slate-900 dark:text-slate-100 transition-colors duration-200`}
    >
      {/* Mobile Header (compact <= 56px) */}
      <header
        className={`lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between ${sidebarBg} px-4 text-white border-b border-white/10`}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-slate-200 hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
        {isAdminTheme ? (
          <span className="text-sm font-bold tracking-tight text-white">Directorate Console</span>
        ) : (
          <BrandLogo variant="dark" size="sm" />
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs font-semibold text-slate-300 hover:text-white whitespace-nowrap"
        >
          Sign Out
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen border-r border-slate-200 dark:border-[#2B3848]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-68 h-full shadow-[0_20px_50px_rgba(0,0,0,0.45)]">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={() => setMobileOpen(false)}
            className="flex-1 bg-black/55"
          />
        </div>
      )}

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          {/* Workspace Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#2B3848]">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {portalTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{portalSubtitle}</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <QuickThemeButton scope={themeVariant} variant="surface" className="hidden sm:inline-flex" />
              {headerAction && <div>{headerAction}</div>}
            </div>
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
