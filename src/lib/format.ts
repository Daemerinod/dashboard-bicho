/** Shown whenever a value is unavailable. Never render a missing value as 0. */
export const NO_VALUE = '---'

/**
 * Locale-neutral fixed-point formatting (no thousands separators, '.' decimal)
 * so values read the same on every operator station.
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NO_VALUE
  }
  const text = value.toFixed(decimals)
  // Avoid "-0.00" when a tiny negative value rounds to zero.
  return Number(text) === 0 ? text.replace('-', '') : text
}
