// Minimal RFC 4180 CSV parser. Handles:
//   - quoted fields with embedded commas
//   - quoted fields with embedded newlines (CR/LF/CRLF)
//   - escaped double-quotes ("")
//   - trailing CRLF/LF/no-newline
// Returns an array of arrays (rows of fields). Field whitespace is preserved.
//
// We hand-roll instead of pulling in papaparse so the importer has zero deps —
// this CSV is irreplaceable PII and the fewer moving parts, the better.

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          // escaped quote
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    // not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      // CRLF or bare CR — both end the row
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      if (i < n && text[i] === '\n') i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // flush final field/row (only if there's content — avoid trailing empty row)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
