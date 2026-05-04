// Parse the free-text supervisor comment column (col 13) into structured fields.
//
// Real samples we need to handle:
//   "الدخول بتاريخ 30-9-2025, شقه 504, غرفه 3, ماستر"
//   "الدخول تاريخ 14 فبراير 2026 - شقه 27 غرفه 3 - ثنائي مشترك"
//   "ش9 غ2 ثلاثيه"
//   "ش 24 غ4 ثلاثية"
//   "ش12 غ1 ثنائي خاص"
//   "شقه704 غرفه 3"
//   "ش34غ2"
//   "شقة B6 غرفة 1"
//   "9-سبتمبر-2025 ش 24 غ4 ثلاثية"
//   "11-يناير-2026 ش403 غ 4احادي ماستر"
//   "26-7-2025 ش37 غ4 احادي ماستر"
//   "الدخول بتاريخ 2020, شقه 11, غرفه1, احادي ماستر"
//   "شقه 506 , غرفه 3 , احادي مشترك"
//
// Returns { apartment, room, checkInDate, unitTypeHint, confidence, raw } where
// any field can be null. confidence is 'high' if both apt+room parsed, else
// 'medium' if one parsed, else 'low'.

const ARABIC_MONTHS = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'إبريل': 4, 'ابريل': 4, 'أبريل': 4,
  'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'اغسطس': 8, 'آب': 8,
  'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
};

function pad(n) { return String(n).padStart(2, '0'); }

function tryParseDate(s) {
  if (!s) return null;
  s = s.trim();

  // 30-9-2025  or  30/9/2025  or  2025-9-30  or  2025/9/30
  let m = s.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
  if (m) {
    let a = +m[1], b = +m[2], c = +m[3];
    let y, mo, d;
    if (a > 31) {                  // YYYY/MM/DD
      y = a; mo = b; d = c;
    } else if (c > 31) {           // DD/MM/YYYY
      d = a; mo = b; y = c;
    }
    if (y && mo && d && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2015 && y <= 2030) {
      return `${y}-${pad(mo)}-${pad(d)}`;
    }
  }

  // "9-سبتمبر-2025"  or  "9 سبتمبر 2025"
  m = s.match(/(\d{1,2})[\s\-]([^\s\-\d]+)[\s\-](\d{4})/);
  if (m) {
    const d = +m[1];
    const mo = ARABIC_MONTHS[m[2]];
    const y = +m[3];
    if (mo && d >= 1 && d <= 31 && y >= 2015 && y <= 2030) {
      return `${y}-${pad(mo)}-${pad(d)}`;
    }
  }

  // "ديسمبر 2024" — month + year only, default to day 1
  m = s.match(/([^\s\d]+)\s+(\d{4})/);
  if (m) {
    const mo = ARABIC_MONTHS[m[1]];
    const y = +m[2];
    if (mo && y >= 2015 && y <= 2030) {
      return `${y}-${pad(mo)}-01`;
    }
  }

  return null;
}

export function parseSupervisorComment(rawComment) {
  if (!rawComment) return null;
  const raw = rawComment.trim();
  if (!raw) return null;

  // Apartment: حقن "شقه" / "شقة" / "ش" + space-or-direct + (alphanumeric).
  // We match "ش" only when followed by a digit or capital letter to avoid
  // grabbing other ش-prefixed words. Apartment may be "B6", "504", "33", etc.
  let apartment = null;
  // long forms first
  let m = raw.match(/شق[هة]\s*([A-Za-z0-9٠-٩]+)/);
  if (m) {
    apartment = m[1];
  } else {
    // short form: "ش" followed by alphanumeric (not Arabic letter)
    m = raw.match(/(?:^|\s)ش\s*([A-Za-z0-9٠-٩]+)/);
    if (m) apartment = m[1];
  }

  // Room: "غرفه" / "غرفة" / "غ" + space-or-direct + digit.
  let room = null;
  m = raw.match(/غرف[هة]\s*([0-9٠-٩]+)/);
  if (m) {
    room = m[1];
  } else {
    m = raw.match(/(?:^|\s)غ\s*([0-9٠-٩]+)/);
    if (m) room = m[1];
  }

  // Check-in date: try to extract from the leading portion of the string.
  // Look for explicit "الدخول بتاريخ" / "الدخول تاريخ" / "دخول تاريخ" prefix,
  // else accept any date pattern at the start.
  const checkInDate = tryParseDate(raw);

  // Unit-type hint: anything trailing the room number (often the "ثنائي مشترك"
  // or "احادي ماستر" descriptor). Just capture from after the room match.
  let unitTypeHint = null;
  if (room) {
    const idx = raw.lastIndexOf(room);
    if (idx >= 0) {
      let tail = raw.slice(idx + room.length).trim();
      // Strip leading punctuation
      tail = tail.replace(/^[\s,،\-\(\)]+/, '').trim();
      if (tail) unitTypeHint = tail.slice(0, 50);
    }
  }

  // Convert Arabic-Indic digits to ASCII for apartment/room
  function toAscii(s) {
    if (!s) return s;
    return s.replace(/[٠-٩]/g, (d) => '0123456789'[d.charCodeAt(0) - 0x0660]);
  }
  apartment = toAscii(apartment);
  room = toAscii(room);

  let confidence = 'low';
  if (apartment && room) confidence = 'high';
  else if (apartment || room) confidence = 'medium';

  return { apartment, room, checkInDate, unitTypeHint, confidence, raw };
}
