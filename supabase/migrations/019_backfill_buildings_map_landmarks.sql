-- ============================================================================
-- Migration 019: Backfill map_url and landmarks for the 8 seeded buildings
-- ============================================================================
-- The original seed populated buildings rows but did not carry map_url or
-- landmarks from src/data/locations.ts. This migration restores those fields
-- so the public-facing site (Slice 8b) can render the "View on Map" button
-- and "Nearby Places" list under each location card.
--
-- Idempotency: each UPDATE has a WHERE guard that skips rows where the field
-- has already been set (by an admin or a previous run), so re-running this
-- migration never clobbers user-entered data.
-- ============================================================================

BEGIN;

-- 1. khobar-alolaya
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/xEkYrLEVorwnsLzP6?g_st=ic'
WHERE slug = 'khobar-alolaya' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "Restaurants & Cafes", "name_ar": "مطاعم وكافيهات", "distance_en": "Walking distance", "distance_ar": "مسافة مشي"},
  {"name_en": "Services & Shopping", "name_ar": "خدمات وتسوق", "distance_en": "Walking distance", "distance_ar": "مسافة مشي"}
]'::jsonb
WHERE slug = 'khobar-alolaya' AND landmarks = '[]'::jsonb;

-- 2. khobar-alandalus
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/odAYEoTAmu4ha8oe9?g_st=ic'
WHERE slug = 'khobar-alandalus' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "IAU Rakah", "name_ar": "جامعة الإمام عبدالرحمن - الراكة", "distance_en": "10-15 minutes", "distance_ar": "10-15 دقيقة"},
  {"name_en": "Villagio", "name_ar": "فيلاجيو", "distance_en": "3 minutes", "distance_ar": "3 دقائق"},
  {"name_en": "King Fahd Hospital", "name_ar": "مستشفى الملك فهد", "distance_en": "Nearby", "distance_ar": "قريب"},
  {"name_en": "Al-Mana Hospital", "name_ar": "مستشفى المانع", "distance_en": "Nearby", "distance_ar": "قريب"},
  {"name_en": "Sulaiman Al-Habib", "name_ar": "سليمان الحبيب", "distance_en": "Nearby", "distance_ar": "قريب"}
]'::jsonb
WHERE slug = 'khobar-alandalus' AND landmarks = '[]'::jsonb;

-- 3. khobar-alrakah
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/Vis5Dq8qaAwiQx4A8?g_st=ic'
WHERE slug = 'khobar-alrakah' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "IAU", "name_ar": "جامعة الإمام عبدالرحمن", "distance_en": "3 minutes", "distance_ar": "3 دقائق"},
  {"name_en": "Al-Mana College", "name_ar": "كلية المانع", "distance_en": "3 minutes", "distance_ar": "3 دقائق"},
  {"name_en": "Al-Yamamah University", "name_ar": "جامعة اليمامة", "distance_en": "10 minutes", "distance_ar": "10 دقائق"}
]'::jsonb
WHERE slug = 'khobar-alrakah' AND landmarks = '[]'::jsonb;

-- 4. dammam-alaziziah
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/BzvKVyG8oigUbHr87?g_st=ic'
WHERE slug = 'dammam-alaziziah' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "Dareen Mall", "name_ar": "دارين مول", "distance_en": "10 min walk", "distance_ar": "10 دقائق مشي"},
  {"name_en": "IAU Rayyan", "name_ar": "جامعة الإمام عبدالرحمن - الريان", "distance_en": "Nearby", "distance_ar": "قريب"},
  {"name_en": "Al-Ghad College", "name_ar": "كلية الغد", "distance_en": "Nearby", "distance_ar": "قريب"},
  {"name_en": "Dammam Central Hospital", "name_ar": "المستشفى المركزي بالدمام", "distance_en": "Nearby", "distance_ar": "قريب"},
  {"name_en": "Al-Asala & Batterjee", "name_ar": "الأصالة وبترجي", "distance_en": "17 minutes", "distance_ar": "17 دقيقة"}
]'::jsonb
WHERE slug = 'dammam-alaziziah' AND landmarks = '[]'::jsonb;

-- 5. jubail-jalmudah
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/3W6RL75MdUuXzAfn8?g_st=ic'
WHERE slug = 'jubail-jalmudah' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "Grocery Center", "name_ar": "مركز التموينات", "distance_en": "5 min walk", "distance_ar": "5 دقائق مشي"},
  {"name_en": "Colleges & Hospitals", "name_ar": "كليات ومستشفيات", "distance_en": "Nearby", "distance_ar": "قريب"}
]'::jsonb
WHERE slug = 'jubail-jalmudah' AND landmarks = '[]'::jsonb;

-- 6. riyadh-alyarmouk-1
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic'
WHERE slug = 'riyadh-alyarmouk-1' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "Metro Station", "name_ar": "محطة الميترو", "distance_en": "8 minutes", "distance_ar": "8 دقائق"},
  {"name_en": "Riyadh Park Mall", "name_ar": "الرياض بارك مول", "distance_en": "10 minutes", "distance_ar": "10 دقائق"}
]'::jsonb
WHERE slug = 'riyadh-alyarmouk-1' AND landmarks = '[]'::jsonb;

-- 7. riyadh-alyarmouk-2
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic'
WHERE slug = 'riyadh-alyarmouk-2' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "Metro Station", "name_ar": "محطة الميترو", "distance_en": "8 minutes", "distance_ar": "8 دقائق"},
  {"name_en": "Riyadh Park Mall", "name_ar": "الرياض بارك مول", "distance_en": "10 minutes", "distance_ar": "10 دقائق"}
]'::jsonb
WHERE slug = 'riyadh-alyarmouk-2' AND landmarks = '[]'::jsonb;

-- 8. riyadh-alaridh
UPDATE public.buildings
SET map_url = 'https://maps.app.goo.gl/a28rhz9mh7RENndr6?g_st=ic'
WHERE slug = 'riyadh-alaridh' AND map_url IS NULL;

UPDATE public.buildings
SET landmarks = '[
  {"name_en": "SAB Metro Station", "name_ar": "محطة ميترو ساب", "distance_en": "10 minutes", "distance_ar": "10 دقائق"},
  {"name_en": "Princess Nourah University", "name_ar": "جامعة الأميرة نورة", "distance_en": "15 minutes", "distance_ar": "15 دقيقة"},
  {"name_en": "Dallah Hospital (Al-Aridh)", "name_ar": "مستشفى دلة (العارض)", "distance_en": "3 minutes", "distance_ar": "3 دقائق"},
  {"name_en": "Al-Habib Clinics (Al-Narjis)", "name_ar": "عيادات الحبيب (النرجس)", "distance_en": "5 minutes", "distance_ar": "5 دقائق"}
]'::jsonb
WHERE slug = 'riyadh-alaridh' AND landmarks = '[]'::jsonb;

COMMIT;
