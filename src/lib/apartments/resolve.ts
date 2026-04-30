import type { SupabaseClient } from '@supabase/supabase-js';

// Resolve the default apartment for a given (building, floor). Used by the
// existing rooms POST/PATCH so callers that pre-date the apartments UI keep
// working: when a caller doesn't pass apartment_id, we route the room into
// the auto-created `F{n}-DEFAULT` apartment for its floor — same one the
// migration 028 backfill made. If a building somehow lacks one (new floor
// added after backfill), we create it on the fly so the room insert/update
// can succeed.
//
// Slice 2 will replace this with explicit apartment selection in the
// RoomForm, at which point this helper's auto-create branch becomes a
// safety net rather than the primary path.

const DEFAULT_NAME = (floor: number) => `F${floor}-DEFAULT`;

export async function resolveDefaultApartmentForFloor(
  supabase: SupabaseClient,
  buildingId: string,
  floor: number
): Promise<{ apartmentId: string } | { error: string }> {
  const apartment_number = DEFAULT_NAME(floor);

  const { data: existing, error: lookupErr } = await supabase
    .from('apartments')
    .select('id')
    .eq('building_id', buildingId)
    .eq('apartment_number', apartment_number)
    .maybeSingle<{ id: string }>();

  if (lookupErr) {
    console.error('Default apartment lookup failed:', lookupErr);
    return { error: 'apartmentLookupFailed' };
  }
  if (existing) return { apartmentId: existing.id };

  const { data: created, error: insertErr } = await supabase
    .from('apartments')
    .insert({
      building_id: buildingId,
      apartment_number,
      floor,
      description_en: `Default apartment auto-created for floor ${floor}`,
      description_ar: `شقة افتراضية تم إنشاؤها تلقائيا للطابق ${floor}`,
      sort_order: floor,
    })
    .select('id')
    .single();

  if (insertErr) {
    // Race: another caller created the same default apartment between our
    // SELECT and INSERT. Retry the lookup once.
    if ((insertErr as { code?: string }).code === '23505') {
      const { data: retry } = await supabase
        .from('apartments')
        .select('id')
        .eq('building_id', buildingId)
        .eq('apartment_number', apartment_number)
        .maybeSingle<{ id: string }>();
      if (retry) return { apartmentId: retry.id };
    }
    console.error('Default apartment create failed:', insertErr);
    return { error: 'apartmentCreateFailed' };
  }

  return { apartmentId: created.id };
}
