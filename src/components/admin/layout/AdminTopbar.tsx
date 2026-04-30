'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, LogOut, Globe } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import ConfirmDialog from '@/components/admin/shared/ConfirmDialog';
import ThemeToggle from '@/components/admin/layout/ThemeToggle';

interface AdminTopbarProps {
  onMenuToggle: () => void;
}

export default function AdminTopbar({ onMenuToggle }: AdminTopbarProps) {
  const { profile, signOut } = useAuth();
  const locale = useLocale();
  const t = useTranslations('admin.topbar');
  const router = useRouter();
  const pathname = usePathname();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const roleLabels: Record<string, string> = {
    super_admin: t('roles.super_admin'),
    deputy_general_manager: t('roles.deputy_general_manager'),
    branch_manager: t('roles.branch_manager'),
    maintenance_manager: t('roles.maintenance_manager'),
    transportation_manager: t('roles.transportation_manager'),
    finance_manager: t('roles.finance_manager'),
    maintenance_staff: t('roles.maintenance_staff'),
    transportation_staff: t('roles.transportation_staff'),
    supervision_staff: t('roles.supervision_staff'),
    finance_staff: t('roles.finance_staff'),
  };

  function switchLanguage() {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    const newPath = pathname.replace(`/${locale}/`, `/${newLocale}/`);
    router.push(newPath);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    window.location.href = `/${locale}/admin/login`;
  }

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-[var(--admin-surface)] border-b border-gray-200 dark:border-[var(--admin-border)] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--admin-surface-2)]"
            aria-label="Toggle menu"
          >
            <Menu size={20} className="text-navy dark:text-[var(--admin-text)]" />
          </button>
          <div className="hidden sm:block min-w-0 max-w-[16rem]">
            <h2 className="text-sm font-semibold text-navy dark:text-[var(--admin-text)] truncate">
              {profile?.full_name || t('welcome')}
            </h2>
            {profile && (
              <p
                className="text-xs text-gray-500 dark:text-[var(--admin-text-muted)] truncate"
                title={roleLabels[profile.role] || profile.role}
              >
                {roleLabels[profile.role] || profile.role}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={switchLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-[var(--admin-surface-2)] text-navy dark:text-[var(--admin-text)] transition-colors"
          >
            <Globe size={16} />
            <span>{locale === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          <button
            onClick={() => setShowSignOutDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">{t('logout')}</span>
          </button>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showSignOutDialog}
        onClose={() => setShowSignOutDialog(false)}
        onConfirm={handleSignOut}
        title={t('signOutConfirm.title')}
        description={t('signOutConfirm.description')}
        confirmLabel={t('signOutConfirm.confirm')}
        cancelLabel={t('signOutConfirm.cancel')}
        variant="warning"
        loading={signingOut}
      />
    </header>
  );
}
