'use client';

import { useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { useTranslations } from 'next-intl';
import { AuthProvider } from '@/lib/auth/providers';
import type { StaffProfile } from '@/lib/auth/types';
import AdminSidebar from '@/components/admin/layout/AdminSidebar';
import AdminTopbar from '@/components/admin/layout/AdminTopbar';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Toaster } from 'sonner';

interface AdminShellProps {
  children: ReactNode;
  initialUser: User | null;
  initialProfile: StaffProfile | null;
}

export default function AdminShell({
  children,
  initialUser,
  initialProfile,
}: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const tCommon = useTranslations('common');

  return (
    <AuthProvider initialUser={initialUser} initialProfile={initialProfile}>
      <ThemeProvider initialTheme={initialProfile?.theme_preference ?? null}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[200] focus:bg-coral focus:text-white focus:px-4 focus:py-2 focus:rounded focus:font-medium focus:shadow-lg"
        >
          {tCommon('skipToContent')}
        </a>
        <div className="flex h-screen bg-gray-50 dark:bg-[var(--admin-bg)] overflow-hidden">
          <AdminSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <AdminTopbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
            <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 md:p-6 focus:outline-none">{children}</main>
          </div>
        </div>
        <Toaster position="top-center" richColors closeButton dir="auto" theme="system" />
      </ThemeProvider>
    </AuthProvider>
  );
}
