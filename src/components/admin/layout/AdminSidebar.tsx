'use client';

import { useSyncExternalStore } from 'react';
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
  UserCog,
  FileText,
  Settings,
  Activity,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/hooks';

const COLLAPSED_STORAGE_KEY = 'admin.sidebar.collapsed';

function subscribeToCollapsed(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
}

function getCollapsedServerSnapshot() {
  return false;
}

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navSections = [
  {
    key: 'operations',
    items: [
      { key: 'dashboard', href: '', icon: LayoutDashboard, superAdminOnly: false },
      { key: 'bookings', href: '/bookings', icon: MessageSquare, superAdminOnly: false },
      { key: 'maintenance', href: '/maintenance', icon: Wrench, superAdminOnly: false },
    ],
  },
  {
    key: 'properties',
    items: [
      { key: 'buildings', href: '/buildings', icon: Building2, superAdminOnly: false },
      { key: 'occupancy', href: '/occupancy', icon: Activity, superAdminOnly: false },
    ],
  },
  {
    key: 'people',
    items: [
      { key: 'residents', href: '/residents', icon: Users, superAdminOnly: false },
      { key: 'users', href: '/users', icon: UserCog, superAdminOnly: true },
    ],
  },
  {
    key: 'admin',
    items: [
      { key: 'content', href: '/content', icon: FileText, superAdminOnly: false },
      { key: 'settings', href: '/settings', icon: Settings, superAdminOnly: false },
    ],
  },
];

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('admin.sidebar');
  const { profile } = useAuth();
  const basePath = `/${locale}/admin`;
  const isSuperAdmin = profile?.role === 'super_admin';
  const isRtl = locale === 'ar';

  const isCollapsed = useSyncExternalStore(
    subscribeToCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  function toggleCollapsed() {
    const next = !isCollapsed;
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
    // 'storage' fires across tabs but not within the same tab; dispatch to notify our own subscriber.
    window.dispatchEvent(new StorageEvent('storage', { key: COLLAPSED_STORAGE_KEY }));
  }

  const visibleNavSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.superAdminOnly || isSuperAdmin
      ),
    }))
    .filter((section) => section.items.length > 0);

  function isActive(href: string) {
    const fullPath = `${basePath}${href}`;
    if (href === '') return pathname === basePath || pathname === `${basePath}/`;
    return pathname.startsWith(fullPath);
  }

  // Mobile drawer always renders full-width; only desktop honors the collapsed rail.
  const desktopCollapsed = isCollapsed;
  const collapseLabel = isCollapsed ? t('expand') : t('collapse');
  const ChevronCollapseIcon = isRtl
    ? isCollapsed ? ChevronsLeft : ChevronsRight
    : isCollapsed ? ChevronsRight : ChevronsLeft;

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
          'fixed top-0 bottom-0 z-50 w-64 bg-navy text-white flex flex-col transition-[width,transform] duration-300 lg:translate-x-0 lg:static lg:z-auto',
          desktopCollapsed && 'lg:w-16',
          isOpen
            ? 'translate-x-0'
            : isRtl
            ? 'translate-x-full'
            : '-translate-x-full'
        )}
        style={isRtl ? { right: 0 } : { left: 0 }}
      >
        {/* Logo + controls */}
        <div
          className={cn(
            'flex items-center border-b border-white/10 h-16 px-4',
            desktopCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'
          )}
        >
          <Link
            href={basePath}
            className={cn(
              'flex items-center gap-2',
              desktopCollapsed && 'lg:hidden'
            )}
          >
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
          <button
            onClick={toggleCollapsed}
            className="hidden lg:inline-flex p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            aria-label={collapseLabel}
            title={collapseLabel}
          >
            <ChevronCollapseIcon size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className={cn('px-2', desktopCollapsed ? 'lg:space-y-2' : 'space-y-4')}>
            {visibleNavSections.map((section, sectionIdx) => (
              <div key={section.key}>
                {desktopCollapsed && sectionIdx > 0 ? (
                  <div className="hidden lg:block mx-2 mb-2 border-t border-white/10" aria-hidden="true" />
                ) : null}
                <p
                  className={cn(
                    'px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40',
                    desktopCollapsed && 'lg:hidden'
                  )}
                >
                  {t(`section.${section.key}`)}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const label = t(item.key);
                    return (
                      <li key={item.key}>
                        <Link
                          href={`${basePath}${item.href}`}
                          onClick={onClose}
                          title={desktopCollapsed ? label : undefined}
                          aria-label={desktopCollapsed ? label : undefined}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                            desktopCollapsed && 'lg:justify-center lg:px-0',
                            active
                              ? 'bg-coral text-white'
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <Icon size={20} />
                          <span className={cn(desktopCollapsed && 'lg:hidden')}>
                            {label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className={cn('border-t border-white/10', desktopCollapsed ? 'lg:p-2 p-4' : 'p-4')}>
          <p className="text-xs text-white/40 text-center">
            {t('version', { version: '1.0' })}
          </p>
        </div>
      </aside>
    </>
  );
}
