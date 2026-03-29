'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type UserRole =
  | 'super_admin'
  | 'branch_manager'
  | 'maintenance_staff'
  | 'transportation_staff'
  | 'supervision_staff'
  | 'finance_staff';

interface StaffProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
}

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

// Module-level cache so auth state persists across remounts (e.g. language switch).
// This prevents re-fetching user + profile when the component tree remounts
// due to locale changes in [locale]/layout.tsx.
let cachedUser: User | null = null;
let cachedProfile: StaffProfile | null = null;
let cacheReady = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [profile, setProfile] = useState<StaffProfile | null>(cachedProfile);
  const [loading, setLoading] = useState(!cacheReady);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    // If we already have cached auth state, skip the initial fetch
    if (cacheReady) {
      setUser(cachedUser);
      setProfile(cachedProfile);
      setLoading(false);
    } else {
      // Use getSession() instead of getUser() — reads from local cookie, no network call.
      // The middleware already called getUser() to refresh the session.
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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
  }, [supabase]);

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
