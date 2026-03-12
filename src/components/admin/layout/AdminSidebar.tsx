'use client';

import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Building2,
  Users,
  FileText,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { key: 'dashboard', href: '', icon: LayoutDashboard },
  { key: 'bookings', href: '/bookings', icon: MessageSquare },
  { key: 'maintenance', href: '/maintenance', icon: Wrench },
  { key: 'buildings', href: '/buildings', icon: Building2 },
  { key: 'residents', href: '/residents', icon: Users },
  { key: 'content', href: '/content', icon: FileText },
  { key: 'settings', href: '/settings', icon: Settings },
];

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('admin.sidebar');
  const basePath = `/${locale}/admin`;

  function isActive(href: string) {
    const fullPath = `${basePath}${href}`;
    if (href === '') return pathname === basePath || pathname === `${basePath}/`;
    return pathname.startsWith(fullPath);
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 bottom-0 z-50 w-64 bg-navy text-white flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
          isOpen
            ? 'translate-x-0'
            : locale === 'ar'
            ? 'translate-x-full'
            : '-translate-x-full'
        )}
        style={locale === 'ar' ? { right: 0 } : { left: 0 }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Link href={basePath} className="flex items-center gap-2">
            <Image
              src="/logo-white.png"
              alt="Sakan Alsayd"
              width={140}
              height={40}
              className="h-8 w-auto"
            />
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-white/10"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={`${basePath}${item.href}`}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-coral text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon size={20} />
                    <span>{t(item.key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            {t('version', { version: '1.0' })}
          </p>
        </div>
      </aside>
    </>
  );
}
