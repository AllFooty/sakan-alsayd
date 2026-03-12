-- ============================================================================
-- Sakan Alsayd Platform - Seed Data
-- ============================================================================
-- Inserts all buildings and room types from the existing locations.ts file.
-- Buildings use deterministic UUIDs so rooms can reference them.
-- ============================================================================

-- ============================================================================
-- BUILDINGS
-- ============================================================================

INSERT INTO buildings (id, slug, city_en, city_ar, neighborhood_en, neighborhood_ar, description_en, description_ar, cover_image, map_url, landmarks, is_active, is_placeholder, sort_order)
VALUES
  -- 1. Khobar - Al-Olaya
  (
    '00000000-0000-0000-0000-000000000001',
    'khobar-alolaya',
    'Khobar', E'\u0627\u0644\u062E\u0628\u0631',
    'Al-Olaya', E'\u0627\u0644\u0639\u0644\u064A\u0627',
    'Located in Al-Olaya, the most vibrant neighborhood in Khobar. Walking distance to restaurants, cafes, laundries, and all services.',
    E'\u062D\u064A \u0627\u0644\u0639\u0644\u064A\u0627 - \u0623\u0643\u062B\u0631 \u0623\u062D\u064A\u0627\u0621 \u0627\u0644\u062E\u0628\u0631 \u062D\u064A\u0648\u064A\u0629. \u0639\u0644\u0649 \u0645\u0633\u0627\u0641\u0629 \u0645\u0634\u064A \u0645\u0646 \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0648\u0627\u0644\u0643\u0627\u0641\u064A\u0647\u0627\u062A \u0648\u0627\u0644\u0645\u063A\u0627\u0633\u0644 \u0648\u062C\u0645\u064A\u0639 \u0627\u0644\u062E\u062F\u0645\u0627\u062A.',
    NULL,
    'https://maps.app.goo.gl/xEkYrLEVorwnsLzP6?g_st=ic',
    '[{"name_en": "Restaurants & Cafes", "name_ar": "\u0645\u0637\u0627\u0639\u0645 \u0648\u0643\u0627\u0641\u064A\u0647\u0627\u062A", "distance_en": "Walking distance", "distance_ar": "\u0645\u0633\u0627\u0641\u0629 \u0645\u0634\u064A"}, {"name_en": "Services & Shopping", "name_ar": "\u062E\u062F\u0645\u0627\u062A \u0648\u062A\u0633\u0648\u0642", "distance_en": "Walking distance", "distance_ar": "\u0645\u0633\u0627\u0641\u0629 \u0645\u0634\u064A"}]'::jsonb,
    true, false, 1
  ),

  -- 2. Khobar - Al-Andalus
  (
    '00000000-0000-0000-0000-000000000002',
    'khobar-alandalus',
    'Khobar', E'\u0627\u0644\u062E\u0628\u0631',
    'Al-Andalus', E'\u0627\u0644\u0623\u0646\u062F\u0644\u0633',
    'Located in Al-Andalus, Khobar. 10-15 min to IAU, 3 min to Villagio, near hospitals. Features pool, sauna, gym, and waiting reception.',
    E'\u062D\u064A \u0627\u0644\u0623\u0646\u062F\u0644\u0633 \u0628\u0627\u0644\u062E\u0628\u0631 - 10-15 \u062F\u0642\u064A\u0642\u0629 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646\u060C 3 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u0641\u064A\u0644\u0627\u062C\u064A\u0648\u060C \u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u0634\u0641\u064A\u0627\u062A. \u064A\u062A\u0645\u064A\u0632 \u0628\u0645\u0633\u0628\u062D \u0648\u0633\u0627\u0648\u0646\u0627 \u0648\u0635\u0627\u0644\u0629 \u0631\u064A\u0627\u0636\u064A\u0629 \u0648\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0646\u062A\u0638\u0627\u0631.',
    NULL,
    'https://maps.app.goo.gl/odAYEoTAmu4ha8oe9?g_st=ic',
    '[{"name_en": "IAU Rakah", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 - \u0627\u0644\u0631\u0627\u0643\u0629", "distance_en": "10-15 minutes", "distance_ar": "10-15 \u062F\u0642\u064A\u0642\u0629"}, {"name_en": "Villagio", "name_ar": "\u0641\u064A\u0644\u0627\u062C\u064A\u0648", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "King Fahd Hospital", "name_ar": "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Al-Mana Hospital", "name_ar": "\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0627\u0646\u0639", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Sulaiman Al-Habib", "name_ar": "\u0633\u0644\u064A\u0645\u0627\u0646 \u0627\u0644\u062D\u0628\u064A\u0628", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}]'::jsonb,
    true, false, 2
  ),

  -- 3. Khobar - Al-Rakah
  (
    '00000000-0000-0000-0000-000000000003',
    'khobar-alrakah',
    'Khobar', E'\u0627\u0644\u062E\u0628\u0631',
    'Al-Rakah', E'\u0645\u062C\u0645\u0639 \u0627\u0644\u0631\u0627\u0643\u0629 \u0627\u0644\u0633\u0643\u0646\u064A',
    'Located in Al-Rakah, Khobar. 3 min to IAU, 3 min to Al-Mana College, 10 min to Al-Yamamah University. Quiet residential neighborhood.',
    E'\u062D\u064A \u0627\u0644\u0631\u0627\u0643\u0629 \u0628\u0627\u0644\u062E\u0628\u0631 - 3 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646\u060C 3 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u0643\u0644\u064A\u0629 \u0627\u0644\u0645\u0627\u0646\u0639\u060C 10 \u062F\u0642\u0627\u0626\u0642 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u064A\u0645\u0627\u0645\u0629. \u062D\u064A \u0633\u0643\u0646\u064A \u0647\u0627\u062F\u0626.',
    NULL,
    'https://maps.app.goo.gl/Vis5Dq8qaAwiQx4A8?g_st=ic',
    '[{"name_en": "IAU", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Al-Mana College", "name_ar": "\u0643\u0644\u064A\u0629 \u0627\u0644\u0645\u0627\u0646\u0639", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Al-Yamamah University", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u064A\u0645\u0627\u0645\u0629", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 3
  ),

  -- 4. Dammam - Al-Safa (slug: dammam-alaziziah)
  (
    '00000000-0000-0000-0000-000000000004',
    'dammam-alaziziah',
    'Dammam', E'\u0627\u0644\u062F\u0645\u0627\u0645',
    'Al-Safa', E'\u0627\u0644\u0635\u0641\u0627',
    'Located in Al-Safa district, Dammam. 10 min walk to Dareen Mall. Near IAU Rayyan, Al-Ghad College, and Dammam Central Hospital.',
    E'\u062D\u064A \u0627\u0644\u0635\u0641\u0627 \u0628\u0627\u0644\u062F\u0645\u0627\u0645 - 10 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A \u0625\u0644\u0649 \u062F\u0627\u0631\u064A\u0646 \u0645\u0648\u0644. \u0642\u0631\u064A\u0628 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 \u0641\u0631\u0639 \u0627\u0644\u0631\u064A\u0627\u0646 \u0648\u0643\u0644\u064A\u0629 \u0627\u0644\u063A\u062F \u0648\u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0628\u0627\u0644\u062F\u0645\u0627\u0645.',
    NULL,
    'https://maps.app.goo.gl/BzvKVyG8oigUbHr87?g_st=ic',
    '[{"name_en": "Dareen Mall", "name_ar": "\u062F\u0627\u0631\u064A\u0646 \u0645\u0648\u0644", "distance_en": "10 min walk", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A"}, {"name_en": "IAU Rayyan", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0625\u0645\u0627\u0645 \u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646 - \u0627\u0644\u0631\u064A\u0627\u0646", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Al-Ghad College", "name_ar": "\u0643\u0644\u064A\u0629 \u0627\u0644\u063A\u062F", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Dammam Central Hospital", "name_ar": "\u0627\u0644\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0628\u0627\u0644\u062F\u0645\u0627\u0645", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}, {"name_en": "Al-Asala & Batterjee", "name_ar": "\u0627\u0644\u0623\u0635\u0627\u0644\u0629 \u0648\u0628\u062A\u0631\u062C\u064A", "distance_en": "17 minutes", "distance_ar": "17 \u062F\u0642\u064A\u0642\u0629"}]'::jsonb,
    true, false, 4
  ),

  -- 5. Jubail - Jalmudah
  (
    '00000000-0000-0000-0000-000000000005',
    'jubail-jalmudah',
    'Jubail', E'\u0627\u0644\u062C\u0628\u064A\u0644 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629',
    'Jalmudah', E'\u062C\u0644\u0645\u0648\u062F\u0629',
    'Located in Jalmudah district, Jubail. 5 min walk to grocery center. Serves nearby colleges and hospitals.',
    E'\u062D\u064A \u062C\u0644\u0645\u0648\u062F\u0629 \u0628\u0627\u0644\u062C\u0628\u064A\u0644 \u0627\u0644\u0635\u0646\u0627\u0639\u064A\u0629 - 5 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A \u0625\u0644\u0649 \u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u0627\u062A. \u064A\u062E\u062F\u0645 \u0627\u0644\u0643\u0644\u064A\u0627\u062A \u0648\u0627\u0644\u0645\u0633\u062A\u0634\u0641\u064A\u0627\u062A \u0627\u0644\u0642\u0631\u064A\u0628\u0629.',
    NULL,
    'https://maps.app.goo.gl/3W6RL75MdUuXzAfn8?g_st=ic',
    '[{"name_en": "Grocery Center", "name_ar": "\u0645\u0631\u0643\u0632 \u0627\u0644\u062A\u0645\u0648\u064A\u0646\u0627\u062A", "distance_en": "5 min walk", "distance_ar": "5 \u062F\u0642\u0627\u0626\u0642 \u0645\u0634\u064A"}, {"name_en": "Colleges & Hospitals", "name_ar": "\u0643\u0644\u064A\u0627\u062A \u0648\u0645\u0633\u062A\u0634\u0641\u064A\u0627\u062A", "distance_en": "Nearby", "distance_ar": "\u0642\u0631\u064A\u0628"}]'::jsonb,
    true, false, 5
  ),

  -- 6. Riyadh - Al-Yarmouk 1
  (
    '00000000-0000-0000-0000-000000000006',
    'riyadh-alyarmouk-1',
    'Riyadh', E'\u0627\u0644\u0631\u064A\u0627\u0636',
    'Al-Yarmouk', E'\u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0661',
    'Located in Al-Yarmouk neighborhood in Riyadh, a well-established residential area with excellent facilities.',
    E'\u062D\u064A \u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0627\u0644\u0631\u0627\u0642\u064A \u0628\u0627\u0644\u0631\u064A\u0627\u0636 - \u0645\u0646\u0637\u0642\u0629 \u0633\u0643\u0646\u064A\u0629 \u0622\u0645\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u0639 \u0645\u0631\u0627\u0641\u0642 \u0645\u0645\u062A\u0627\u0632\u0629. \u0645\u0648\u0642\u0639 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u062C\u0627\u0645\u0639\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A.',
    NULL,
    'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic',
    '[{"name_en": "Metro Station", "name_ar": "\u0645\u062D\u0637\u0629 \u0627\u0644\u0645\u064A\u062A\u0631\u0648", "distance_en": "8 minutes", "distance_ar": "8 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Riyadh Park Mall", "name_ar": "\u0627\u0644\u0631\u064A\u0627\u0636 \u0628\u0627\u0631\u0643 \u0645\u0648\u0644", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 6
  ),

  -- 7. Riyadh - Al-Yarmouk 2
  (
    '00000000-0000-0000-0000-000000000007',
    'riyadh-alyarmouk-2',
    'Riyadh', E'\u0627\u0644\u0631\u064A\u0627\u0636',
    'Al-Yarmouk', E'\u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0662',
    'Coming soon - Located in Al-Yarmouk neighborhood in Riyadh, a well-established residential area with excellent facilities.',
    E'\u0642\u0631\u064A\u0628\u0627\u064B - \u062D\u064A \u0627\u0644\u064A\u0631\u0645\u0648\u0643 \u0627\u0644\u0631\u0627\u0642\u064A \u0628\u0627\u0644\u0631\u064A\u0627\u0636 - \u0645\u0646\u0637\u0642\u0629 \u0633\u0643\u0646\u064A\u0629 \u0622\u0645\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u0639 \u0645\u0631\u0627\u0641\u0642 \u0645\u0645\u062A\u0627\u0632\u0629. \u0645\u0648\u0642\u0639 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A \u0642\u0631\u064A\u0628 \u0645\u0646 \u0627\u0644\u062C\u0627\u0645\u0639\u0627\u062A \u0648\u0627\u0644\u062E\u062F\u0645\u0627\u062A.',
    NULL,
    'https://maps.app.goo.gl/wFivqUUKo3YG91QB6?g_st=ic',
    '[{"name_en": "Metro Station", "name_ar": "\u0645\u062D\u0637\u0629 \u0627\u0644\u0645\u064A\u062A\u0631\u0648", "distance_en": "8 minutes", "distance_ar": "8 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Riyadh Park Mall", "name_ar": "\u0627\u0644\u0631\u064A\u0627\u0636 \u0628\u0627\u0631\u0643 \u0645\u0648\u0644", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 7
  ),

  -- 8. Riyadh - Al-Aridh
  (
    '00000000-0000-0000-0000-000000000008',
    'riyadh-alaridh',
    'Riyadh', E'\u0627\u0644\u0631\u064A\u0627\u0636',
    'Al-Aridh', E'\u0627\u0644\u0639\u0627\u0631\u0636',
    'Located in one of the finest neighborhoods in Riyadh, near King Salman Road and Abu Bakr Al-Siddiq Road.',
    E'\u062D\u064A \u0627\u0644\u0639\u0627\u0631\u0636 \u0627\u0644\u0631\u0627\u0642\u064A \u062C\u062F\u0627\u064B \u0628\u0627\u0644\u0631\u064A\u0627\u0636 - \u0623\u062D\u062F \u0623\u0631\u0642\u0649 \u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0633\u0643\u0646\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u0645\u0644\u0643\u0629. \u0628\u064A\u0626\u0629 \u0622\u0645\u0646\u0629 \u0645\u062D\u0627\u0641\u0638\u0629 \u0645\u0639 \u062E\u062F\u0645\u0627\u062A \u0639\u0627\u0644\u064A\u0629 \u0627\u0644\u062C\u0648\u062F\u0629 \u0648\u0642\u0631\u064A\u0628 \u0645\u0646 \u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0623\u0645\u064A\u0631\u0629 \u0646\u0648\u0631\u0629.',
    NULL,
    'https://maps.app.goo.gl/a28rhz9mh7RENndr6?g_st=ic',
    '[{"name_en": "SAB Metro Station", "name_ar": "\u0645\u062D\u0637\u0629 \u0645\u064A\u062A\u0631\u0648 \u0633\u0627\u0628", "distance_en": "10 minutes", "distance_ar": "10 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Princess Nourah University", "name_ar": "\u062C\u0627\u0645\u0639\u0629 \u0627\u0644\u0623\u0645\u064A\u0631\u0629 \u0646\u0648\u0631\u0629", "distance_en": "15 minutes", "distance_ar": "15 \u062F\u0642\u064A\u0642\u0629"}, {"name_en": "Dallah Hospital (Al-Aridh)", "name_ar": "\u0645\u0633\u062A\u0634\u0641\u0649 \u062F\u0644\u0629 (\u0627\u0644\u0639\u0627\u0631\u0636)", "distance_en": "3 minutes", "distance_ar": "3 \u062F\u0642\u0627\u0626\u0642"}, {"name_en": "Al-Habib Clinics (Al-Narjis)", "name_ar": "\u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u062D\u0628\u064A\u0628 (\u0627\u0644\u0646\u0631\u062C\u0633)", "distance_en": "5 minutes", "distance_ar": "5 \u062F\u0642\u0627\u0626\u0642"}]'::jsonb,
    true, false, 8
  );

-- ============================================================================
-- ROOMS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Building 1: khobar-alolaya (00000000-0000-0000-0000-000000000001)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'triple',  'private', 1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'double',  'shared',  1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'double',  'private', 1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'double',  'master',  1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'single',  'shared',  2199, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'single',  'private', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'single',  'master',  2899, NULL);

-- ---------------------------------------------------------------------------
-- Building 2: khobar-alandalus (00000000-0000-0000-0000-000000000002)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'triple',  'private',           1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'triple',  'private-balcony',   1200, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'double',  'shared',            1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'double',  'private',           1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'double',  'master',            1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'shared-b',          1999, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'shared-a',          2299, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'shared-balcony',    2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'private',           2900, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'master',            3050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'single',  'master-balcony',    3250, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'suite',   'private',           3400, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'suite',   'private-two-rooms', 3999, NULL);

-- ---------------------------------------------------------------------------
-- Building 3: khobar-alrakah (00000000-0000-0000-0000-000000000003)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'triple',  'private',  1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'triple',  'suite',    1200, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'shared-b', 1350, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'shared-a', 1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'master-b', 1599, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'master-a', 1700, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'double',  'suite',    2199, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'single',  'shared-b', 1999, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'single',  'shared-a', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'single',  'master',   2899, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'suite',   'private',  3400, NULL);

-- ---------------------------------------------------------------------------
-- Building 4: dammam-alaziziah (00000000-0000-0000-0000-000000000004)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'triple',  'private', 1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'double',  'private', 1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'double',  'master',  1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'single',  'private', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'single',  'master',  2699, NULL);

-- ---------------------------------------------------------------------------
-- Building 5: jubail-jalmudah (00000000-0000-0000-0000-000000000005)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'triple',  'private', 1050, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'double',  'shared',  1550, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'double',  'private', 1699, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'double',  'master',  1850, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'single',  'shared',  1999, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'single',  'private', 2499, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000005', 'single',  'master',  2899, NULL);

-- ---------------------------------------------------------------------------
-- Building 6: riyadh-alyarmouk-1 (00000000-0000-0000-0000-000000000006)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'triple',  'private',         2000, 1750),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'double',  'shared',          2800, 2450),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'double',  'private',         2900, 2550),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'double',  'master',          3100, 2700),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'shared',          4400, 3850),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'shared-balcony',  4550, 3950),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'private',         4600, 4050),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'private-balcony', 4750, 4150),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'single',  'master',          4900, 4300),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000006', 'suite',   'private',         5500, 4800);

-- ---------------------------------------------------------------------------
-- Building 7: riyadh-alyarmouk-2 (00000000-0000-0000-0000-000000000007)
-- Same room types and prices as riyadh-alyarmouk-1
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'triple',  'private',         2000, 1750),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'double',  'shared',          2800, 2450),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'double',  'private',         2900, 2550),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'double',  'master',          3100, 2700),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'shared',          4400, 3850),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'shared-balcony',  4550, 3950),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'private',         4600, 4050),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'private-balcony', 4750, 4150),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'single',  'master',          4900, 4300),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000007', 'suite',   'private',         5500, 4800);

-- ---------------------------------------------------------------------------
-- Building 8: riyadh-alaridh (00000000-0000-0000-0000-000000000008)
-- ---------------------------------------------------------------------------
INSERT INTO rooms (id, building_id, room_type, bathroom_type, monthly_price, discounted_price) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'triple',  'private', 1898, 1650),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'double',  'shared',  2645, 2290),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'double',  'private', 2760, 2390),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'double',  'master',  2818, 2490),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'single',  'shared',  4255, 3700),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'single',  'private', 4485, 3900),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'single',  'master',  4700, 3950),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000008', 'suite',   'private', 5500, 4800);
