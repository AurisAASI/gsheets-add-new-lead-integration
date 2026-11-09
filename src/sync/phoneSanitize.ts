/**
 * Normalize a spreadsheet phone cell into a digit-friendly string for the API.
 * - Converts numeric cells (avoids scientific notation).
 * - Strips Meta-style prefixes like `p:` / `tel:`.
 * Does not apply DDD/country rules — the Lead Control API owns that.
 */
export function sanitizePhoneCell(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  let raw: string;
  if (typeof value === 'number' && Number.isFinite(value)) {
    raw = Number.isInteger(value) ?
      String(value) :
      // Large phones sometimes arrive as float; keep integer digits only.
      String(Math.trunc(value));
  } else {
    raw = String(value).trim();
  }

  // Scientific notation from Sheets (e.g. 5.511999999999e12)
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(raw)) {
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) {
      raw = String(Math.trunc(asNum));
    }
  }

  raw = raw.replace(/^(p:|tel:)/i, '').trim();
  return raw;
}
