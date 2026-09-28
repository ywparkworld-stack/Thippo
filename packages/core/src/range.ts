/**
 * PostgreSQL の tstzrange の文字列と、ISO 8601 の開始・終了の組を相互に変換する。
 * 例: '["2026-10-01 01:00:00+00","2026-10-01 02:00:00+00")'
 */
export function parseTstzRange(range: string): { start: string; end: string } {
  const m = /^\[\s*"?([^",]+?)"?\s*,\s*"?([^")]+?)"?\s*\)$/.exec(range.trim());
  if (!m) throw new RangeError(`unsupported range: ${range}`);
  return { start: parsePgTimestamp(m[1]!), end: parsePgTimestamp(m[2]!) };
}

function parsePgTimestamp(value: string): string {
  // "2026-10-01 01:00:00+00" → "2026-10-01T01:00:00+00:00"
  const iso = value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new RangeError(`invalid timestamp: ${value}`);
  return d.toISOString();
}

/** 半開区間 [start, end) の tstzrange の文字列 */
export function toTstzRange(start: string | Date, end: string | Date): string {
  return `[${new Date(start).toISOString()},${new Date(end).toISOString()})`;
}
