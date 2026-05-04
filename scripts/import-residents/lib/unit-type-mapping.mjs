// Map a CSV unit-type string (col 19 "نوع الوحدة السكنية المطلوبة") to our DB
// rooms enums: room_type, bathroom_type, capacity, occupancy_mode.
//
// Background (per CLAUDE.md project memory note `room_terminology`):
//   - room_type encodes BED COUNT: single | double | triple | suite
//   - occupancy_mode encodes RENTAL MODEL:
//       'private'  = the whole room rents as one unit (capacity = 1 *unit*)
//       'shared'   = each bed rents independently (capacity = bed count)
//   - bathroom_type encodes plumbing layout (shared / private / master / etc.)
//
// Linguistic conventions in the form data:
//   - Prefix "غرفة أحادية/ثنائية/ثلاثية" → whole-room rental → mode='private',
//     capacity matches bed count
//   - Bare "أحادي/ثنائي/ثلاثي" (no غرفة prefix) → bed-by-bed → mode='shared'
//   - "ماستر" inside the unit name → bathroom_type='master'
//   - "دورة مياه خاصة" → bathroom_type='private'
//   - "دورة مياه مشتركة" or "حمام مشترك" → bathroom_type='shared'
//   - "بالكونة" → balcony variant
//   - "جناح خاص" → room_type='suite'
//
// We return a partial spec; the importer fills in price + capacity defaults.
// `confidence` is one of: 'high' | 'medium' | 'low' — low-confidence mappings
// are flagged in the report so the user can spot-check before committing.

export function mapUnitType(rawUnitType) {
  const original = (rawUnitType || '').trim();
  if (!original) {
    return null;
  }
  const s = original;

  // Suite — most distinctive, check first.
  if (s.includes('جناح خاص') || s.includes('جناح')) {
    let capacity = 1;
    if (s.includes('ثنائي')) capacity = 2;
    if (s.includes('ثلاثي')) capacity = 3;
    return {
      room_type: 'suite',
      bathroom_type: 'suite',
      occupancy_mode: 'private',
      capacity,
      confidence: 'high',
      original,
    };
  }

  // Detect bed count + occupancy mode.
  // "غرفة <X>ية" → whole room → mode=private
  // bare "<X>ي" without "غرفة" → bed-by-bed → mode=shared
  let beds = null;
  let mode = null;
  if (/غرفة\s*أحادية/.test(s) || /غرفة\s*احادية/.test(s)) {
    beds = 1; mode = 'private';
  } else if (/غرفة\s*ثنائية/.test(s)) {
    beds = 2; mode = 'private';
  } else if (/غرفة\s*ثلاثية/.test(s)) {
    beds = 3; mode = 'private';
  } else if (/^أحادي|^احادي|\sأحادي|\sاحادي/.test(s)) {
    // bare bed-by-bed single — but a "single" in shared mode is unusual; the
    // schema's check constraint says single rooms can't be shared. We'll
    // downgrade to private mode in that case.
    beds = 1; mode = 'private';
  } else if (/^ثنائي|\sثنائي/.test(s)) {
    beds = 2; mode = 'shared';
  } else if (/^ثلاثي|\sثلاثي/.test(s)) {
    beds = 3; mode = 'shared';
  }

  if (!beds) {
    return {
      room_type: null,
      bathroom_type: null,
      occupancy_mode: null,
      capacity: null,
      confidence: 'low',
      original,
    };
  }

  const room_type = beds === 1 ? 'single' : beds === 2 ? 'double' : 'triple';

  // Detect bathroom type
  let bathroom_type = 'private'; // default
  let confidence = 'high';

  const hasBalcony = s.includes('بالكونة') || s.includes('بالكونه');
  const hasMaster = s.includes('ماستر');
  const hasPrivate = s.includes('دورة مياه خاصة') || s.includes('دورة مياه خاص') ||
                     s.includes('دورة مياه داخل الغرفة');
  const hasShared = s.includes('دورة مياه مشتركة') || s.includes('دورة مياه مشترك') ||
                    s.includes('حمام مشترك');

  if (hasMaster && hasBalcony) {
    bathroom_type = 'master-balcony';
  } else if (hasMaster) {
    bathroom_type = 'master';
  } else if (hasPrivate && hasBalcony) {
    bathroom_type = 'private-balcony';
  } else if (hasPrivate) {
    bathroom_type = 'private';
  } else if (hasShared && hasBalcony) {
    bathroom_type = 'shared-balcony';
  } else if (hasShared) {
    bathroom_type = 'shared';
  } else {
    confidence = 'low';
  }

  // Schema constraint: single beds cannot be shared mode.
  if (beds === 1 && mode === 'shared') mode = 'private';

  const capacity = mode === 'shared' ? beds : 1;

  return {
    room_type,
    bathroom_type,
    occupancy_mode: mode,
    capacity,
    confidence,
    original,
  };
}
