export interface Contact {
  id: string;
  type: string;
  typeAr: string;
  phone: string;
  whatsapp?: string;
}

export const contacts: Contact[] = [
  {
    id: 'customer-service-riyadh',
    type: 'Customer Service - Riyadh',
    typeAr: 'خدمة العملاء - فروع الرياض',
    phone: '0539988872',
    whatsapp: '966539988872',
  },
  {
    id: 'customer-service-eastern',
    type: 'Customer Service - Eastern',
    typeAr: 'خدمة العملاء - فروع الشرقية',
    phone: '0541188896',
    whatsapp: '966541188896',
  },
  {
    id: 'transportation-eastern',
    type: 'Transportation - Eastern',
    typeAr: 'مسؤول المواصلات - فروع الشرقية',
    phone: '0538470669',
    whatsapp: '966538470669',
  },
  {
    id: 'transportation-riyadh',
    type: 'Transportation - Riyadh',
    typeAr: 'مسؤول المواصلات - فروع الرياض',
    phone: '0508762027',
    whatsapp: '966508762027',
  },
  {
    id: 'supervision',
    type: 'Supervision Manager',
    typeAr: 'مديرة قسم الإشراف - جميع الفروع',
    phone: '0536006124',
    whatsapp: '966536006124',
  },
  {
    id: 'finance',
    type: 'Finance Manager',
    typeAr: 'مدير قسم المالية',
    phone: '0539439945',
    whatsapp: '966539439945',
  },
  {
    id: 'mini-market',
    type: 'Mini Market Manager',
    typeAr: 'مسؤول الميني ماركت',
    phone: '0501466301',
    whatsapp: '966501466301',
  },
  {
    id: 'maintenance',
    type: 'Maintenance Manager',
    typeAr: 'مدير قسم الصيانة',
    phone: '0530800310',
    whatsapp: '966530800310',
  },
];

export const socialMedia = {
  instagram: 'sakanalsayd',
  twitter: 'sakanalsayed',
  tiktok: 'sakanalsayed',
};

export const bankInfo = {
  bankName: 'Al Rajhi Bank',
  bankNameAr: 'بنك الراجحي',
  accountName: 'Ali Ibrahim Mohammed Al-Hassan Real Estate Development & Investment Office',
  accountNameAr: 'مكتب علي إبراهيم محمد الحسن للتطوير والاستثمار العقاري',
  iban: 'SA0280000300608016100965',
  accountNumber: '300000010006086100965',
};
