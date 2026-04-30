// Migration 028's backfill and resolveDefaultApartmentForFloor name auto-
// generated apartments `F{floor}-DEFAULT` (e.g. F0-DEFAULT, F2-DEFAULT,
// F-1-DEFAULT for basements). UI surfaces should hide these placeholder
// names — they signal "admin hasn't split this floor into real apartments
// yet" — and fall back to a Floor N label instead.
const AUTO_NAME_RE = /^F-?\d+-DEFAULT$/;

export function isAutoApartmentNumber(apartmentNumber: string | null | undefined): boolean {
  if (!apartmentNumber) return false;
  return AUTO_NAME_RE.test(apartmentNumber);
}
