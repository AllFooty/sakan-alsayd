'use client';

import { useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { AuthProvider } from '@/lib/auth/providers';
import type { StaffProfile } from '@/lib/auth/types';
import AdminSidebar from '@/components/admin/layout/AdminSidebar';
import AdminTopbar from '@/components/admin/layout/AdminTopbar';
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

  return (
    <AuthProvider initialUser={initialUser} initialProfile={initialProfile}>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminTopbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
      <Toaster position="top-center" richColors closeButton dir="auto" />
    </AuthProvider>
  );
}
