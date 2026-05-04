-- Migration 031 — additional buildings to match production reality.
--
-- The original seed (8 buildings) reflected a snapshot. Real-world operations
-- run additional sister buildings in three neighborhoods:
--   - Khobar / Al-Olaya: 2 buildings (DB had 1)
--   - Khobar / Al-Rakah: 2 buildings (DB had 1)
--   - Riyadh / Al-Aridh: 2 buildings (DB had 1)
--
-- This migration creates the missing 2nd buildings. They are inserted with:
--   is_active     = false  (hidden from public site until descriptions/images added)
--   is_placeholder = true   (admin UI displays "coming soon" badge)
--
-- Once content is filled in, an admin flips is_active=true via the buildings
-- edit screen — no further migration needed.
--
-- These rows are required ahead of the 5,000-row resident import (the importer
-- routes "Rakah 2"-tagged CSV rows to khobar-alrakah-2). Missing target buildings
-- would cause the importer to drop those residents.

INSERT INTO buildings (
  id, slug,
  city_en, city_ar,
  neighborhood_en, neighborhood_ar,
  description_en, description_ar,
  cover_image, map_url, landmarks,
  is_active, is_placeholder, sort_order
)
VALUES
  (
    '00000000-0000-0000-0000-000000000009',
    'khobar-alolaya-2',
    'Khobar', E'الخبر',
    'Al-Olaya 2', E'العليا (الفرع الثاني)',
    'Second Al-Olaya building, Khobar. Details to be added.',
    E'الفرع الثاني في حي العليا بالخبر. التفاصيل ستُضاف لاحقاً.',
    NULL, NULL, '[]'::jsonb,
    false, true, 9
  ),
  (
    '00000000-0000-0000-0000-000000000010',
    'khobar-alrakah-2',
    'Khobar', E'الخبر',
    'Al-Rakah 2', E'الراكة (الفرع الثاني)',
    'Second Al-Rakah building, Khobar. Details to be added.',
    E'الفرع الثاني في حي الراكة بالخبر. التفاصيل ستُضاف لاحقاً.',
    NULL, NULL, '[]'::jsonb,
    false, true, 10
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    'riyadh-alaridh-2',
    'Riyadh', E'الرياض',
    'Al-Aridh 2', E'العارض (الفرع الثاني)',
    'Second Al-Aridh building, Riyadh. Details to be added.',
    E'الفرع الثاني في حي العارض بالرياض. التفاصيل ستُضاف لاحقاً.',
    NULL, NULL, '[]'::jsonb,
    false, true, 11
  )
ON CONFLICT (slug) DO NOTHING;
