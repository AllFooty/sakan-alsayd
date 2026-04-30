'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'admin.theme';

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function subscribePrefersDark(callback: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getPrefersDarkSnapshot(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getPrefersDarkServerSnapshot(): boolean {
  return false;
}

function applyClass(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Server-hydrated preference from staff_profiles.theme_preference. When
   *  present, takes precedence over localStorage on first paint so a user's
   *  choice follows them between devices. */
  initialTheme?: ThemeMode | null;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  // Lazy initializer: server-hydrated preference wins; fall back to
  // localStorage; default to 'system'. Reading localStorage during render
  // is safe inside a useState initializer (runs once on mount).
  const [theme, setThemeState] = useState<ThemeMode>(
    () => initialTheme ?? readStoredTheme(),
  );

  const prefersDark = useSyncExternalStore(
    subscribePrefersDark,
    getPrefersDarkSnapshot,
    getPrefersDarkServerSnapshot,
  );

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    applyClass(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('dark');
      }
    };
  }, []);

  // Sync server-hydrated preference into localStorage on first mount so the
  // anti-FOUC script gets the right value on the next reload (it only reads
  // localStorage). Skip if no server value was provided.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (initialTheme && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, initialTheme);
    }
    syncedRef.current = true;
  }, [initialTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    setThemeState(mode);

    // Fire-and-forget: persist to staff_profiles so the choice follows the
    // user across devices. Failures are logged; the local update has already
    // happened so the UI is responsive regardless.
    if (typeof window !== 'undefined') {
      fetch('/api/admin/profile/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: mode }),
      }).catch((err) => {
        console.error('Failed to persist theme preference:', err);
      });
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('admin.theme');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
