import type { TBMTelemetry } from './telemetry'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Human-readable type of a value, distinguishing null / array / object. */
function describeType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Structural sanity check for an untrusted `/telemetry` response.
 *
 * It verifies the root fields, the blocks nested in `extra`, the arrays the UI
 * iterates over and the fields the watchdog depends on (`sample_index`,
 * `timestamp_unix_ms`). It deliberately does NOT validate every leaf value:
 * the goal is that a malformed response (e.g. an error body served with HTTP
 * 200) is treated as a failed fetch instead of crashing the render tree.
 *
 * Returns EVERY violation found (not just the first one), each one as
 * `"<path>: expected <type>, got <type>"`. An empty list means the payload is
 * valid. Pure function: it does not log; the caller decides what to do.
 */
export function getTelemetryIssues(value: unknown): string[] {
  if (!isRecord(value)) {
    return [`<root>: expected object, got ${describeType(value)}`]
  }

  const issues: string[] = []

  const expect = (
    container: Record<string, unknown>,
    path: string,
    key: string,
    type: 'number' | 'string' | 'boolean' | 'array' | 'object',
  ): unknown => {
    const field = container[key]
    const ok =
      type === 'array'
        ? Array.isArray(field)
        : type === 'object'
          ? isRecord(field)
          : typeof field === type
    if (!ok) {
      const label = key in container ? describeType(field) : 'missing'
      issues.push(`${path}${key}: expected ${type}, got ${label}`)
    }
    return field
  }

  expect(value, '', 'timestamp', 'number')
  expect(value, '', 'mining', 'boolean')

  if (!isRecord(value.extra)) {
    expect(value, '', 'extra', 'object')
    return issues
  }
  const extra = value.extra

  expect(extra, 'extra.', 'state', 'string')
  expect(extra, 'extra.', 'timestamp_iso', 'string')
  expect(extra, 'extra.', 'timestamp_unix_ms', 'number')
  expect(extra, 'extra.', 'sample_index', 'number')

  for (const block of [
    'cutterhead',
    'propulsion',
    'bladder',
    'steering',
    'navigation',
    'safety',
    'comms',
    'sim',
  ]) {
    expect(extra, 'extra.', block, 'object')
  }

  if (isRecord(extra.safety)) {
    const safety = extra.safety
    expect(safety, 'extra.safety.', 'active_interlocks', 'array')
    expect(safety, 'extra.safety.', 'interlocks', 'object')
    const safeRestart = expect(safety, 'extra.safety.', 'safe_restart', 'object')
    if (isRecord(safeRestart)) {
      const path = 'extra.safety.safe_restart.'
      // Optional: the backend omits these keys (or sends null) when there is
      // no re-arm in progress (e.g. IDLE). Only validate them when present.
      for (const key of ['sequence', 'completed', 'pending']) {
        if (safeRestart[key] != null) {
          expect(safeRestart, path, key, 'array')
        }
      }
    }
  }

  return issues
}

export function isTBMTelemetry(value: unknown): value is TBMTelemetry {
  return getTelemetryIssues(value).length === 0
}
