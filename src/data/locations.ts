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
  discountedPrice?: number;
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
  mapUrl: string;
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
    description: 'Located in Al-Olaya, the most vibrant neighborhood in Khobar. Walking distance to restaurants, cafes, laundries, and all services.',
    descriptionAr: 'حي العليا - أكثر أحياء الخبر حيوية. على مسافة مشي من المطاعم والكافيهات والمغاسل وجميع الخدمات.',
    image: '/images/locations/khobar-alolaya.jpg',
    mapUrl: 'https://maps.app.goo.gl/xEkYrLEVorwnsLzP6?g_st=ic',
    nearbyLandmarks: [
      { id: 'restaurants', name: 'Restaurants & Cafes', nameAr: 'مطاعم وكافيهات', distance: 'Walking distance', distanceAr: 'مسافة مشي' },
      { id: 'services', name: 'Services & Shopping', nameAr: 'خدمات وتسوق', distance: 'Walking distance', distanceAr: 'مسافة مشي' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1050 },
      { type: 'double', bathroomType: 'shared', monthlyPrice: 1550 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 1699 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 1850 },
      { type: 'single', bathroomType: 'shared', monthlyPrice: 2199 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 2499 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 2899 },
    ],
    isPlaceholder: false,
  },
  {
    id: 'khobar-alandalus',
    city: 'Khobar',
    cityAr: 'الخبر',
    neighborhood: 'Al-Andalus',
    neighborhoodAr: 'الأندلس',
    description: 'Located in Al-Andalus, Khobar. 10-15 min to IAU, 3 min to Villagio, near hospitals. Features pool, sauna, gym, and waiting reception.',
    descriptionAr: 'حي الأندلس بالخبر - 10-15 دقيقة من جامعة الإمام عبدالرحمن، 3 دقائق من فيلاجيو، قريب من المستشفيات. يتميز بمسبح وساونا وصالة رياضية واستقبال انتظار.',
    image: '/images/locations/khobar-alandalus.jpg',
    mapUrl: 'https://maps.app.goo.gl/odAYEoTAmu4ha8oe9?g_st=ic',
    nearbyLandmarks: [
      { id: 'iau', name: 'IAU Rakah', nameAr: 'جامعة الإمام عبدالرحمن - الراكة', distance: '10-15 minutes', distanceAr: '10-15 دقيقة' },
      { id: 'villagio', name: 'Villagio', nameAr: 'فيلاجيو', distance: '3 minutes', distanceAr: '3 دقائق' },
      { id: 'kfh', name: 'King Fahd Hospital', nameAr: 'مستشفى الملك فهد', distance: 'Nearby', distanceAr: 'قريب' },
      { id: 'mana', name: 'Al-Mana Hospital', nameAr: 'مستشفى المانع', distance: 'Nearby', distanceAr: 'قريب' },
      { id: 'habib', name: 'Sulaiman Al-Habib', nameAr: 'سليمان الحبيب', distance: 'Nearby', distanceAr: 'قريب' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1050 },
      { type: 'triple', bathroomType: 'private-balcony', monthlyPrice: 1200 },
      { type: 'double', bathroomType: 'shared', monthlyPrice: 1550 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 1699 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 1850 },
      { type: 'single', bathroomType: 'shared-b', monthlyPrice: 1999 },
      { type: 'single', bathroomType: 'shared-a', monthlyPrice: 2299 },
      { type: 'single', bathroomType: 'shared-balcony', monthlyPrice: 2499 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 2900 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 3050 },
      { type: 'single', bathroomType: 'master-balcony', monthlyPrice: 3250 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 3400 },
      { type: 'suite', bathroomType: 'private-two-rooms', monthlyPrice: 3999 },
    ],
    isPlaceholder: false,
  },
  {
    id: 'khobar-alrakah',
    city: 'Khobar',
    cityAr: 'الخبر',
    neighborhood: 'Al-Rakah',
    neighborhoodAr: 'مجمع الراكة السكني',
    description: 'Located in Al-Rakah, Khobar. 3 min to IAU, 3 min to Al-Mana College, 10 min to Al-Yamamah University. Quiet residential neighborhood.',
    descriptionAr: 'حي الراكة بالخبر - 3 دقائق من جامعة الإمام عبدالرحمن، 3 دقائق من كلية المانع، 10 دقائق من جامعة اليمامة. حي سكني هادئ.',
    image: '/images/locations/khobar-alrakah.jpg',
    mapUrl: 'https://maps.app.goo.gl/Vis5Dq8qaAwiQx4A8?g_st=ic',
    nearbyLandmarks: [
      { id: 'iau', name: 'IAU', nameAr: 'جامعة الإمام عبدالرحمن', distance: '3 minutes', distanceAr: '3 دقائق' },
      { id: 'mana-college', name: 'Al-Mana College', nameAr: 'كلية المانع', distance: '3 minutes', distanceAr: '3 دقائق' },
      { id: 'yamamah', name: 'Al-Yamamah University', nameAr: 'جامعة اليمامة', distance: '10 minutes', distanceAr: '10 دقائق' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1050 },
      { type: 'triple', bathroomType: 'suite', monthlyPrice: 1200 },
      { type: 'double', bathroomType: 'shared-b', monthlyPrice: 1350 },
      { type: 'double', bathroomType: 'shared-a', monthlyPrice: 1550 },
      { type: 'double', bathroomType: 'master-b', monthlyPrice: 1599 },
      { type: 'double', bathroomType: 'master-a', monthlyPrice: 1700 },
      { type: 'double', bathroomType: 'suite', monthlyPrice: 2199 },
      { type: 'single', bathroomType: 'shared-b', monthlyPrice: 1999 },
      { type: 'single', bathroomType: 'shared-a', monthlyPrice: 2499 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 2899 },
      { type: 'suite', bathroomType: 'private', monthlyPrice: 3400 },
    ],
    isPlaceholder: false,
  },
  // الدمام - Dammam
  {
    id: 'dammam-alaziziah',
    city: 'Dammam',
    cityAr: 'الدمام',
    neighborhood: 'Al-Safa',
    neighborhoodAr: 'الصفا',
    description: 'Located in Al-Safa district, Dammam. 10 min walk to Dareen Mall. Near IAU Rayyan, Al-Ghad College, and Dammam Central Hospital.',
    descriptionAr: 'حي الصفا بالدمام - 10 دقائق مشي إلى دارين مول. قريب من جامعة الإمام عبدالرحمن فرع الريان وكلية الغد والمستشفى المركزي بالدمام.',
    image: '/images/locations/dammam-alaziziah.jpg',
    mapUrl: 'https://maps.app.goo.gl/BzvKVyG8oigUbHr87?g_st=ic',
    nearbyLandmarks: [
      { id: 'dareen', name: 'Dareen Mall', nameAr: 'دارين مول', distance: '10 min walk', distanceAr: '10 دقائق مشي' },
      { id: 'iau-rayyan', name: 'IAU Rayyan', nameAr: 'جامعة الإمام عبدالرحمن - الريان', distance: 'Nearby', distanceAr: 'قريب' },
      { id: 'ghad', name: 'Al-Ghad College', nameAr: 'كلية الغد', distance: 'Nearby', distanceAr: 'قريب' },
      { id: 'central-hospital', name: 'Dammam Central Hospital', nameAr: 'المستشفى المركزي بالدمام', distance: 'Nearby', distanceAr: 'قريب' },
      { id: 'asala', name: 'Al-Asala & Batterjee', nameAr: 'الأصالة وبترجي', distance: '17 minutes', distanceAr: '17 دقيقة' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1050 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 1699 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 1850 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 2499 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 2699 },
    ],
    isPlaceholder: false,
  },
  // الجبيل الصناعية - Jubail
  {
    id: 'jubail-jalmudah',
    city: 'Jubail',
    cityAr: 'الجبيل الصناعية',
    neighborhood: 'Jalmudah',
    neighborhoodAr: 'جلمودة',
    description: 'Located in Jalmudah district, Jubail. 5 min walk to grocery center. Serves nearby colleges and hospitals.',
    descriptionAr: 'حي جلمودة بالجبيل الصناعية - 5 دقائق مشي إلى مركز التموينات. يخدم الكليات والمستشفيات القريبة.',
    image: '/images/locations/jubail-jalmudah.jpg',
    mapUrl: 'https://maps.app.goo.gl/3W6RL75MdUuXzAfn8?g_st=ic',
    nearbyLandmarks: [
      { id: 'grocery', name: 'Grocery Center', nameAr: 'مركز التموينات', distance: '5 min walk', distanceAr: '5 دقائق مشي' },
      { id: 'colleges', name: 'Colleges & Hospitals', nameAr: 'كليات ومستشفيات', distance: 'Nearby', distanceAr: 'قريب' },
    ],
    roomPrices: [
      { type: 'triple', bathroomType: 'private', monthlyPrice: 1050 },
      { type: 'double', bathroomType: 'shared', monthlyPrice: 1550 },
      { type: 'double', bathroomType: 'private', monthlyPrice: 1699 },
      { type: 'double', bathroomType: 'master', monthlyPrice: 1850 },
      { type: 'single', bathroomType: 'shared', monthlyPrice: 1999 },
      { type: 'single', bathroomType: 'private', monthlyPrice: 2499 },
      { type: 'single', bathroomType: 'master', monthlyPrice: 2899 },
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
    mapUrl: 'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic',
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
    mapUrl: 'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic',
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
    mapUrl: 'https://maps.app.goo.gl/a28rhz9mh7RENndr6?g_st=ic',
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
      { type: 'single', bathroomType: 'master', monthlyPrice: 4700, discountedPrice: 3950 },
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
