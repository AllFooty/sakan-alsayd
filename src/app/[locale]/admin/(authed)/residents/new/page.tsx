'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/hooks';
import LoadingScreen from '@/components/admin/shared/LoadingScreen';
import ResidentForm from '@/components/admin/residents/ResidentForm';

const CAN_CREATE_ROLES = [
  'super_admin',
  'deputy_general_manager',
  'branch_manager',
  'supervision_staff',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BookingPrefill {
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string;
  university_or_workplace: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

interface BookingApi {
  id: string;
  name: string;
  email: string;
  phone: string;
  date_of_birth: string | null;
  occupation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: string;
  metadata: { resident_id?: string } | null;
}

function NewResidentInner() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const t = useTranslations('admin.residents');

  const fromBookingId = searchParams.get('from_booking');
  const isValidBookingId = !!fromBookingId && UUID_RE.test(fromBookingId);

  const canCreate =
    !!profile && (CAN_CREATE_ROLES as readonly string[]).includes(profile.role);

  const [prefill, setPrefill] = useState<BookingPrefill | null>(null);
  const [bookingLoading, setBookingLoading] = useState(isValidBookingId);
  const [bookingName, setBookingName] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && profile && !canCreate) {
      router.replace(`/${locale}/admin/residents`);
    }
  }, [authLoading, profile, canCreate, router, locale]);

  useEffect(() => {
    if (!isValidBookingId || !canCreate) {
      setBookingLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setBookingLoading(true);
      try {
        const res = await fetch(`/api/booking-requests/${fromBookingId}`);
        if (cancelled) return;
        if (!res.ok) {
          console.warn('Convert: booking fetch failed; falling back to empty form');
          return;
        }
        // The booking GET endpoint returns the row directly, not wrapped
        // in { data }, so cast the response itself.
        const b = (await res.json()) as BookingApi;
        if (b.metadata?.resident_id) {
          // Already linked — bounce to the existing resident.
          router.replace(`/${locale}/admin/residents/${b.metadata.resident_id}`);
          return;
        }
        setBookingName(b.name);
        setPrefill({
          full_name: b.name ?? '',
          phone: b.phone ?? '',
          email: b.email ?? '',
          date_of_birth: b.date_of_birth ?? '',
          university_or_workplace: b.occupation ?? '',
          emergency_contact_name: b.emergency_contact_name ?? '',
          emergency_contact_phone: b.emergency_contact_phone ?? '',
        });
      } catch (err) {
        console.error('Convert: booking fetch threw:', err);
      } finally {
        if (!cancelled) setBookingLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fromBookingId, isValidBookingId, canCreate, locale, router]);

  if (authLoading || !canCreate || bookingLoading) {
    return (
      <div className="space-y-4">
        {bookingLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            {t('fromBooking.loading')}
          </div>
        )}
        {!bookingLoading && <LoadingScreen />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isValidBookingId && prefill && (
        <div className="flex items-start gap-3 rounded-xl border border-coral/30 bg-coral/5 p-4">
          <Sparkles size={18} className="text-coral mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-navy">
              {t('fromBooking.bannerTitle')}
            </p>
            <p className="text-sm text-gray-600 mt-0.5">
              {t('fromBooking.bannerDescription', {
                name: bookingName ?? '—',
              })}
            </p>
          </div>
        </div>
      )}
      <ResidentForm
        mode="create"
        prefill={prefill ?? undefined}
        fromBookingId={isValidBookingId ? fromBookingId : undefined}
      />
    </div>
  );
}

export default function NewResidentPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <NewResidentInner />
    </Suspense>
  );
}
