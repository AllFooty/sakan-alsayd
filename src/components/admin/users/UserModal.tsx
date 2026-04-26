'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { X, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth/hooks';
import type { UserRole } from './UserRoleBadge';

const ROLES: UserRole[] = [
  'super_admin',
  'branch_manager',
  'maintenance_staff',
  'transportation_staff',
  'supervision_staff',
  'finance_staff',
];

export interface BuildingOption {
  id: string;
  city_en: string;
  city_ar: string;
  neighborhood_en: string;
  neighborhood_ar: string;
}

export interface ManagedUser {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  buildings: BuildingOption[];
}

interface UserModalProps {
  isOpen: boolean;
  mode: 'invite' | 'edit';
  user?: ManagedUser | null;
  buildings: BuildingOption[];
  onClose: () => void;
  onSaved: () => void;
}

export default function UserModal({
  isOpen,
  mode,
  user,
  buildings,
  onClose,
  onSaved,
}: UserModalProps) {
  const t = useTranslations('admin.users');
  const tRoles = useTranslations('admin.topbar.roles');
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const { user: currentUser } = useAuth();

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('supervision_staff');
  const [isActive, setIsActive] = useState(true);
  const [buildingIds, setBuildingIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isSelf = mode === 'edit' && user && currentUser && user.id === currentUser.id;

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && user) {
      setEmail(user.email || '');
      setFullName(user.full_name);
      setPhone(user.phone || '');
      setRole(user.role);
      setIsActive(user.is_active);
      setBuildingIds(new Set(user.buildings.map((b) => b.id)));
    } else {
      setEmail('');
      setFullName('');
      setPhone('');
      setRole('supervision_staff');
      setIsActive(true);
      setBuildingIds(new Set());
    }
  }, [isOpen, mode, user]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  function toggleBuilding(id: string) {
    setBuildingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function buildingLabel(b: BuildingOption) {
    return isArabic
      ? `${b.city_ar} — ${b.neighborhood_ar}`
      : `${b.city_en} — ${b.neighborhood_en}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (mode === 'invite') {
      if (!email.trim() || !fullName.trim()) return;
    } else if (mode === 'edit') {
      if (!fullName.trim()) return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role,
      };
      if (role !== 'super_admin') {
        payload.building_ids = Array.from(buildingIds);
      } else {
        payload.building_ids = [];
      }

      let res: Response;
      if (mode === 'invite') {
        payload.email = email.trim();
        res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (user) {
        if (isSelf) {
          delete payload.role;
        } else {
          payload.is_active = isActive;
        }
        res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errKey = typeof json.error === 'string' ? json.error : '';
        const map: Record<string, string> = {
          emailExists: t('errors.emailExists'),
          lastSuperAdmin: t('errors.lastSuperAdmin'),
          selfModify: t('errors.selfModify'),
          invalidRole: t('errors.invalidRole'),
          inviteFailed: t('errors.inviteFailed'),
        };
        toast.error(map[errKey] || t('toast.genericError'));
        return;
      }

      if (mode === 'invite') {
        toast.success(t('toast.invited', { email: email.trim() }));
      } else {
        toast.success(t('toast.updated'));
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('User save failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!user || resetting) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
      });
      if (!res.ok) {
        toast.error(t('toast.genericError'));
        return;
      }
      toast.success(t('toast.resetSent'));
    } catch (err) {
      console.error('Reset password failed:', err);
      toast.error(t('toast.genericError'));
    } finally {
      setResetting(false);
    }
  }

  const title = mode === 'invite' ? t('modal.inviteTitle') : t('modal.editTitle');
  const submitLabel =
    mode === 'invite'
      ? submitting
        ? t('modal.sending')
        : t('modal.sendInvite')
      : submitting
      ? t('modal.saving')
      : t('modal.save');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-navy">{title}</h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {isSelf && (
            <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              {t('modal.selfNote')}
            </p>
          )}

          {mode === 'invite' && (
            <Input
              label={t('modal.email')}
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('modal.emailPlaceholder')}
              helperText={t('modal.emailHelper')}
              autoComplete="off"
            />
          )}

          {mode === 'edit' && (
            <Input
              label={t('modal.email')}
              type="email"
              dir="ltr"
              value={email}
              disabled
              readOnly
            />
          )}

          <Input
            label={t('modal.fullName')}
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('modal.fullNamePlaceholder')}
          />

          <PhoneInput
            label={t('modal.phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('modal.phonePlaceholder')}
          />

          <Select
            label={t('modal.role')}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            disabled={!!isSelf}
            options={ROLES.map((r) => ({ value: r, label: tRoles(r) }))}
          />

          {role !== 'super_admin' && (
            <div>
              <label className="block text-sm font-medium text-navy mb-2">
                {t('modal.assignBuildings')}
              </label>
              <p className="text-xs text-gray-500 mb-2">
                {t('modal.assignBuildingsHint')}
              </p>
              <div className="border border-border rounded-xl divide-y divide-gray-100 max-h-56 overflow-y-auto">
                {buildings.length === 0 ? (
                  <p className="text-sm text-gray-500 px-3 py-3">
                    {t('modal.noBuildingsSelected')}
                  </p>
                ) : (
                  buildings.map((b) => (
                    <label
                      key={b.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={buildingIds.has(b.id)}
                        onChange={() => toggleBuilding(b.id)}
                        className="rounded border-gray-300 text-coral focus:ring-coral/50"
                      />
                      <span className="text-sm text-gray-700">
                        {buildingLabel(b)}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {mode === 'edit' && (
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={!!isSelf}
                  className="mt-1 rounded border-gray-300 text-coral focus:ring-coral/50 disabled:opacity-50"
                />
                <span>
                  <span className="block text-sm font-medium text-navy">
                    {t('modal.isActive')}
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {t('modal.isActiveHint')}
                  </span>
                </span>
              </label>
            </div>
          )}

          {mode === 'edit' && user && (
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={resetting}
              className="flex items-center gap-2 text-sm text-coral hover:text-coral/80 disabled:opacity-50"
            >
              <KeyRound size={16} />
              {resetting ? t('modal.sendingReset') : t('modal.sendPasswordReset')}
            </button>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 -mx-6 px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-coral rounded-lg hover:bg-coral/90 disabled:opacity-50"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
