'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '@/lib/server-store';

export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'afusta_theme_preference';
const themeListeners = new Set<() => void>();

function normalizePreference(value: unknown): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    return normalizePreference(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'system';
  }
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return getSystemDark() ? 'dark' : 'light';
}

function applyThemeToDocument(preference: ThemePreference) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

function notifyThemeChange() {
  applyThemeToDocument(readStoredPreference());
  themeListeners.forEach((listener) => listener());
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      applyThemeToDocument(readStoredPreference());
      listener();
    }
  };
  const mq =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const onMediaChange = () => {
    if (readStoredPreference() === 'system') {
      applyThemeToDocument('system');
      listener();
    }
  };

  window.addEventListener('storage', onStorage);
  mq?.addEventListener('change', onMediaChange);

  return () => {
    themeListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    mq?.removeEventListener('change', onMediaChange);
  };
}

function getSnapshotString(): string {
  const pref = readStoredPreference();
  const resolved = resolveTheme(pref);
  return `${pref}:${resolved}`;
}

function getServerSnapshotString(): string {
  return 'system:light';
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (
    next: ThemePreference,
    options?: { syncServer?: boolean; scope?: 'user' | 'admin' }
  ) => Promise<void>;
  hydrateFromServer: (serverPreference?: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeTheme,
    getSnapshotString,
    getServerSnapshotString
  );
  const [prefPart, resolvedPart] = snapshot.split(':') as [ThemePreference, ResolvedTheme];

  useEffect(() => {
    applyThemeToDocument(readStoredPreference());
  }, []);

  const setTheme = useCallback(
    async (
      next: ThemePreference,
      options?: { syncServer?: boolean; scope?: 'user' | 'admin' }
    ) => {
      const normalized = normalizePreference(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // Ignore storage errors
      }
      notifyThemeChange();

      if (options?.syncServer !== false) {
        try {
          await fetch('/api/auth/theme', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(options?.scope === 'admin' ? { 'x-portal-scope': 'admin' } : {}),
            },
            body: JSON.stringify({ themePreference: normalized }),
          });
        } catch {
          // Ignore unauthenticated or offline errors; local preference remains saved
        }
      }
    },
    []
  );

  const hydrateFromServer = useCallback((serverPreference?: ThemePreference) => {
    if (!serverPreference) return;
    const normalized = normalizePreference(serverPreference);
    if (readStoredPreference() !== normalized) {
      try {
        window.localStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // Ignore storage errors
      }
      notifyThemeChange();
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        preference: prefPart,
        resolvedTheme: resolvedPart,
        setTheme,
        hydrateFromServer,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}

export function ThemeToggle({
  scope = 'user',
  syncServer = true,
}: {
  scope?: 'user' | 'admin';
  syncServer?: boolean;
}) {
  const { preference, setTheme } = useTheme();

  const options: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Color theme preference"
      className="inline-flex rounded-xl border border-slate-200 dark:border-[#2B3848] bg-slate-100 dark:bg-[#0E1621] p-1 gap-1"
    >
      {options.map((item) => {
        const Icon = item.icon;
        const active = preference === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(item.id, { syncServer, scope })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'bg-[#2481CC] dark:bg-[#4EA4F6] text-white dark:text-[#0E1621] shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-[#17212B]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function QuickThemeButton({
  scope = 'user',
  syncServer = true,
  variant = 'surface',
  className = '',
}: {
  scope?: 'user' | 'admin';
  syncServer?: boolean;
  variant?: 'surface' | 'sidebar' | 'overlay';
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const variantClasses =
    variant === 'overlay'
      ? 'border-white/25 bg-black/30 text-white hover:bg-black/45'
      : variant === 'sidebar'
      ? 'border-white/15 bg-[#1B2735] text-slate-200 hover:bg-[#233242] hover:text-white'
      : 'border-slate-200 dark:border-[#2B3848] bg-white dark:bg-[#17212B] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#232E3C]';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark', { syncServer, scope })}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${variantClasses} ${className}`}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-amber-400" />
          <span>Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-[#2481CC]" />
          <span>Dark Mode</span>
        </>
      )}
    </button>
  );
}
