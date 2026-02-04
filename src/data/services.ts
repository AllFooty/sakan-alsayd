import {
  Shield,
  Sparkles,
  Dumbbell,
  Bus,
  Wrench,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

export interface Service {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
}

export const services: Service[] = [
  {
    id: 'supervision',
    icon: Shield,
    titleKey: 'services.items.supervision.title',
    descriptionKey: 'services.items.supervision.description',
  },
  {
    id: 'cleaning',
    icon: Sparkles,
    titleKey: 'services.items.cleaning.title',
    descriptionKey: 'services.items.cleaning.description',
  },
  {
    id: 'facilities',
    icon: Dumbbell,
    titleKey: 'services.items.facilities.title',
    descriptionKey: 'services.items.facilities.description',
  },
  {
    id: 'transportation',
    icon: Bus,
    titleKey: 'services.items.transportation.title',
    descriptionKey: 'services.items.transportation.description',
  },
  {
    id: 'maintenance',
    icon: Wrench,
    titleKey: 'services.items.maintenance.title',
    descriptionKey: 'services.items.maintenance.description',
  },
  {
    id: 'utilities',
    icon: Wifi,
    titleKey: 'services.items.utilities.title',
    descriptionKey: 'services.items.utilities.description',
  },
];
