'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_STEPS = [
  { status: 'new', department: null },
  { status: 'in_review', department: 'customer_service' },
  { status: 'pending_payment', department: 'finance' },
  { status: 'pending_onboarding', department: 'supervision' },
  { status: 'completed', department: null },
] as const;

const STATUS_TO_STEP_INDEX: Record<string, number> = {
  new: 0,
  in_review: 1,
  pending_payment: 2,
  pending_onboarding: 3,
  completed: 4,
};

interface BookingPipelineStepperProps {
  status: string;
}

export default function BookingPipelineStepper({ status }: BookingPipelineStepperProps) {
  const t = useTranslations('admin.bookings');

  const isTerminal = status === 'rejected' || status === 'cancelled';
  const currentIndex = STATUS_TO_STEP_INDEX[status] ?? -1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      {/* Terminal status banner */}
      {isTerminal && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm font-medium',
          status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
        )}>
          <X size={16} />
          {t(`status.${status}`)}
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center">
        {PIPELINE_STEPS.map((step, i) => {
          const isPast = !isTerminal && currentIndex > i;
          const isCurrent = !isTerminal && currentIndex === i;
          const isFuture = isTerminal || currentIndex < i;

          return (
            <div key={step.status} className="flex items-center flex-1 last:flex-none">
              {/* Step node */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors border-2',
                    isPast && 'bg-green-500 border-green-500 text-white',
                    isCurrent && 'bg-coral border-coral text-white',
                    isFuture && 'bg-white border-gray-300 text-gray-400'
                  )}
                >
                  {isPast ? <Check size={16} /> : i + 1}
                </div>
                <div className="mt-1.5 text-center">
                  <p className={cn(
                    'text-[10px] sm:text-xs font-medium leading-tight',
                    isPast && 'text-green-600',
                    isCurrent && 'text-coral',
                    isFuture && 'text-gray-400'
                  )}>
                    {t(`status.${step.status}`)}
                  </p>
                  {step.department && (
                    <p className="text-[9px] sm:text-[10px] text-gray-400 leading-tight mt-0.5">
                      {t(`pipeline.department.${step.department}`)}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-1 sm:mx-2 mt-[-20px] sm:mt-[-22px]',
                    !isTerminal && currentIndex > i ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Get department label key for a given status */
export function getDepartmentForStatus(status: string): string | null {
  switch (status) {
    case 'in_review': return 'customer_service';
    case 'pending_payment': return 'finance';
    case 'pending_onboarding': return 'supervision';
    default: return null;
  }
}

/** Get the role to filter staff by when handing off to a status */
export function getRoleForHandoff(targetStatus: string): string | null {
  switch (targetStatus) {
    case 'in_review': return 'branch_manager';
    case 'pending_payment': return 'finance_staff';
    case 'pending_onboarding': return 'supervision_staff';
    default: return null;
  }
}
