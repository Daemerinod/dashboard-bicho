import type { MachineState } from '../domain/telemetry'

/**
 * Semantic severity -> color mapping (single source of truth).
 *   ok      emerald-500  READY / MINING / OK
 *   warn    amber-500    warnings
 *   alarm   red-500      FAULT / E-STOP / alarms
 *   neutral zinc         informational / inactive
 * Class names are written out in full so Tailwind can detect them.
 */
export type Severity = 'neutral' | 'ok' | 'warn' | 'alarm'

export const TEXT_CLASS: Record<Severity, string> = {
  neutral: 'text-zinc-100',
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  alarm: 'text-red-500',
}

export const OUTLINE_CLASS: Record<Severity, string> = {
  neutral: 'border-zinc-600 text-zinc-300',
  ok: 'border-emerald-500 text-emerald-500',
  warn: 'border-amber-500 text-amber-500',
  alarm: 'border-red-500 text-red-500',
}

export const SOLID_CLASS: Record<Severity, string> = {
  neutral: 'border-zinc-400 bg-zinc-400 text-black',
  ok: 'border-emerald-500 bg-emerald-500 text-black',
  warn: 'border-amber-500 bg-amber-500 text-black',
  alarm: 'border-red-500 bg-red-500 text-black',
}

const STATE_SEVERITY: Record<MachineState, Severity> = {
  'POWER OFF': 'neutral',
  'E-STOPPED': 'alarm',
  IDLE: 'neutral',
  READY: 'ok',
  MINING: 'ok',
  FAULT: 'alarm',
}

/** Unknown states (backend newer than this UI) surface as a warning. */
export function stateSeverity(state: string | undefined): Severity {
  if (state === undefined) return 'neutral'
  return Object.hasOwn(STATE_SEVERITY, state)
    ? STATE_SEVERITY[state as MachineState]
    : 'warn'
}

/**
 * Fraction of a limit at which a reading starts to show as a warning.
 * The payload only carries hard limits (no warning thresholds), so this is a
 * UI-side convention: tune it here.
 */
export const WARN_FRACTION = 0.8

/**
 * Severity of a reading against the limit reported by the machine itself.
 * Reaching the limit is an alarm (that is where interlocks trip).
 */
export function limitSeverity(
  value: number | null | undefined,
  limit: number | null | undefined,
): Severity {
  if (
    value === null ||
    value === undefined ||
    limit === null ||
    limit === undefined ||
    !Number.isFinite(value) ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return 'neutral'
  }
  const ratio = Math.abs(value) / limit
  if (ratio >= 1) return 'alarm'
  if (ratio >= WARN_FRACTION) return 'warn'
  return 'neutral'
}
