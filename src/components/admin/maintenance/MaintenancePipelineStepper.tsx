'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_STEPS = [
  { status: 'submitted' },
  { status: 'assigned' },
  { status: 'in_progress' },
  { status: 'completed' },
] as const;

const STATUS_TO_STEP_INDEX: Record<string, number> = {
  submitted: 0,
  assigned: 1,
  in_progress: 2,
  completed: 3,
};

interface MaintenancePipelineStepperProps {
  status: string;
  cancelledAtStep?: string;
}

export default function MaintenancePipelineStepper({ status, cancelledAtStep }: MaintenancePipelineStepperProps) {
  const t = useTranslations('admin.maintenance');

  const isCancelled = status === 'cancelled';
  const currentIndex = STATUS_TO_STEP_INDEX[status] ?? -1;
  const cancelledIndex = cancelledAtStep ? (STATUS_TO_STEP_INDEX[cancelledAtStep] ?? -1) : -1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      {/* Cancelled banner */}
      {isCancelled && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm font-medium bg-red-50 text-red-700">
          <X size={16} />
          {t('filters.cancelled')}
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center">
        {PIPELINE_STEPS.map((step, i) => {
          let isPast: boolean;
          let isCurrent: boolean;
          let isFuture: boolean;
          let isCancelledStep = false;

          if (isCancelled && cancelledIndex >= 0) {
            // Show progress up to where it was cancelled
            isPast = i < cancelledIndex;
            isCurrent = false;
            isCancelledStep = i === cancelledIndex;
            isFuture = i > cancelledIndex;
          } else if (isCancelled) {
            // No info about where it was cancelled - all gray
            isPast = false;
            isCurrent = false;
            isFuture = true;
          } else {
            isPast = currentIndex > i;
            isCurrent = currentIndex === i;
            isFuture = currentIndex < i;
          }

          return (
            <div key={step.status} className="flex items-center flex-1 last:flex-none">
              {/* Step node */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors border-2',
                    isPast && 'bg-green-500 border-green-500 text-white',
                    isCurrent && 'bg-coral border-coral text-white',
                    isCancelledStep && 'bg-red-500 border-red-500 text-white',
                    isFuture && !isCancelledStep && 'bg-white border-gray-300 text-gray-400'
                  )}
                >
                  {isPast ? <Check size={16} /> : isCancelledStep ? <X size={16} /> : i + 1}
                </div>
                <p className={cn(
                  'mt-1.5 text-[10px] sm:text-xs font-medium leading-tight text-center',
                  isPast && 'text-green-600',
                  isCurrent && 'text-coral',
                  isCancelledStep && 'text-red-600',
                  isFuture && !isCancelledStep && 'text-gray-400'
                )}>
                  {t(`filters.${step.status}`)}
                </p>
              </div>

              {/* Connector line */}
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-1 sm:mx-2 mt-[-20px] sm:mt-[-22px]',
                    (isPast || (isCancelled && cancelledIndex > i)) ? 'bg-green-500' : 'bg-gray-200'
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
