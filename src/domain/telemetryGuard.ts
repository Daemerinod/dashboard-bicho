import type { TBMTelemetry } from './telemetry'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Structural sanity check for an untrusted `/telemetry` response.
 *
 * It verifies the root fields, the blocks nested in `extra`, the arrays the UI
 * iterates over and the fields the watchdog depends on (`sample_index`,
 * `timestamp_unix_ms`). It deliberately does NOT validate every leaf value:
 * the goal is that a malformed response (e.g. an error body served with HTTP
 * 200) is treated as a failed fetch instead of crashing the render tree.
 */
export function isTBMTelemetry(value: unknown): value is TBMTelemetry {
  if (!isRecord(value)) return false
  if (typeof value.timestamp !== 'number' || typeof value.mining !== 'boolean') {
    return false
  }

  const extra = value.extra
  if (!isRecord(extra)) return false
  if (
    typeof extra.state !== 'string' ||
    typeof extra.timestamp_iso !== 'string' ||
    typeof extra.timestamp_unix_ms !== 'number' ||
    typeof extra.sample_index !== 'number'
  ) {
    return false
  }

  const blocks = [
    extra.cutterhead,
    extra.propulsion,
    extra.bladder,
    extra.steering,
    extra.navigation,
    extra.safety,
    extra.comms,
    extra.sim,
  ]
  if (!blocks.every(isRecord)) return false

  const safety = extra.safety as Record<string, unknown>
  const safeRestart = safety.safe_restart
  return (
    Array.isArray(safety.active_interlocks) &&
    isRecord(safety.interlocks) &&
    isRecord(safeRestart) &&
    Array.isArray(safeRestart.sequence) &&
    Array.isArray(safeRestart.completed) &&
    Array.isArray(safeRestart.pending)
  )
}
