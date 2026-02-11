export interface NearbyLandmark {
  id: string;
  name: string;
  nameAr: string;
  distance: string;
  distanceAr: string;
}

export interface RoomPrice {
  type: 'single' | 'double' | 'triple' | 'suite';
  bathroomType: 'shared' | 'shared-a' | 'shared-b' | 'shared-balcony' | 'private' | 'private-balcony' | 'private-two-rooms' | 'master' | 'master-a' | 'master-b' | 'master-balcony' | 'suite';
  monthlyPrice: number;
  discountedPrice: number;
}

export interface Location {
  id: string;
  city: string;
  cityAr: string;
  neighborhood: string;
  neighborhoodAr: string;
  description: string;
  descriptionAr: string;
  image: string;
  nearbyLandmarks: NearbyLandmark[];
  roomPrices: RoomPrice[];
  isPlaceholder: boolean;
}

export const locations: Location[] = [
  // الخبر - Khobar
  {
    id: 'khobar-alolaya',
    city: 'Khobar',
    cityAr: 'الخبر',
    neighborhood: 'Al-Olaya',
    neighborhoodAr: 'العليا',
    description: 'Located in Al-Olaya neighborhood in Khobar, a prime location near business centers.',
    descriptionAr: 'حي العليا الراقي بالخبر - موقع استراتيجي آمن قريب من مراكز الأعمال والخدمات. منطقة محافظة مناسبة للعوائل والطالبات.',
    image: '/images/locations/khobar-alolaya.jpg',
    nearbyLandmarks: [
      { id: 'corniche', name: 'Khobar Corniche', nameAr: 'كورنيش الخبر', distance: '5 minutes', distanceAr: '5 دقائق' },
      { id: 'mall', name: 'Al-Rashid Mall', nameAr: 'الراشد مول', distance: '5 minutes', distanceAr: '5 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1750, discountedPrice: 1500 },
      { type: 'double', bathroomType: 'shared', monthlyPrice: 2450, discountedPrice: 2100 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2600, discountedPrice: 2250 },
      { type: 'single', bathroomType: 'shared', monthlyPrice: 3950, discountedPrice: 3450 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 4150, discountedPrice: 3650 },
    ],
    isPlaceholder: false,
  },
  {
    id: 'khobar-alandalus',
    city: 'Khobar',
    cityAr: 'الخبر',
    neighborhood: 'Al-Andalus',
    neighborhoodAr: 'الأندلس',
    description: 'Located in Al-Andalus neighborhood in Khobar, a quiet residential area with all amenities.',
    descriptionAr: 'حي الأندلس بالخبر - منطقة سكنية هادئة وآمنة جداً، مشهورة بالهدوء والخصوصية. موقع مثالي للتركيز على الدراسة مع جميع الخدمات القريبة.',
    image: '/images/locations/khobar-alandalus.jpg',
    nearbyLandmarks: [
      { id: 'corniche', name: 'Khobar Corniche', nameAr: 'كورنيش الخبر', distance: '15 minutes', distanceAr: '15 دقيقة' },
      { id: 'mall', name: 'Dhahran Mall', nameAr: 'الظهران مول', distance: '10 minutes', distanceAr: '10 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1750, discountedPrice: 1500 },
      { type: 'double', bathroomType: 'shared-a', monthlyPrice: 2450, discountedPrice: 2100 },
      { type: 'double', bathroomType: 'shared-b', monthlyPrice: 2350, discountedPrice: 2000 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2600, discountedPrice: 2250 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 2818, discountedPrice: 2490 },
      { type: 'single', bathroomType: 'shared-a', monthlyPrice: 3950, discountedPrice: 3450 },
      { type: 'single', bathroomType: 'shared-b', monthlyPrice: 3850, discountedPrice: 3350 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 4150, discountedPrice: 3650 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 4485, discountedPrice: 3900 },
      { type: 'single', bathroomType: 'master-balcony', monthlyPrice: 4600, discountedPrice: 4000 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 5000, discountedPrice: 4400 },
      { type: 'suite', bathroomType: 'private-two-rooms', monthlyPrice: 6000, discountedPrice: 5200 },
    ],
    isPlaceholder: false,
  },
  {
    id: 'khobar-alrakah',
    city: 'Khobar',
    cityAr: 'الخبر',
    neighborhood: 'Al-Rakah',
    neighborhoodAr: 'مجمع الراكة السكني',
    description: 'Located in Al-Rakah Northern neighborhood in Khobar, with easy access to main roads and facilities.',
    descriptionAr: 'حي الراكة بالخبر - منطقة سكنية آمنة وراقية مع وصول سهل للطرق الرئيسية والخدمات. موقع مناسب للطالبات والموظفات.',
    image: '/images/locations/khobar-alrakah.jpg',
    nearbyLandmarks: [
      { id: 'corniche', name: 'Khobar Corniche', nameAr: 'كورنيش الخبر', distance: '10 minutes', distanceAr: '10 دقائق' },
      { id: 'mall', name: 'Al-Rashid Mall', nameAr: 'الراشد مول', distance: '8 minutes', distanceAr: '8 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'suite', monthlyPrice: 1900, discountedPrice: 1650 },
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1750, discountedPrice: 1500 },
      { type: 'double', bathroomType: 'master-a', monthlyPrice: 2818, discountedPrice: 2490 },
      { type: 'double', bathroomType: 'master-b', monthlyPrice: 2700, discountedPrice: 2350 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2600, discountedPrice: 2250 },
      { type: 'single', bathroomType: 'shared-a', monthlyPrice: 3950, discountedPrice: 3450 },
      { type: 'single', bathroomType: 'shared-b', monthlyPrice: 3850, discountedPrice: 3350 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 4485, discountedPrice: 3900 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 5000, discountedPrice: 4400 },
    ],
    isPlaceholder: false,
  },
  // الدمام - Dammam
  {
    id: 'dammam-alaziziah',
    city: 'Dammam',
    cityAr: 'الدمام',
    neighborhood: 'Al-Aziziah',
    neighborhoodAr: 'العزيزية',
    description: 'Located in Al-Aziziah neighborhood in Dammam, a vibrant residential area with excellent facilities.',
    descriptionAr: 'حي العزيزية بالدمام - منطقة سكنية حيوية وآمنة مع مرافق ممتازة. قريبة من جامعة الإمام عبدالرحمن والخدمات التجارية.',
    image: '/images/locations/dammam-alaziziah.jpg',
    nearbyLandmarks: [
      { id: 'mall', name: 'Al-Nuzha Mall', nameAr: 'مول النزهة', distance: '8 minutes', distanceAr: '8 دقائق' },
      { id: 'university', name: 'Imam Abdulrahman University', nameAr: 'جامعة الإمام عبدالرحمن', distance: '10 minutes', distanceAr: '10 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1750, discountedPrice: 1500 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2600, discountedPrice: 2250 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 2818, discountedPrice: 2490 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 4200, discountedPrice: 3650 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 4485, discountedPrice: 3900 },
    ],
    isPlaceholder: false,
  },
  // الجبيل الصناعية - Jubail
  {
    id: 'jubail-jalmudah',
    city: 'Jubail',
    cityAr: 'الجبيل الصناعية',
    neighborhood: 'Industrial Area',
    neighborhoodAr: 'جلمودة',
    description: 'Located in Jubail Industrial City, ideal for working women at the industrial companies and nearby facilities.',
    descriptionAr: 'الجبيل الصناعية - موقع آمن وراقي مثالي للموظفات في الشركات الصناعية. بيئة محافظة مع خدمات متكاملة وقريب من جميع المنشآت.',
    image: '/images/locations/jubail-jalmudah.jpg',
    nearbyLandmarks: [
      { id: 'royal-commission', name: 'Royal Commission', nameAr: 'الهيئة الملكية', distance: '10 minutes', distanceAr: '10 دقائق' },
      { id: 'industrial-college', name: 'Jubail Industrial College', nameAr: 'كلية الجبيل الصناعية', distance: '8 minutes', distanceAr: '8 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1700, discountedPrice: 1450 },
      { type: 'double', bathroomType: 'shared-a', monthlyPrice: 2400, discountedPrice: 2050 },
      { type: 'double', bathroomType: 'shared-b', monthlyPrice: 2300, discountedPrice: 1950 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2550, discountedPrice: 2200 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 2818, discountedPrice: 2490 },
      { type: 'single', bathroomType: 'shared-a', monthlyPrice: 3900, discountedPrice: 3400 },
      { type: 'single', bathroomType: 'shared-b', monthlyPrice: 3800, discountedPrice: 3300 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 4100, discountedPrice: 3600 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 4485, discountedPrice: 3900 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 5000, discountedPrice: 4400 },
      { type: 'suite', bathroomType: 'private-two-rooms', monthlyPrice: 6000, discountedPrice: 5200 },
    ],
    isPlaceholder: false,
  },
  // الرياض - Riyadh
  {
    id: 'riyadh-alyarmouk-1',
    city: 'Riyadh',
    cityAr: 'الرياض',
    neighborhood: 'Al-Yarmouk',
    neighborhoodAr: 'اليرموك ١',
    description: 'Located in Al-Yarmouk neighborhood in Riyadh, a well-established residential area with excellent facilities.',
    descriptionAr: 'حي اليرموك الراقي بالرياض - منطقة سكنية آمنة محافظة مع مرافق ممتازة. موقع استراتيجي قريب من الجامعات والخدمات.',
    image: '/images/locations/riyadh-alyarmouk-1.jpg',
    nearbyLandmarks: [
      { id: 'metro', name: 'Metro Station', nameAr: 'محطة الميترو', distance: '8 minutes', distanceAr: '8 دقائق' },
      { id: 'mall', name: 'Riyadh Park Mall', nameAr: 'الرياض بارك مول', distance: '10 minutes', distanceAr: '10 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 2000, discountedPrice: 1750 },
      { type: 'double', bathroomType: 'shared', monthlyPrice: 2800, discountedPrice: 2450 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2900, discountedPrice: 2550 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 3100, discountedPrice: 2700 },
      { type: 'single', bathroomType: 'shared', monthlyPrice: 4400, discountedPrice: 3850 },
      { type: 'single', bathroomType: 'shared-balcony', monthlyPrice: 4550, discountedPrice: 3950 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 4600, discountedPrice: 4050 },
      { type: 'single', bathroomType: 'private-balcony', monthlyPrice: 4750, discountedPrice: 4150 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 4900, discountedPrice: 4300 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 5500, discountedPrice: 4800 },
    ],
    isPlaceholder: false,
  },
  {
    id: 'riyadh-alyarmouk-2',
    city: 'Riyadh',
    cityAr: 'الرياض',
    neighborhood: 'Al-Yarmouk',
    neighborhoodAr: 'اليرموك ٢',
    description: 'Coming soon - Located in Al-Yarmouk neighborhood in Riyadh, a well-established residential area with excellent facilities.',
    descriptionAr: 'قريباً - حي اليرموك الراقي بالرياض - منطقة سكنية آمنة محافظة مع مرافق ممتازة. موقع استراتيجي قريب من الجامعات والخدمات.',
    image: '/images/locations/placeholder.jpg',
    nearbyLandmarks: [
      { id: 'metro', name: 'Metro Station', nameAr: 'محطة الميترو', distance: '8 minutes', distanceAr: '8 دقائق' },
      { id: 'mall', name: 'Riyadh Park Mall', nameAr: 'الرياض بارك مول', distance: '10 minutes', distanceAr: '10 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 2000, discountedPrice: 1750 },
      { type: 'double', bathroomType: 'shared', monthlyPrice: 2800, discountedPrice: 2450 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2900, discountedPrice: 2550 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 3100, discountedPrice: 2700 },
      { type: 'single', bathroomType: 'shared', monthlyPrice: 4400, discountedPrice: 3850 },
      { type: 'single', bathroomType: 'shared-balcony', monthlyPrice: 4550, discountedPrice: 3950 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 4600, discountedPrice: 4050 },
      { type: 'single', bathroomType: 'private-balcony', monthlyPrice: 4750, discountedPrice: 4150 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 4900, discountedPrice: 4300 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 5500, discountedPrice: 4800 },
    ],
    isPlaceholder: false,
  },
  {
    id: 'riyadh-alaridh',
    city: 'Riyadh',
    cityAr: 'الرياض',
    neighborhood: 'Al-Aridh',
    neighborhoodAr: 'العارض',
    description: 'Located in one of the finest neighborhoods in Riyadh, near King Salman Road and Abu Bakr Al-Siddiq Road.',
    descriptionAr: 'حي العارض الراقي جداً بالرياض - أحد أرقى المناطق السكنية في المملكة. بيئة آمنة محافظة مع خدمات عالية الجودة وقريب من جامعة الأميرة نورة.',
    image: '/images/locations/riyadh-alaridh.jpg',
    nearbyLandmarks: [
      { id: 'metro', name: 'SAB Metro Station', nameAr: 'محطة ميترو ساب', distance: '10 minutes', distanceAr: '10 دقائق' },
      { id: 'pnu', name: 'Princess Nourah University', nameAr: 'جامعة الأميرة نورة', distance: '15 minutes', distanceAr: '15 دقيقة' },
      { id: 'dallah', name: 'Dallah Hospital (Al-Aridh)', nameAr: 'مستشفى دلة (العارض)', distance: '3 minutes', distanceAr: '3 دقائق' },
      { id: 'habib-clinic', name: 'Al-Habib Clinics (Al-Narjis)', nameAr: 'عيادات الحبيب (النرجس)', distance: '5 minutes', distanceAr: '5 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1898, discountedPrice: 1650 },
      { type: 'double', bathroomType: 'shared', monthlyPrice: 2645, discountedPrice: 2290 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 2760, discountedPrice: 2390 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 2818, discountedPrice: 2490 },
      { type: 'single', bathroomType: 'shared', monthlyPrice: 4255, discountedPrice: 3700 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 4485, discountedPrice: 3900 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 4700, discountedPrice: 4100 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 5500, discountedPrice: 4800 },
    ],
    isPlaceholder: false,
  },
];

export function getLocationById(id: string): Location | undefined {
  return locations.find((location) => location.id === id);
}

export function getLocationsByCity(city: string): Location[] {
  return locations.filter((location) => location.city === city || location.cityAr === city);
}

export function getCities(): { name: string; nameAr: string }[] {
  const citySet = new Set<string>();
  const cities: { name: string; nameAr: string }[] = [];

  locations.forEach((location) => {
    if (!citySet.has(location.city)) {
      citySet.add(location.city);
      cities.push({ name: location.city, nameAr: location.cityAr });
    }
  });

  return cities;
}
