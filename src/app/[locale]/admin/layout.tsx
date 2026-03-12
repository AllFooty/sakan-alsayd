'use client';

import { useState } from 'react';
import { AuthProvider } from '@/lib/auth/providers';
import AdminSidebar from '@/components/admin/layout/AdminSidebar';
import AdminTopbar from '@/components/admin/layout/AdminTopbar';
import { Toaster } from 'sonner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AdminTopbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
      <Toaster
        position="top-center"
        richColors
        closeButton
        dir="auto"
      />
    </AuthProvider>
  );
}
