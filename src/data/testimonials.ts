// Base interface for common fields
export interface BaseTestimonial {
  id: string;
  createdAt: string;
  featured?: boolean;
}

// Quote testimonial (text-based reviews)
export interface QuoteTestimonial extends BaseTestimonial {
  type: 'quote';
  name: string;
  nameAr: string;
  building: string;
  buildingAr: string;
  city: string;
  cityAr: string;
  quote: string;
  quoteAr: string;
  rating: number;
  image: string;
}

// Screenshot testimonial (Google Maps, social media, etc.)
export interface ScreenshotTestimonial extends BaseTestimonial {
  type: 'screenshot';
  source: 'google_maps' | 'twitter' | 'instagram' | 'whatsapp' | 'other';
  sourceLabel: string;
  sourceLabelAr: string;
  imageUrl: string;
  alt: string;
  altAr: string;
}

// Video testimonial (YouTube embeds)
export interface VideoTestimonial extends BaseTestimonial {
  type: 'video';
  title: string;
  titleAr: string;
  thumbnailUrl: string;
  youtubeId: string;
  duration?: string;
  name?: string;
  nameAr?: string;
}

// Union type for all testimonials
export type Testimonial = QuoteTestimonial | ScreenshotTestimonial | VideoTestimonial;

// Quote testimonials (existing data with type added)
export const quoteTestimonials: QuoteTestimonial[] = [
  {
    id: 'q1',
    type: 'quote',
    name: 'Lama',
    nameAr: 'لمى',
    building: 'Al-Ulya - A',
    buildingAr: 'العليا - أ',
    city: 'Riyadh',
    cityAr: 'الرياض',
    quote: 'Living at Sakan Alsayd has been the best experience of my life! The attention to detail is incredible - clean, new furniture, personal iron and table, private fridge and desk. What truly sets it apart is the management and supervisors who treat you like family. The free transportation to mall, library, and supermarket four times weekly is amazing, plus metro rides for just 5 riyals. The study rooms are quiet and peaceful, perfect for exam preparation. After experiencing other housing options in Riyadh, I can confidently say Sakan Alsayd has changed the concept of women\'s housing. If I work in Riyadh again, I won\'t consider anywhere else.',
    quoteAr: 'السلام عليكم،اللي يقيم سكن السيد ويقرا التعليقات، يكون فخووور في هذا المكان ومعرفته لهذي الناس الطيبة❤️,هذي تجربتي الشخصية كشخص لاول مره اجي الرياض،سكنت في سكن قبل هذا، فعندي تجربة مع السكن النسائي و نفس المشاكل المتكرره (النت مايشتغل،بعد ما تستاجرين معد يستجيبون،الاغراض معدومه وكل شيء زفت) بعدين جيت سكن السيد،سكنت في غرفة مفرد،عمومًا كانت احلى تجربة بالحياة! بدون مبالغة.مافي ولاشيء يكذبون فيه عليك او يعشمونك وبعد التاجير يماطلون فيه،مميزات الغرفة،نظيفة والاثاث جديد وكل شيء مرتب، لك مكواة وطاولة خاصه فيك بحيث ما تتبهذلين في المكواة المشتركة ويمكن ماتلاقينها مكانها، عندك ثلاجة خاصة غير الثلاجة الخارجية ، عندك مكتب خاص تذاكرين فيه، وتلفزيون خاص ، الشقه نظيفة جدا (بالمعنى الحرفي) فيه عاملات يوميا يجون يشيلون كل الزبايل فمافي اي تراكمات + يشيكون على المطبخ اذا فيه مواعين متراكمه المشرفة تتواصل مع البنات،متخيلين انه المطبخ طوال الوقت مغسل؟والبنات ينظفون مواعينهم اول باول؟ ترا هذا الشيء مو موجود باي سكن ثاني،المواعين تتراكم لين المطبخ ينفجر، فيه ٧ او ٥ بنات معاك بالشقه ماتحسين فيهم ابدًا، السبب الاول انه مافي صالة في الشقه اصلاً، واذا تتوقعين انها نقطة سيئه ف لا، بلعكس ايجابية جدا، قد جربت الصاله في الشقه في سكن قديم . كمية فوضى وازعاج وتجمعات وكل وحدة تجيب صديقاتها مابتقدرين تنامين ولا تجلسين برواق، الشقه هدوء مع ان عددنا كبير ، اذا وحدة تبغا صالة او تذاكر تنزل تحت فيه صالة كبيره وغرفة مذاكره هاديةجدًا ، بحيث ما ننزعج احنا فوق . فكرة رهيبة، تحت فيه نادي مجاني و ميني ماركت بالبصمه وتحاسبين بنفسك ، ويجيبون دايما اكل من اسر منتجة طبخ بيت لذيذ، وفيه رحلات مجانية اسبوعيا ٤ مرات ، يودونك مكتبه صيدليه وسوبر ماركت وابو خمسة وكمان اي مكان حلو مرات مول مرات بوليفارد مرات مجمعات تتقهوين فيها،مره الرحلات حلوه ومجانية وتجلسين بالمكان تقريبا٣ ساعات ، وعندهم رحلات يوميا صباح ومساء معاد الويكند للمترو ب٥ ريال، يعني ما بتحتاجين اوبر عشان تروحين دوامك ، وعندهم رحلات للشرقية كل ويكند وفيه مشرفه تحت تداوم يوميا لو احتجتي شيء.انا اشوفه مكان متكامل ومو بس متكامل ،لا ، مكان اللي واقفين عليه ناس واعية و محترمه تخلق لك تجربة رهيبه ، غيروا مفهوم السكن النسائي! ، اخيرًا شفت سكن بهذا الرقي ، اذا جربتي سكن السيد وتتوقعين انك بتلاقين سكن شبيه لمواصفاته ف ابغاك ترتاحين انتي الان في احسن المواصفات ، على الاقل سكن السيد ناس تخاف الله فعلًا وواقفين على الشغل ومهتمين لتطوير كل شيء . انا كنت سعيده بالتجربة جدًا ولو رجعت اشتغل بالرياض مابفكر في غيرهم ابدًا',
    rating: 5,
    image: '',
    createdAt: '2025-01-20',
    featured: true,
  },
  {
    id: 'q2',
    type: 'quote',
    name: 'M M',
    nameAr: 'إم إم',
    building: 'Al-Aridh - A',
    buildingAr: 'العارض - أ',
    city: 'Riyadh',
    cityAr: 'الرياض',
    quote: 'The location is excellent - close to everything including metro, restaurants, and supermarkets. The staff is incredibly cooperative and helpful, and the supervisors are respectful and professional. Security is top-notch with fingerprint access and cameras throughout. The complimentary transportation to mall, library, and supermarket is a wonderful service. Everyone here treats you with respect and works together seamlessly. Overall, an excellent experience in a clean, new facility where everyone is respectful and cooperative.',
    quoteAr: 'بما إنِ أقمت في السكن بقول تجربتي بالايجابيات والسلبيات بكل أمانة. الايجابيات: ١-السكن موقعه قريب من كل شي سواءً مطاعم أو بقالات أو حتى محطة المترو اللي عند اطياف مول بس تحتاجين سواق لان المسافة ٨ دقايق بالسيارة ، السكن جنبه بالضبط بقالات ومغسلة ٢- التعامل: جداً جداً جداً متعاونين وخدومين والمشرفاات محترمات جداً وأخلاااق، والإدارة والتواصل وخدمة العملاء ماقصروا الله يعطيهم العافية متعاونين ومرنين بكل حاجة الله يجزاهم خير. الأمان: السكن آمن والباب الخارجي كل وحدة لها بصمة مايفتح إلا ببصمتك وفيه كاميرات، وكاميرات داخلية على كل ممر ودور، والساكنات لطيفاات مره. الخدمة: خدومين وموفرين سواق يودي مجاناً للمول او للمكتبة او سوبر ماركت.. فكرة جميلة مشكورين عليها. السلبيات: الدور الأرضي مزعج بسبب الأصوات اللي برا إذا فتحت الشباك ازعاج السيارات وغيره، وبرضو مااقدر افتح الشباك بالارضي عشان اللي برا، مااعرف اذا الشباك عاكس او لا بس يفضل تركيب عاكس الرؤية، بس موجود ستارة، الادوار اللي فوق اشوفها افضل. المطبخ فيه أغراض للساكنات اللي قبل ياليت يتم التخلص منها والتأكد من انه يوجد فقط أغراض الموجودات لأن اشوف اغراض موجودة ماتحركت من زمان وماخذه مكان. تجربتي بشكل عام ممتازه والسكن نظيف وجديد وكل الموجودين محترمين ومتعاونين',
    rating: 5,
    image: '',
    createdAt: '2025-01-25',
    featured: true,
  },
  {
    id: 'q3',
    type: 'quote',
    name: 'Zahra Mansour',
    nameAr: 'زهرة منصور',
    building: 'Al-Aridh - B',
    buildingAr: 'العارض - ب',
    city: 'Riyadh',
    cityAr: 'الرياض',
    quote: 'One of the best experiences since I started my life away from home. The treatment and respect here is unparalleled - they genuinely care about ensuring you get what you deserve and work with you every step of the way. Beyond the security and cleanliness, there\'s a worker who comes to clean your bathroom and room. The transportation to supermarket, pharmacy, and malls is fantastic, and the officials treat you with the utmost respect like you\'re their own daughter and sister. After years of struggling with poor housing options in Riyadh, I finally found the best. You won\'t find anything like Sakan Alsayd. May God bless them abundantly.',
    quoteAr: 'من افضل التجارب من بديت حياتي بالغربه مالقيت ارقى من تعاملهم واحترامهم وكيف يهتمون انه ينصفون حقك ويتعاونون معاك لاخر لحظه لك بالسكن غير الامان المتوفر ونطافه المكان والعامله تجي لين عندك تنظف الحمام والشقه وغير المواصلات المتوفره للسوبرماركت والصيدليه والمولات وتعامل المسؤولات بقمه الاحترام يعاملونك كأنك بنتهم واختهم حمدالله الي ربي خلاني اجرب هالتجربه بعد ماعانيت سنين مع سكنات الرياض السيئه بس مثل هالسكن مراح تلقون الله يبارك برزقهم',
    rating: 5,
    image: '',
    createdAt: '2025-02-01',
    featured: true,
  },
];

// Screenshot testimonials (Google Maps reviews, social media, etc.)
export const screenshotTestimonials: ScreenshotTestimonial[] = [
  {
    id: 's1',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-1.jpg',
    alt: '5-star Google Maps review from a satisfied resident',
    altAr: 'تقييم 5 نجوم على خرائط جوجل من ساكنة راضية',
    createdAt: '2024-05-01',
    featured: true,
  },
  {
    id: 's2',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-2.png',
    alt: '5-star Google Maps review from همس همسة praising cleanliness and staff',
    altAr: 'تقييم 5 نجوم من همس همسة يشيد بالنظافة والموظفين',
    createdAt: '2024-12-01',
    featured: true,
  },
  {
    id: 's3',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-3.png',
    alt: '5-star Google Maps review from Razan praising location, facilities and supervisor',
    altAr: 'تقييم 5 نجوم من رزان يشيد بالموقع والمرافق والمشرفة',
    createdAt: '2024-09-01',
    featured: true,
  },
  {
    id: 's4',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-4.jpg',
    alt: '5-star Google Maps review from Moqdad Sam6 praising cleanliness, transportation and weekly trips',
    altAr: 'تقييم 5 نجوم من مقداد سام6 يشيد بالنظافة والمواصلات والرحلات الأسبوعية',
    createdAt: '2024-09-01',
    featured: true,
  },
  {
    id: 's5',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-5.jpg',
    alt: '5-star Google Maps review from Salwa Al Zahrani praising building, 24hr service and staff',
    altAr: 'تقييم 5 نجوم من سلوى الزهراني يشيد بالمبنى والخدمة على مدار الساعة والموظفين',
    createdAt: '2024-09-01',
    featured: true,
  },
  {
    id: 's6',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-6.jpg',
    alt: '5-star Google Maps review from Ftoom A praising facilities, security, study rooms and supervisors',
    altAr: 'تقييم 5 نجوم من فطوم يشيد بالمرافق والأمان وغرف المذاكرة والمشرفات',
    createdAt: '2024-11-01',
    featured: true,
  },
  {
    id: 's7',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-7.jpg',
    alt: '5-star Google Maps review from Manal Saleh praising safety, cleanliness and supervisor Tahani',
    altAr: 'تقييم 5 نجوم من منال صالح يشيد بالأمان والنظافة والمشرفة تهاني',
    createdAt: '2024-09-01',
    featured: true,
  },
  {
    id: 's8',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-8.jpg',
    alt: '5-star Google Maps review from Za praising it as best women housing with excellent supervisor service',
    altAr: 'تقييم 5 نجوم من زا يشيد بأنه أفضل سكن نسائي مع خدمة مشرفين ممتازة',
    createdAt: '2024-10-01',
    featured: true,
  },
  {
    id: 's9',
    type: 'screenshot',
    source: 'google_maps',
    sourceLabel: 'Google Maps',
    sourceLabelAr: 'خرائط جوجل',
    imageUrl: '/images/testimonials/screenshots/google-review-9.jpg',
    alt: '4-star Google Maps review from Maryam praising facilities, gym and regular cleaning',
    altAr: 'تقييم 4 نجوم من مريم يشيد بالمرافق والجيم والتنظيف الدوري',
    createdAt: '2025-01-01',
    featured: false,
  },
];

// Video testimonials (YouTube embeds)
export const videoTestimonials: VideoTestimonial[] = [
  // Add your video testimonials here
  // Example:
  // {
  //   id: 'v1',
  //   type: 'video',
  //   title: 'My Experience at Sakan Alsayd',
  //   titleAr: 'تجربتي في سكن السيد',
  //   thumbnailUrl: '/images/testimonials/videos/video-thumb-1.jpg',
  //   youtubeId: 'your-youtube-id',
  //   duration: '2:30',
  //   name: 'Hana Al-Mutairi',
  //   nameAr: 'هنا المطيري',
  //   createdAt: '2024-06-01',
  // },
];

// Combined array of all testimonials sorted by date (newest first)
export const allTestimonials: Testimonial[] = [
  ...quoteTestimonials,
  ...screenshotTestimonials,
  ...videoTestimonials,
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

// Get featured quote testimonials for landing page
export const getFeaturedTestimonials = (count: number = 3): QuoteTestimonial[] => {
  return quoteTestimonials
    .filter(t => t.featured)
    .slice(0, count);
};

// Get testimonials by type
export const getTestimonialsByType = <T extends Testimonial['type']>(
  type: T
): Extract<Testimonial, { type: T }>[] => {
  return allTestimonials.filter((t): t is Extract<Testimonial, { type: T }> => t.type === type);
};

// Legacy export for backwards compatibility (will be removed)
export const testimonials = quoteTestimonials;
