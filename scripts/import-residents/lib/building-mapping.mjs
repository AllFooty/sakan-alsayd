// Map a raw CSV building string (col 15 "الفرع المطلوب") to a building UUID
// in our DB.
//
// Building UUIDs are stable (defined in seed.sql + migration 031). Hardcoding
// them here is intentional — this mapping is the single source of truth for
// CSV→DB resolution and we don't want it spread across config files.
//
// User decisions captured here (from chat 2026-05-04):
//   - Olaya / Aridh / Rakah-complex with no "1/2" disambiguation → SKIP
//     (return null + reason). The original Arabic string is stashed in the
//     resident's notes so managers can reassign.
//   - All Yarmouk variants → riyadh-alyarmouk-1 (we keep -2 in DB for future
//     use but route nothing to it from this import).
//   - Explicit "Rakah 1" / "Rakah 2" → respective buildings.

export const BUILDING_IDS = {
  KHOBAR_ALOLAYA:    '00000000-0000-0000-0000-000000000001',
  KHOBAR_ALANDALUS:  '00000000-0000-0000-0000-000000000002',
  KHOBAR_ALRAKAH:    '00000000-0000-0000-0000-000000000003', // Rakah 1
  DAMMAM_ALAZIZIAH:  '00000000-0000-0000-0000-000000000004', // labeled Al-Safa in DB
  JUBAIL_JALMUDAH:   '00000000-0000-0000-0000-000000000005',
  RIYADH_ALYARMOUK1: '00000000-0000-0000-0000-000000000006',
  RIYADH_ALYARMOUK2: '00000000-0000-0000-0000-000000000007',
  RIYADH_ALARIDH:    '00000000-0000-0000-0000-000000000008', // Aridh 1
  KHOBAR_ALOLAYA2:   '00000000-0000-0000-0000-000000000009',
  KHOBAR_ALRAKAH2:   '00000000-0000-0000-0000-000000000010',
  RIYADH_ALARIDH2:   '00000000-0000-0000-0000-000000000011',
};

// Decision returned for every CSV building string.
//   { buildingId: '<uuid>' | null, reason: '<short tag>', original: '<csv string>' }
//
// reason values:
//   'matched'         — string mapped unambiguously
//   'ambiguous_olaya' — Olaya without 1/2; manager must assign
//   'ambiguous_aridh' — Aridh without 1/2
//   'ambiguous_rakah' — Rakah complex (could be 1 or 2)
//   'transfer_note'   — string is a transfer annotation, not a building
//   'unmapped'        — string isn't recognised at all
export function mapBuilding(rawBuildingString) {
  const original = (rawBuildingString || '').trim();
  if (!original) {
    return { buildingId: null, reason: 'empty', original };
  }

  // Normalize: collapse whitespace, drop diacritics-ish noise, lowercase Latin.
  const norm = original
    .replace(/\s+/g, ' ')
    .trim();

  // Transfer notes — appear as building values but mean "moved to X".
  // We treat as ambiguous and require manager review (preserves the resident
  // record but doesn't guess wrong).
  if (norm.includes('تم النقل')) {
    return { buildingId: null, reason: 'transfer_note', original };
  }

  // Andalus — both variants map to the same single building.
  // ("الخبر - حي الاندلس", "الخبر - حي الاندلس ( ... )", "الاندلس - الخبر",
  //  "الاندلس")
  if (norm.includes('الاندلس') || norm.includes('الأندلس')) {
    return { buildingId: BUILDING_IDS.KHOBAR_ALANDALUS, reason: 'matched', original };
  }

  // Jubail / Jalmudah — single building.
  if (norm.includes('جلمودة') || norm.includes('الجبيل')) {
    return { buildingId: BUILDING_IDS.JUBAIL_JALMUDAH, reason: 'matched', original };
  }

  // Dammam Al-Safa — single building (legacy slug "alaziziah").
  if (norm.includes('الصفا') || norm.includes('الدمام')) {
    return { buildingId: BUILDING_IDS.DAMMAM_ALAZIZIAH, reason: 'matched', original };
  }

  // Yarmouk — collapse all to building 1 (per user direction; only one is in
  // operational use).
  if (norm.includes('اليرموك')) {
    return { buildingId: BUILDING_IDS.RIYADH_ALYARMOUK1, reason: 'matched', original };
  }

  // Rakah — explicit "1" or "2" disambiguation, else ambiguous.
  // Examples we expect:
  //   "الراكة 1 - الخبر ( ... )"     → rakah-1
  //   "الراكة 2 - الخبر ( ... )"     → rakah-2
  //   "الخبر - الراكة 1 ( ... )"     → rakah-1
  //   "الخبر - الراكة 2 ( ... )"     → rakah-2
  //   "راكه 1"                        → rakah-1 (alt spelling)
  //   "راكه 2"                        → rakah-2
  //   "الخبر - مجمع الراكة السكني …"  → ambiguous (could be either)
  if (norm.includes('راكة') || norm.includes('راكه')) {
    if (/الراكة\s*1|الراكه\s*1|راكه\s*1/.test(norm)) {
      return { buildingId: BUILDING_IDS.KHOBAR_ALRAKAH, reason: 'matched', original };
    }
    if (/الراكة\s*2|الراكه\s*2|راكه\s*2/.test(norm)) {
      return { buildingId: BUILDING_IDS.KHOBAR_ALRAKAH2, reason: 'matched', original };
    }
    // "مجمع الراكة" or unqualified "الراكة" → ambiguous (per user decision)
    return { buildingId: null, reason: 'ambiguous_rakah', original };
  }

  // Aridh — no "1/2" appears in CSV variants; per user decision, all ambiguous.
  if (norm.includes('العارض')) {
    return { buildingId: null, reason: 'ambiguous_aridh', original };
  }

  // Olaya — no "1/2" appears in CSV variants; per user decision, all ambiguous.
  // Match BOTH "العليا - الخبر" and "الخبر - العليا" forms.
  if (norm.includes('العليا')) {
    return { buildingId: null, reason: 'ambiguous_olaya', original };
  }

  // Anything else is a string we haven't seen — log it for manual review.
  return { buildingId: null, reason: 'unmapped', original };
}
