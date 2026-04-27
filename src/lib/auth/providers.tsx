'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { UserRole, StaffProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: StaffProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

// Module-level cache so auth state persists across remounts (e.g. language switch
// remounting [locale]/layout.tsx). When the server hydrates us via initialUser/
// initialProfile, we seed this cache so subsequent client-side mounts also skip
// the network round-trip.
let cachedUser: User | null = null;
let cachedProfile: StaffProfile | null = null;
let cacheReady = false;

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: User | null;
  initialProfile?: StaffProfile | null;
}

export function AuthProvider({
  children,
  initialUser,
  initialProfile,
}: AuthProviderProps) {
  // Server-hydrated path: when the RSC layout passes initialUser/initialProfile,
  // seed local state synchronously and skip the client round-trip entirely.
  // Module cache is updated inside the effect below (writing to it during
  // render would be a side effect React's strict rules forbid).
  const serverHydrated = initialUser !== undefined;
  const [user, setUser] = useState<User | null>(
    serverHydrated ? (initialUser ?? null) : cachedUser
  );
  const [profile, setProfile] = useState<StaffProfile | null>(
    serverHydrated ? (initialProfile ?? null) : cachedProfile
  );
  const [loading, setLoading] = useState(!serverHydrated && !cacheReady);
  // Lazy initializer: create the Supabase browser client once per provider
  // mount. Avoids accessing a ref during render (a React strict-rule violation).
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // Sync the module-level cache from server-hydrated values so cross-mount
    // reads (e.g. another AuthProvider mounting after a locale switch before
    // its props arrive) see the fresh user without a round-trip.
    if (serverHydrated && !cacheReady) {
      cachedUser = initialUser ?? null;
      cachedProfile = initialProfile ?? null;
      cacheReady = true;
    }

    // Fallback path: no server hydration AND no module cache yet — read the
    // session from the cookie and fetch the profile. Should be rare now that
    // the admin layout is an RSC, but kept for safety.
    if (!serverHydrated && !cacheReady) {
      // Fallback path: server didn't hydrate (e.g. legacy mount without provider
      // wrapping). Use getSession() — local cookie read, no network call.
      async function initSession() {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const sessionUser = session?.user ?? null;
        setUser(sessionUser);
        cachedUser = sessionUser;

        if (sessionUser) {
          const { data } = await supabase
            .from('staff_profiles')
            .select('*')
            .eq('id', sessionUser.id)
            .single();
          setProfile(data);
          cachedProfile = data;
        }

        cacheReady = true;
        setLoading(false);
      }

      initSession();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;

      // Only re-fetch profile if the user actually changed (sign in/out),
      // not on INITIAL_SESSION or TOKEN_REFRESHED events with the same user
      if (currentUser?.id === cachedUser?.id && cacheReady) {
        return;
      }

      setUser(currentUser);
      cachedUser = currentUser;

      if (currentUser) {
        const { data } = await supabase
          .from('staff_profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();
        setProfile(data);
        cachedProfile = data;
      } else {
        setProfile(null);
        cachedProfile = null;
      }

      cacheReady = true;
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, serverHydrated, initialUser, initialProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    cachedUser = null;
    cachedProfile = null;
    cacheReady = false;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { UserRole, StaffProfile, AuthContextType };
