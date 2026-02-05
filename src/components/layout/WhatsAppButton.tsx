'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import WhatsAppRegionModal from '@/components/ui/WhatsAppRegionModal';

export default function WhatsAppButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'fixed bottom-6 end-6 z-50',
          'w-14 h-14 rounded-full',
          'bg-[#25D366] hover:bg-[#128C7E]',
          'shadow-lg shadow-[#25D366]/30 hover:shadow-xl hover:shadow-[#25D366]/40',
          'flex items-center justify-center',
          'transition-all duration-300 hover:scale-110',
          'animate-pulse hover:animate-none'
        )}
        aria-label="Contact via WhatsApp"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </button>

      <WhatsAppRegionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
