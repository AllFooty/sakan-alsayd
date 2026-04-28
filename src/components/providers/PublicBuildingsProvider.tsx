'use client';

import { createContext, useContext } from 'react';
import type { PublicBuilding, PublicCity } from '@/lib/buildings/public';

interface PublicBuildingsContextValue {
  buildings: PublicBuilding[];
  cities: PublicCity[];
}

const PublicBuildingsContext = createContext<PublicBuildingsContextValue | null>(null);

interface PublicBuildingsProviderProps {
  buildings: PublicBuilding[];
  cities: PublicCity[];
  children: React.ReactNode;
}

export function PublicBuildingsProvider({
  buildings,
  cities,
  children,
}: PublicBuildingsProviderProps) {
  return (
    <PublicBuildingsContext.Provider value={{ buildings, cities }}>
      {children}
    </PublicBuildingsContext.Provider>
  );
}

export function usePublicBuildings(): PublicBuildingsContextValue {
  const ctx = useContext(PublicBuildingsContext);
  if (!ctx) {
    throw new Error('usePublicBuildings must be used inside <PublicBuildingsProvider>');
  }
  return ctx;
}
