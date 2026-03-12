'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, LogOut, Globe } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';

interface AdminTopbarProps {
  onMenuToggle: () => void;
}

export default function AdminTopbar({ onMenuToggle }: AdminTopbarProps) {
  const { profile, signOut } = useAuth();
  const locale = useLocale();
  const t = useTranslations('admin.topbar');
  const router = useRouter();
  const pathname = usePathname();

  const roleLabels: Record<string, string> = {
    super_admin: t('roles.super_admin'),
    branch_manager: t('roles.branch_manager'),
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
    await signOut();
    router.push(`/${locale}/admin/login`);
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <Menu size={20} className="text-navy" />
          </button>
          <div className="hidden sm:block">
            <h2 className="text-sm font-semibold text-navy">
              {profile?.full_name || t('welcome')}
            </h2>
            {profile && (
              <p className="text-xs text-gray-500">
                {roleLabels[profile.role] || profile.role}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={switchLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-navy transition-colors"
          >
            <Globe size={16} />
            <span>{locale === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-red-50 text-red-600 transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">{t('logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
